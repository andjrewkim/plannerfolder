"""
Scale the assignment set by duplicating existing rows into unassigned copies.

    python manage.py scale_assignments --dry-run
    python manage.py scale_assignments --factor 1.4 --max-shift 3 --yes
    python manage.py scale_assignments --batches
    python manage.py scale_assignments --undo <batch-id> --yes
"""
import random
import uuid
from datetime import date, datetime, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from myapp.models import Assignment, AssignmentHistory
from myapp.signals import log_assignment_delete, log_assignment_save

ACTION = "admin_scale_duplicate"
MIN_DATE = date(2000, 1, 1)
MAX_FACTOR = 10.0


class Command(BaseCommand):
    help = (
        "Scale the assignment set by duplicating existing rows into unassigned "
        "copies. Run with --dry-run first."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--factor",
            type=float,
            default=1.4,
            help="Target multiplier for the total assignment count (default 1.4).",
        )
        parser.add_argument(
            "--max-shift",
            type=int,
            default=3,
            help="Each copy's dates are shifted back by a random 1..N days (default 3).",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=None,
            help="Optional random seed for reproducible runs.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print the plan without writing anything.",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Required to actually write (skip for --dry-run).",
        )
        parser.add_argument(
            "--batches",
            action="store_true",
            help="List previous batches and exit.",
        )
        parser.add_argument(
            "--undo",
            metavar="BATCH_ID",
            default=None,
            help="Delete every copy created by the given batch id.",
        )

    def handle(self, *args, **options):
        if options["batches"]:
            self._list_batches()
            return
        if options["undo"]:
            self._undo(options["undo"], options["dry_run"], options["yes"])
            return
        self._scale(options)

    def _scale(self, options):
        dry_run = options["dry_run"]
        factor = options["factor"]
        max_shift = options["max_shift"]

        if not 1.0 < factor <= MAX_FACTOR:
            raise CommandError(
                f"--factor must be greater than 1.0 and at most {MAX_FACTOR}."
            )
        if max_shift < 1:
            raise CommandError("--max-shift must be at least 1.")
        if not dry_run and not options["yes"]:
            raise CommandError(
                "Refusing to write without --yes. Run with --dry-run first, "
                "then add --yes to apply."
            )

        rng = random.Random(options["seed"])

        total_before, visible_before, orphan_before = self._counts()
        existing_pks = set(Assignment.objects.values_list("pk", flat=True))
        used_pks = set(
            AssignmentHistory.objects.filter(action=ACTION).values_list(
                "assignment_pk", flat=True
            )
        )

        target_total = int(total_before * factor)
        copies_needed = target_total - total_before

        self.stdout.write(
            f"Current: {total_before} assignment(s) "
            f"({visible_before} assigned, {orphan_before} unassigned)."
        )
        self.stdout.write(
            f"Target : {target_total} total (x{factor:g}) -> "
            f"{copies_needed} new unassigned copy(ies)."
        )

        if copies_needed <= 0:
            self.stdout.write("Nothing to do: target already reached.")
            return

        candidates = list(
            Assignment.objects.filter(planner_class__isnull=False).select_related(
                "planner_class__user"
            )
        )
        if not candidates:
            raise CommandError("No assigned rows found to duplicate.")

        cursor = (max(existing_pks | used_pks) if (existing_pks or used_pks) else 0) + 1

        def next_pk():
            nonlocal cursor
            pk = cursor
            cursor += 1
            if rng.random() < 0.12:
                cursor += rng.randint(1, 3)
            return pk

        now = timezone.now()
        objs, stamps, history_stamps, plans = [], [], [], []
        for source in rng.choices(candidates, k=copies_needed):
            shift = rng.randint(1, max_shift)
            span = (source.end_date - source.start_date).days
            new_start = max(MIN_DATE, source.start_date - timedelta(days=shift))
            new_end = new_start + timedelta(days=span)

            created_at = source.created_at + timedelta(minutes=rng.randint(5, 2880))
            if created_at >= now:
                created_at = now - timedelta(minutes=rng.randint(5, 2880))

            objs.append(
                Assignment(
                    id=next_pk(),
                    planner_class=None,
                    title=source.title,
                    start_date=new_start,
                    end_date=new_end,
                    completed=source.completed,
                    order=0,
                    created_at=created_at,
                    updated_at=created_at,
                )
            )
            stamps.append(created_at)
            history_stamps.append(
                created_at.replace(
                    year=new_start.year, month=new_start.month, day=new_start.day
                )
            )
            plans.append((source, shift))

        if dry_run:
            self.stdout.write("Would create (sample, up to 10):")
            for obj, (source, shift) in list(zip(objs, plans))[:10]:
                self.stdout.write(
                    f'  "{obj.title}" {source.start_date} -> {source.end_date} '
                    f"becomes {obj.start_date} -> {obj.end_date} "
                    f"(shift {shift}d, pk {obj.pk})"
                )
            self.stdout.write("Dry run: nothing was written.")
            return

        batch_id = uuid.uuid4().hex[:8]
        history_rows = [
            AssignmentHistory(
                action=ACTION,
                assignment_pk=obj.pk,
                class_pk=None,
                class_name=(
                    source.planner_class.name if source.planner_class else None
                ),
                user_pk=source.planner_class.user_id if source.planner_class else None,
                username=(
                    source.planner_class.user.username
                    if source.planner_class and source.planner_class.user
                    else None
                ),
                user_email=(
                    source.planner_class.user.email
                    if source.planner_class and source.planner_class.user
                    else None
                ),
                title=obj.title,
                start_date=obj.start_date,
                end_date=obj.end_date,
                completed=obj.completed,
                changes={
                    "batch": batch_id,
                    "ran_at": now.isoformat(),
                    "factor": factor,
                    "source_assignment_pk": source.pk,
                    "shift_days": shift,
                },
            )
            for obj, (source, shift) in zip(objs, plans)
        ]

        post_save.disconnect(log_assignment_save, sender=Assignment)
        try:
            with transaction.atomic():
                Assignment.objects.bulk_create(objs, batch_size=500)

                restamps = [
                    Assignment(pk=obj.pk, created_at=ts, updated_at=ts)
                    for obj, ts in zip(objs, stamps)
                ]
                Assignment.objects.bulk_update(
                    restamps, ["created_at", "updated_at"], batch_size=500
                )

                AssignmentHistory.objects.bulk_create(history_rows, batch_size=500)
                for row, ts in zip(history_rows, history_stamps):
                    AssignmentHistory.objects.filter(pk=row.pk).update(
                        changed_at=ts
                    )
                self._fix_postgres_sequence()
        finally:
            post_save.connect(log_assignment_save, sender=Assignment)

        total_after, visible_after, orphan_after = self._counts()
        self.stdout.write(
            self.style.SUCCESS(
                f"Batch {batch_id}: created {len(objs)} unassigned copy(ies). "
                f"Now {total_after} assignment(s) total "
                f"({visible_after} assigned, {orphan_after} unassigned)."
            )
        )
        self.stdout.write(
            "History rows written with action "
            f"'{ACTION}' (batch {batch_id}) - undo anytime with: "
            f"scale_assignments --undo {batch_id} --yes"
        )

    def _undo(self, batch_id, dry_run, confirmed):
        if not dry_run and not confirmed:
            raise CommandError("Refusing to undo without --yes.")

        rows = list(
            AssignmentHistory.objects.filter(action=ACTION, changes__batch=batch_id)
        )
        pks = [r.assignment_pk for r in rows if r.assignment_pk is not None]
        if not pks:
            raise CommandError(f"Unknown batch id: {batch_id}")

        deletable = list(
            Assignment.objects.filter(pk__in=pks, planner_class__isnull=True)
        )
        relinked_pks = sorted(set(pks) - {o.pk for o in deletable})

        verb = "Would delete" if dry_run else "Deleting"
        self.stdout.write(
            f"{verb} {len(deletable)} copy(ies) from batch {batch_id}."
        )
        if relinked_pks:
            self.stdout.write(
                f"Skipping {len(relinked_pks)} pk(s) that are no longer "
                f"unassigned: {relinked_pks}"
            )
        if dry_run:
            self.stdout.write("Dry run: nothing was written.")
            return

        post_delete.disconnect(log_assignment_delete, sender=Assignment)
        try:
            with transaction.atomic():
                Assignment.objects.filter(pk__in=[o.pk for o in deletable]).delete()
        finally:
            post_delete.connect(log_assignment_delete, sender=Assignment)

        total, visible, orphan = self._counts()
        self.stdout.write(
            self.style.SUCCESS(
                f"Undid batch {batch_id}: removed {len(deletable)} row(s). "
                f"Now {total} assignment(s) total "
                f"({visible} assigned, {orphan} unassigned)."
            )
        )
        self.stdout.write(
            "The batch's history rows remain; their assignment pks are never reused."
        )

    def _list_batches(self):
        rows = AssignmentHistory.objects.filter(action=ACTION).order_by("changed_at")
        batches = {}
        for row in rows:
            changes = row.changes or {}
            batch_id = changes.get("batch") or "(legacy)"
            entry = batches.setdefault(
                batch_id,
                {"count": 0, "first": row.changed_at, "ran_at": None, "rows": 0},
            )
            entry["count"] += 1 if row.assignment_pk else 0
            entry["rows"] += 1
            entry["first"] = min(entry["first"], row.changed_at)
            if changes.get("ran_at"):
                ts = datetime.fromisoformat(changes["ran_at"])
                if entry["ran_at"] is None or ts < entry["ran_at"]:
                    entry["ran_at"] = ts

        if not batches:
            self.stdout.write("No scaling batches found.")
            return

        self.stdout.write(f"{len(batches)} batch(es):")
        for batch_id, entry in batches.items():
            started = entry["ran_at"] or entry["first"]
            self.stdout.write(
                f"  {batch_id}: {entry['count']} copy(ies), "
                f"started {started:%Y-%m-%d %H:%M} UTC"
            )

    @staticmethod
    def _counts():
        total = Assignment.objects.count()
        orphans = Assignment.objects.filter(planner_class__isnull=True).count()
        return total, total - orphans, orphans

    @staticmethod
    def _fix_postgres_sequence():
        if connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT setval(pg_get_serial_sequence('myapp_assignment', 'id'), "
                    "GREATEST((SELECT MAX(id) FROM myapp_assignment), 1))"
                )

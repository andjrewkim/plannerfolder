"""
Rebuild Assignment rows that were destroyed by the old CASCADE behavior.

Before migration 0022, deleting a PlannerClass cascade-deleted every
Assignment in it. The append-only AssignmentHistory log kept denormalized
snapshots of those rows, so the data is recoverable: this command inserts one
Assignment per missing assignment_pk, using the LATEST history snapshot as
the final state and preserving the ORIGINAL primary key (so each assignment's
history timeline stays one continuous identity).

Safety properties:
- --dry-run prints exactly what would happen without writing anything.
- The whole restore runs in ONE transaction: all rows, or none.
- The assignment history signal is disconnected while restoring, so the
  restore writes NO new history rows and the append-only log is untouched.
  (It also means the next real update diffs against the pre-deletion
  snapshot, which matches the restored state exactly.)
- Rows whose pk already exists in myapp_assignment are never touched — no
  clobbering, ever (guards against pk reuse on SQLite dev databases).
- Individually deleted assignments (those with a 'deleted' history row) are
  NOT restored by default. Pass --include-deleted to undo those too.
- On PostgreSQL the id sequence is re-pointed past the restored keys so
  future auto-inserts can never collide.
- Restored rows whose class no longer exists become ORPHANS (planner_class
  NULL). This is the DEFAULT and the intended outcome: the rows are safe in
  the database and visible only in the Django admin — they never appear in
  the user-facing app, which lists assignments through their class.
  --recreate-classes is the opt-in opposite: it recreates same-named classes
  and links the rows, deliberately making them visible in the app again.
"""
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.models.signals import post_save

from myapp.models import Assignment, AssignmentHistory, CustomUser, PlannerClass
from myapp.signals import log_assignment_save


class Command(BaseCommand):
    help = (
        "Rebuild Assignment rows that were cascade-deleted together with their "
        "PlannerClass (pre-0022 on_delete=CASCADE behavior), using the latest "
        "AssignmentHistory snapshot for every assignment pk that no longer "
        "exists. Run with --dry-run first."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print what would be restored without writing anything.',
        )
        parser.add_argument(
            '--include-deleted',
            action='store_true',
            help=(
                "Also restore assignments that were deleted individually "
                "(they have a 'deleted' history row). Default: only recover "
                "rows lost to class-deletion cascades."
            ),
        )
        parser.add_argument(
            '--recreate-classes',
            action='store_true',
            help=(
                'Recreate each missing PlannerClass (same name, same user) and '
                'link the restored assignments to it, making them VISIBLE in '
                'the app again. This is opt-in: the default keeps restored '
                'rows orphaned and invisible to users (backend/admin only).'
            ),
        )
        parser.add_argument(
            '--user-email',
            dest='user_email',
            default=None,
            help='Only restore assignments belonging to this user email.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        include_deleted = options['include_deleted']
        recreate_classes = options['recreate_classes']
        user_email = options['user_email']

        existing_pks = set(Assignment.objects.values_list('pk', flat=True))
        deleted_pks = set(
            AssignmentHistory.objects.filter(action='deleted')
            .values_list('assignment_pk', flat=True)
        )

        rows = (
            AssignmentHistory.objects.filter(assignment_pk__isnull=False)
            .order_by('assignment_pk', 'changed_at', 'pk')
        )
        if user_email:
            rows = rows.filter(user_email=user_email)

        # Latest snapshot per missing assignment pk (dict overwrite keeps the
        # last row per pk = the final state before the row disappeared).
        latest = {}
        earliest = {}
        created_row = {}
        for row in rows:
            pk = row.assignment_pk
            if pk in existing_pks:
                continue  # row still exists (or the pk was reused) — never touch it
            if not include_deleted and pk in deleted_pks:
                continue  # deliberately deleted by the user — not a cascade victim
            latest[pk] = row
            earliest.setdefault(pk, row)
            if row.action == 'created':
                created_row.setdefault(pk, row)

        plans = []
        skipped_incomplete = []
        for pk, row in sorted(latest.items()):
            if row.title is None or row.start_date is None or row.end_date is None:
                skipped_incomplete.append(row)
                continue
            plans.append((pk, row))

        excluded_deleted = sorted(pk for pk in deleted_pks if pk not in existing_pks)
        if user_email:
            excluded_deleted = []  # the email filter already scoped everything above

        if not include_deleted and excluded_deleted:
            self.stdout.write(
                f"{len(excluded_deleted)} individually deleted assignment(s) were "
                "NOT restored (they have a 'deleted' history row). Pass "
                "--include-deleted to restore those too."
            )

        if not plans and not skipped_incomplete:
            self.stdout.write("Nothing to restore: no recoverable assignments found.")
            return

        verb = "Would restore" if dry_run else "Restoring"
        for pk, row in plans:
            self.stdout.write(
                f"{verb} pk={pk} \"{row.title}\" "
                f"({row.start_date} → {row.end_date}, "
                f"completed={bool(row.completed)}) "
                f"user={row.user_email or '?'} "
                f"class={row.class_name or '?'}"
            )

        if skipped_incomplete:
            self.stdout.write(
                f"Skipping {len(skipped_incomplete)} snapshot(s) with missing "
                "title/dates (cannot build a valid Assignment):"
            )
            for row in skipped_incomplete:
                self.stdout.write(
                    f"  pk={row.assignment_pk} action={row.action} "
                    f"user={row.user_email or '?'}"
                )

        if dry_run:
            self.stdout.write("Dry run: nothing was written.")
            return

        post_save.disconnect(log_assignment_save, sender=Assignment)
        try:
            with transaction.atomic():
                self._restore(plans, recreate_classes, created_row, earliest)
        finally:
            post_save.connect(log_assignment_save, sender=Assignment)

        self.stdout.write(self.style.SUCCESS(
            f"Restored {len(plans)} assignment row(s): "
            f"{self.relinked} relinked to an existing class, "
            f"{self.classes_created} class(es) recreated, "
            f"{self.orphans} left orphaned (not visible in the app), "
            f"{self.skipped_existing} skipped (pk already exists)."
        ))
        if self.orphans:
            self.stdout.write(
                f"{self.orphans} row(s) left ORPHANED (planner_class=NULL): "
                "these are backend-only — safe in the database and visible to "
                "you in the Django admin, and they will NOT appear anywhere "
                "in the user-facing app. If you ever WANT them visible in the "
                "app, re-run with --recreate-classes."
            )

    # Counters for the final summary (set in _restore).
    relinked = 0
    classes_created = 0
    orphans = 0
    skipped_existing = 0

    def _restore(self, plans, recreate_classes, created_row, earliest):
        self.relinked = 0
        self.classes_created = 0
        self.orphans = 0
        self.skipped_existing = 0

        for pk, row in plans:
            if Assignment.objects.filter(pk=pk).exists():
                # PK got reused (possible on SQLite after deleting the max
                # row). Never clobber a live row.
                self.skipped_existing += 1
                continue

            planner_class, created_class = self._resolve_class(row, recreate_classes)
            if planner_class is not None:
                self.relinked += 1
                self.classes_created += 1 if created_class else 0
            else:
                self.orphans += 1

            assignment = Assignment(
                id=pk,  # original pk — keeps the history timeline one identity
                title=row.title,
                start_date=row.start_date,
                end_date=row.end_date,
                completed=bool(row.completed),
                order=0,  # not snapshotted; ordering is start_date-first anyway
                planner_class=planner_class,
            )
            assignment.save(force_insert=True)

            # auto_now_add/auto_now ignore assigned values on insert, so stamp
            # the true timestamps afterwards (the history log is the source of
            # truth: 'created' row for creation, latest row for last update).
            created_ts = (created_row.get(pk) or earliest[pk]).changed_at
            Assignment.objects.filter(pk=pk).update(
                created_at=created_ts,
                updated_at=row.changed_at,
            )

        # Explicit-pk inserts do not advance PostgreSQL sequences. Rewind the
        # sequence to MAX(id) — always safe, since every id > MAX(id) is free —
        # so the next auto-insert can never collide with a restored pk.
        if connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT setval(pg_get_serial_sequence('myapp_assignment', 'id'), "
                    "GREATEST((SELECT MAX(id) FROM myapp_assignment), 1))"
                )

    def _resolve_class(self, row, recreate_classes):
        """Return (PlannerClass or None, class_was_created) for a snapshot row."""
        # 1. Original class still exists and belongs to the same user → relink.
        if row.class_pk is not None:
            cls = PlannerClass.objects.filter(pk=row.class_pk).first()
            if cls is not None and (row.user_pk is None or cls.user_id == row.user_pk):
                return cls, False
        # 2. Opt-in: recreate a same-named class for the same user.
        if recreate_classes and row.user_pk is not None and row.class_name:
            user = CustomUser.objects.filter(pk=row.user_pk).first()
            if user is not None:
                cls, created = PlannerClass.objects.get_or_create(
                    user=user,
                    name=row.class_name[:200],
                    defaults={'order': 0},
                )
                return cls, created
        # 3. Otherwise the restored row stays orphaned.
        return None, False

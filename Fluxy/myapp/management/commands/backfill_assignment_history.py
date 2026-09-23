from django.core.management.base import BaseCommand

from myapp.models import Assignment, AssignmentHistory
from myapp.signals import _assignment_snapshot


class Command(BaseCommand):
    help = (
        "Backfill the permanent assignment history with a 'created' row for "
        "every existing assignment that has no history yet."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show how many rows would be created without writing.',
        )
        parser.add_argument(
            '--fix-dates',
            action='store_true',
            help=(
                'Restamp changed_at on existing backfilled created rows from the '
                'assignment real created_at (repairs rows written by earlier '
                'versions that stamped everything with the backfill run time).'
            ),
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        fix_dates = options['fix_dates']

        if fix_dates:
            self._fix_dates(dry_run)
            return

        existing = set(
            AssignmentHistory.objects.filter(action='created')
            .values_list('assignment_pk', flat=True)
        )
        missing = [a for a in Assignment.objects.select_related('planner_class__user') if a.pk not in existing]

        if dry_run:
            self.stdout.write(f"{len(missing)} assignment(s) would get history rows.")
            return

        created = 0
        for assignment in missing:
            row = AssignmentHistory(action='created', **_assignment_snapshot(assignment))
            row.save()
            # auto_now_add ignores assigned values, so stamp the true creation
            # time right after the insert (the assignment is the source of truth).
            AssignmentHistory.objects.filter(pk=row.pk).update(
                changed_at=assignment.created_at
            )
            created += 1

        self.stdout.write(
            self.style.SUCCESS(f"Backfilled {created} assignment history row(s) with true creation dates.")
        )

    def _fix_dates(self, dry_run):
        """Restamp backfilled created rows whose changed_at is wrong."""
        from django.db.models import F

        # created rows whose changed_at does not match their assignment's
        # real created_at. AssignmentHistory has no FK to Assignment (only the
        # integer assignment_pk), so join in Python. Rows for assignments that
        # no longer exist keep their stamp - it is the best data we have.
        rows = list(
            AssignmentHistory.objects.filter(
                action='created', assignment_pk__isnull=False
            ).only('pk', 'assignment_pk', 'changed_at')
        )
        true_dates = dict(
            Assignment.objects.filter(
                pk__in={r.assignment_pk for r in rows}
            ).values_list('pk', 'created_at')
        )

        to_fix = {
            r.pk: true_dates[r.assignment_pk]
            for r in rows
            if r.assignment_pk in true_dates and r.changed_at != true_dates[r.assignment_pk]
        }

        if dry_run:
            self.stdout.write(f"{len(to_fix)} history row(s) would get corrected dates.")
            return

        updated = 0
        for row_pk, true_date in to_fix.items():
            updated += AssignmentHistory.objects.filter(pk=row_pk).update(changed_at=true_date)

        self.stdout.write(
            self.style.SUCCESS(f"Corrected changed_at on {updated} history row(s).")
        )

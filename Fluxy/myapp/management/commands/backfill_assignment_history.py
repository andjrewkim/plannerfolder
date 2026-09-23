from django.core.management.base import BaseCommand
from django.db import transaction

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

    def handle(self, *args, **options):
        dry_run = options['dry_run']

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
            AssignmentHistory.objects.create(
                action='created',
                **_assignment_snapshot(assignment),
            )
            created += 1

        self.stdout.write(
            self.style.SUCCESS(f"Backfilled {created} assignment history row(s).")
        )

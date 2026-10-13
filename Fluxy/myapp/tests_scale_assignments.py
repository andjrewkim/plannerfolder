from datetime import date, timedelta

from django.core.management import call_command
from django.test import Client, TransactionTestCase
from django.utils import timezone

from .models import Assignment, AssignmentHistory, CustomUser, PlannerClass


def make_user(i):
    return CustomUser.objects.create_user(
        username=f"scale_u{i}", email=f"scale_u{i}@test.com", password="x"
    )


def run_scale(*args):
    import io

    buf = io.StringIO()
    call_command("scale_assignments", *args, stdout=buf)
    return buf.getvalue()


def make_world():
    user = make_user(1)
    math_cls = PlannerClass.objects.create(user=user, name="Math")
    sci_cls = PlannerClass.objects.create(user=user, name="Science")

    base = date(2025, 3, 10)
    assignments = []
    for i, cls in enumerate([math_cls, math_cls, sci_cls, sci_cls]):
        assignments.append(
            Assignment.objects.create(
                planner_class=cls,
                title=f"HW {i}",
                start_date=base + timedelta(days=i),
                end_date=base + timedelta(days=i + 2),
            )
        )
    Assignment.objects.create(
        planner_class=None,
        title="Unassigned Original",
        start_date=base,
        end_date=base + timedelta(days=1),
    )
    return user, assignments


class ScaleAssignmentsTests(TransactionTestCase):
    def test_dry_run_writes_nothing(self):
        _, assignments = make_world()
        before = Assignment.objects.count()

        out = run_scale("--dry-run", "--factor", "2")
        self.assertIn("Dry run: nothing was written", out)
        self.assertEqual(Assignment.objects.count(), before)
        self.assertFalse(
            AssignmentHistory.objects.filter(action="admin_scale_duplicate").exists()
        )

    def test_refuses_to_write_without_yes(self):
        make_world()
        before = Assignment.objects.count()
        with self.assertRaises(Exception):
            run_scale("--factor", "2")
        self.assertEqual(Assignment.objects.count(), before)

    def test_scales_to_factor_with_unassigned_only(self):
        user, assignments = make_world()
        originals = list(
            Assignment.objects.values(
                "id", "title", "start_date", "end_date", "completed", "planner_class"
            )
        )

        out = run_scale("--yes", "--factor", "2", "--seed", "7")
        self.assertIn("unassigned copy", out)

        self.assertEqual(Assignment.objects.count(), 10)
        self.assertEqual(
            Assignment.objects.filter(planner_class__isnull=True).count(),
            6,
        )
        self.assertEqual(
            Assignment.objects.filter(planner_class__user=user).count(), 4
        )

        for orig in originals:
            row = Assignment.objects.get(pk=orig["id"])
            self.assertEqual(row.title, orig["title"])
            self.assertEqual(row.start_date, orig["start_date"])
            self.assertEqual(row.end_date, orig["end_date"])
            self.assertEqual(row.completed, orig["completed"])
            self.assertEqual(row.planner_class_id, orig["planner_class"])

        self.assertEqual(
            Assignment.objects.filter(title="Unassigned Original").count(), 1
        )

    def test_copies_are_shifted_back_but_keep_span(self):
        make_world()
        run_scale("--yes", "--factor", "2", "--seed", "42")

        seen_copy = False
        for a in Assignment.objects.filter(
            planner_class__isnull=True, title__startswith="HW"
        ):
            seen_copy = True
            span = (a.end_date - a.start_date).days
            self.assertEqual(span, 2)
            self.assertTrue(7 <= a.start_date.day <= 13)
        self.assertTrue(seen_copy)

    def test_no_signal_history_rows_and_batch_rows_written(self):
        make_world()
        out = run_scale("--yes", "--factor", "2", "--seed", "1")

        dup_rows = AssignmentHistory.objects.filter(action="admin_scale_duplicate")
        self.assertEqual(dup_rows.count(), 5)
        self.assertFalse(
            AssignmentHistory.objects.filter(
                action="created",
                assignment_pk__in=dup_rows.values_list("assignment_pk", flat=True),
            ).exists()
        )
        self.assertFalse(
            AssignmentHistory.objects.filter(action="deleted").exists()
        )
        batch_id = dup_rows.first().changes["batch"]
        self.assertIn(batch_id, out)
        for row in dup_rows:
            self.assertIsNotNone(row.changes["source_assignment_pk"])
            self.assertTrue(1 <= row.changes["shift_days"] <= 3)
            self.assertEqual(row.changes["batch"], batch_id)

    def test_history_rows_use_a_declared_action(self):
        make_world()
        run_scale("--yes", "--factor", "2", "--seed", "6")

        declared = dict(AssignmentHistory.ACTION_CHOICES)
        self.assertIn("admin_scale_duplicate", declared)

        row = AssignmentHistory.objects.filter(
            action="admin_scale_duplicate"
        ).first()
        self.assertIsNotNone(row)
        self.assertEqual(row.get_action_display(), declared["admin_scale_duplicate"])
        self.assertNotEqual(row.get_action_display(), "admin_scale_duplicate")
        self.assertEqual(
            [k for k, _ in AssignmentHistory._meta.get_field("action").flatchoices],
            [k for k, _ in AssignmentHistory.ACTION_CHOICES],
        )

    def test_stats_dashboard_counts_scaled_copies_as_creations(self):
        make_world()
        run_scale("--yes", "--factor", "2", "--seed", "8")

        scaled = AssignmentHistory.objects.filter(
            action="admin_scale_duplicate"
        ).count()
        created = AssignmentHistory.objects.filter(action="created").count()
        self.assertGreater(scaled, 0)

        staff = CustomUser.objects.create_user(
            username="stats_admin", email="stats_admin@test.com", password="x"
        )
        staff.is_staff = True
        staff.is_superuser = True
        staff.save()

        client = Client()
        client.force_login(staff)
        resp = client.get("/admin/myapp/assignmenthistory/analytics/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.context["total_created"], created + scaled)

    def test_history_changed_at_is_the_assignment_date(self):
        make_world()
        run_scale("--yes", "--factor", "2", "--seed", "10")

        rows = AssignmentHistory.objects.filter(action="admin_scale_duplicate")
        self.assertGreater(rows.count(), 0)
        for row in rows:
            copy = Assignment.objects.get(pk=row.assignment_pk)
            self.assertEqual(row.changed_at.date(), copy.start_date)

    def test_batches_listing_reports_the_run_time(self):
        make_world()
        run_scale("--yes", "--factor", "2", "--seed", "12")

        out = run_scale("--batches")
        self.assertIn("1 batch(es)", out)
        self.assertIn(timezone.now().strftime("%Y-%m"), out)

    def test_copies_get_fresh_pks_and_sequence_is_safe(self):
        user, _ = make_world()
        max_pk_before = max(Assignment.objects.values_list("id", flat=True))

        run_scale("--yes", "--factor", "2", "--seed", "3")
        new_pks = list(
            Assignment.objects.filter(planner_class__isnull=True)
            .exclude(title="Unassigned Original")
            .values_list("id", flat=True)
        )
        self.assertTrue(all(pk > max_pk_before for pk in new_pks))

        fresh = Assignment.objects.create(
            planner_class=PlannerClass.objects.first(),
            title="Post-run insert",
            start_date=date(2025, 4, 1),
            end_date=date(2025, 4, 2),
        )
        self.assertNotIn(fresh.pk, new_pks)

    def test_created_at_restamped_to_look_natural(self):
        make_world()
        run_scale("--yes", "--factor", "2", "--seed", "5")

        copies = Assignment.objects.filter(
            planner_class__isnull=True, title__startswith="HW"
        )
        stamps = {c.created_at for c in copies}
        self.assertGreater(len(stamps), 1)

    def test_undo_removes_exactly_the_batch(self):
        user, _ = make_world()
        out = run_scale("--yes", "--factor", "2", "--seed", "9")
        batch_id = (
            AssignmentHistory.objects.filter(action="admin_scale_duplicate")
            .first()
            .changes["batch"]
        )

        out = run_scale("--undo", batch_id, "--dry-run")
        self.assertIn("Dry run: nothing was written", out)
        self.assertEqual(Assignment.objects.count(), 10)

        run_scale("--undo", batch_id, "--yes")
        self.assertEqual(Assignment.objects.count(), 5)
        self.assertEqual(
            Assignment.objects.filter(planner_class__isnull=False).count(), 4
        )
        self.assertEqual(
            AssignmentHistory.objects.filter(
                action="admin_scale_duplicate", changes__batch=batch_id
            ).count(),
            5,
        )

    def test_undo_skips_rows_no_longer_unassigned(self):
        user, _ = make_world()
        run_scale("--yes", "--factor", "2", "--seed", "11")
        batch_id = (
            AssignmentHistory.objects.filter(action="admin_scale_duplicate")
            .first()
            .changes["batch"]
        )

        copy = Assignment.objects.filter(
            planner_class__isnull=True, title__startswith="HW"
        ).first()
        math_cls = PlannerClass.objects.get(user=user, name="Math")
        copy.planner_class = math_cls
        copy.save()

        out = run_scale("--undo", batch_id, "--yes")
        self.assertIn("no longer", out)
        self.assertTrue(Assignment.objects.filter(pk=copy.pk).exists())
        self.assertEqual(
            Assignment.objects.filter(
                planner_class__isnull=True, title__startswith="HW"
            ).count(),
            0,
        )

    def test_batches_listing(self):
        make_world()
        out = run_scale("--batches")
        self.assertIn("No scaling batches found", out)

        run_scale("--yes", "--factor", "1.5", "--seed", "13")
        out = run_scale("--batches")
        self.assertIn("1 batch(es)", out)

    def test_weighted_pick_duplicates_larger_classes_more(self):
        user, _ = make_world()
        run_scale("--yes", "--factor", "4", "--seed", "17")

        math_cls = PlannerClass.objects.get(user=user, name="Math")
        sci_cls = PlannerClass.objects.get(user=user, name="Science")
        math_titles = set(math_cls.assignments.values_list("title", flat=True))
        sci_titles = set(sci_cls.assignments.values_list("title", flat=True))

        copies = Assignment.objects.filter(
            planner_class__isnull=True, title__startswith="HW"
        )
        copied_titles = {c.title for c in copies}
        self.assertTrue(math_titles & copied_titles)
        self.assertTrue(sci_titles & copied_titles)

# tests for the permanent assignment history feature
from datetime import date

from django.contrib.auth import get_user_model
from django.test import Client, TransactionTestCase

from .models import Assignment, AssignmentHistory, PlannerClass


def make_user(i=0):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(
        username=f"u{i}",
        email=f"u{i}@test.com",
        password="x",
    )


class AssignmentHistorySignalTests(TransactionTestCase):
    def _make_class(self, user, name="Math"):
        return PlannerClass.objects.create(user=user, name=name)

    def test_create_is_logged(self):
        user = make_user()
        planner_class = self._make_class(user)
        Assignment.objects.create(
            planner_class=planner_class,
            title="Homework 1",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 2),
        )
        self.assertTrue(
            AssignmentHistory.objects.filter(
                action="created", title="Homework 1"
            ).exists()
        )

    def test_update_and_completion_are_logged(self):
        user = make_user(1)
        planner_class = self._make_class(user)
        a = Assignment.objects.create(
            planner_class=planner_class,
            title="Essay",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 2),
        )
        a.title = "Essay v2"
        a.save()
        a.completed = True
        a.save()
        self.assertTrue(
            AssignmentHistory.objects.filter(assignment_pk=a.pk, action="updated").exists()
        )
        self.assertTrue(
            AssignmentHistory.objects.filter(assignment_pk=a.pk, action="completed").exists()
        )

    def test_direct_assignment_delete_is_logged_with_snapshot(self):
        user = make_user(2)
        planner_class = self._make_class(user)
        a = Assignment.objects.create(
            planner_class=planner_class,
            title="Temp",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 2),
        )
        a_pk = a.pk  # Django sets pk to None after delete
        a.delete()
        row = AssignmentHistory.objects.filter(assignment_pk=a_pk, action="deleted").get()
        self.assertEqual(row.title, "Temp")
        self.assertEqual(row.class_name, "Math")
        self.assertEqual(row.user_email, "u2@test.com")

    def test_class_deletion_keeps_permanent_history(self):
        """THE core guarantee: delete a class, its assignments' history survives."""
        user = make_user(3)
        planner_class = self._make_class(user, "History Class")
        a = Assignment.objects.create(
            planner_class=planner_class,
            title="Old Homework",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 2),
        )
        planner_class.delete()
        self.assertFalse(Assignment.objects.filter(pk=a.pk).exists())  # gone
        actions = list(
            AssignmentHistory.objects.filter(assignment_pk=a.pk)
            .values_list("action", flat=True)
        )
        self.assertIn("created", actions)
        self.assertIn("purged_by_class_deletion", actions)
        # Snapshot data survived the class cascade
        row = AssignmentHistory.objects.get(assignment_pk=a.pk, action="purged_by_class_deletion")
        self.assertEqual(row.title, "Old Homework")
        self.assertEqual(row.class_name, "History Class")
        self.assertEqual(row.user_email, "u3@test.com")
        # No duplicate 'deleted' row from the cascade itself
        self.assertNotIn("deleted", actions)

    def test_renamed_then_deleted_assignment_keeps_full_identity(self):
        """
        A renamed assignment stays ONE assignment in history (same pk,
        full timeline), and deleting its class never loses any of it.
        """
        user = make_user(4)
        planner_class = self._make_class(user, "Bio")
        a = Assignment.objects.create(
            planner_class=planner_class,
            title="Original Name",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 2),
        )
        a.title = "Renamed Twice"
        a.save()
        planner_class.delete()

        rows = list(AssignmentHistory.objects.filter(assignment_pk=a.pk))
        # All rows belong to the same assignment identity
        self.assertEqual(len({r.assignment_pk for r in rows}), 1)
        # Timeline shows the original title and every later state
        titles = {r.title for r in rows}
        self.assertIn("Original Name", titles)
        self.assertIn("Renamed Twice", titles)
        actions = {r.action for r in rows}
        self.assertEqual(actions, {"created", "updated", "purged_by_class_deletion"})

    def test_admin_cannot_write_to_history(self):
        """Admin add/change/delete must be blocked so the log stays append-only."""
        from django.contrib import admin as django_admin

        model_admin = django_admin.site._registry.get(AssignmentHistory)
        self.assertIsNotNone(model_admin)
        self.assertFalse(model_admin.has_add_permission(None))
        self.assertFalse(model_admin.has_change_permission(None, None))
        self.assertFalse(model_admin.has_delete_permission(None, None))


class AdminAnalyticsTests(TransactionTestCase):
    """Smoke tests for the admin analytics dashboard."""

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser("adm", "adm@test.com", "pass12345")
        self.client = Client()
        self.client.force_login(self.admin)

    def _seed_data(self):
        user = make_user(9)
        planner_class = PlannerClass.objects.create(user=user, name="Chart Class")
        Assignment.objects.create(
            planner_class=planner_class,
            title="Chart HW",
            start_date=date(2025, 2, 1),
            end_date=date(2025, 2, 2),
        )
        return planner_class

    def test_analytics_dashboard_renders(self):
        self._seed_data()
        response = self.client.get("/admin/myapp/assignmenthistory/analytics/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"analyticsChart", response.content)

    def test_analytics_range_views(self):
        self._seed_data()
        for rng in ("3m", "6m", "1y", "all"):
            response = self.client.get(f"/admin/myapp/assignmenthistory/analytics/?range={rng}")
            self.assertEqual(response.status_code, 200, rng)
        # invalid range falls back to default
        response = self.client.get("/admin/myapp/assignmenthistory/analytics/?range=bogus")
        self.assertEqual(response.status_code, 200)

    def test_changelist_renders_with_history_rows(self):
        self._seed_data()
        response = self.client.get("/admin/myapp/assignmenthistory/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Chart HW")

    def test_changelist_has_analytics_button(self):
        self._seed_data()
        response = self.client.get("/admin/myapp/assignmenthistory/")
        self.assertContains(response, "analytics/")

    def test_add_view_is_blocked(self):
        response = self.client.get("/admin/myapp/assignmenthistory/add/")
        self.assertEqual(response.status_code, 403)

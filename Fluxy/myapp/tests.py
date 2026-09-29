# tests for the permanent assignment history feature
from datetime import date

from django.contrib.auth import get_user_model
from django.test import Client, TransactionTestCase, override_settings

from .models import Assignment, AssignmentHistory, PlannerClass


def make_user(i=0):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(
        username=f"u{i}",
        email=f"u{i}@test.com",
        password="x",
    )


def run_backfill(*args):
    from django.core.management import call_command
    import io

    buf = io.StringIO()
    call_command("backfill_assignment_history", *args, stdout=buf)
    return buf.getvalue()


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
        """THE core guarantee: delete a class — the assignment row itself SURVIVES."""
        user = make_user(3)
        planner_class = self._make_class(user, "History Class")
        a = Assignment.objects.create(
            planner_class=planner_class,
            title="Old Homework",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 2),
        )
        planner_class.delete()
        self.assertTrue(Assignment.objects.filter(pk=a.pk).exists())  # row survives
        orphan = Assignment.objects.get(pk=a.pk)
        self.assertIsNone(orphan.planner_class)  # orphaned: class ref cleared, not deleted
        actions = list(
            AssignmentHistory.objects.filter(assignment_pk=a.pk)
            .values_list("action", flat=True)
        )
        self.assertIn("created", actions)
        # No removal event — the assignment was never deleted, just orphaned
        self.assertNotIn("purged_by_class_deletion", actions)
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
        self.assertEqual(actions, {"created", "updated"})
        # The live row itself survived the class deletion, orphaned
        orphan = Assignment.objects.get(pk=a.pk)
        self.assertIsNone(orphan.planner_class)
        self.assertEqual(orphan.title, "Renamed Twice")

    def test_assignment_survives_class_deletion(self):
        """Class deletion must NEVER delete assignment rows (they orphan instead)."""
        user = make_user(3)
        planner_class = self._make_class(user, "Survivor Class")
        a1 = Assignment.objects.create(
            planner_class=planner_class, title="Kept 1",
            start_date=date(2025, 1, 1), end_date=date(2025, 1, 2),
        )
        a2 = Assignment.objects.create(
            planner_class=planner_class, title="Kept 2",
            start_date=date(2025, 1, 2), end_date=date(2025, 1, 3),
        )
        Assignment.objects.filter(pk=a2.pk).update(completed=True)
        a2.refresh_from_db()

        planner_class.delete()

        # Both rows still exist in the database
        self.assertTrue(Assignment.objects.filter(pk=a1.pk).exists())
        self.assertTrue(Assignment.objects.filter(pk=a2.pk).exists())
        # Orphaned: class reference cleared, all other data intact
        a1.refresh_from_db()
        a2.refresh_from_db()
        self.assertIsNone(a1.planner_class)
        self.assertIsNone(a2.planner_class)
        self.assertEqual(a1.title, "Kept 1")
        self.assertEqual(a2.title, "Kept 2")
        self.assertTrue(a2.completed)  # completed state survived too

    def test_admin_cannot_write_to_history(self):
        """Admin add/change/delete must be blocked so the log stays append-only."""
        from django.contrib import admin as django_admin

        model_admin = django_admin.site._registry.get(AssignmentHistory)
        self.assertIsNotNone(model_admin)
        self.assertFalse(model_admin.has_add_permission(None))
        self.assertFalse(model_admin.has_change_permission(None, None))
        self.assertFalse(model_admin.has_delete_permission(None, None))


class BackfillDateTests(TransactionTestCase):
    """Backfilled rows must carry the assignment's real creation date."""

    def test_backfill_stamps_true_created_at(self):
        from datetime import timedelta

        from django.utils import timezone as dj_tz

        user = make_user(7)
        planner_class = PlannerClass.objects.create(user=user, name="Date Class")
        a = Assignment.objects.create(
            planner_class=planner_class,
            title="Dated HW",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 2),
        )
        AssignmentHistory.objects.all().delete()  # simulate pre-feature data

        # Pretend the assignment was created 40 days ago
        old = dj_tz.now() - timedelta(days=40)
        Assignment.objects.filter(pk=a.pk).update(created_at=old)
        a.refresh_from_db()

        out = run_backfill()
        self.assertIn("true creation dates", out)
        row = AssignmentHistory.objects.get(assignment_pk=a.pk, action="created")
        self.assertEqual(row.changed_at, a.created_at)  # NOT the backfill run time

    def test_fix_dates_repairs_stale_stamps(self):
        from datetime import timedelta

        from django.utils import timezone as dj_tz

        user = make_user(8)
        planner_class = PlannerClass.objects.create(user=user, name="Fix Class")
        a = Assignment.objects.create(
            planner_class=planner_class,
            title="Fix HW",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 2),
        )
        old = dj_tz.now() - timedelta(days=10)
        Assignment.objects.filter(pk=a.pk).update(created_at=old)
        a.refresh_from_db()  # pick up the DB value of created_at

        # Simulate a bad backfill: row stamped with the wrong (recent) time
        row = AssignmentHistory.objects.get(assignment_pk=a.pk, action="created")
        AssignmentHistory.objects.filter(pk=row.pk).update(changed_at=dj_tz.now())

        out = run_backfill("--fix-dates")
        self.assertIn("Corrected changed_at on 1", out)
        row.refresh_from_db()
        self.assertEqual(row.changed_at, a.created_at)

    def test_verbose_names_are_pluralized_correctly(self):
        self.assertEqual(AssignmentHistory._meta.verbose_name_plural, "Assignment histories")
        self.assertEqual(PlannerClass._meta.verbose_name_plural, "Planner classes")
        from .models import UserSettings
        self.assertEqual(UserSettings._meta.verbose_name_plural, "User settings")


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


def run_restore(*args):
    from django.core.management import call_command
    import io

    buf = io.StringIO()
    call_command("restore_purged_assignments", *args, stdout=buf)
    return buf.getvalue()


def simulate_old_cascade(assignment, planner_class):
    """Delete an assignment the way the pre-0022 CASCADE did: per-row
    'deleted' logging suppressed, one 'purged_by_class_deletion' row."""
    user = planner_class.user
    a_pk = assignment.pk  # capture BEFORE delete — Django nulls instance.pk
    snapshot = dict(
        assignment_pk=a_pk,
        class_pk=planner_class.pk,
        class_name=planner_class.name,
        user_pk=user.pk,
        username=user.username,
        user_email=user.email,
        title=assignment.title,
        start_date=assignment.start_date,
        end_date=assignment.end_date,
        completed=assignment.completed,
    )
    assignment.delete()  # logs a 'deleted' row under the new SET_NULL signals
    AssignmentHistory.objects.filter(
        assignment_pk=a_pk, action="deleted"
    ).delete()
    AssignmentHistory.objects.create(
        action="purged_by_class_deletion", **snapshot
    )


class RestorePurgedAssignmentsTests(TransactionTestCase):
    """Recovery path: rebuild rows cascade-destroyed under the old CASCADE FK."""

    def test_restores_cascade_victim_with_original_pk(self):
        user = make_user(10)
        planner_class = PlannerClass.objects.create(user=user, name="Lost Class")
        a = Assignment.objects.create(
            planner_class=planner_class,
            title="Lost HW",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 2),
        )
        a_pk = a.pk
        a.title = "Lost HW v2"
        a.save()  # second snapshot must win over the creation snapshot
        created_row = AssignmentHistory.objects.get(
            assignment_pk=a_pk, action="created"
        )

        simulate_old_cascade(a, planner_class)
        planner_class.delete()
        self.assertFalse(Assignment.objects.filter(pk=a_pk).exists())

        # Baseline AFTER the simulated cascade: the restore itself must add
        # (or rewrite) zero history rows.
        history_rows_before = AssignmentHistory.objects.filter(
            assignment_pk=a_pk
        ).count()

        out = run_restore()
        self.assertIn("Restored 1 assignment", out)

        restored = Assignment.objects.get(pk=a_pk)  # original pk preserved
        self.assertEqual(restored.title, "Lost HW v2")  # latest snapshot won
        self.assertEqual(restored.start_date, date(2025, 1, 1))
        self.assertEqual(restored.end_date, date(2025, 1, 2))
        self.assertFalse(restored.completed)
        self.assertIsNone(restored.planner_class)  # class gone → orphan
        # True creation timestamp restamped from the 'created' history row
        self.assertEqual(restored.created_at, created_row.changed_at)
        # Append-only log untouched: no rows added or rewritten by the restore
        self.assertEqual(
            AssignmentHistory.objects.filter(assignment_pk=a_pk).count(),
            history_rows_before,
        )

    def test_individually_deleted_assignments_are_not_restored_by_default(self):
        user = make_user(11)
        planner_class = PlannerClass.objects.create(user=user, name="Keep Class")
        a = Assignment.objects.create(
            planner_class=planner_class,
            title="User Deleted This",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 2),
        )
        a_pk = a.pk
        a.delete()  # genuine user-initiated delete → 'deleted' history row
        planner_class.delete()

        out = run_restore()
        self.assertIn("NOT restored", out)
        self.assertFalse(Assignment.objects.filter(pk=a_pk).exists())

        run_restore("--include-deleted")
        self.assertTrue(Assignment.objects.filter(pk=a_pk).exists())
        self.assertEqual(
            Assignment.objects.get(pk=a_pk).title, "User Deleted This"
        )

    def test_dry_run_writes_nothing(self):
        user = make_user(12)
        planner_class = PlannerClass.objects.create(user=user, name="Dry Class")
        a = Assignment.objects.create(
            planner_class=planner_class,
            title="Dry HW",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 2),
        )
        a_pk = a.pk
        simulate_old_cascade(a, planner_class)
        planner_class.delete()

        out = run_restore("--dry-run")
        self.assertIn("Dry HW", out)
        self.assertIn("Dry run: nothing was written", out)
        self.assertFalse(Assignment.objects.filter(pk=a_pk).exists())

    def test_recreate_classes_makes_rows_visible_again(self):
        user = make_user(13)
        planner_class = PlannerClass.objects.create(user=user, name="Chem")
        old_class_pk = planner_class.pk
        a1 = Assignment.objects.create(
            planner_class=planner_class, title="Lab Report",
            start_date=date(2025, 1, 1), end_date=date(2025, 1, 2),
        )
        a2 = Assignment.objects.create(
            planner_class=planner_class, title="Reading",
            start_date=date(2025, 1, 2), end_date=date(2025, 1, 3),
        )
        pks = (a1.pk, a2.pk)
        simulate_old_cascade(a1, planner_class)
        simulate_old_cascade(a2, planner_class)
        planner_class.delete()

        out = run_restore("--recreate-classes")
        self.assertIn("Restored 2 assignment", out)

        chem = PlannerClass.objects.get(user=user, name="Chem")
        self.assertNotEqual(chem.pk, old_class_pk)  # a NEW class row
        for pk in pks:
            restored = Assignment.objects.get(pk=pk)
            self.assertEqual(restored.planner_class, chem)

    def test_never_clobbers_an_existing_row(self):
        user = make_user(14)
        planner_class = PlannerClass.objects.create(user=user, name="Clobber Class")
        a = Assignment.objects.create(
            planner_class=planner_class, title="Victim",
            start_date=date(2025, 1, 1), end_date=date(2025, 1, 2),
        )
        a_pk = a.pk
        simulate_old_cascade(a, planner_class)
        planner_class.delete()

        # The pk got reused by a newer assignment (possible on SQLite after
        # deleting the highest row) — restore must leave it alone.
        Assignment.objects.create(
            id=a_pk, title="Live Now",
            start_date=date(2025, 2, 1), end_date=date(2025, 2, 2),
        )

        out = run_restore()
        self.assertIn("Nothing to restore", out)
        reused = Assignment.objects.get(pk=a_pk)
        self.assertEqual(reused.title, "Live Now")  # untouched


def api_settings_without_throttles():
    """REST_FRAMEWORK override for API tests: drop the 2/second user throttle."""
    return {
        "REST_FRAMEWORK": {
            "DEFAULT_PERMISSION_CLASSES": [
                "rest_framework.permissions.IsAuthenticated"
            ],
            "DEFAULT_AUTHENTICATION_CLASSES": [
                "rest_framework.authentication.SessionAuthentication"
            ],
        }
    }


class RestoredRowsStayInvisibleInAppTests(TransactionTestCase):
    """Restored (orphaned) rows are backend-only: they exist in the database
    and the admin, but NO user-facing endpoint may ever return them."""

    def _restore_a_cascade_victim(self, i):
        user = make_user(i)
        planner_class = PlannerClass.objects.create(user=user, name="Ghost Class")
        today = date.today()
        a = Assignment.objects.create(
            planner_class=planner_class,
            title="Ghost HW",
            start_date=today,
            end_date=today,
        )
        a_pk = a.pk
        simulate_old_cascade(a, planner_class)
        planner_class.delete()
        run_restore()
        restored = Assignment.objects.get(pk=a_pk)
        self.assertIsNone(restored.planner_class)  # restored as an orphan
        return user, restored

    def test_restored_rows_absent_from_every_user_facing_endpoint(self):
        user, ghost = self._restore_a_cascade_victim(20)
        live_class = PlannerClass.objects.create(user=user, name="Live Class")
        Assignment.objects.create(
            planner_class=live_class,
            title="Live HW",
            start_date=ghost.start_date,
            end_date=ghost.end_date,
        )
        self.client = Client()
        self.client.force_login(user)

        date_str = ghost.start_date.strftime("%Y-%m-%d")
        endpoints = [
            "/api/planner/assignments/",                        # full list
            f"/api/planner/assignments/active_on_date/?date={date_str}",
            "/api/planner/assignments/?days=14",                # rolling window
        ]
        with override_settings(**api_settings_without_throttles()):
            responses = [self.client.get(url) for url in endpoints]

        for url, response in zip(endpoints, responses):
            self.assertEqual(response.status_code, 200, url)
            titles = [row["title"] for row in response.json()]
            self.assertIn("Live HW", titles, url)      # healthy data still served
            self.assertNotIn("Ghost HW", titles, url)  # restored orphan never leaks

    def test_restored_rows_are_still_visible_in_admin(self):
        _, ghost = self._restore_a_cascade_victim(21)
        User = get_user_model()
        admin_user = User.objects.create_superuser("boss", "boss@test.com", "pw12345!")
        self.client = Client()
        self.client.force_login(admin_user)
        with override_settings(**api_settings_without_throttles()):
            response = self.client.get("/admin/myapp/assignment/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Ghost HW")

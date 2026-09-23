from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime
import threading
import zoneinfo

from django.db.models.signals import post_delete, pre_delete
from django.db import transaction
from .models import Assignment, PlannerClass, AssignmentHistory


def _assignment_snapshot(assignment, class_name=None):
    """Build the denormalized snapshot stored on every history row."""
    planner_class = getattr(assignment, 'planner_class', None)
    user = getattr(planner_class, 'user', None)
    return {
        'assignment_pk': assignment.pk,
        'class_pk': planner_class.pk if planner_class else None,
        'class_name': class_name if class_name is not None else (planner_class.name if planner_class else None),
        'user_pk': user.pk if user else None,
        'username': user.username if user else None,
        'user_email': user.email if user else None,
        'title': assignment.title,
        'start_date': assignment.start_date,
        'end_date': assignment.end_date,
        'completed': assignment.completed,
    }


def _log_history(action, snapshot, changes=None):
    """
    Insert one immutable history row. Wrapped in on_commit so rows created by
    the class-deletion handler below survive the cascade inside the same
    transaction (on_commit runs after the transaction commits).
    """
    transaction.on_commit(
        lambda: AssignmentHistory.objects.create(
            action=action,
            changes=changes,
            **snapshot,
        )
    )


def _diff(old, new):
    """Return {field: {'from': ..., 'to': ...}} for changed tracked fields."""
    changes = {}
    for field in ('title', 'start_date', 'end_date', 'completed'):
        if old.get(field) != new.get(field):
            changes[field] = {'from': str(old.get(field)), 'to': str(new.get(field))}
    return changes


@receiver(post_save, sender=Assignment)
def log_assignment_save(sender, instance, created, **kwargs):
    """Log every assignment creation, update, and completion-toggle."""
    snapshot = _assignment_snapshot(instance)
    if created:
        _log_history('created', snapshot)
    else:
        try:
            previous = AssignmentHistory.objects.filter(
                assignment_pk=instance.pk,
                action__in=['created', 'updated', 'completed', 'uncompleted'],
            ).latest('changed_at')
            changes = _diff(
                {f: getattr(previous, f) for f in ('title', 'start_date', 'end_date', 'completed')},
                snapshot,
            )
        except AssignmentHistory.DoesNotExist:
            changes = None
        if changes == {}:
            return
        completed_changed = bool(changes) and 'completed' in changes
        if completed_changed and instance.completed:
            action = 'completed'
        elif completed_changed and not instance.completed:
            action = 'uncompleted'
        else:
            action = 'updated'
        _log_history(action, snapshot, changes=changes or None)


# Thread-local set of assignment pks that are about to be purged by a class
# deletion, so the cascade's per-object post_delete doesn't ALSO log a
# 'deleted' row for the same assignment (which would double-count removals).
_purge_state = threading.local()


def _pending_purges():
    if not hasattr(_purge_state, 'pks'):
        _purge_state.pks = set()
    return _purge_state.pks


@receiver(post_delete, sender=Assignment)
def log_assignment_delete(sender, instance, **kwargs):
    """Log assignment deletions, except those already logged as purged by class deletion."""
    if instance.pk in _pending_purges():
        _pending_purges().discard(instance.pk)
        return
    _log_history('deleted', _assignment_snapshot(instance))


@receiver(pre_delete, sender=PlannerClass)
def log_assignments_on_class_delete(sender, instance, **kwargs):
    """
    When a class is deleted, log its assignments as 'purged_by_class_deletion'
    BEFORE the cascade runs, so a permanent record survives for assignments
    that vanish along with the class.
    """
    pending = _pending_purges()
    pending.clear()
    for assignment in instance.assignments.all():
        pending.add(assignment.pk)
        snapshot = _assignment_snapshot(assignment, class_name=instance.name)
        _log_history('purged_by_class_deletion', snapshot)





def get_user_timezone(user):
    """
    Get user's timezone from user profile or default to UTC.
    This should match the logic in your views.py
    
    Priority order:
    1. User profile timezone field (if exists)
    2. Default to UTC
    
    Note: Request headers are not available in signals, so we can't use X-Timezone here.
    Consider storing the user's timezone in their profile when they first set it.
    """
    # Try to get from user profile
    if hasattr(user, 'profile') and hasattr(user.profile, 'timezone'):
        try:
            tz_str = user.profile.timezone
            if tz_str:
                return zoneinfo.ZoneInfo(tz_str)
        except Exception:
            pass
    
    # Default to UTC if no profile timezone is set
    # You may want to detect timezone on frontend and save it to user profile
    return zoneinfo.ZoneInfo('UTC')
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime
import zoneinfo
from .models import PlannerClass, Assignment

@receiver(post_save, sender=PlannerClass)
def create_default_assignment(sender, instance, created, **kwargs):
    """
    Create a default assignment when the first PlannerClass (Class 1) is created for a new user.
    Uses user's timezone to ensure date is correct in their local time.
    """
    if created and instance.name == 'Class 1':
        # Double-check this is actually the user's first class
        user_classes_count = PlannerClass.objects.filter(user=instance.user).count()
        
        if user_classes_count == 1:  # This is their very first class
            # Get user's timezone
            user_tz = get_user_timezone(instance.user)
            
            # Get current date in user's timezone (not server timezone)
            local_date = timezone.now().astimezone(user_tz).date()
            
            Assignment.objects.create(
                planner_class=instance,
                title="First Assignment",
                date=local_date,
                order=0
            )


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
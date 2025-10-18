from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime
import zoneinfo





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
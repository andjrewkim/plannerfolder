# models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import pytz



class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']




class CalendarEvent(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)

    event_name = models.CharField(max_length=255, null=True, blank=True)
    date = models.DateTimeField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    virtual = models.BooleanField(default=False)
    urgency = models.CharField(max_length=50, choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High')], default='medium')
    notes = models.TextField(null=True, blank=True)
    event_type = models.CharField(max_length=100, null=True, blank=True)
    category = models.CharField(max_length=100, null=True, blank=True)
    subcategories = models.TextField(null=True, blank=True)
    recurrence_pattern = models.CharField(max_length=255, null=True, blank=True)
    day_marking_title = models.CharField(max_length=255, null=True, blank=True)
    color = models.CharField(max_length=7, default="#000")

    def __str__(self):
        username = self.user.username if self.user else "No User"
        event_name = self.event_name or "Unnamed Event"
        return f'{event_name} on {self.date} at {self.start_time} - {username}'




class TodoTask(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    event = models.CharField(max_length=200)
    date = models.CharField(max_length=20, null=True, blank=True)  # Changed to CharField to handle "longterm"
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.event} - {self.user.username}"
    
    
    
    
    


class UserSettings(models.Model):
    VIEW_CHOICES = [
        ('month', 'Month'),
        ('week', 'Week'),
        ('day', 'Day'),
        ('agenda', 'Agenda'),
    ]

    WEEK_START_CHOICES = [
        ('sunday', 'Sunday'),
        ('monday', 'Monday'),
    ]

    THEME_CHOICES = [
        ('classic', 'Classic'),
        ('emerald', 'Emerald'),
        ('ocean', 'Ocean'),
        ('sunset', 'Sunset'),
        ('royal', 'Royal'),
        ('monochrome', 'Monochrome'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='settings')
    default_calendar_view = models.CharField(max_length=10, choices=VIEW_CHOICES, default='month')
    week_starts_on = models.CharField(max_length=6, choices=WEEK_START_CHOICES, default='sunday')
    dark_mode = models.BooleanField(default=False)
    theme = models.CharField(max_length=20, choices=THEME_CHOICES, default='classic')

    def __str__(self):
        return f"Settings for {self.user.email}"

    
    










class LLMUsage(models.Model):
    """Track LLM usage per user per week"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    week_start = models.DateField()  # Start of the week (Monday)
    message_count = models.IntegerField(default=0)
    last_used = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'week_start')
        indexes = [
            models.Index(fields=['user', 'week_start']),
            models.Index(fields=['week_start']),
        ]

    def __str__(self):
        return f"{self.user.email} - Week {self.week_start} - {self.message_count} messages"

    @staticmethod
    def get_week_start(date=None):
        """Get the Monday of the current week"""
        if date is None:
            # Use Pacific timezone
            pacific_tz = pytz.timezone('America/Los_Angeles')
            date = timezone.now().astimezone(pacific_tz).date()
        
        # Get Monday of the current week (weekday() returns 0 for Monday)
        days_since_monday = date.weekday()
        week_start = date - timedelta(days=days_since_monday)
        return week_start

    @classmethod
    def get_or_create_weekly_usage(cls, user):
        """Get or create usage record for current week"""
        week_start = cls.get_week_start()
        usage, created = cls.objects.get_or_create(
            user=user,
            week_start=week_start,
            defaults={'message_count': 0}
        )
        return usage

    @classmethod
    def can_user_send_message(cls, user, limit=5):
        """Check if user can send another message this week"""
        usage = cls.get_or_create_weekly_usage(user)
        return usage.message_count < limit

    @classmethod
    def increment_usage(cls, user):
        """Increment message count for user this week"""
        usage = cls.get_or_create_weekly_usage(user)
        usage.message_count += 1
        usage.save()
        return usage

    @classmethod
    def get_remaining_messages(cls, user, limit=5):
        """Get remaining messages for user this week"""
        usage = cls.get_or_create_weekly_usage(user)
        return max(0, limit - usage.message_count)

    @classmethod
    def reset_weekly_usage(cls, user):
        """Reset usage for current week (admin function)"""
        usage = cls.get_or_create_weekly_usage(user)
        usage.message_count = 0
        usage.save()
        return usage



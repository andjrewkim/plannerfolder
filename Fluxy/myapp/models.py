# models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from zoneinfo import ZoneInfo
import pytz

class FriendRequest(models.Model):
    sender = models.ForeignKey('CustomUser', on_delete=models.CASCADE, related_name='sent_requests')
    receiver = models.ForeignKey('CustomUser', on_delete=models.CASCADE, related_name='received_requests')
    accepted = models.BooleanField(default=False)

    def accept(self):
        self.accepted = True
        self.save()
        self.sender.friends.add(self.receiver)
        self.receiver.friends.add(self.sender)

    def decline(self):
        self.delete()

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    has_seen_onboarding = models.BooleanField(default=False)
    friends = models.ManyToManyField('self', symmetrical=True, blank=True)
    has_unlocked_features = models.BooleanField(default=False)
    timezone = models.CharField(
        max_length=50,
        default='UTC',
        help_text="IANA timezone string, e.g., 'America/New_York'"
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []


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
        ('coffee', 'Coffee'),
        ('royal', 'Royal'),
        ('monochrome', 'Monochrome'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='settings')
    default_calendar_view = models.CharField(max_length=10, choices=VIEW_CHOICES, default='month')
    week_starts_on = models.CharField(max_length=6, choices=WEEK_START_CHOICES, default='sunday')
    dark_mode = models.BooleanField(default=True)
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

class PlannerClass(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    order = models.IntegerField(default=0)  # For maintaining class order

    class Meta:
        ordering = ['order', 'created_at']
        unique_together = ['user', 'name']

    def __str__(self):
        return f"{self.user.username} - {self.name}"

class Assignment(models.Model):
    planner_class = models.ForeignKey(
        PlannerClass, on_delete=models.CASCADE, related_name='assignments'
    )
    title = models.CharField(max_length=500)
    start_date = models.DateField()  # Now required
    end_date = models.DateField()    # Now required
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['start_date', 'order', 'created_at']

    def __str__(self):
        return f"{self.planner_class.name} - {self.title} ({self.start_date} to {self.end_date})"

    def is_active_on(self, day):
        """Check if the assignment is active on a given date."""
        return self.start_date <= day <= self.end_date
    
    
class NoWorkDay(models.Model):
    planner_class = models.ForeignKey(PlannerClass, on_delete=models.CASCADE, related_name='no_work_days')
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date']
        unique_together = ['planner_class', 'date']  # Prevent duplicate no-work days for same class/date

    def __str__(self):
        return f"{self.planner_class.name} - No Work Day ({self.date})"

class NoteTab(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=100, default="New Tab")  # tab label
    content = models.TextField(blank=True)  # the actual notes
    order = models.PositiveIntegerField(default=0)  # optional: for custom tab ordering

    def __str__(self):
        return f"{self.title} ({self.user.username})"

class UserStreak(models.Model):
    user = models.OneToOneField(
        'CustomUser',
        on_delete=models.CASCADE,
        related_name='streak'
    )
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    last_active_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} — {self.current_streak}-day streak"

    def update_streak(self):
        """
        Call this method whenever the user performs a 'streak-worthy' action.
        It updates the streak count based on their last active date.
        Weekends (Saturday=5, Sunday=6) do not break the streak.
        """
        today = timezone.now().date()

        if self.last_active_date == today:
            # Already counted today — nothing to update
            return

        # If this is the first activity ever
        if self.last_active_date is None:
            self.current_streak = 1
            self.longest_streak = 1
            self.last_active_date = today
            self.save()
            return

        # Calculate the last expected active day (skipping weekends)
        expected_date = self.last_active_date + timedelta(days=1)
        
        # Skip forward past any weekends
        while expected_date.weekday() in [5, 6]:  # 5=Saturday, 6=Sunday
            expected_date += timedelta(days=1)

        if today >= expected_date:
            # Check if streak should continue or break
            check_date = self.last_active_date + timedelta(days=1)
            streak_broken = False
            
            # Check each day between last active and today
            while check_date < today:
                # If it's a weekday and was missed, streak is broken
                if check_date.weekday() not in [5, 6]:
                    streak_broken = True
                    break
                check_date += timedelta(days=1)
            
            if streak_broken:
                # Streak broken — reset to 1
                self.current_streak = 1
            else:
                # Continued streak (today is the expected next day or within weekend grace)
                self.current_streak += 1
        else:
            # This shouldn't happen, but just in case
            self.current_streak = 1

        # Update longest streak if needed
        self.longest_streak = max(self.longest_streak, self.current_streak)
        self.last_active_date = today
        self.save()


class DailyActivity(models.Model):
    user = models.ForeignKey(
        'CustomUser', 
        on_delete=models.CASCADE, 
        related_name='daily_activities'
    )
    date = models.DateField(default=timezone.now)
    assignments_completed = models.IntegerField(default=0)
    total_assignments = models.IntegerField(default=0)
    is_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'daily_activities'
        verbose_name = 'Daily Activity'
        verbose_name_plural = 'Daily Activities'
        unique_together = ['user', 'date']
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.user.email} - {self.date} - {self.assignments_completed}/{self.total_assignments}"
    
    def save(self, *args, **kwargs):
        self.is_complete = self.assignments_completed >= self.total_assignments
        super().save(*args, **kwargs)
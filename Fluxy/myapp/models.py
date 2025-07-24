# models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings




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
        return f'{self.event_name} on {self.date} at {self.start_time} - {self.user.username}'




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

    
    
    
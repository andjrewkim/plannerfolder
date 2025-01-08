from django.db import models

# In models.py


class CalendarEvent(models.Model):
    event_name = models.CharField(max_length=255, null=True, blank=True)
    date = models.DateTimeField(null=True, blank=True)  # Changed to DateTimeField
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
    color = models.CharField(max_length=7, default="#000")
    def __str__(self):
        return f'{self.event_name} on {self.date} at {self.start_time}'


class TodoTask(models.Model):
    event = models.CharField(max_length=200)
    date = models.DateField()

    def __str__(self):
        return f"{self.event} - {self.date}"

    class Meta:
        ordering = ['date']  # Orders tasks by date
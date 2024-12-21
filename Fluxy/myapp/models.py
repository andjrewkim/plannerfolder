from django.db import models
# In models.py


class CalendarEvent(models.Model):
    event = models.CharField(max_length=255)
    date = models.DateField()
    time = models.TimeField()

    def __str__(self):
        return f'{self.event} on {self.date} at {self.time}'

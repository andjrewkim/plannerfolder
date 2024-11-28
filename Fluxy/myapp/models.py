# models.py
from django.db import models

class CalendarEvent(models.Model):
    event = models.CharField(max_length=100)  # This will correspond to 'event' in the serializer
    date = models.DateField()  # Corresponds to 'date' in the serializer
    time = models.TimeField()  # Corresponds to 'time' in the serializer

    def __str__(self):
        return self.event  # You can return the 'event' field as the string representation

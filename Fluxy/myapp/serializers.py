# myapp/serializers.py
from rest_framework import serializers
from .models import CalendarEvent  # Make sure to import the model

class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = ['event', 'time', 'date']  # Adjust these fields as needed

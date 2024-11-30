# myapp/serializers.py
from rest_framework import serializers
from .models import CalendarEvent

class CalendarEventSerializer(serializers.ModelSerializer):
    event = serializers.CharField(source='event')  # Map 'event' to 'event' in the model
    time = serializers.CharField(source='time')  # Map 'time' to 'start_time' in the model
    date = serializers.DateField(source='date')  # Map 'date' to 'date' in the model

    class Meta:
        model = CalendarEvent
        fields = ['event', 'time', 'date']  # Expose these fields in the API response

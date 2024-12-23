# serializers.py
from rest_framework import serializers
from .models import CalendarEvent

class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = ['id', 'event', 'time', 'date', 'color']  # Directly use these fields from the model

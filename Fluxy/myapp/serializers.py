# serializers.py
from rest_framework import serializers
from .models import CalendarEvent
from .models import TodoTask


class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = [            
            'id',
            'event_name',
            'date',
            'start_time',
            'end_time',
            'location',
            'virtual',
            'urgency',
            'notes',
            'event_type',
            'category',
            'subcategories',
            'recurrence_pattern',
            'color']  # Directly use these fields from the model



class TodoTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TodoTask
        fields = ['id', 'event', 'date']
        
    def validate_event(self, value):
        """
        Check that the event is not empty or just whitespace
        """
        if not value.strip():
            raise serializers.ValidationError("Event cannot be empty")
        return value.strip()
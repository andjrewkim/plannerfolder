# serializers.py
from rest_framework import serializers
from .models import CalendarEvent
from .models import TodoTask
from django.core.exceptions import ValidationError
import json

class CalendarEventSerializer(serializers.ModelSerializer):
    recurrence_pattern = serializers.JSONField(required=False, allow_null=True)
    
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
            'day_marking_title',
            'color'
        ]

    def validate_recurrence_pattern(self, value):
        if value is None:
            return value
            
        try:
            if isinstance(value, str):
                value = json.loads(value)
            
            required_fields = ['type', 'interval', 'day']
            if not all(field in value for field in required_fields):
                raise ValidationError(f"Recurrence pattern must contain {', '.join(required_fields)}")
            
            return value
            
        except json.JSONDecodeError:
            raise ValidationError("Invalid JSON format for recurrence pattern")
        except KeyError as e:
            raise ValidationError(f"Missing required field: {str(e)}")
        except Exception as e:
            raise ValidationError(f"Invalid recurrence pattern: {str(e)}")








from rest_framework import serializers

class TodoTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TodoTask
        fields = ['id', 'event', 'date']
        extra_kwargs = {
            'date': {'allow_null': True}  # Explicitly allow null values
        }

    def validate_event(self, value):
        """
        Check that the event is not empty or just whitespace
        """
        if not value.strip():
            raise serializers.ValidationError("Event cannot be empty")
        return value.strip()

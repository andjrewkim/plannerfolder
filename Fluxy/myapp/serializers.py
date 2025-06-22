# serializers.py
from rest_framework import serializers
from .models import CalendarEvent, TodoTask, CustomUser
from django.core.exceptions import ValidationError
import json


class CalendarEventSerializer(serializers.ModelSerializer):
    recurrence_pattern = serializers.JSONField(required=False, allow_null=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = CalendarEvent
        fields = [
            'id',
            'user',
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

    def create(self, validated_data):
        """Create event with authenticated user"""
        user = self.context['request'].user
        validated_data['user'] = user
        return super().create(validated_data)

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


class TodoTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TodoTask
        fields = ['id', 'event', 'date', 'created_at']
        extra_kwargs = {
            'date': {'allow_null': True}
        }

    def validate_event(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Event cannot be empty")
        return value.strip()

    def create(self, validated_data):
        """Create task with authenticated user"""
        user = self.context['request'].user
        validated_data['user'] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """Update task, ensuring user ownership"""
        if instance.user != self.context['request'].user:
            raise serializers.ValidationError("You can only update your own tasks")
        return super().update(instance, validated_data)
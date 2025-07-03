# serializers.py
from rest_framework import serializers
from .models import CalendarEvent, TodoTask, CustomUser
from django.core.exceptions import ValidationError
import json


class CalendarEventSerializer(serializers.ModelSerializer):
    recurrence_pattern = serializers.JSONField(required=False, allow_null=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    location = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    virtual = serializers.BooleanField(required=False)
    urgency = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    notes = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    event_type = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    category = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    subcategories = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        default=list,
        allow_null=True
    )
    day_marking_title = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    color = serializers.CharField(required=False, allow_null=True, allow_blank=True)

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

    def validate_subcategories(self, value):
        """Ensure subcategories is always a list of strings"""
        if value is None:
            return []
        if not isinstance(value, list):
            return []
        # Convert all items to strings and filter out None values
        return [str(item) for item in value if item is not None]

    def to_internal_value(self, data):
        """Transform incoming data to match serializer field names"""
        # Handle QueryDict by converting to regular dict and extracting single values
        if hasattr(data, 'getlist'):
            # This is a QueryDict, extract the actual values
            new_data = {}
            for key, value_list in data.lists():
                if len(value_list) == 1:
                    new_data[key] = value_list[0]
                else:
                    new_data[key] = value_list
            data = new_data
        elif hasattr(data, 'copy'):
            data = data.copy()
        else:
            data = dict(data)
        
        # DEBUG: Print the processed data
        print(f"DEBUG - Processed data: {data}")
        print(f"DEBUG - Subcategories after QueryDict processing: {data.get('subcategories')}")
        
        # Map 'type' to 'event_type' if it exists
        if 'type' in data:
            data['event_type'] = str(data.pop('type')) if data['type'] is not None else None
        
        # Handle subcategories properly - it should be a list of strings
        if 'subcategories' in data:
            subcats = data['subcategories']
            if subcats is None or subcats == [] or subcats == [[]]:
                data['subcategories'] = []
            elif isinstance(subcats, list):
                # If it's a list containing lists (like [[]]), flatten it
                if len(subcats) == 1 and isinstance(subcats[0], list):
                    data['subcategories'] = subcats[0]  # Extract the inner list
                else:
                    # Filter out any non-string values and convert to strings
                    cleaned_subcats = []
                    for item in subcats:
                        if item is not None and str(item).strip():
                            cleaned_subcats.append(str(item).strip())
                    data['subcategories'] = cleaned_subcats
            else:
                data['subcategories'] = []
        else:
            data['subcategories'] = []
        
        # Handle recurrence_pattern - be explicit about None
        if 'recurrence_pattern' in data:
            if data['recurrence_pattern'] is None:
                data.pop('recurrence_pattern', None)  # Remove it entirely if None
        
        # Clean up any fields that shouldn't be in the serializer
        fields_to_remove = ['deadline', 'confidence_scores', 'input_text']
        for field in fields_to_remove:
            data.pop(field, None)
        
        print(f"DEBUG - Final data before validation: {data}")
        return super().to_internal_value(data)

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
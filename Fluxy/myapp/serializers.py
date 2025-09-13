# serializers.py
from rest_framework import serializers
from .models import CalendarEvent, TodoTask, CustomUser
from django.core.exceptions import ValidationError
import json
from .models import UserSettings
from .models import PlannerClass, Assignment



class CalendarEventSerializer(serializers.ModelSerializer):
    recurrence_pattern = serializers.CharField(required=False, allow_null=True, allow_blank=True)
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
        # Ensure the user is set from the request context
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['user'] = request.user
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
        print(f"DEBUG - Raw incoming data: {data}")
        print(f"DEBUG - Data type: {type(data)}")
        
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
        #print(f"DEBUG - Processed data: {data}")
        #print(f"DEBUG - Subcategories after QueryDict processing: {data.get('subcategories')}")
        
        # Map 'type' to 'event_type' if it exists
        if 'type' in data:
            data['event_type'] = str(data.pop('type')) if data['type'] is not None else None
        
        # Handle subcategories properly - fix character parsing issue
        if 'subcategories' in data:
            subcats = data['subcategories']
            if subcats is None or subcats == '':
                data['subcategories'] = []
            elif isinstance(subcats, str):
                # Try to parse as JSON first, then fall back to comma-separated
                try:
                    parsed = json.loads(subcats)
                    if isinstance(parsed, list):
                        data['subcategories'] = [str(item).strip() for item in parsed if item is not None and str(item).strip()]
                    else:
                        data['subcategories'] = []
                except (json.JSONDecodeError, TypeError):
                    # Handle comma-separated strings
                    data['subcategories'] = [s.strip() for s in subcats.split(',') if s.strip()]
            elif isinstance(subcats, list):
                # Check if it's a list of characters (parsing issue)
                if len(subcats) > 0 and all(len(str(item)) == 1 for item in subcats):
                    # This looks like a string that was parsed as individual characters
                    # Join them back and try to parse as JSON
                    joined = ''.join(subcats)
                    try:
                        parsed = json.loads(joined)
                        if isinstance(parsed, list):
                            data['subcategories'] = [str(item).strip() for item in parsed if item is not None and str(item).strip()]
                        else:
                            data['subcategories'] = []
                    except (json.JSONDecodeError, TypeError):
                        data['subcategories'] = []
                else:
                    # Handle normal list processing
                    cleaned_subcats = []
                    for item in subcats:
                        if isinstance(item, list):
                            # Flatten nested lists
                            cleaned_subcats.extend([str(subitem).strip() for subitem in item if subitem is not None and str(subitem).strip()])
                        elif item is not None and str(item).strip():
                            cleaned_subcats.append(str(item).strip())
                    data['subcategories'] = cleaned_subcats
            else:
                data['subcategories'] = []
        else:
            data['subcategories'] = []
        
        # Handle recurrence_pattern - keep as iCal format string
        if 'recurrence_pattern' in data:
            recurrence = data['recurrence_pattern']
            if recurrence == 'null' or recurrence is None or recurrence == '':
                data['recurrence_pattern'] = None
            elif isinstance(recurrence, str):
                # Keep the original iCal format string as-is
                data['recurrence_pattern'] = recurrence.strip()
                print(f"DEBUG - Keeping iCal format: {recurrence}")
            else:
                # If it's not a string, convert to string or set to None
                data['recurrence_pattern'] = str(recurrence) if recurrence else None
        
        # Clean up any fields that shouldn't be in the serializer
        fields_to_remove = ['deadline', 'confidence_scores', 'input_text']
        for field in fields_to_remove:
            data.pop(field, None)
        
        print(f"DEBUG - Final data before validation: {data}")
        
        try:
            result = super().to_internal_value(data)
            return result
        except Exception as e:
            print(f"DEBUG - Validation failed: {e}")
            print(f"DEBUG - Exception type: {type(e)}")
            raise

    def validate_recurrence_pattern(self, value):
        # If the value is None, return None (no recurrence)
        if value is None or value == '' or value == 'null':
            return None
        
        try:
            # Convert to string and strip whitespace
            if not isinstance(value, str):
                value = str(value)
            
            value = value.strip()
            
            # Handle special case of "null" string
            if value.lower() == 'null' or value == '':
                return None
            
            # Validate iCal format - should start with FREQ=
            if not value.startswith('FREQ='):
                raise ValidationError("Recurrence pattern must be in iCal format starting with 'FREQ='")
            
            # Basic validation of frequency values
            freq_part = value.split(';')[0].replace('FREQ=', '').upper()
            valid_frequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
            
            if freq_part not in valid_frequencies:
                raise ValidationError(f"Invalid frequency. Must be one of: {', '.join(valid_frequencies)}")
            
            print(f"DEBUG - Validated iCal recurrence pattern: {value}")
            return value

        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            raise ValidationError(f"Invalid recurrence pattern: {str(e)}")

    def validate(self, data):
        """Add overall validation with debug info"""
        #print(f"DEBUG - Final validation of data: {data}")
        try:
            result = super().validate(data)
            return result
        except Exception as e:
            print(f"DEBUG - Overall validation error: {e}")
            print(f"DEBUG - Error details: {str(e)}")
            raise


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
    
    
class UserSettingsSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = UserSettings
        fields = ['default_calendar_view', 'week_starts_on', 'dark_mode', 'theme']
        
    def validate_default_calendar_view(self, value):
        valid_choices = ['month', 'week', 'day', 'agenda']
        if value not in valid_choices:
            raise serializers.ValidationError(f"Invalid choice. Must be one of: {valid_choices}")
        return value
    
    def validate_week_starts_on(self, value):
        valid_choices = ['sunday', 'monday']
        if value not in valid_choices:
            raise serializers.ValidationError(f"Invalid choice. Must be one of: {valid_choices}")
        return value
    
    def validate_theme(self, value):
        valid_choices = ['classic', 'emerald', 'ocean', 'sunset', 'royal', 'monochrome']
        if value not in valid_choices:
            raise serializers.ValidationError(f"Invalid choice. Must be one of: {valid_choices}")
        return value
    
    
    from .models import PlannerClass, Assignment


class PlannerClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlannerClass
        fields = ['id', 'name', 'order', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = ['id', 'title', 'date', 'planner_class', 'completed', 'order', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def validate_planner_class(self, value):
        """Ensure the planner_class belongs to the current user"""
        if value.user != self.context['request'].user:
            raise serializers.ValidationError("You can only create assignments for your own classes.")
        return value

    def validate_title(self, value):
        """Ensure title is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Assignment title cannot be empty.")
        return value.strip()

from .models import NoteTab

class NoteTabSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteTab
        fields = ['id', 'title', 'content', 'order']
        
        
        
from .models import NoWorkDay

class NoWorkDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = NoWorkDay
        fields = ['id', 'planner_class', 'date']

    def create(self, validated_data):
        # Ensure the planner_class belongs to the authenticated user
        planner_class = validated_data['planner_class']
        if planner_class.user != self.context['request'].user:
            raise serializers.ValidationError("You can only create no-work days for your own classes.")
        return super().create(validated_data)

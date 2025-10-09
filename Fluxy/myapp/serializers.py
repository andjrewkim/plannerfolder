from rest_framework import serializers
from .models import (
    CalendarEvent, 
    TodoTask, 
    CustomUser, 
    UserSettings, 
    PlannerClass, 
    Assignment,
    NoteTab,
    NoWorkDay,
    FriendRequest
)
from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from django.utils import timezone
from datetime import datetime, date, time
import pytz
import json
from .timezone_utils import (
    get_user_timezone,
    get_user_local_date,
    parse_date_in_user_timezone
)



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
        return [str(item) for item in value if item is not None]

    def to_internal_value(self, data):
        """Transform incoming data to match serializer field names"""
        # Handle QueryDict by converting to regular dict
        if hasattr(data, 'getlist'):
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
        
        # Map 'type' to 'event_type' if it exists
        if 'type' in data:
            data['event_type'] = str(data.pop('type')) if data['type'] is not None else None
        
        # Handle subcategories properly
        if 'subcategories' in data:
            subcats = data['subcategories']
            if subcats is None or subcats == '':
                data['subcategories'] = []
            elif isinstance(subcats, str):
                try:
                    parsed = json.loads(subcats)
                    if isinstance(parsed, list):
                        data['subcategories'] = [str(item).strip() for item in parsed if item is not None and str(item).strip()]
                    else:
                        data['subcategories'] = []
                except (json.JSONDecodeError, TypeError):
                    data['subcategories'] = [s.strip() for s in subcats.split(',') if s.strip()]
            elif isinstance(subcats, list):
                if len(subcats) > 0 and all(len(str(item)) == 1 for item in subcats):
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
                    cleaned_subcats = []
                    for item in subcats:
                        if isinstance(item, list):
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
                data['recurrence_pattern'] = recurrence.strip()
            else:
                data['recurrence_pattern'] = str(recurrence) if recurrence else None
        
        # Clean up any fields that shouldn't be in the serializer
        fields_to_remove = ['deadline', 'confidence_scores', 'input_text']
        for field in fields_to_remove:
            data.pop(field, None)
        
        return super().to_internal_value(data)

    def validate_recurrence_pattern(self, value):
        if value is None or value == '' or value == 'null':
            return None
        
        try:
            if not isinstance(value, str):
                value = str(value)
            
            value = value.strip()
            
            if value.lower() == 'null' or value == '':
                return None
            
            if not value.startswith('FREQ='):
                raise ValidationError("Recurrence pattern must be in iCal format starting with 'FREQ='")
            
            freq_part = value.split(';')[0].replace('FREQ=', '').upper()
            valid_frequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
            
            if freq_part not in valid_frequencies:
                raise ValidationError(f"Invalid frequency. Must be one of: {', '.join(valid_frequencies)}")
            
            return value

        except Exception as e:
            if isinstance(e, ValidationError):
                raise
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
        valid_choices = ['classic', 'emerald', 'ocean', 'coffee', 'royal', 'monochrome']
        if value not in valid_choices:
            raise serializers.ValidationError(f"Invalid choice. Must be one of: {valid_choices}")
        return value


class PlannerClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlannerClass
        fields = ['id', 'name', 'order', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
from rest_framework import serializers
from django.db.models import Q, Count
from .models import Assignment, PlannerClass, NoteTab, NoWorkDay, CustomUser, FriendRequest
from .timezone_utils import parse_date_in_user_timezone, get_user_local_date


class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = ['id', 'title', 'date', 'planner_class', 'completed', 'order', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def validate_planner_class(self, value):
        """Ensure the planner_class belongs to the current user"""
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            raise serializers.ValidationError("Authentication required.")
        
        if value.user != request.user:
            raise serializers.ValidationError("You can only create assignments for your own classes.")
        return value

    def validate_title(self, value):
        """Ensure title is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Assignment title cannot be empty.")
        return value.strip()
    
    def validate_date(self, value):
        """
        Ensure date is parsed correctly in user's timezone.
        This is CRITICAL for "today's assignments" queries to work correctly.
        """
        if value is None:
            raise serializers.ValidationError("Date is required.")
        
        # Parse the date in user's timezone context
        request = self.context.get('request')
        if not request:
            # If no request in context, log warning but continue with the value as-is
            print("⚠️ WARNING: No request in AssignmentSerializer.validate_date context")
            return value
            
        return parse_date_in_user_timezone(value, request)
    
    def to_representation(self, instance):
        """
        Override to ensure date is always returned in consistent ISO format
        """
        data = super().to_representation(instance)
        # Ensure date is in YYYY-MM-DD format
        if instance.date:
            data['date'] = instance.date.isoformat()
        return data


class NoteTabSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteTab
        fields = ['id', 'title', 'content', 'order']


class NoWorkDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = NoWorkDay
        fields = ['id', 'planner_class', 'date']

    def create(self, validated_data):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            raise serializers.ValidationError("Authentication required.")
            
        planner_class = validated_data['planner_class']
        if planner_class.user != request.user:
            raise serializers.ValidationError("You can only create no-work days for your own classes.")
        return super().create(validated_data)


class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user info for friend lists and requests"""
    name = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'name', 'first_name', 'last_name']
        read_only_fields = ['id', 'username', 'email', 'name', 'first_name', 'last_name']
    
    def get_name(self, obj):
        """Return full name if available, otherwise email username"""
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        elif obj.first_name:
            return obj.first_name
        elif obj.last_name:
            return obj.last_name
        else:
            return obj.email.split('@')[0]


class FriendRequestSerializer(serializers.ModelSerializer):
    """Serializer for friend requests with sender/receiver details"""
    sender = UserBasicSerializer(read_only=True)
    receiver = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = FriendRequest
        fields = ['id', 'sender', 'receiver', 'accepted']
        read_only_fields = ['id', 'sender', 'receiver', 'accepted']


class SendFriendRequestSerializer(serializers.Serializer):
    """Serializer for sending friend request by email"""
    email = serializers.EmailField(required=True)
    
    def validate_email(self, value):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            raise serializers.ValidationError("Authentication required.")
        
        try:
            receiver = CustomUser.objects.get(email=value)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("User with this email does not exist")
        
        request_user = request.user
        if receiver == request_user:
            raise serializers.ValidationError("Cannot send friend request to yourself")
        
        if receiver in request_user.friends.all():
            raise serializers.ValidationError("Already friends with this user")
        
        if FriendRequest.objects.filter(
            Q(sender=request_user, receiver=receiver) | Q(sender=receiver, receiver=request_user),
            accepted=False
        ).exists():
            raise serializers.ValidationError("Friend request already exists")
        
        return value
    
    def create(self, validated_data):
        email = validated_data['email']
        receiver = CustomUser.objects.get(email=email)
        sender = self.context['request'].user
        
        friend_request = FriendRequest.objects.create(
            sender=sender,
            receiver=receiver
        )
        return friend_request


class UserProfileSerializer(serializers.ModelSerializer):
    """Detailed user profile with assignment stats - TIMEZONE SAFE"""
    
    name = serializers.SerializerMethodField()
    today_completion_percentage = serializers.SerializerMethodField()
    overall_completion_percentage = serializers.SerializerMethodField()
    total_assignments_today = serializers.SerializerMethodField()
    completed_assignments_today = serializers.SerializerMethodField()
    total_assignments_overall = serializers.SerializerMethodField()
    completed_assignments_overall = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'name', 'first_name', 'last_name', 'created_at',
            'today_completion_percentage', 'overall_completion_percentage',
            'total_assignments_today', 'completed_assignments_today',
            'total_assignments_overall', 'completed_assignments_overall',
        ]
        read_only_fields = fields
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._stats_cache = {}
        self._today_cache = None
    
    def get_name(self, obj):
        """Return full name if available, otherwise email username"""
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        elif obj.first_name:
            return obj.first_name
        elif obj.last_name:
            return obj.last_name
        else:
            return obj.email.split('@')[0] if obj.email else obj.username
    
    def _get_today(self):
        """
        Cache the user's local date to avoid recalculating.
        CRITICAL FIX: Check if request exists before using it.
        """
        if self._today_cache is None:
            request = self.context.get('request')
            
            if not request:
                # IMPORTANT: Log this and provide detailed debugging info
                print("=" * 80)
                print("🚨 CRITICAL: UserProfileSerializer._get_today() called without request!")
                print(f"   Context keys: {list(self.context.keys())}")
                print(f"   Instance: {self.instance}")
                print("   This will cause timezone calculations to default to UTC!")
                print("=" * 80)
                
            self._today_cache = get_user_local_date(request)
            
        return self._today_cache
    
    def get_assignment_stats(self, user):
        """
        Calculate assignment stats with caching.
        TIMEZONE SAFE: Uses user's local date from request timezone.
        
        The key is that we're comparing Assignment.date (naive date field) 
        with today's date calculated in the user's timezone.
        """
        user_id = user.id
        if user_id in self._stats_cache:
            return self._stats_cache[user_id]
        
        # Get user's local date based on timezone from request
        today = self._get_today()
        
        # Query today's assignments
        # Assignment.date is a DateField (timezone-naive), so direct comparison works
        today_stats = Assignment.objects.filter(
            planner_class__user=user, 
            date=today
        ).aggregate(
            total=Count('id'), 
            completed=Count('id', filter=Q(completed=True))
        )
        
        # Query all assignments
        overall_stats = Assignment.objects.filter(
            planner_class__user=user
        ).aggregate(
            total=Count('id'), 
            completed=Count('id', filter=Q(completed=True))
        )
        
        stats = {
            'today': {
                'total': today_stats['total'] or 0,
                'completed': today_stats['completed'] or 0
            },
            'overall': {
                'total': overall_stats['total'] or 0,
                'completed': overall_stats['completed'] or 0
            }
        }
        
        # Cache the result
        self._stats_cache[user_id] = stats
        
        return stats
    
    def get_today_completion_percentage(self, obj):
        stats = self.get_assignment_stats(obj)
        total = stats['today']['total']
        completed = stats['today']['completed']
        return int((completed / total) * 100) if total > 0 else 0
    
    def get_overall_completion_percentage(self, obj):
        stats = self.get_assignment_stats(obj)
        total = stats['overall']['total']
        completed = stats['overall']['completed']
        return int((completed / total) * 100) if total > 0 else 0
    
    def get_total_assignments_today(self, obj):
        stats = self.get_assignment_stats(obj)
        return stats['today']['total']
    
    def get_completed_assignments_today(self, obj):
        stats = self.get_assignment_stats(obj)
        return stats['today']['completed']
    
    def get_total_assignments_overall(self, obj):
        stats = self.get_assignment_stats(obj)
        return stats['overall']['total']
    
    def get_completed_assignments_overall(self, obj):
        stats = self.get_assignment_stats(obj)
        return stats['overall']['completed']


class PendingFriendRequestsSerializer(serializers.Serializer):
    """Serializer for listing pending friend requests"""
    received = FriendRequestSerializer(many=True, read_only=True)
    sent = FriendRequestSerializer(many=True, read_only=True)
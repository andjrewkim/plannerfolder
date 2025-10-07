# views.py
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from django.db import transaction
from django.utils import timezone
from datetime import datetime
import zoneinfo
from .models import PlannerClass, Assignment
from .serializers import PlannerClassSerializer, AssignmentSerializer

class PlannerClassViewSet(viewsets.ModelViewSet):
    serializer_class = PlannerClassSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PlannerClass.objects.filter(user=self.request.user)

    def get_user_timezone(self):
        """
        Get user's timezone from multiple sources in order of priority:
        1. Request header (X-Timezone)
        2. User profile timezone field
        3. Default to UTC
        """
        # Try to get from request header
        tz_header = self.request.headers.get('X-Timezone')
        if tz_header:
            try:
                return zoneinfo.ZoneInfo(tz_header)
            except Exception:
                pass
        
        # Try to get from user profile (if you have a profile model with timezone field)
        if hasattr(self.request.user, 'profile') and hasattr(self.request.user.profile, 'timezone'):
            try:
                return zoneinfo.ZoneInfo(self.request.user.profile.timezone)
            except Exception:
                pass
        
        # Default to UTC
        return zoneinfo.ZoneInfo('UTC')

    def get_user_date(self):
        """Get current date in user's timezone"""
        user_tz = self.get_user_timezone()
        return timezone.now().astimezone(user_tz).date()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # If user has no classes, create default ones
        if not queryset.exists():
            with transaction.atomic():
                default_classes = []
                for i in range(1, 7):  # Create 6 default classes
                    default_class = PlannerClass.objects.create(
                        user=request.user,
                        name=f'Class {i}',
                        order=i-1
                    )
                    default_classes.append(default_class)
                
                # Create default assignment for Class 1 only using user's timezone
                if default_classes:
                    first_class = default_classes[0]
                    if not Assignment.objects.filter(planner_class=first_class).exists():
                        Assignment.objects.create(
                            planner_class=first_class,
                            title="First Assignment",
                            date=self.get_user_date(),  # Uses user's timezone
                            order=0
                        )
            
            # Refresh the queryset after creating defaults
            queryset = self.get_queryset()
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Assignment.objects.filter(planner_class__user=self.request.user)

    def get_user_timezone(self):
        """
        Get user's timezone from multiple sources in order of priority:
        1. Request header (X-Timezone)
        2. User profile timezone field
        3. Default to UTC
        """
        # Try to get from request header
        tz_header = self.request.headers.get('X-Timezone')
        if tz_header:
            try:
                return zoneinfo.ZoneInfo(tz_header)
            except Exception:
                pass
        
        # Try to get from user profile
        if hasattr(self.request.user, 'profile') and hasattr(self.request.user.profile, 'timezone'):
            try:
                return zoneinfo.ZoneInfo(self.request.user.profile.timezone)
            except Exception:
                pass
        
        # Default to UTC
        return zoneinfo.ZoneInfo('UTC')

    def validate_date_string(self, date_str, user_tz):
        """
        Validate and parse date string in user's timezone
        Accepts formats: YYYY-MM-DD, ISO 8601
        """
        try:
            # Parse the date string
            if 'T' in date_str or ' ' in date_str:
                # Full datetime provided
                dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                # Convert to user's timezone and extract date
                return dt.astimezone(user_tz).date()
            else:
                # Just a date provided (YYYY-MM-DD)
                return datetime.strptime(date_str, '%Y-%m-%d').date()
        except (ValueError, AttributeError) as e:
            raise ValidationError(f"Invalid date format: {date_str}. Use YYYY-MM-DD or ISO 8601 format.")

    def perform_create(self, serializer):
        # Validate that the planner_class belongs to the user
        planner_class = serializer.validated_data['planner_class']
        if planner_class.user != self.request.user:
            raise PermissionError("You can only create assignments for your own classes.")
        
        # If date is provided as string in request data, parse it in user's timezone
        if 'date' in self.request.data and isinstance(self.request.data['date'], str):
            user_tz = self.get_user_timezone()
            validated_date = self.validate_date_string(self.request.data['date'], user_tz)
            serializer.validated_data['date'] = validated_date
        
        serializer.save()

    def perform_update(self, serializer):
        # Same timezone validation for updates
        if 'date' in self.request.data and isinstance(self.request.data['date'], str):
            user_tz = self.get_user_timezone()
            validated_date = self.validate_date_string(self.request.data['date'], user_tz)
            serializer.validated_data['date'] = validated_date
        
        serializer.save()
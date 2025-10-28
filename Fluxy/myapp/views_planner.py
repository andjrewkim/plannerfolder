# views.py - Fixed to ensure serializer always has request context
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from django.db import transaction
from .models import PlannerClass, Assignment
from .serializers import PlannerClassSerializer, AssignmentSerializer
from .timezone_utils import get_user_timezone, get_user_local_date, parse_date_in_user_timezone
from datetime import timedelta
from django.utils import timezone

class PlannerClassViewSet(viewsets.ModelViewSet):
    serializer_class = PlannerClassSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PlannerClass.objects.filter(user=self.request.user)

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
        queryset = Assignment.objects.filter(planner_class__user=self.request.user)
        
        # Handle days parameter for date range filtering
        days = self.request.query_params.get('days')
        if days:
            try:
                days = int(days)
                user_tz = get_user_timezone(self.request)
                today = get_user_local_date(self.request)
                
                # Calculate range: 4 days ago to (days-4) days forward
                start_date = today - timedelta(days=4)
                end_date = today + timedelta(days=days-4)
                
                queryset = queryset.filter(
                    date__gte=start_date,
                    date__lte=end_date
                )
            except (ValueError, TypeError):
                pass  # Invalid days param, return all
        
        return queryset
    
    def get_serializer_context(self):
        """
        CRITICAL: Ensure request is always in serializer context for timezone handling
        """
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        # Validate that the planner_class belongs to the user
        planner_class = serializer.validated_data.get('planner_class')
        if planner_class and planner_class.user != self.request.user:
            raise ValidationError("You can only create assignments for your own classes.")
        
        # Date validation is now handled in the serializer's validate_date method
        # which uses parse_date_in_user_timezone automatically
        serializer.save()

    def perform_update(self, serializer):
        # Date validation is handled in the serializer
        serializer.save()
# views.py
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from django.db.models import Q
from datetime import date
from django.db import transaction
from .models import PlannerClass, Assignment
from .serializers import PlannerClassSerializer, AssignmentSerializer

class PlannerClassViewSet(viewsets.ModelViewSet):
    serializer_class = PlannerClassSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PlannerClass.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # If user has no classes, create default ones
        if not queryset.exists():
            with transaction.atomic():  # Ensure all operations happen together
                default_classes = []
                for i in range(1, 7):  # Create 6 default classes
                    default_class = PlannerClass.objects.create(
                        user=request.user,
                        name=f'Class {i}',
                        order=i-1
                    )
                    default_classes.append(default_class)
                
                # Create default assignment for Class 1 only
                if default_classes:
                    first_class = default_classes[0]  # Class 1
                    # Double-check no assignment exists for this class already
                    if not Assignment.objects.filter(planner_class=first_class).exists():
                        Assignment.objects.create(
                            planner_class=first_class,
                            title="First Assignment",
                            date=date.today(),
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

    def perform_create(self, serializer):
        # Additional validation to ensure the planner_class belongs to the user
        planner_class = serializer.validated_data['planner_class']
        if planner_class.user != self.request.user:
            raise PermissionError("You can only create assignments for your own classes.")
        serializer.save()
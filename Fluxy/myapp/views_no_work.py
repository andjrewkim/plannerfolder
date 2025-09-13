from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import NoWorkDay, PlannerClass
from .serializers import NoWorkDaySerializer

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def no_work_days_list_create(request):
    """List all no-work days (GET) or create a new one (POST)"""
    if request.method == 'GET':
        no_work_days = NoWorkDay.objects.filter(planner_class__user=request.user)
        serializer = NoWorkDaySerializer(no_work_days, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = NoWorkDaySerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_no_work_day(request, pk):
    """Delete a no-work day by ID"""
    no_work_day = get_object_or_404(NoWorkDay, pk=pk)
    
    # Ensure the no-work day belongs to the authenticated user
    if no_work_day.planner_class.user != request.user:
        return Response(
            {"error": "You can only delete your own no-work days."}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    no_work_day.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
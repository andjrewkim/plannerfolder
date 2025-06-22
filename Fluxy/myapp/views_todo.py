from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import TodoTask
from .serializers import TodoTaskSerializer
from .views import extract_schedule_info

class TodoTaskCreate(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Filter tasks by the authenticated user
        tasks = TodoTask.objects.filter(user=request.user)
        serializer = TodoTaskSerializer(tasks, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        try:
            task_data = {
                'event': request.data.get('event'),
                'date': request.data.get('date'),
                # Remove the user field from here since serializer handles it
            }
            
            # Pass context to serializer
            serializer = TodoTaskSerializer(data=task_data, context={'request': request})
            if serializer.is_valid():
                task_instance = serializer.save()
                return Response({
                    "id": task_instance.id,
                    "event": task_instance.event,
                    "date": task_instance.date,
                }, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def delete(self, request, *args, **kwargs):
        task_id = kwargs.get('task_id')
        
        try:
            # Only allow deletion of user's own tasks
            task = TodoTask.objects.get(id=task_id, user=request.user)
            task.delete()
            return Response({"message": "Task deleted successfully."}, status=status.HTTP_200_OK)
        except TodoTask.DoesNotExist:
            return Response({"message": "Task not found."}, status=status.HTTP_404_NOT_FOUND)
    
    def put(self, request, *args, **kwargs):
        task_id = kwargs.get('task_id')
        
        try:
            # Only allow updating user's own tasks
            task = TodoTask.objects.get(id=task_id, user=request.user)
        except TodoTask.DoesNotExist:
            return Response({"message": "Task not found."}, status=status.HTTP_404_NOT_FOUND)
        
        updated_data = request.data
        
        if 'event' in updated_data and not updated_data['event'].strip():
            return Response({"message": "Task event cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = TodoTaskSerializer(task, data=updated_data, partial=True)
        if serializer.is_valid():
            task_instance = serializer.save()
            return Response({
                "id": task_instance.id,
                "event": task_instance.event,
                "date": task_instance.date,
            }, status=status.HTTP_200_OK)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated


class TodoTaskViewSet(viewsets.ModelViewSet):
    serializer_class = TodoTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return only tasks for the authenticated user"""
        return TodoTask.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Set the user when creating a task"""
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        """Ensure user can only delete their own tasks"""
        if instance.user != self.request.user:
            raise PermissionError("You can only delete your own tasks")
        instance.delete()

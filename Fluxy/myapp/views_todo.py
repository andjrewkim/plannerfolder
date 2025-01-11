from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import TodoTask
from .serializers import TodoTaskSerializer
from .views import extract_schedule_info

class TodoTaskCreate(APIView):
    def get(self, request):
        tasks = TodoTask.objects.all()
        serializer = TodoTaskSerializer(tasks, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        try:
            task_data = {
                'event': request.data.get('event'),
                'date': request.data.get('date'),
            }
            
            serializer = TodoTaskSerializer(data=task_data)
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
            task = TodoTask.objects.get(id=task_id)
            task.delete()
            return Response({"message": "Task deleted successfully."}, status=status.HTTP_200_OK)
        except TodoTask.DoesNotExist:
            return Response({"message": "Task not found."}, status=status.HTTP_404_NOT_FOUND)
    
    def put(self, request, *args, **kwargs):
        task_id = kwargs.get('task_id')
        
        try:
            task = TodoTask.objects.get(id=task_id)
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


class TodoTaskViewSet(viewsets.ModelViewSet):
    queryset = TodoTask.objects.all()
    serializer_class = TodoTaskSerializer
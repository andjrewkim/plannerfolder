from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import TodoTask
from .serializers import TodoTaskSerializer
from datetime import datetime
from .views import extract_schedule_info  # Import the function you've already written


class TodoTaskCreate(APIView):
    def get(self, request):
        # Retrieve all tasks from the database
        tasks = TodoTask.objects.all()
        
        # Format the data
        data = [
            {
                "id": task.id,
                "event": task.event,
                "date": task.date,
            }
            for task in tasks
        ]
        
        return Response(data, status=status.HTTP_200_OK)
    
    def post(self, request):
        input_text = request.data.get('input_text')  
        if not input_text:
            return Response({"error": "Input text is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Extract event details from the raw input text using your pre-written function
            extracted_data = extract_schedule_info(input_text)
            
            if extracted_data['type'] == 'task':
                # Send to TodoTask API
                todoAPI = extracted_data
            elif extracted_data['type'] == 'event':
                # Send to CalendarEvent API
                eventAPI = extracted_data
            else:
                print("Unknown event type:", extracted_data['type'])
                
                
        # Get the task data from request
            task_data = {
                'event': todoAPI('event'),
                'date': todoAPI('date'),
            }
            
        # Validate and save using serializer
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
            return Response({"error": f"Error extracting event details: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
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
        
        # Get updated data
        updated_data = request.data
        
        # Validate event field
        if 'event' in updated_data and not updated_data['event'].strip():
            return Response({"message": "Task event cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Use serializer to validate and save
        serializer = TodoTaskSerializer(task, data=updated_data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    
from rest_framework import viewsets

class TodoTaskViewSet(viewsets.ModelViewSet):
    queryset = TodoTask.objects.all()  # This defines the set of tasks to work with
    serializer_class = TodoTaskSerializer  # This defines the serializer for the task model

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .views import extract_schedule_info
from .serializers import TodoTaskSerializer
from .views_api import CalendarEventCreate
from django.http import QueryDict

class ScheduleInputDispatcher(APIView):
    def post(self, request):
        # Get input text from request data
        if not isinstance(request.data, dict):
            request_data = QueryDict(request.data).dict()
        else:
            request_data = request.data.copy()
        
        input_text = request_data.get('input_text')
        if not input_text:
            return Response(
                {"error": "Input text is required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Extract schedule information
            extracted_data = extract_schedule_info(input_text)
            print("Debug - Dispatcher received type:", extracted_data.get('type'))

            if extracted_data.get('type') == 'task':
                # Prepare task data
                task_data = {
                    'event': extracted_data.get('event_name'),
                    'date': extracted_data.get('date'),
                }
                
                serializer = TodoTaskSerializer(data=task_data)
                if serializer.is_valid():
                    task = serializer.save()
                    return Response({
                        'id': task.id,
                        'event': task.event,
                        'date': task.date
                    }, status=status.HTTP_201_CREATED)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            elif extracted_data.get('type') == 'event' or extracted_data.get('type') == 'marking':
                calendar_view = CalendarEventCreate.as_view()
                
                # Just pass the extracted data directly - no need to modify recurrence_pattern
                new_data = request_data.copy()
                new_data.update(extracted_data)
                
                # Set the event_type to either 'event' or 'marking'
                new_data['event_type'] = extracted_data.get('type')
                
                request._request.POST = QueryDict('').copy()
                request._request.POST.update(new_data)
                
                return calendar_view(request._request)

            else:
                return Response(
                    {"error": f"Unknown type: {extracted_data.get('type')}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            print(f"Debug - Dispatcher error: {str(e)}")
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
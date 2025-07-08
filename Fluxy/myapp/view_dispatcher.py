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
            # Check if we already have extracted data (from frontend edits)
            if 'event_name' in request_data and 'date' in request_data:
                # Use the provided data instead of re-extracting
                extracted_data = request_data.copy()
            else:
                # Extract schedule information only if not already provided
                extracted_data = extract_schedule_info(input_text)
            
            print("Debug - Dispatcher received type:", extracted_data.get('type'))

            if extracted_data.get('type') == 'task':
                # Prepare task data - make sure all required fields are present
                task_data = {
                    'event': extracted_data.get('event_name', ''),
                    'date': extracted_data.get('date', ''),
                }
                
                print("Debug - Task data being sent to serializer:", task_data)
                
                # Pass request context to serializer if needed
                serializer = TodoTaskSerializer(data=task_data, context={'request': request})
                if serializer.is_valid():
                    task = serializer.save()
                    return Response({
                        'id': task.id,
                        'event': task.event,
                        'date': task.date
                    }, status=status.HTTP_201_CREATED)
                else:
                    print("Debug - Serializer errors:", serializer.errors)
                    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            elif extracted_data.get('type') in ['event', 'marking'] or extracted_data.get('event_type') in ['event', 'marking']:
                calendar_view = CalendarEventCreate()
                
                # Use the data as-is (don't re-extract)
                new_data = extracted_data.copy()
                
                # Remove input_text from the data being saved
                new_data.pop('input_text', None)
                
                # Create a new request with the updated data
                request.data.clear()
                request.data.update(new_data)
                
                # Call the view's post method directly
                return calendar_view.post(request)

            else:
                return Response(
                    {"error": f"Unknown type: {extracted_data.get('type')}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            print(f"Debug - Dispatcher error: {str(e)}")
            import traceback
            print(f"Debug - Full traceback: {traceback.format_exc()}")
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ScheduleInputParser(APIView):
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
            # Extract schedule information WITHOUT saving
            extracted_data = extract_schedule_info(input_text)
            print("Debug - Parser received type:", extracted_data.get('type'))

            # Return the parsed data without saving to database
            return Response(extracted_data, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"Debug - Parser error: {str(e)}")
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
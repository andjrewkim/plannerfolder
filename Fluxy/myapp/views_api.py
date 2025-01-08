from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import CalendarEvent
from .serializers import CalendarEventSerializer
from .views import extract_schedule_info  # Import the function you've already written

from datetime import datetime

class CalendarEventCreate(APIView):
    def post(self, request):
        input_text = request.data.get('input_text')
        if not input_text:
            return Response({"error": "Input text is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            extracted_data = extract_schedule_info(input_text)
            
            if extracted_data['type'] == 'task':
                todoAPI = extracted_data
                return Response({"message": "Todo task created"}, status=status.HTTP_201_CREATED)
                
            elif extracted_data['type'] == 'event':
                # Format the datetime properly
                date = extracted_data['date']
                start_time = datetime.strptime(extracted_data['start_time'], '%H:%M').time()
                end_time = datetime.strptime(extracted_data['end_time'], '%H:%M').time()
                
                event_data = {
                    'event_name': extracted_data.get('event_name'),
                    'date': date,
                    'start_time': start_time,
                    'end_time': end_time,
                    'location': extracted_data.get('location'),
                    'virtual': extracted_data.get('virtual', False),
                    'urgency': extracted_data.get('urgency', 'medium'),
                    'notes': extracted_data.get('notes'),
                    'event_type': 'event',
                    'category': extracted_data.get('category'),
                    'subcategories': ','.join(extracted_data.get('subcategories', [])),
                    'recurrence_pattern': extracted_data.get('recurrence_pattern'),
                    'color': request.data.get('color', "#000")
                }
                
                print("Debug - Formatted event data:", event_data)  # Debug print
                
                serializer = CalendarEventSerializer(data=event_data)
                if serializer.is_valid():
                    event_instance = serializer.save()
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
                print("Debug - Serializer errors:", serializer.errors)  # Debug print
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            else:
                return Response({"error": f"Unknown type: {extracted_data['type']}"}, 
                              status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            import traceback
            print(f"Error: {str(e)}")
            print(traceback.format_exc())
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, *args, **kwargs):
        event_id = kwargs.get('event_id')  # Get event_id from the URL

        try:
            # Try to get the event by ID
            event = CalendarEvent.objects.get(id=event_id)
            event.delete()  # Delete the event
            return Response({"message": "Event deleted successfully."}, status=status.HTTP_200_OK)
        except CalendarEvent.DoesNotExist:
            return Response({"message": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, *args, **kwargs):
        event_id = kwargs.get('event_id')  # Get the event ID
        try:
            # Try to fetch the event
            event = CalendarEvent.objects.get(id=event_id)
        except CalendarEvent.DoesNotExist:
            return Response({"message": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        # Get updated data
        updated_data = request.data

        # Parse and update date and time if 'start' is provided
        if 'start' in updated_data:
            start_datetime = datetime.fromisoformat(updated_data['start'])
            updated_data['date'] = start_datetime.date()
            updated_data['time'] = start_datetime.time()

        # Validate the title field
        if 'title' in updated_data:
            if not updated_data['title'].strip():  # Ensure title is not empty
                return Response({"message": "Event title cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

            # Update the event name
            updated_data['event'] = updated_data.pop('title')

        # Use the serializer to validate and save the updated data
        serializer = CalendarEventSerializer(event, data=updated_data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        # Return validation errors
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    
    def get(self, request):
        events = CalendarEvent.objects.all()
        serializer = CalendarEventSerializer(events, many=True)
        return Response(serializer.data)




from rest_framework import viewsets
from .serializers import CalendarEventSerializer

class CalendarEventViewSet(viewsets.ModelViewSet):
    queryset = CalendarEvent.objects.all()
    serializer_class = CalendarEventSerializer

    # Optionally add custom actions here if needed

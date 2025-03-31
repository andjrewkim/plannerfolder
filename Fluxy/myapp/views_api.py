from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import CalendarEvent
from .serializers import CalendarEventSerializer
from .views import extract_schedule_info  # Import the function you've already written

from datetime import datetime

class CalendarEventCreate(APIView):

    def post(self, request):
        try:
            # Format the datetime properly
            date = request.data.get('date')
            start_time = datetime.strptime(request.data.get('start_time'), '%H:%M').time()
            end_time = datetime.strptime(request.data.get('end_time'), '%H:%M').time()
            day_marking_title = request.data.get('day_marking_title', 'Blank Date')

            
            event_data = {
                'event_name': request.data.get('event_name'),
                'date': date,
                'start_time': start_time,
                'end_time': end_time,
                'location': request.data.get('location'),
                'virtual': request.data.get('virtual', False),
                'urgency': request.data.get('urgency', 'medium'),
                'notes': request.data.get('notes'),
                'event_type': 'event',
                'category': request.data.get('category'),
                'subcategories': ','.join(request.data.get('subcategories', [])),
                'recurrence_pattern': request.data.get('recurrence_pattern'),
                'day_marking_title': day_marking_title if not (start_time or end_time) else None,
                'color': request.data.get('color', "#000")
                
            }
            
            serializer = CalendarEventSerializer(data=event_data)
            if serializer.is_valid():
                event_instance = serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
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

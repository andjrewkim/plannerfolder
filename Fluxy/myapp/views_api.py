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
            
            # Handle start and end times - they might be None for marking events
            start_time = None
            end_time = None
            
            if request.data.get('start_time'):
                start_time = datetime.strptime(request.data.get('start_time'), '%H:%M').time()
            
            if request.data.get('end_time'):
                end_time = datetime.strptime(request.data.get('end_time'), '%H:%M').time()
                
            day_marking_title = request.data.get('day_marking_title')
            
            # Use the type from the extracted data
            event_type = request.data.get('type', 'event')
            
            event_data = {
                'event_name': request.data.get('event_name'),
                'date': date,
                'start_time': start_time,
                'end_time': end_time,
                'location': request.data.get('location'),
                'virtual': request.data.get('virtual', False),
                'urgency': request.data.get('urgency', 'medium'),
                'notes': request.data.get('notes'),
                'event_type': event_type,
                'category': request.data.get('category'),
                'subcategories': ','.join(request.data.get('subcategories', [])) if request.data.get('subcategories') else '',
                'recurrence_pattern': request.data.get('recurrence_pattern'),
                'day_marking_title': day_marking_title,
                'color': request.data.get('color', "#000")
            }
            
            serializer = CalendarEventSerializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=201)
            else:
                print("DEBUG: Serializer errors:", serializer.errors)  # Add this line
                return Response(serializer.errors, status=400)
                    
        except Exception as e:
            # Add more detailed error information for debugging
            import traceback
            error_details = traceback.format_exc()
            print(f"Error in CalendarEventCreate: {error_details}")
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
from rest_framework import permissions
from .serializers import CalendarEventSerializer

class CalendarEventViewSet(viewsets.ModelViewSet):
    serializer_class = CalendarEventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return only events for the authenticated user"""
        return CalendarEvent.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Set the user when creating an event"""
        serializer.save(user=self.request.user)

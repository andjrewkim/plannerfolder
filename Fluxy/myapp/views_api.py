from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import CalendarEvent
from .serializers import CalendarEventSerializer

class CalendarEventCreate(APIView):  # Define the class as a subclass of APIView
    def get(self, request):
        # Retrieve all events from the database
        events = CalendarEvent.objects.all()

        # Format the data for FullCalendar
        data = [
            {
                "id": event.id,             # Include the event ID
                "title": event.event,       # Event title
                "start": f"{event.date}T{event.time}",  # Combine date and time for FullCalendar
            }
            for event in events
        ]

        # Return the data as JSON
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        # Get the event details from the request body
        event = request.data.get('event')  # Get the event name or description
        time = request.data.get('time')   # Get the event time
        date = request.data.get('date')   # Get the event date

        # Create a dictionary with the event data
        event_data = {
            'event': event,  # 'event' field from the request
            'time': time,    # 'time' field from the request
            'date': date,    # 'date' field from the request
        }

        # Use the CalendarEventSerializer to validate and save the data
        serializer = CalendarEventSerializer(data=event_data)
        if serializer.is_valid():  # Check if the data is valid
            event_instance = serializer.save()  # Save the event to the database

            # Return the event with the ID included in the response
            return Response({
                "id": event_instance.id,  # Include the event ID
                "event": event_instance.event,
                "time": event_instance.time,
                "date": event_instance.date
            }, status=status.HTTP_201_CREATED)  # Return a successful response

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)  # Return errors if the data is invalid

    def delete(self, request, *args, **kwargs):
        event_id = kwargs.get('event_id')  # Get event_id from the URL

        try:
            # Try to get the event by ID
            event = CalendarEvent.objects.get(id=event_id)
            event.delete()  # Delete the event
            return Response({"message": "Event deleted successfully."}, status=status.HTTP_200_OK)
        except CalendarEvent.DoesNotExist:
            return Response({"message": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

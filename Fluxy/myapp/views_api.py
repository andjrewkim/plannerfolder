from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import CalendarEvent
from .serializers import CalendarEventSerializer
from .views import extract_schedule_info  # Import the function you've already written

from datetime import datetime

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
                "color": event.color, 
            }
            for event in events
        ]

        # Return the data as JSON
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        # Get the raw event text from the request body
        input_text = request.data.get('input_text')  # Assume the input text is sent with the key 'input_text'

        if not input_text:
            return Response({"error": "Input text is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Extract event details from the raw input text using your pre-written function
            extracted_data = extract_schedule_info(input_text)

            # The extracted data should contain 'event', 'date', and 'time'
            event_data = {
                'event': extracted_data['event'],  # Extracted event name
                'date': extracted_data['date'],    # Extracted event date
                'time': extracted_data['time'],    # Extracted event time
                'color': request.data.get('color', "#000"),  # Default color if not provided
            }

            # Use the CalendarEventSerializer to validate and save the event data
            serializer = CalendarEventSerializer(data=event_data)
            if serializer.is_valid():  # Check if the data is valid
                event_instance = serializer.save()  # Save the event to the database

                # Return the event data with the ID included in the response
                return Response({
                    "id": event_instance.id,  # Include the event ID
                    "event": event_instance.event,
                    "time": event_instance.time,
                    "date": event_instance.date,
                    "color": event_instance.color
                }, status=status.HTTP_201_CREATED)  # Return a successful response

            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)  # Return errors if the data is invalid

        except Exception as e:
            return Response({"error": f"Error extracting event details: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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




from rest_framework import viewsets
from .models import CalendarEvent
from .serializers import CalendarEventSerializer

class CalendarEventViewSet(viewsets.ModelViewSet):
    queryset = CalendarEvent.objects.all()
    serializer_class = CalendarEventSerializer

    # Optionally add custom actions here if needed

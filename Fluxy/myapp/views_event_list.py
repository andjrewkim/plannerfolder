from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import CalendarEvent  # Assuming your event model is called CalendarEvent
from rest_framework import status

class CalendarEventCreate(APIView):
    
    # Handle POST requests to create an event
    def post(self, request, *args, **kwargs):
        event_name = request.data.get('event')
        event_date = request.data.get('date')
        event_time = request.data.get('time')

        # Create and save the event
        event = CalendarEvent.objects.create(
            name=event_name, 
            date=event_date, 
            time=event_time
        )

        return Response({"message": "Event created successfully."}, status=status.HTTP_201_CREATED)
    
    # Handle DELETE requests to delete an event
    def delete(self, request, *args, **kwargs):
        event_id = request.data.get('event_id')  # Get event_id from the request

        try:
            event = CalendarEvent.objects.get(id=event_id)
            event.delete()
            return JsonResponse({"message": "Event deleted successfully."}, status=status.HTTP_200_OK)
        except CalendarEvent.DoesNotExist:
            return JsonResponse({"message": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

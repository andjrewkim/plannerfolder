from django.shortcuts import render
from .forms import UserInputForm
from transformers import pipeline
import re


# myapp/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import CalendarEvent
from .serializers import CalendarEventSerializer

class CalendarEventCreate(APIView):  # Define the class as a subclass of APIView
    def post(self, request):
        # Get the event details from the request body
        event = request.data.get('event')  # Get the event name or description
        time = request.data.get('time')  # Get the event time
        date = request.data.get('date')  # Get the event date
        
        # Create a dictionary with the event data
        event_data = {
            'event': event,  # 'event' field from the request
            'time': time,    # 'time' field from the request
            'date': date,    # 'date' field from the request
        }

        # Use the CalendarEventSerializer to validate and save the data
        serializer = CalendarEventSerializer(data=event_data)
        if serializer.is_valid():  # Check if the data is valid
            serializer.save()  # Save the event to the database
            return Response(serializer.data, status=status.HTTP_201_CREATED)  # Return a successful response
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)  # Return errors if the data is invalid




"""
from api.models import CalendarEvent
from api.serializers import CalendarEventSerializer
from rest_framework import status
from rest_framework.response import Response

def create_calendar_event(request):
    text_input = request.data.get('text_input')
    # Extract relevant information from the text input
    title = 'Tennis practice'
    start_time = '2023-05-27T19:00:00'
    end_time = '2023-05-27T20:00:00'

    event_data = {
        'title': title,
        'start_time': start_time,
        'end_time': end_time,
    }
    serializer = CalendarEventSerializer(data=event_data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
"""



def calendar_view(request):
    events = Event.objects.all()
    return render(request, 'calendar.html', {'events': events})

# Load the NER pipeline
ner_pipeline = pipeline("ner", model="dbmdz/bert-large-cased-finetuned-conll03-english", aggregation_strategy="simple")

def extract_schedule_info(user_input):
    entities = ner_pipeline(user_input)
    event, time, date = "", "", ""
    for entity in entities:
        if entity['entity_group'] in ['MISC', 'ORG']:
            event += " " + entity['word']
        elif entity['entity_group'] == 'TIME':
            time += " " + entity['word']
        elif entity['entity_group'] == 'DATE':
            date += " " + entity['word']
    event = event.strip()
    time = time.strip()
    date = date.strip() if date.strip() else None

    # If event is empty, use regex to extract more information
    if not event:
        main_event_pattern = r'(?i)(?:I have|I need|I will|attend|working on|I want|work|homework|task|project|event|meeting|activity|upcoming)?\s*(.*?)(?=\s+at\s+|\s+on\s+|$)'
        main_event_match = re.search(main_event_pattern, user_input)
        if main_event_match:
            event = main_event_match.group(1).strip()

    # Use regex to find additional time and date if they weren't detected
    time_patterns = r'(\d{1,2}:\d{2} ?[APMapm]{2}|\d{1,2} ?[APMapm]{2})|(\d{1,2} - \d{1,2} ?[APMapm]{2})'
    date_patterns = r'(?:(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?: to (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))?)|(\b\w+ \d{1,2}(?:th|st|nd|rd)?(?: of \w+)? \d{4})|\b(\w+ \d{1,2})'
    time_matches = re.findall(time_patterns, user_input)
    date_matches = re.findall(date_patterns, user_input)
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    found_days = [day for day in day_names if day.lower() in user_input.lower()]

    # Set date if found
    if found_days:
        date = ', '.join(found_days)
    if time_matches:
        flat_time_matches = [match for group in time_matches for match in group if match]
        time = ', '.join(flat_time_matches)

    # Prepare the extracted information
    events_info = {
    'event': event.strip() if event else '',
    'time': time.strip() if time else '',
    'date': date.strip() if date else ''
}

    return events_info

def home(request):
    result = None
    if request.method == "POST":
        form = UserInputForm(request.POST)
        if form.is_valid():
            user_input = form.cleaned_data['user_input']
            result = extract_schedule_info(user_input)
    else:
        form = UserInputForm()
    return render(request, 'home.html', {'form': form, 'result': result})

from django.shortcuts import render
from .forms import UserInputForm
from transformers import pipeline

# Load the NER pipeline
ner_pipeline = pipeline("ner", model="dbmdz/bert-large-cased-finetuned-conll03-english", aggregation_strategy="simple")

#__________________________________________________________________________________________________

import datetime
import re

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

    # If days are found, convert to actual date
    if found_days:
        # Get today's date
        today = datetime.date.today()
        # Convert found days to actual dates
        date = []
        for day in found_days:
            day_index = day_names.index(day)
            # Calculate the days difference from today
            days_diff = (day_index - today.weekday()) % 7  # Calculate days until the next occurrence
            target_date = today + datetime.timedelta(days=days_diff)
            date.append(target_date.strftime('%Y-%m-%d'))  # Format as YYYY-MM-DD
        date = ', '.join(date)

    # Handle time extraction and conversion to 24-hour format
    if time_matches:
        flat_time_matches = [match for group in time_matches for match in group if match]
        time = ', '.join(flat_time_matches)
    
    # Convert time (e.g., "5pm" or "5:00pm") to 24-hour format if necessary
    if time:
        time = convert_to_24_hour_format(time)

    # Prepare the extracted information
    events_info = {
        'event': event.strip() if event else '',
        'time': time.strip() if time else '',
        'date': date.strip() if date else ''
    }

    return events_info

def convert_to_24_hour_format(time_str):
    """Converts time in 12-hour format (e.g., '5pm') to 24-hour format (e.g., '17:00')."""
    try:
        # Check if the time is in a 12-hour format and convert to 24-hour format
        time_obj = datetime.datetime.strptime(time_str, '%I%p')  # e.g., '5pm' -> '17:00'
        return time_obj.strftime('%H:%M')  # '17:00'
    except ValueError:
        # If the time is already in 24-hour format (e.g., '17:00'), return it unchanged
        try:
            time_obj = datetime.datetime.strptime(time_str, '%H:%M')  # e.g., '17:00'
            return time_obj.strftime('%H:%M')
        except ValueError:
            return time_str  # Return original if no valid format is found



#___________________________________________________________________________________


from django.shortcuts import render
from .forms import UserInputForm
from .models import CalendarEvent

def home(request):
    result = None
    if request.method == "POST":
        form = UserInputForm(request.POST)
        if form.is_valid():
            # Get user input from the form
            user_input = form.cleaned_data['user_input']
            
            # Extract schedule information
            result = extract_schedule_info(user_input)

            # Save the extracted information to the database
            if result:
                CalendarEvent.objects.create(
                    event=result.get("event"),
                    time=result.get("time"),
                    date=result.get("date"),
                )
    else:
        form = UserInputForm()

    # Get all events to display in the calendar
    events = CalendarEvent.objects.all()

    # Pass the form, result, and events to the template
    return render(request, 'home.html', {
        'form': form,
        'result': result,
        'events': events,
    })

def calendar_view(request):
    events = Event.objects.all()
    return render(request, 'calendar.html', {'events': events})
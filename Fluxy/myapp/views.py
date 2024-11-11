from django.shortcuts import render
from .forms import UserInputForm
from transformers import pipeline
import re

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
    events_info = {'event': event.strip(), 'time': time.strip(), 'date': date.strip()}
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

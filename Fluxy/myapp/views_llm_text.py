from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import requests
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod
from django.conf import settings
import re
from datetime import datetime, timedelta
from django.utils import timezone
import pytz

class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    def call_llm(self, message: str, **kwargs) -> Dict[str, Any]:
        """Call the LLM API and return response"""
        pass


class GeminiProvider(LLMProvider):
    """Google Gemini API provider with prompt support and calendar integration"""
    
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash", events_function=None, update_event_function=None):
        self.api_key = api_key
        self.model = model
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        self.events_function = events_function
        self.update_event_function = update_event_function
    
    def format_date(self, date_obj):
        """Format date object to YYYY-MM-DD string"""
        if hasattr(date_obj, 'date'):
            return date_obj.date().strftime('%Y-%m-%d')
        elif hasattr(date_obj, 'strftime'):
            return date_obj.strftime('%Y-%m-%d')
        else:
            # Handle string dates that might have time components
            date_str = str(date_obj)
            if ' ' in date_str:
                date_str = date_str.split(' ')[0]
            if '+' in date_str:
                date_str = date_str.split('+')[0]
            return date_str
    
    def get_week_date_range(self):
        """Get the start and end dates for the current week (next 7 days)"""
        try:
            # Get current date in Pacific timezone
            pacific_tz = pytz.timezone('America/Los_Angeles')
            now_pacific = timezone.now().astimezone(pacific_tz)
            today = now_pacific.date()
            
            # Week starts from today and goes 7 days forward
            week_start = today
            week_end = today + timedelta(days=6)  # 7 days total including today
            
            print(f"DEBUG: Week range: {week_start} to {week_end}")
            return week_start, week_end
            
        except Exception as e:
            print(f"ERROR: Failed to get week range: {e}")
            # Fallback to system local time
            today = datetime.now().date()
            week_start = today
            week_end = today + timedelta(days=6)
            return week_start, week_end
    
    def filter_events_by_week(self, events):
        """Filter events to only include those in the current week"""
        week_start, week_end = self.get_week_date_range()
        
        filtered_events = []
        for event in events:
            try:
                # Get the event date
                event_date = getattr(event, 'date', None)
                if event_date:
                    # Convert to date object if it's a datetime
                    if hasattr(event_date, 'date'):
                        event_date = event_date.date()
                    elif isinstance(event_date, str):
                        # Parse string date
                        event_date = datetime.strptime(event_date.split(' ')[0], '%Y-%m-%d').date()
                    
                    # Check if event is within the week range
                    if week_start <= event_date <= week_end:
                        filtered_events.append(event)
                        print(f"DEBUG: Including event '{getattr(event, 'event_name', 'Unknown')}' on {event_date}")
                    else:
                        print(f"DEBUG: Excluding event '{getattr(event, 'event_name', 'Unknown')}' on {event_date} (outside week range)")
                        
            except Exception as e:
                print(f"ERROR: Failed to filter event {event}: {e}")
                # Include event if we can't determine its date (better safe than sorry)
                filtered_events.append(event)
        
        print(f"DEBUG: Filtered {len(filtered_events)} events from {len(events)} total events")
        return filtered_events
    
    def fetch_calendar_events(self):
        """Fetch events using the provided database function, filtered to current week only"""
        if not self.events_function:
            return []
            
        try:
            # Get all events from database
            all_events = self.events_function()
            
            # Filter to only show events for the current week
            week_events = self.filter_events_by_week(all_events)
            
            # Convert Django QuerySet to minimal list of dictionaries
            events_list = []
            for event in week_events:
                event_dict = {
                    'name': getattr(event, 'event_name', 'Untitled'),
                    'date': self.format_date(getattr(event, 'date', 'No date')),
                    'start': str(getattr(event, 'start_time', 'No time')),
                    'end': str(getattr(event, 'end_time', 'No time')),
                    'id': getattr(event, 'id', None)  # Keep ID for updates
                }
                events_list.append(event_dict)
            
            print(f"DEBUG: Fetched {len(events_list)} events for current week")
            return events_list
            
        except Exception as e:
            print(f"Error fetching calendar events: {e}")
            return []
    
    def format_events_for_context(self, events_data):
        """Format events for LLM context with minimal tokens"""
        if not events_data:
            return "No events this week."
            
        formatted = ["This week's events:"]
        for event in events_data:
            name = event.get('name', 'Untitled')
            date = event.get('date', 'No date')
            start = event.get('start', 'No time')
            end = event.get('end', 'No time')
            event_line = f"{name}|{date}|{start}-{end}"
            formatted.append(event_line)
        return "\n".join(formatted)
    
    def get_event_management_prompt(self):
        """Get system prompt for event management"""
        # Get current date and week range in Pacific timezone
        try:
            pacific_tz = pytz.timezone('America/Los_Angeles')
            now_pacific = timezone.now().astimezone(pacific_tz)
            today = now_pacific.strftime('%Y-%m-%d')
            
            # Calculate week range for context
            week_start, week_end = self.get_week_date_range()
            week_range = f"{week_start} to {week_end}"
            
        except:
            # Fallback to system local time
            import time
            today = time.strftime('%Y-%m-%d')
            week_end = (datetime.now() + timedelta(days=6)).strftime('%Y-%m-%d')
            week_range = f"{today} to {week_end}"
            
        return f"""You are a calendar assistant. Today is {today}. You can view and modify events for this week ({week_range}).

Event format: EventName|Date|StartTime-EndTime

To modify events, use this format:
CHANGE:EventName|NewDate|NewStartTime-NewEndTime

Rules:
- Only events for this week ({week_range}) are shown
- Only output CHANGE: lines if user requests modifications
- For normal chat, respond naturally without CHANGE: lines
- Keep event names short
- Use format: YYYY-MM-DD for dates, HH:MM for times
- Multiple events: separate CHANGE: lines
- When moving date, keep time the same unless specified
- If user asks to schedule outside this week, mention you can only see the next 7 days

Examples:
User: "Move meeting to 2pm"
Response: "I'll reschedule your meeting to 2pm.
CHANGE:Meeting|2024-01-15|14:00-15:00"

User: "How's my schedule?"
Response: "This week you have a meeting from 10am-11am today."
"""
    
    def parse_event_changes(self, response_text):
        """Parse CHANGE: lines from LLM response"""
        changes = []
        lines = response_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if line.startswith('CHANGE:'):
                try:
                    # Remove CHANGE: prefix
                    change_data = line[7:]  # Remove "CHANGE:"
                    parts = change_data.split('|')
                    
                    if len(parts) == 3:
                        name = parts[0].strip()
                        date = parts[1].strip()
                        time_range = parts[2].strip()
                        
                        # Parse time range
                        if '-' in time_range:
                            start_time, end_time = time_range.split('-', 1)
                            changes.append({
                                'name': name,
                                'date': date,
                                'start_time': start_time.strip(),
                                'end_time': end_time.strip()
                            })
                except Exception as e:
                    print(f"Error parsing change line '{line}': {e}")
                    continue
        
        print(f"DEBUG: Parsed {len(changes)} changes: {changes}")
        return changes
    
    def clean_response_text(self, response_text):
        """Remove CHANGE: lines from response text for user display"""
        lines = response_text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            if not line.strip().startswith('CHANGE:'):
                cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines).strip()
    
    def find_matching_event(self, change, original_events):
        """Find matching event by name, with fuzzy matching"""
        change_name = change['name'].lower().strip()
        
        # First try exact match
        for event in original_events:
            if event['name'].lower().strip() == change_name:
                return event
        
        # Try partial match
        for event in original_events:
            if change_name in event['name'].lower() or event['name'].lower() in change_name:
                return event
        
        return None
    
    def apply_event_changes(self, changes, original_events):
        """Apply event changes to the database"""
        if not self.update_event_function or not changes:
            print("DEBUG: No update function or no changes to apply")
            return False
        
        print(f"DEBUG: Applying {len(changes)} changes to {len(original_events)} events")
        
        updated_events = []
        for change in changes:
            print(f"DEBUG: Processing change: {change}")
            
            # Find matching event
            matching_event = self.find_matching_event(change, original_events)
            
            if matching_event and matching_event['id']:
                try:
                    print(f"DEBUG: Found matching event: {matching_event}")
                    
                    # Call the update function with event ID and new data
                    success = self.update_event_function(
                        event_id=matching_event['id'],
                        event_name=change['name'],
                        date=change['date'],
                        start_time=change['start_time'],
                        end_time=change['end_time']
                    )
                    
                    print(f"DEBUG: Update function returned: {success}")
                    
                    if success:
                        updated_events.append(matching_event['id'])
                        print(f"DEBUG: Successfully updated event {matching_event['id']}")
                    else:
                        print(f"DEBUG: Update function returned False for event {matching_event['id']}")
                        
                except Exception as e:
                    print(f"ERROR: Exception updating event {matching_event['id']}: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
            else:
                print(f"DEBUG: No matching event found for change: {change}")
                print(f"DEBUG: Available events: {[e['name'] for e in original_events]}")
        
        print(f"DEBUG: Updated {len(updated_events)} events: {updated_events}")
        return len(updated_events) > 0
    
    def call_llm_with_calendar(self, message: str, include_events: bool = True, prompt: str = None, **kwargs) -> Dict[str, Any]:
        """Call LLM with calendar context (week view only)"""
        print(f"DEBUG: call_llm_with_calendar called with include_events={include_events}")
        print(f"DEBUG: events_function exists: {self.events_function is not None}")
        print(f"DEBUG: update_event_function exists: {self.update_event_function is not None}")
        
        if include_events and self.events_function:
            print("DEBUG: About to fetch calendar events for current week")
            events_data = self.fetch_calendar_events()
            calendar_context = self.format_events_for_context(events_data)
            
            # Use event management prompt if no custom prompt provided
            if prompt is None:
                prompt = self.get_event_management_prompt()
            
            enhanced_message = f"""Context: {calendar_context}

User: {message}"""
            print(f"DEBUG: Enhanced message created with week calendar context")
            
            # Call LLM
            result = self.call_llm(enhanced_message, prompt=prompt, **kwargs)
            
            # Parse for event changes if successful
            if result.get("success"):
                response_text = result.get("response", "")
                print(f"DEBUG: LLM response: {response_text}")
                
                changes = self.parse_event_changes(response_text)
                cleaned_response = self.clean_response_text(response_text)
                
                # Update result with parsed changes
                result["response"] = cleaned_response
                result["event_changes"] = changes
                result["has_changes"] = len(changes) > 0
                
                print(f"DEBUG: Found {len(changes)} changes, has_changes: {result['has_changes']}")
                
                # Apply changes to database if update function is available
                if changes and self.update_event_function:
                    print("DEBUG: Attempting to apply changes to database")
                    update_success = self.apply_event_changes(changes, events_data)
                    result["changes_applied"] = update_success
                    
                    if update_success:
                        print("DEBUG: Changes applied successfully, refreshing events")
                        # Refresh events data to return updated info
                        result["updated_events"] = self.fetch_calendar_events()
                    else:
                        print("DEBUG: Changes were not applied successfully")
                else:
                    print("DEBUG: No changes to apply or no update function")
                    result["changes_applied"] = False
                
                # Store original events for reference
                result["original_events"] = events_data
            else:
                print(f"DEBUG: LLM call failed: {result}")
            
            return result
        else:
            print("DEBUG: Skipping calendar integration - calling regular call_llm")
            return self.call_llm(message, prompt=prompt, **kwargs)
    
    def call_llm(self, message: str, prompt: str = None, **kwargs) -> Dict[str, Any]:
        headers = {
            "Content-Type": "application/json"
        }
        
        # Gemini API configuration
        generation_config = {
            "maxOutputTokens": kwargs.get("max_tokens", 1000),  # Increased default
            "temperature": kwargs.get("temperature", 0.7),
            "topP": kwargs.get("top_p", 0.95),
            "topK": kwargs.get("top_k", 40)
        }
        
        # Prepare the contents array
        contents = []
        
        # For Gemini, we need to combine system prompt and user message
        # since Gemini doesn't have a separate system role
        if prompt:
            combined_message = f"{prompt}\n\n{message}"
        else:
            combined_message = message
        
        contents.append({
            "parts": [
                {
                    "text": combined_message
                }
            ]
        })
        
        payload = {
            "contents": contents,
            "generationConfig": generation_config
        }
        
        try:
            # Add API key as query parameter
            url = f"{self.base_url}?key={self.api_key}"
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # Extract response from Gemini API structure
            if "candidates" in data and len(data["candidates"]) > 0:
                candidate = data["candidates"][0]
                if "content" in candidate and "parts" in candidate["content"]:
                    response_text = candidate["content"]["parts"][0]["text"]
                    return {
                        "success": True,
                        "response": response_text,
                        "model": self.model,
                        "finish_reason": candidate.get("finishReason", "STOP")
                    }
            
            return {
                "success": False,
                "error": "No valid response from Gemini API"
            }
            
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": str(e)
            }
        except (KeyError, IndexError) as e:
            return {
                "success": False,
                "error": f"Error parsing Gemini response: {str(e)}"
            }

    def call_llm_with_system_prompt(self, message: str, system_prompt: str, **kwargs) -> Dict[str, Any]:
        """Convenience method for system prompts"""
        return self.call_llm(message, prompt=system_prompt, **kwargs)


class LLMService:
    """Service class to manage LLM providers"""
    
    def __init__(self):
        self.providers = {}
    
    def register_provider(self, name: str, provider: LLMProvider):
        """Register a new LLM provider"""
        self.providers[name] = provider
    
    def get_provider(self, name: str) -> Optional[LLMProvider]:
        """Get a registered provider by name"""
        return self.providers.get(name)
    
    def list_providers(self) -> list:
        """List all registered providers"""
        return list(self.providers.keys())


llm_service = LLMService()


@csrf_exempt
@require_http_methods(["POST"])
def llm_text(request):
    """
    Django view for LLM chat functionality with week-limited calendar context
    
    Expected POST data:
    {
        "message": "User input message",
        "provider": "gemini" (optional, defaults to first available),
        "max_tokens": 1000 (optional),
        "temperature": 0.7 (optional),
        "top_p": 0.95 (optional, for Gemini),
        "top_k": 40 (optional, for Gemini),
        "prompt": "System prompt text" (optional),
        "include_calendar": true (optional, defaults to true for providers that support it)
    }
    
    Response includes:
    {
        "success": true,
        "response": "AI response text",
        "event_changes": [
            {
                "name": "Event Name",
                "date": "2024-01-15",
                "start_time": "14:00",
                "end_time": "15:00"
            }
        ],
        "has_changes": true,
        "changes_applied": true,
        "updated_events": [...],
        "original_events": [...],
        "provider": "gemini"
    }
    """
    try:
        # Parse request data
        data = json.loads(request.body)
        message = data.get("message", "").strip()
        provider_name = data.get("provider")
        system_prompt = data.get("prompt")
        include_calendar = data.get("include_calendar", True)
        
        # Validate input
        if not message:
            return JsonResponse({
                "success": False,
                "error": "Message is required"
            }, status=400)
        
        # Get available providers
        available_providers = llm_service.list_providers()
        if not available_providers:
            return JsonResponse({
                "success": False,
                "error": "No LLM providers configured"
            }, status=500)
        
        # Select provider
        if provider_name:
            if provider_name not in available_providers:
                return JsonResponse({
                    "success": False,
                    "error": f"Provider '{provider_name}' not available. Available: {available_providers}"
                }, status=400)
            provider = llm_service.get_provider(provider_name)
        else:
            # Use first available provider
            provider_name = available_providers[0]
            provider = llm_service.get_provider(provider_name)
        
        # Prepare optional parameters
        llm_kwargs = {}
        if "max_tokens" in data:
            llm_kwargs["max_tokens"] = data["max_tokens"]
        if "temperature" in data:
            llm_kwargs["temperature"] = data["temperature"]
        # Additional parameters for Gemini
        if "top_p" in data:
            llm_kwargs["top_p"] = data["top_p"]
        if "top_k" in data:
            llm_kwargs["top_k"] = data["top_k"]
        
        # Call LLM with calendar context (if available and requested)
        print(f"DEBUG: About to call LLM. Provider type: {type(provider).__name__}")
        print(f"DEBUG: include_calendar: {include_calendar}")
        print(f"DEBUG: hasattr call_llm_with_calendar: {hasattr(provider, 'call_llm_with_calendar')}")
        
        if hasattr(provider, 'call_llm_with_calendar') and include_calendar:
            print("DEBUG: Calling call_llm_with_calendar (week view)")
            result = provider.call_llm_with_calendar(message, prompt=system_prompt, **llm_kwargs)
        else:
            print("DEBUG: Calling regular call_llm")
            result = provider.call_llm(message, prompt=system_prompt, **llm_kwargs)
        
        # Add provider info to response
        if result["success"]:
            result["provider"] = provider_name
        
        return JsonResponse(result)
        
    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "error": "Invalid JSON in request body"
        }, status=400)
    
    except Exception as e:
        import traceback
        print(f"ERROR: Exception in llm_text view: {e}")
        traceback.print_exc()
        return JsonResponse({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }, status=500)


# Example usage in settings.py or apps.py
"""
from django.conf import settings
from .views import llm_service, GeminiProvider

# Register Gemini provider with API key from settings
if hasattr(settings, 'GEMINI_API_KEY'):
    llm_service.register_provider("gemini", GeminiProvider(
        api_key=settings.GEMINI_API_KEY,
        model=getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash'),
        events_function=your_events_function,
        update_event_function=your_update_event_function
    ))
"""


# Updated helper functions for week-filtered calendar events

from datetime import datetime, timedelta
from django.utils import timezone
import pytz

def update_calendar_event(event_id, event_name, date, start_time, end_time):
    """
    Update a calendar event in the database
    
    Args:
        event_id: ID of the event to update
        event_name: New event name
        date: New date (YYYY-MM-DD format)
        start_time: New start time (HH:MM format)  
        end_time: New end time (HH:MM format)
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Import your Event model here - replace 'YourApp' with your actual app name
        from myapp.models import CalendarEvent  # CHANGE THIS LINE
        
        # Get the event
        event = CalendarEvent.objects.get(id=event_id)
        
        # Update the event fields
        event.event_name = event_name
        
        # Parse the date string to a date object
        if isinstance(date, str):
            event.date = datetime.strptime(date, '%Y-%m-%d').date()
        else:
            event.date = date
        
        # Parse time strings to time objects
        if isinstance(start_time, str):
            event.start_time = datetime.strptime(start_time, '%H:%M').time()
        else:
            event.start_time = start_time
            
        if isinstance(end_time, str):
            event.end_time = datetime.strptime(end_time, '%H:%M').time()
        else:
            event.end_time = end_time
        
        # Save the event
        event.save()
        
        print(f"DEBUG: Successfully updated event {event_id}")
        return True
        
    except CalendarEvent.DoesNotExist:
        print(f"ERROR: Event with ID {event_id} not found")
        return False
    except Exception as e:
        print(f"ERROR: Failed to update event {event_id}: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_calendar_events():
    """
    Get all calendar events from the database
    NOTE: The GeminiProvider will filter these to only show the current week
    
    Returns:
        QuerySet: All events ordered by date
    """
    try:
        from myapp.models import CalendarEvent  # CHANGE THIS LINE
        
        return CalendarEvent.objects.all().order_by('date', 'start_time')
    except Exception as e:
        print(f"ERROR: Failed to fetch events: {e}")
        return []


def get_week_calendar_events():
    """
    Get calendar events for the current week only (next 7 days from today)
    This is an alternative function if you want to filter at the database level
    
    Returns:
        QuerySet: Events for the current week only
    """
    try:
        from myapp.models import CalendarEvent  # CHANGE THIS LINE
        
        # Get current date in Pacific timezone
        pacific_tz = pytz.timezone('America/Los_Angeles')
        now_pacific = timezone.now().astimezone(pacific_tz)
        today = now_pacific.date()
        
        # Calculate week range (today + 6 days)
        week_start = today
        week_end = today + timedelta(days=6)
        
        print(f"DEBUG: Fetching events from {week_start} to {week_end}")
        
        # Filter events to current week
        return CalendarEvent.objects.filter(
            date__gte=week_start,
            date__lte=week_end
        ).order_by('date', 'start_time')
        
    except Exception as e:
        print(f"ERROR: Failed to fetch week events: {e}")
        return []
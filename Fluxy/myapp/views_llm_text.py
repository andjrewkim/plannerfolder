from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.views import View
from django.conf import settings
from django.utils import timezone
import json
import requests
import os
from typing import Dict, Any, Optional, Tuple, List
from abc import ABC, abstractmethod
from datetime import datetime, date, time as time_module, timedelta
import pytz
from myapp.models import LLMUsage
import time
import re



class LLMConfig:
    """Configuration class for LLM providers"""
    
    # Default models - can be overridden by settings/env
    DEFAULT_MODELS = {
        'gemini': 'gemini-1.5-flash',
        'openai': 'gpt-4.1-nano-2025-04-14'
    }
    
    @classmethod
    def get_api_key(cls, provider: str) -> str:
        """Get API key from environment or settings"""
        env_key = f"{provider.upper()}_API_KEY"
        
        # Try environment first
        api_key = os.getenv(env_key)
        if api_key:
            return api_key.strip()
        
        # Try Django settings
        settings_key = f"{provider.upper()}_API_KEY"
        api_key = getattr(settings, settings_key, None)
        if api_key:
            return api_key.strip()
        
        raise ValueError(f"No API key found for {provider}. Set {env_key} environment variable or {settings_key} in settings.")
    
    @classmethod
    def get_model(cls, provider: str) -> str:
        """Get model name from environment, settings, or default"""
        env_key = f"{provider.upper()}_MODEL"
        
        # Try environment first
        model = os.getenv(env_key)
        if model:
            return model.strip()
        
        # Try Django settings
        settings_key = f"{provider.upper()}_MODEL"
        model = getattr(settings, settings_key, None)
        if model:
            return model.strip()
        
        # Use default
        return cls.DEFAULT_MODELS.get(provider, f"default-{provider}-model")
    
    @classmethod
    def get_default_provider(cls) -> str:
        """Get default provider from environment or settings"""
        # Try environment first
        provider = os.getenv('DEFAULT_LLM_PROVIDER')
        if provider:
            return provider.lower().strip()
        
        # Try Django settings
        provider = getattr(settings, 'DEFAULT_LLM_PROVIDER', None)
        if provider:
            return provider.lower().strip()
        
        # Default fallback
        return 'gemini'
    
    @classmethod
    def get_enabled_providers(cls) -> list:
        """Get list of enabled providers from environment or settings"""
        # Try environment first
        providers = os.getenv('ENABLED_LLM_PROVIDERS')
        if providers:
            return [p.strip().lower() for p in providers.split(',')]
        
        # Try Django settings
        providers = getattr(settings, 'ENABLED_LLM_PROVIDERS', None)
        if providers:
            if isinstance(providers, str):
                return [p.strip().lower() for p in providers.split(',')]
            elif isinstance(providers, list):
                return [p.lower() for p in providers]
        
        # Default fallback - try to enable providers that have API keys
        enabled = []
        for provider in ['gemini', 'openai']:
            try:
                cls.get_api_key(provider)
                enabled.append(provider)
            except ValueError:
                continue
        
        return enabled or ['gemini']  # Fallback to gemini if none found




class BaseLLMProvider(ABC):
    """Ultra-efficient token-minimized calendar LLM provider"""
    
    def __init__(self, api_key: str, model: str, events_function=None, update_event_function=None, create_event_function=None, delete_event_function=None):
        if not api_key or not api_key.strip():
            raise ValueError(f"{self.__class__.__name__} API key cannot be empty")
        if not model or not model.strip():
            raise ValueError(f"{self.__class__.__name__} model cannot be empty")
            
        self.api_key = api_key.strip()
        self.model = model.strip()
        self.events_function = events_function
        self.update_event_function = update_event_function
        self.create_event_function = create_event_function
        self.delete_event_function = delete_event_function
        
        # Cache for event lookups
        self._event_cache = {}
        self._id_counter = 0
        
        self._validate_api_key()

    @abstractmethod
    def _validate_api_key(self):
        """Test if API key is valid"""
        pass
    
    @abstractmethod
    def _make_api_request(self, message: str, prompt: str = None, max_retries: int = 3, **kwargs) -> Dict[str, Any]:
        """Make the actual API request"""
        pass
    
    # ==================== TIME/DATE UTILITIES ====================
    
    def get_current_week_info(self) -> Tuple[date, int, str]:
        """Get week start date, current day index (0=Mon), and compact week range"""
        try:
            pacific_tz = pytz.timezone('America/Los_Angeles')
            now = timezone.now().astimezone(pacific_tz)
            today = now.date()
        except:
            today = datetime.now().date()
        
        # Get Monday of current week
        days_since_monday = today.weekday()
        week_start = today - timedelta(days=days_since_monday)
        current_day_idx = days_since_monday
        
        # Compact week range: "Jan15-21/25"
        week_end = week_start + timedelta(days=6)
        month_abbrev = week_start.strftime('%b')
        week_range = f"{month_abbrev}{week_start.day}-{week_end.day}/{week_start.strftime('%y')}"
        
        return week_start, current_day_idx, week_range
    
    def date_to_compact(self, date_obj) -> str:
        """Convert date to compact format: M15 (Mon15), T16 (Tue16), etc."""
        try:
            if hasattr(date_obj, 'date'):
                date_obj = date_obj.date()
            elif isinstance(date_obj, str):
                date_part = date_obj.split(' ')[0].split('T')[0]
                date_obj = datetime.strptime(date_part, '%Y-%m-%d').date()
            
            week_start, _, _ = self.get_current_week_info()
            day_diff = (date_obj - week_start).days
            
            if 0 <= day_diff <= 6:
                day_letters = ['M', 'T', 'W', 'R', 'F', 'S', 'U']  # Mon-Sun
                return f"{day_letters[day_diff]}{date_obj.day}"
            else:
                # Outside current week - use full compact: Jan15/25
                return f"{date_obj.strftime('%b')}{date_obj.day}/{date_obj.strftime('%y')}"
        except Exception as e:
            print(f"DEBUG: Error in date_to_compact: {e}")
            return str(date_obj)
    
    def compact_to_date(self, compact: str) -> Optional[date]:
        """Convert compact format like W17 or M6 to a real date."""
        try:
            compact = compact.strip()
            week_start, _, _ = self.get_current_week_info()
            
            print(f"DEBUG: Converting compact date '{compact}' with week_start {week_start}")
            
            # Handle current week format: M15, T16, etc.
            if len(compact) >= 2 and compact[0] in 'MTWRFSU':
                day_letters = {'M': 0, 'T': 1, 'W': 2, 'R': 3, 'F': 4, 'S': 5, 'U': 6}
                day_idx = day_letters.get(compact[0])
                
                if day_idx is not None:
                    try:
                        day_num = int(compact[1:])
                        # Get the weekday of current week
                        base_date = week_start + timedelta(days=day_idx)
                        
                        # If day_num matches the actual day, use it
                        if base_date.day == day_num:
                            print(f"DEBUG: Exact match for {compact} -> {base_date}")
                            return base_date
                        
                        # Otherwise, try to create date with same day number in base_date's month
                        try:
                            result_date = base_date.replace(day=day_num)
                            print(f"DEBUG: Adjusted date for {compact} -> {result_date}")
                            return result_date
                        except ValueError:
                            # Day doesn't exist in month, use base_date
                            print(f"DEBUG: Invalid day {day_num}, using base_date {base_date}")
                            return base_date
                            
                    except ValueError:
                        print(f"DEBUG: Invalid day number in {compact}")
                        return None
            
            # Handle full format: Jan15/25
            if '/' in compact:
                parts = compact.split('/')
                if len(parts) == 2:
                    month_day = parts[0]
                    year = f"20{parts[1]}"
                    
                    month_match = re.match(r'([A-Za-z]+)(\d+)', month_day)
                    if month_match:
                        month_str, day_str = month_match.groups()
                        month_num = {
                            'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
                            'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
                        }.get(month_str)
                        if month_num:
                            result = date(int(year), month_num, int(day_str))
                            print(f"DEBUG: Full format {compact} -> {result}")
                            return result
            
            print(f"DEBUG: Could not parse compact date: {compact}")
            return None
            
        except Exception as e:
            print(f"DEBUG: Error in compact_to_date: {e}")
            return None
    
    def time_to_compact(self, time_obj) -> str:
        """Convert time to compact format: 14:30 -> 1430"""
        try:
            if isinstance(time_obj, str):
                time_str = time_obj.strip()
                if ':' in time_str:
                    parts = time_str.split(':')[:2]  # Take only HH:MM
                    return ''.join(parts)
                return time_str
            elif hasattr(time_obj, 'strftime'):
                return time_obj.strftime('%H%M')
            elif hasattr(time_obj, 'hour') and hasattr(time_obj, 'minute'):
                return f"{time_obj.hour:02d}{time_obj.minute:02d}"
            else:
                return str(time_obj)
        except Exception as e:
            print(f"DEBUG: Error in time_to_compact: {e}")
            return str(time_obj)
    
    def compact_to_time(self, compact: str) -> Optional[time_module]:
        """Convert compact format back to time: 1430 -> 14:30"""
        try:
            compact = compact.strip()
            print(f"DEBUG: Converting compact time '{compact}'")
            
            # Handle 4-digit times like 1430
            if len(compact) == 4 and compact.isdigit():
                hours = int(compact[:2])
                minutes = int(compact[2:])
                if 0 <= hours <= 23 and 0 <= minutes <= 59:
                    result = time_module(hours, minutes)
                    print(f"DEBUG: 4-digit time {compact} -> {result}")
                    return result
                    
            # Handle 3-digit times like 930 (9:30)
            elif len(compact) == 3 and compact.isdigit():
                hours = int(compact[0])
                minutes = int(compact[1:])
                if 0 <= hours <= 23 and 0 <= minutes <= 59:
                    result = time_module(hours, minutes)
                    print(f"DEBUG: 3-digit time {compact} -> {result}")
                    return result
                    
            # Handle 2-digit times like 15 (assume 15:00)
            elif len(compact) == 2 and compact.isdigit():
                hours = int(compact)
                if 0 <= hours <= 23:
                    result = time_module(hours, 0)
                    print(f"DEBUG: 2-digit time {compact} -> {result}")
                    return result
                    
            # Handle 1-digit times like 9 (assume 9:00)
            elif len(compact) == 1 and compact.isdigit():
                hours = int(compact)
                if 0 <= hours <= 9:
                    result = time_module(hours, 0)
                    print(f"DEBUG: 1-digit time {compact} -> {result}")
                    return result
            
            print(f"DEBUG: Could not parse compact time: {compact}")
            return None
            
        except Exception as e:
            print(f"DEBUG: Error in compact_to_time: {e}")
            return None
    
    # ==================== EVENT PROCESSING ====================
    
    def assign_event_id(self, event_name: str, date_str: str) -> str:
        """Assign ultra-compact event ID: A, B, C, etc."""
        key = f"{event_name.lower().strip()}_{date_str}"
        if key not in self._event_cache:
            # Use single letters: A-Z, then AA-ZZ
            if self._id_counter < 26:
                event_id = chr(ord('A') + self._id_counter)
            else:
                first = chr(ord('A') + (self._id_counter - 26) // 26)
                second = chr(ord('A') + (self._id_counter - 26) % 26)
                event_id = f"{first}{second}"
            
            self._event_cache[key] = event_id
            self._id_counter += 1
        
        return self._event_cache[key]
    
    def get_event_id(self, event_name: str, date_str: str) -> Optional[str]:
        """Get existing event ID if it exists"""
        key = f"{event_name.lower().strip()}_{date_str}"
        return self._event_cache.get(key)
    
    def compress_event_name(self, name: str) -> str:
        """Compress event names intelligently"""
        name = name.strip()
        
        # Common abbreviations
        replacements = {
            'meeting': 'mtg', 'Meeting': 'Mtg',
            'appointment': 'appt', 'Appointment': 'Appt',
            'conference': 'conf', 'Conference': 'Conf',
            'interview': 'intv', 'Interview': 'Intv',
            'training': 'trng', 'Training': 'Trng',
            'presentation': 'pres', 'Presentation': 'Pres',
            'workshop': 'wksp', 'Workshop': 'Wksp',
            'consultation': 'consult', 'Consultation': 'Consult',
            'follow up': 'f/u', 'Follow up': 'F/u',
            'follow-up': 'f/u', 'Follow-up': 'F/u'
        }
        
        for full, abbrev in replacements.items():
            name = name.replace(full, abbrev)
        
        return name
    
    def fetch_events_ultra_compact(self) -> List[str]:
        """Fetch events in ultra-compact format: ['A:Team mtg:M15:1400-1530', ...]"""
        if not self.events_function:
            return []
        
        try:
            all_events = self.events_function()
            week_start, _, _ = self.get_current_week_info()
            week_end = week_start + timedelta(days=6)
            
            compact_events = []
            self._event_cache.clear()  # Reset cache
            self._id_counter = 0
            
            print(f"DEBUG: Processing {len(all_events)} total events")
            
            for event in all_events:
                try:
                    event_date = getattr(event, 'date', None)
                    if not event_date:
                        continue
                    
                    # Check if in current week
                    if hasattr(event_date, 'date'):
                        check_date = event_date.date()
                    elif isinstance(event_date, str):
                        date_part = event_date.split(' ')[0].split('T')[0]
                        check_date = datetime.strptime(date_part, '%Y-%m-%d').date()
                    else:
                        check_date = event_date
                    
                    if not (week_start <= check_date <= week_end):
                        continue
                    
                    # Extract event info
                    name = getattr(event, 'event_name', 'Untitled')
                    start_time = getattr(event, 'start_time', '')
                    end_time = getattr(event, 'end_time', '')
                    db_id = getattr(event, 'id', None)
                    
                    # Compress and format
                    compact_name = self.compress_event_name(name)
                    compact_date = self.date_to_compact(check_date)
                    compact_start = self.time_to_compact(start_time)
                    compact_end = self.time_to_compact(end_time)
                    
                    # Assign compact ID
                    event_id = self.assign_event_id(name, str(check_date))
                    
                    # Store mapping to database ID - THIS IS CRITICAL
                    if db_id:
                        self._event_cache[f"db_{event_id}"] = db_id
                        print(f"DEBUG: Mapped event {event_id} -> database ID {db_id} ({name})")
                    
                    # Format: ID:Name:Date:StartTime-EndTime
                    compact_event = f"{event_id}:{compact_name}:{compact_date}:{compact_start}-{compact_end}"
                    compact_events.append(compact_event)
                
                except Exception as e:
                    print(f"DEBUG: Error processing event: {e}")
                    continue
            
            print(f"DEBUG: Created {len(compact_events)} compact events")
            print(f"DEBUG: Final cache: {self._event_cache}")
            return compact_events
            
        except Exception as e:
            print(f"DEBUG: Error fetching events: {e}")
            return []

    def parse_llm_commands(self, response: str) -> List[Dict]:
        """Parse LLM response for calendar commands with robust error handling"""
        commands = []
        print(f"DEBUG: LLM OUTPUT\n{response}")

        # Extract commands section
        if "COMMANDS:" in response:
            commands_section = response.split("COMMANDS:", 1)[1].strip()
        else:
            commands_section = response.strip()

        # Clean up any markdown formatting
        commands_section = commands_section.replace('```', '').replace('`', '')

        # Split into lines and process
        for raw_line in commands_section.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):  # skip empty/comment lines
                continue

            print(f"DEBUG: Processing line: {line}")

            # Delete command: D:<identifier>
            if line.startswith("D:"):
                identifier = line[2:].strip()
                commands.append({
                    'action': 'D',
                    'identifier': identifier,
                    'raw_command': line
                })
                print(f"DEBUG: Parsed delete command for {identifier}")
                continue

            # Split by colon - handle complex event names
            parts = line.split(":")
            if len(parts) < 4:
                print(f"WARNING: Skipping invalid command format (need at least 4 parts): {line}")
                continue

            action = parts[0].strip().upper()
            
            # Handle different command formats:
            # For C (Change): C:ID:NewName:Date:Time
            # For A (Add): A:EventName:Date:Time  
            # For M (Move): M:ID:Date:Time
            # For D (Delete): D:ID
            
            if action == 'C' and len(parts) >= 5:
                # Change command: C:ID:NewName:Date:Time
                event_id = parts[1].strip()    # Event ID (like 'D')
                new_name = parts[2].strip()    # New event name  
                date_part = parts[3].strip()   # Date
                time_part = parts[4].strip()   # Time
                # For change commands, we need both the ID and new name
                identifier = event_id  # Use the event ID for lookup
                # Store the new name for later use
                new_event_name = new_name
            elif len(parts) > 4:
                # Regular command with complex name: A:Event:Name:Date:Time
                identifier = ":".join(parts[1:-2])  # Join middle parts
                date_part = parts[-2]  # Second to last
                time_part = parts[-1]  # Last
            else:
                # Simple command: A:Name:Date:Time or M:ID:Date:Time
                identifier = parts[1].strip()
                date_part = parts[2].strip()
                time_part = parts[3].strip()

            print(f"DEBUG: Parsed - Action: {action}, Identifier: '{identifier}', Date: '{date_part}', Time: '{time_part}'")

            # Convert compact date to full date
            full_date = self.compact_to_date(date_part.strip())
            if not full_date:
                print(f"WARNING: Skipping command due to invalid date '{date_part}': {line}")
                continue

            # Parse time range
            time_part = time_part.strip()
            start_time_obj = None
            end_time_obj = None
            
            if "-" in time_part:
                start_str, end_str = time_part.split("-", 1)
                start_str = start_str.strip()
                end_str = end_str.strip()
                
                start_time_obj = self.compact_to_time(start_str)
                end_time_obj = self.compact_to_time(end_str)
                
                if not start_time_obj or not end_time_obj:
                    print(f"WARNING: Skipping command due to invalid time range '{time_part}': {line}")
                    continue
                    
            else:
                # Single time - assume 1 hour duration
                start_time_obj = self.compact_to_time(time_part)
                if not start_time_obj:
                    print(f"WARNING: Skipping command due to invalid time '{time_part}': {line}")
                    continue
                
                # Add 1 hour for end time
                start_dt = datetime.combine(date.today(), start_time_obj)
                end_dt = start_dt + timedelta(hours=1)
                end_time_obj = end_dt.time()

            # Build final command object
            command_obj = {
                'action': action,
                'identifier': identifier.strip(),
                'date': full_date.strftime('%Y-%m-%d'),
                'start_time': start_time_obj.strftime('%H:%M'),
                'end_time': end_time_obj.strftime('%H:%M'),
                'raw_command': line
            }
            
            # Add new event name for change commands
            if action == 'C' and 'new_event_name' in locals():
                command_obj['new_event_name'] = new_event_name
            
            commands.append(command_obj)
            print(f"DEBUG: Successfully parsed command: {command_obj}")

        print(f"DEBUG: Parsed {len(commands)} valid commands total")
        return commands
    
    def execute_commands(self, commands: List[Dict], events_data: List[str]) -> Dict[str, Any]:
        """Execute parsed commands and return results"""
        results = {
            'executed': [],
            'failed': [],
            'created': [],
            'updated': [],
            'deleted': []
        }
        
        print(f"DEBUG: Executing {len(commands)} commands")
        print(f"DEBUG: Event cache contents: {self._event_cache}")
        print(f"DEBUG: Available events: {events_data}")
        
        for cmd in commands:
            try:
                action = cmd['action']
                identifier = cmd['identifier']
                
                print(f"DEBUG: Processing command: {action}:{identifier}")
                
                if action == 'A':  # Add new event
                    if self.create_event_function:
                        print(f"DEBUG: Creating event: {identifier} on {cmd['date']} at {cmd['start_time']}-{cmd['end_time']}")
                        success = self.create_event_function(
                            event_name=identifier,
                            date=cmd['date'],
                            start_time=cmd['start_time'],
                            end_time=cmd['end_time']
                        )
                        if success:
                            results['executed'].append(cmd)
                            results['created'].append(identifier)
                            print(f"DEBUG: Successfully created event {identifier}")
                        else:
                            results['failed'].append(cmd)
                            print(f"DEBUG: Failed to create event {identifier}")
                    else:
                        print("DEBUG: Create function not available")
                        results['failed'].append(cmd)
                
                elif action == 'D':  # Delete event
                    if self.delete_event_function:
                        db_id = self._event_cache.get(f"db_{identifier}")
                        print(f"DEBUG: Looking for db_id for {identifier}: {db_id}")
                        
                        if db_id:
                            success = self.delete_event_function(event_id=db_id)
                            if success:
                                results['executed'].append(cmd)
                                results['deleted'].append(identifier)
                                print(f"DEBUG: Successfully deleted event {identifier}")
                            else:
                                results['failed'].append(cmd)
                                print(f"DEBUG: Failed to delete event {identifier}")
                        else:
                            print(f"DEBUG: Event ID {identifier} not found in cache")
                            results['failed'].append(cmd)
                    else:
                        print("DEBUG: Delete function not available")
                        results['failed'].append(cmd)
                
                elif action in ['M', 'C']:  # Move or Change existing event
                    if self.update_event_function:
                        db_id = self._event_cache.get(f"db_{identifier}")
                        print(f"DEBUG: Looking for db_id for {identifier}: {db_id}")
                        
                        if db_id:
                            # For change commands, use the new event name if provided
                            if action == 'C' and 'new_event_name' in cmd:
                                event_name = cmd['new_event_name']
                                print(f"DEBUG: Using new event name for change: {event_name}")
                            else:
                                event_name = self.get_original_event_name(identifier, events_data)
                            
                            print(f"DEBUG: Updating event {db_id} with name: {event_name}")
                            
                            success = self.update_event_function(
                                event_id=db_id,
                                event_name=event_name,
                                date=cmd['date'],
                                start_time=cmd['start_time'],
                                end_time=cmd['end_time']
                            )
                            
                            if success:
                                results['executed'].append(cmd)
                                results['updated'].append(identifier)
                                print(f"DEBUG: Successfully updated event {identifier}")
                            else:
                                results['failed'].append(cmd)
                                print(f"DEBUG: Failed to update event {identifier}")
                        else:
                            print(f"DEBUG: Event ID {identifier} not found for update")
                            results['failed'].append(cmd)
                    else:
                        print("DEBUG: Update function not available")
                        results['failed'].append(cmd)
                        
                else:
                    print(f"DEBUG: Unknown action {action}")
                    results['failed'].append(cmd)
            
            except Exception as e:
                print(f"DEBUG: Error executing command {cmd}: {e}")
                results['failed'].append(cmd)
        
        print(f"DEBUG: Execution results: {results}")
        return results
        
    def get_original_event_name(self, event_id: str, events_data: List[str]) -> str:
        """Get original event name from compact event data"""
        for event in events_data:
            if event.startswith(f"{event_id}:"):
                parts = event.split(':')
                if len(parts) >= 2:
                    return parts[1]
        return event_id
    
    def generate_ultra_compact_prompt(self, events_data: List[str], week_range: str, current_day_idx: int) -> str:
        """Generate extremely compact system prompt"""
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        current_day = day_names[current_day_idx]
        
        events_str = '\n'.join(events_data) if events_data else 'None'
        
        return f"""WEEK {week_range} (Today: {current_day})

EVENTS:
{events_str}

COMMANDS:
M = Move, A = Add, C = Change, D = Delete
M:ID:Date:Time   A:Name:Date:Time   C:ID:New:Date:Time   D:ID

DATES: M15=Mon15, T16=Tue16, W17=Wed17, R18=Thu18, F19=Fri19, S20=Sat20, U21=Sun21
TIME: Use start-end in 24h format, no colon (e.g. 1430-1530 for 2:30 PM–3:30 PM).

RULES:
- You are a helpful calendar assistant
- Edit this week only
- No event overlaps permitted
- Reschedule events for user using commands in case of conflicts
- Add non-existing events the user asks for
- Use exact event IDs (A,B,...), event names for user chat
- Keep schedules realistic
- Chat to user in 12h time, e.g. 2:00 PM
- Make assumptions for vague situations
- Don't ask user for confirmation.
- Mention events by their event name, not letter
- Respond with a single friendly sentence summarizing the changes, concise and natural to user

FORMAT:
1. Natural response to user
2. "COMMANDS:" on new line
3. Commands listed below

Example: I've cleared your 10:30 slot.
COMMANDS:
D:H"""
        
    def call_llm_with_calendar(self, message: str, include_events: bool = True, **kwargs) -> Dict[str, Any]:
        """Main method: ultra-efficient calendar LLM interaction"""
        if not include_events or not self.events_function:
            return self.call_llm(message, **kwargs)
        
        # Get ultra-compact data
        events_data = self.fetch_events_ultra_compact()
        week_start, current_day_idx, week_range = self.get_current_week_info()
        
        # Generate minimal prompt
        system_prompt = self.generate_ultra_compact_prompt(events_data, week_range, current_day_idx)
        
        # Extract the prompt parameter if it exists in kwargs
        user_prompt = kwargs.pop('prompt', None)
        
        # Combine prompts if user provided one
        if user_prompt:
            combined_prompt = f"{system_prompt}\n\nAdditional instructions: {user_prompt}"
        else:
            combined_prompt = system_prompt
        
        # Make API call with combined prompt
        result = self.call_llm(message, prompt=combined_prompt, **kwargs)
        
        if result.get("success"):
            response_text = result.get("response", "")
            
            # Parse and execute commands
            commands = self.parse_llm_commands(response_text)
            
            if commands:
                execution_results = self.execute_commands(commands, events_data)
                result.update({
                    'commands_found': commands,
                    'execution_results': execution_results,
                    'changes_applied': len(execution_results['executed']) > 0
                })
                
                # Refresh events if changes were made
                if execution_results['executed']:
                    result['updated_events'] = self.fetch_events_ultra_compact()
            
            result.update({
                'original_events': events_data,
                'compact_format': True,
                'token_savings': self.calculate_token_savings(events_data)
            })
            
            # Clean the response for user display - remove COMMANDS: section
            if "COMMANDS:" in response_text:
                clean_response = response_text.split("COMMANDS:", 1)[0].strip()
                result['response'] = clean_response
        
        return result
    
    def calculate_token_savings(self, compact_events: List[str]) -> Dict[str, int]:
        """Calculate approximate token savings from compression"""
        if not compact_events:
            return {'original': 0, 'compressed': 0, 'saved': 0}
        
        # Estimate original format tokens
        original_tokens = 0
        for event in compact_events:
            # Expand back to estimate original size
            parts = event.split(':')
            if len(parts) >= 4:
                # Original would be: "EventName|2025-01-15|14:00-15:30"
                original_tokens += len(parts[1]) + 12 + 11  # Name + date + time
        
        # Compressed tokens
        compressed_tokens = sum(len(event) for event in compact_events)
        
        return {
            'original_estimate': original_tokens,
            'compressed': compressed_tokens,
            'saved_estimate': original_tokens - compressed_tokens,
            'compression_ratio': round(compressed_tokens / max(original_tokens, 1), 2)
        }
    
    def call_llm(self, message: str, prompt: str = None, max_retries: int = 3, **kwargs) -> Dict[str, Any]:
        """Call LLM API - delegates to provider implementation"""
        if not message or not message.strip():
            return {
                "success": False,
                "error": "Message cannot be empty",
                "error_type": "INVALID_INPUT"
            }
        
        return self._make_api_request(message, prompt, max_retries=max_retries, **kwargs)


class GeminiProvider(BaseLLMProvider):
    """Google Gemini API provider"""
    
    def __init__(self, api_key: str, model: str, events_function=None, update_event_function=None, create_event_function=None, delete_event_function=None):
        super().__init__(api_key, model, events_function, update_event_function, create_event_function, delete_event_function)
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

    
    def _validate_api_key(self):
        """Test if API key is valid by making a minimal request"""
        try:
            test_payload = {
                "contents": [{"parts": [{"text": "Hi"}]}],
                "generationConfig": {"maxOutputTokens": 10}
            }
            url = f"{self.base_url}?key={self.api_key}"
            response = requests.post(url, json=test_payload, timeout=10)
            
            if response.status_code == 403:
                raise ValueError("Invalid Gemini API key")
            elif response.status_code == 400:
                error_data = response.json()
                if "API_KEY_INVALID" in str(error_data):
                    raise ValueError("Invalid Gemini API key")
        except requests.exceptions.RequestException:
            pass
        except ValueError:
            raise
        except Exception:
            pass
    
    def _make_api_request(self, message: str, prompt: str = None, max_retries: int = 3, **kwargs) -> Dict[str, Any]:
        """Make Gemini API request with retry logic"""
        headers = {"Content-Type": "application/json"}
        
        generation_config = {
            "maxOutputTokens": min(kwargs.get("max_tokens", 1000), 8192),
            "temperature": max(0.0, min(2.0, kwargs.get("temperature", 0.7))),
            "topP": max(0.0, min(1.0, kwargs.get("top_p", 0.8))),
            "topK": max(1, min(100, kwargs.get("top_k", 40)))
        }
        
        combined_message = f"{prompt.strip()}\n\n{message.strip()}" if prompt else message.strip()
        
        if len(combined_message) > 30000:
            combined_message = combined_message[:30000] + "... (truncated)"
        
        payload = {
            "contents": [{"parts": [{"text": combined_message}]}],
            "generationConfig": generation_config
        }
        
        url = f"{self.base_url}?key={self.api_key}"
        
        for attempt in range(max_retries):
            try:
                print(f"Gemini API attempt {attempt + 1}/{max_retries}")
                
                response = requests.post(url, json=payload, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        candidate = data.get("candidates", [{}])[0]
                        content = candidate.get("content", {})
                        parts = content.get("parts", [{}])
                        text = parts[0].get("text", "") if parts else ""
                        
                        if not text:
                            return {
                                "success": False,
                                "error": "Empty response from Gemini API",
                                "error_type": "EMPTY_RESPONSE"
                            }
                        
                        return {
                            "success": True,
                            "response": text,
                            "model": self.model,
                            "finish_reason": candidate.get("finishReason", "STOP"),
                            "attempt": attempt + 1
                        }
                        
                    except (KeyError, IndexError, json.JSONDecodeError) as e:
                        return {
                            "success": False,
                            "error": f"Failed to parse Gemini response: {str(e)}",
                            "error_type": "PARSE_ERROR"
                        }
                
                elif response.status_code == 400:
                    try:
                        error_data = response.json()
                        error_msg = error_data.get('error', {}).get('message', 'Bad request')
                    except:
                        error_msg = "Bad request - invalid input"
                    
                    return {
                        "success": False,
                        "error": f"Invalid request: {error_msg}",
                        "error_type": "BAD_REQUEST",
                        "status_code": 400
                    }
                
                elif response.status_code == 403:
                    return {
                        "success": False,
                        "error": "Invalid API key or insufficient permissions",
                        "error_type": "AUTHENTICATION_ERROR",
                        "status_code": 403
                    }
                
                elif response.status_code == 429:
                    wait_time = min(60, 2 ** attempt)
                    
                    if attempt < max_retries - 1:
                        print(f"Rate limited, waiting {wait_time}s before retry")
                        time.sleep(wait_time)
                        continue
                    else:
                        return {
                            "success": False,
                            "error": "Rate limited by Gemini API. Please try again later.",
                            "error_type": "RATE_LIMITED",
                            "status_code": 429,
                            "retry_after": wait_time
                        }
                
                elif response.status_code >= 500:
                    if attempt < max_retries - 1:
                        wait_time = min(10, 2 ** attempt)
                        print(f"Server error {response.status_code}, retrying in {wait_time}s")
                        time.sleep(wait_time)
                        continue
                    else:
                        return {
                            "success": False,
                            "error": f"Gemini API server error: {response.status_code}",
                            "error_type": "SERVER_ERROR",
                            "status_code": response.status_code
                        }
                
                else:
                    return {
                        "success": False,
                        "error": f"Unexpected response: {response.status_code}",
                        "error_type": "UNEXPECTED_ERROR",
                        "status_code": response.status_code
                    }
            
            except requests.exceptions.Timeout:
                if attempt < max_retries - 1:
                    print(f"Timeout on attempt {attempt + 1}, retrying...")
                    time.sleep(2)
                    continue
                else:
                    return {
                        "success": False,
                        "error": "Request timeout - Gemini API not responding",
                        "error_type": "TIMEOUT"
                    }
            
            except requests.exceptions.ConnectionError:
                if attempt < max_retries - 1:
                    print(f"Connection error on attempt {attempt + 1}, retrying...")
                    time.sleep(2)
                    continue
                else:
                    return {
                        "success": False,
                        "error": "Connection error - unable to reach Gemini API",
                        "error_type": "CONNECTION_ERROR"
                    }
            
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Unexpected error: {str(e)}",
                    "error_type": "UNKNOWN_ERROR"
                }
        
        return {
            "success": False,
            "error": f"All {max_retries} attempts failed",
            "error_type": "MAX_RETRIES_EXCEEDED"
        }


class OpenAIProvider(BaseLLMProvider):
    """OpenAI GPT API provider"""
    
    def __init__(self, api_key: str, model: str, events_function=None, update_event_function=None, create_event_function=None, delete_event_function=None):
        super().__init__(api_key, model, events_function, update_event_function, create_event_function, delete_event_function)
        self.base_url = "https://api.openai.com/v1/chat/completions"

    
    def _validate_api_key(self):
        """Test if API key is valid by making a minimal request"""
        try:
            test_payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 10
            }
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            response = requests.post(self.base_url, json=test_payload, headers=headers, timeout=10)
            
            if response.status_code == 401:
                raise ValueError("Invalid OpenAI API key")
            elif response.status_code == 400:
                error_data = response.json()
                if "invalid_api_key" in str(error_data).lower():
                    raise ValueError("Invalid OpenAI API key")
        except requests.exceptions.RequestException:
            pass
        except ValueError:
            raise
        except Exception:
            pass
    
    def _make_api_request(self, message: str, prompt: str = None, max_retries: int = 3, **kwargs) -> Dict[str, Any]:
        """Make OpenAI API request with retry logic"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if prompt:
            messages.append({"role": "system", "content": prompt.strip()})
        messages.append({"role": "user", "content": message.strip()})
        
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 1000),
            "temperature": max(0.0, min(2.0, kwargs.get("temperature", 0.7))),
            "top_p": max(0.0, min(1.0, kwargs.get("top_p", 0.8)))
        }
        
        for attempt in range(max_retries):
            try:
                print(f"OpenAI API attempt {attempt + 1}/{max_retries}")
                
                response = requests.post(self.base_url, json=payload, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        choice = data.get("choices", [{}])[0]
                        message_content = choice.get("message", {}).get("content", "")
                        
                        if not message_content:
                            return {
                                "success": False,
                                "error": "Empty response from OpenAI API",
                                "error_type": "EMPTY_RESPONSE"
                            }
                        
                        return {
                            "success": True,
                            "response": message_content,
                            "model": self.model,
                            "finish_reason": choice.get("finish_reason", "stop"),
                            "attempt": attempt + 1,
                            "usage": data.get("usage", {})
                        }
                        
                    except (KeyError, IndexError, json.JSONDecodeError) as e:
                        return {
                            "success": False,
                            "error": f"Failed to parse OpenAI response: {str(e)}",
                            "error_type": "PARSE_ERROR"
                        }
                
                elif response.status_code == 400:
                    try:
                        error_data = response.json()
                        error_msg = error_data.get('error', {}).get('message', 'Bad request')
                    except:
                        error_msg = "Bad request - invalid input"
                    
                    return {
                        "success": False,
                        "error": f"Invalid request: {error_msg}",
                        "error_type": "BAD_REQUEST",
                        "status_code": 400
                    }
                
                elif response.status_code == 401:
                    return {
                        "success": False,
                        "error": "Invalid API key or insufficient permissions",
                        "error_type": "AUTHENTICATION_ERROR",
                        "status_code": 401
                    }
                
                elif response.status_code == 429:
                    wait_time = min(60, 2 ** attempt)
                    
                    if attempt < max_retries - 1:
                        print(f"Rate limited, waiting {wait_time}s before retry")
                        time.sleep(wait_time)
                        continue
                    else:
                        return {
                            "success": False,
                            "error": "Rate limited by OpenAI API. Please try again later.",
                            "error_type": "RATE_LIMITED",
                            "status_code": 429,
                            "retry_after": wait_time
                        }
                
                elif response.status_code >= 500:
                    if attempt < max_retries - 1:
                        wait_time = min(10, 2 ** attempt)
                        print(f"Server error {response.status_code}, retrying in {wait_time}s")
                        time.sleep(wait_time)
                        continue
                    else:
                        return {
                            "success": False,
                            "error": f"OpenAI API server error: {response.status_code}",
                            "error_type": "SERVER_ERROR",
                            "status_code": response.status_code
                        }
                
                else:
                    return {
                        "success": False,
                        "error": f"Unexpected response: {response.status_code}",
                        "error_type": "UNEXPECTED_ERROR",
                        "status_code": response.status_code
                    }
            
            except requests.exceptions.Timeout:
                if attempt < max_retries - 1:
                    print(f"Timeout on attempt {attempt + 1}, retrying...")
                    time.sleep(2)
                    continue
                else:
                    return {
                        "success": False,
                        "error": "Request timeout - OpenAI API not responding",
                        "error_type": "TIMEOUT"
                    }
            
            except requests.exceptions.ConnectionError:
                if attempt < max_retries - 1:
                    print(f"Connection error on attempt {attempt + 1}, retrying...")
                    time.sleep(2)
                    continue
                else:
                    return {
                        "success": False,
                        "error": "Connection error - unable to reach OpenAI API",
                        "error_type": "CONNECTION_ERROR"
                    }
            
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Unexpected error: {str(e)}",
                    "error_type": "UNKNOWN_ERROR"
                }
        
        return {
            "success": False,
            "error": f"All {max_retries} attempts failed",
            "error_type": "MAX_RETRIES_EXCEEDED"
        }


class LLMService:
    """Service class to manage LLM providers with automatic initialization"""
    
    def __init__(self):
        self.providers = {}
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Automatically initialize providers based on configuration"""
        enabled_providers = LLMConfig.get_enabled_providers()
        
        for provider_name in enabled_providers:
            try:
                api_key = LLMConfig.get_api_key(provider_name)
                model = LLMConfig.get_model(provider_name)
                
                if provider_name == 'gemini':
                    provider = GeminiProvider(
                        api_key=api_key, 
                        model=model,
                        events_function=None,
                        update_event_function=None,
                        create_event_function=None,
                        delete_event_function=None
                    )
                elif provider_name == 'openai':
                    provider = OpenAIProvider(
                        api_key=api_key, 
                        model=model,
                        events_function=None,
                        update_event_function=None,
                        create_event_function=None,
                        delete_event_function=None
                    )
                else:
                    print(f"Unknown provider: {provider_name}")
                    continue
                
                self.providers[provider_name] = provider
                print(f"Successfully initialized {provider_name} provider with model: {model}")
                
            except Exception as e:
                print(f"Failed to initialize {provider_name} provider: {e}")
                continue
    
    
    def setup_calendar_functions(self, events_function=None, update_event_function=None, create_event_function=None, delete_event_function=None):
        """Setup calendar functions for all providers"""
        for provider in self.providers.values():
            provider.events_function = events_function
            provider.update_event_function = update_event_function
            provider.create_event_function = create_event_function
            provider.delete_event_function = delete_event_function
            # Reset cache when functions change
            provider._event_cache = {}
            provider._id_counter = 0

    
    def register_provider(self, name: str, provider: BaseLLMProvider):
        """Register a new LLM provider"""
        self.providers[name] = provider
    
    def get_provider(self, name: str = None) -> Optional[BaseLLMProvider]:
        """Get a provider by name, or get default provider"""
        if name:
            return self.providers.get(name)
        
        # Get default provider
        default_name = LLMConfig.get_default_provider()
        provider = self.providers.get(default_name)
        
        if not provider and self.providers:
            # Fallback to first available provider
            provider = next(iter(self.providers.values()))
        
        return provider
    
    def list_providers(self) -> list:
        """List all registered providers"""
        return list(self.providers.keys())
    
    def get_provider_info(self) -> dict:
        """Get detailed info about all providers"""
        info = {}
        for name, provider in self.providers.items():
            info[name] = {
                'type': type(provider).__name__,
                'model': provider.model,
                'available': True
            }
        return info


# Global service instance
llm_service = LLMService()

# Configuration
WEEKLY_MESSAGE_LIMIT = 5000


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def llm_text(request):
    """
    Django view for LLM chat functionality with proper error handling and provider selection
    """
    start_time = time.time()
    
    setup_llm_with_calendar()
    
    try:
        # No need to check authentication - DRF handles it automatically
        # request.user is guaranteed to be authenticated here
        
        # Parse request
        try:
            data = request.data  # Use request.data instead of json.loads(request.body)
        except Exception:
            return Response({
                "success": False,
                "error": "Invalid request data"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        message = data.get("message", "").strip()
        provider_name = data.get("provider")  # Optional - uses default if not specified
        system_prompt = data.get("prompt")
        include_calendar = data.get("include_calendar", True)
        
        # Input validation
        if not message:
            return Response({
                "success": False,
                "error": "Message is required"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if len(message) > 10000:
            return Response({
                "success": False,
                "error": "Message too long (max 10,000 characters)"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check usage limit
        try:
            if not LLMUsage.can_user_send_message(request.user, WEEKLY_MESSAGE_LIMIT):
                usage_record = LLMUsage.get_or_create_weekly_usage(request.user)
                week_start = LLMUsage.get_week_start()
                reset_date = week_start + timedelta(days=7)
                
                return Response({
                    "success": False,
                    "error": "Weekly message limit reached",
                    "error_type": "LIMIT_EXCEEDED",
                    "message": f"You have reached your weekly limit of {WEEKLY_MESSAGE_LIMIT} messages. Your limit will reset on {reset_date.strftime('%A, %B %d, %Y')}.",
                    "usage_info": {
                        "messages_used": usage_record.message_count,
                        "messages_remaining": 0,
                        "weekly_limit": WEEKLY_MESSAGE_LIMIT,
                        "week_start": week_start.strftime('%Y-%m-%d'),
                        "reset_date": reset_date.strftime('%Y-%m-%d'),
                        "can_send_message": False
                    }
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except Exception as e:
            print(f"Error checking usage limit: {e}")
            # Continue without usage limiting if there's an error
        
        # Get available providers
        available_providers = llm_service.list_providers()
        if not available_providers:
            return Response({
                "success": False,
                "error": "No LLM providers configured. Please check your settings.",
                "error_type": "NO_PROVIDERS",
                "help": "Set API keys in environment variables (GEMINI_API_KEY, OPENAI_API_KEY) or Django settings."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Select provider
        if provider_name:
            if provider_name not in available_providers:
                return Response({
                    "success": False,
                    "error": f"Provider '{provider_name}' not available",
                    "available_providers": available_providers
                }, status=status.HTTP_400_BAD_REQUEST)
            provider = llm_service.get_provider(provider_name)
        else:
            # Use default provider
            provider = llm_service.get_provider()
            provider_name = next((name for name, p in llm_service.providers.items() if p == provider), "unknown")
        
        if not provider:
            return Response({
                "success": False,
                "error": f"Provider '{provider_name}' could not be loaded",
                "error_type": "PROVIDER_ERROR"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Prepare LLM parameters with validation
        llm_kwargs = {}
        if "max_tokens" in data:
            max_tokens = data["max_tokens"]
            if isinstance(max_tokens, int) and 1 <= max_tokens <= 8192:
                llm_kwargs["max_tokens"] = max_tokens
        
        if "temperature" in data:
            temp = data["temperature"]
            if isinstance(temp, (int, float)) and 0.0 <= temp <= 2.0:
                llm_kwargs["temperature"] = temp
        
        if "top_p" in data:
            top_p = data["top_p"]
            if isinstance(top_p, (int, float)) and 0.0 <= top_p <= 1.0:
                llm_kwargs["top_p"] = top_p
        
        if "top_k" in data:
            top_k = data["top_k"]
            if isinstance(top_k, int) and 1 <= top_k <= 100:
                llm_kwargs["top_k"] = top_k
        
        # Call LLM
        try:
            if hasattr(provider, 'call_llm_with_calendar') and include_calendar:
                result = provider.call_llm_with_calendar(message, prompt=system_prompt, **llm_kwargs)
            else:
                result = provider.call_llm(message, prompt=system_prompt, **llm_kwargs)
        except Exception as e:
            print(f"Unexpected error calling LLM: {e}")
            return Response({
                "success": False,
                "error": f"Error calling LLM: {str(e)}",
                "error_type": "LLM_CALL_ERROR"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        processing_time = time.time() - start_time
        
        # Add metadata to result
        result["provider"] = provider_name
        result["model"] = provider.model
        result["processing_time"] = round(processing_time, 2)
        
        # If successful, increment usage count
        if result.get("success"):
            try:
                usage_record = LLMUsage.increment_usage(request.user)
                week_start = LLMUsage.get_week_start()
                result["usage_info"] = {
                    "messages_used": usage_record.message_count,
                    "messages_remaining": max(0, WEEKLY_MESSAGE_LIMIT - usage_record.message_count),
                    "weekly_limit": WEEKLY_MESSAGE_LIMIT,
                    "week_start": week_start.strftime('%Y-%m-%d')
                }
            except Exception as e:
                print(f"Error updating usage count: {e}")
                # Don't fail the request if usage tracking fails
        
        return Response(result)
    
    except Exception as e:
        print(f"Unexpected error in llm_text view: {e}")
        import traceback
        traceback.print_exc()
        
        return Response({
            "success": False,
            "error": "Internal server error",
            "error_type": "INTERNAL_ERROR"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def llm_status(request):
    """
    Get status of all LLM providers and configuration
    """
    try:
        providers_info = llm_service.get_provider_info()
        default_provider = LLMConfig.get_default_provider()
        
        return Response({
            "success": True,
            "providers": providers_info,
            "default_provider": default_provider,
            "available_providers": list(providers_info.keys()),
            "configuration": {
                "weekly_message_limit": WEEKLY_MESSAGE_LIMIT,
                "enabled_providers": LLMConfig.get_enabled_providers()
            }
        })
    
    except Exception as e:
        print(f"Error in llm_status view: {e}")
        return Response({
            "success": False,
            "error": "Failed to get status",
            "error_type": "STATUS_ERROR"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Calendar event update function
def update_calendar_event(event_id, event_name, date, start_time, end_time):
    """Update a calendar event in the database"""
    try:
        from myapp.models import CalendarEvent  # Change 'myapp' to your actual app name
        from datetime import datetime
        
        # Get the event
        event = CalendarEvent.objects.get(id=event_id)
        
        # Update fields
        event.event_name = event_name
        
        # Parse date string to date object
        if isinstance(date, str):
            event.date = datetime.strptime(date, '%Y-%m-%d').date()
        else:
            event.date = date
        
        # Parse time strings to time objects
        if isinstance(start_time, str):
            if ':' in start_time:
                event.start_time = datetime.strptime(start_time, '%H:%M').time()
            else:
                # Handle cases like "2pm" -> "14:00"
                start_time = start_time.lower().replace('pm', '').replace('am', '').strip()
                if start_time.isdigit():
                    hour = int(start_time)
                    if 'pm' in start_time.lower() and hour != 12:
                        hour += 12
                    elif 'am' in start_time.lower() and hour == 12:
                        hour = 0
                    event.start_time = datetime.strptime(f"{hour:02d}:00", '%H:%M').time()
                else:
                    event.start_time = datetime.strptime(start_time, '%H:%M').time()
        else:
            event.start_time = start_time
        
        if isinstance(end_time, str):
            if ':' in end_time:
                event.end_time = datetime.strptime(end_time, '%H:%M').time()
            else:
                # Handle cases like "3pm" -> "15:00"
                end_time = end_time.lower().replace('pm', '').replace('am', '').strip()
                if end_time.isdigit():
                    hour = int(end_time)
                    if 'pm' in end_time.lower() and hour != 12:
                        hour += 12
                    elif 'am' in end_time.lower() and hour == 12:
                        hour = 0
                    event.end_time = datetime.strptime(f"{hour:02d}:00", '%H:%M').time()
                else:
                    event.end_time = datetime.strptime(end_time, '%H:%M').time()
        else:
            event.end_time = end_time
        
        # Save the event
        event.save()
        
        print(f"Successfully updated event {event_id}: {event_name} on {event.date} from {event.start_time} to {event.end_time}")
        return True
        
    except CalendarEvent.DoesNotExist:
        print(f"Event with ID {event_id} not found")
        return False
    except ValueError as e:
        print(f"Error parsing date/time for event {event_id}: {e}")
        return False
    except Exception as e:
        print(f"Error updating event {event_id}: {e}")
        import traceback
        traceback.print_exc()
        return False


# Setup functions for backward compatibility and manual setup
def setup_providers_with_calendar(events_function=None, update_event_function=None, create_event_function=None, delete_event_function=None):
    """Setup all available providers with calendar functions"""
    global llm_service
    
    # Setup calendar functions for existing providers
    llm_service.setup_calendar_functions(events_function, update_event_function, create_event_function, delete_event_function)
    
    enabled_providers = LLMConfig.get_enabled_providers()
    
    for provider_name in enabled_providers:
        try:
            # Skip if provider already exists and just needs function updates
            if provider_name in llm_service.providers:
                continue
                
            api_key = LLMConfig.get_api_key(provider_name)
            model = LLMConfig.get_model(provider_name)
            
            if provider_name == 'gemini':
                provider = GeminiProvider(
                    api_key=api_key, 
                    model=model, 
                    events_function=events_function, 
                    update_event_function=update_event_function,
                    create_event_function=create_event_function,
                    delete_event_function=delete_event_function
                )
            elif provider_name == 'openai':
                provider = OpenAIProvider(
                    api_key=api_key, 
                    model=model,
                    events_function=events_function, 
                    update_event_function=update_event_function,
                    create_event_function=create_event_function,
                    delete_event_function=delete_event_function
                )
            else:
                continue
            
            llm_service.register_provider(provider_name, provider)
            print(f"Successfully setup {provider_name} provider with calendar functions")
            
        except Exception as e:
            print(f"Failed to setup {provider_name} provider: {e}")
            continue



def get_provider_status():
    """Get status of all registered providers"""
    return llm_service.get_provider_info()




def delete_calendar_event(event_id):
    """Delete a calendar event from the database"""
    try:
        from myapp.models import CalendarEvent  # Change 'myapp' to your actual app name
        
        # Get and delete the event
        event = CalendarEvent.objects.get(id=event_id)
        event_name = event.event_name  # Store for logging
        event_date = event.date
        
        event.delete()
        
        print(f"Successfully deleted event {event_id}: {event_name} on {event_date}")
        return True
        
    except CalendarEvent.DoesNotExist:
        print(f"Event with id {event_id} not found")
        return False
    except Exception as e:
        print(f"Error deleting event: {e}")
        return False


def create_calendar_event(event_name, date, start_time, end_time):
    """Create a new calendar event in the database"""
    try:
        from myapp.models import CalendarEvent
        from datetime import datetime
        
        # Create new event
        event = CalendarEvent()
        event.event_name = event_name
        
        # Parse date string to date object
        if isinstance(date, str):
            event.date = datetime.strptime(date, '%Y-%m-%d').date()
        else:
            event.date = date
        
        # Parse and set start time
        if isinstance(start_time, str):
            if ':' in start_time:
                event.start_time = datetime.strptime(start_time, '%H:%M').time()
            else:
                # Handle compact format like "1400" -> "14:00"
                if len(start_time) == 4 and start_time.isdigit():
                    hour = int(start_time[:2])
                    minute = int(start_time[2:])
                    event.start_time = datetime.strptime(f"{hour:02d}:{minute:02d}", '%H:%M').time()
                else:
                    event.start_time = datetime.strptime(start_time, '%H:%M').time()
        else:
            event.start_time = start_time
        
        # Parse and set end time
        if isinstance(end_time, str):
            if ':' in end_time:
                event.end_time = datetime.strptime(end_time, '%H:%M').time()
            else:
                # Handle compact format like "1500" -> "15:00"
                if len(end_time) == 4 and end_time.isdigit():
                    hour = int(end_time[:2])
                    minute = int(end_time[2:])
                    event.end_time = datetime.strptime(f"{hour:02d}:{minute:02d}", '%H:%M').time()
                else:
                    event.end_time = datetime.strptime(end_time, '%H:%M').time()
        else:
            event.end_time = end_time
        
        # Save the event
        event.save()
        
        print(f"Successfully created event: {event_name} on {event.date} from {event.start_time} to {event.end_time}")
        return True
        
    except Exception as e:
        print(f"Error creating event: {e}")
        return False
    
    
    
def get_calendar_events():
    """Get calendar events from your models"""
    try:
        from myapp.models import CalendarEvent 
        return CalendarEvent.objects.all()
    except ImportError:
        print("CalendarEvent model not found - update the import path")
        return []
    except Exception as e:
        print(f"Error fetching calendar events: {e}")
        return []

def setup_llm_with_calendar():
    """Initialize LLM service with calendar integration"""
    setup_providers_with_calendar(
        events_function=get_calendar_events,
        update_event_function=update_calendar_event,
        create_event_function=create_calendar_event,
        delete_event_function=delete_calendar_event
    )
    print("LLM service setup complete with calendar integration")
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
from dateutil import rrule



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
    """Ultra-efficient token-minimized calendar LLM provider with recurring events support"""
    
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
    
    def get_current_timeframe_info(self) -> Tuple[date, date, int, str]:
        """Get today's date, tomorrow's date, current day index, and compact range"""
        try:
            pacific_tz = pytz.timezone('America/Los_Angeles')
            now = timezone.now().astimezone(pacific_tz)
            today = now.date()
        except:
            today = datetime.now().date()
        
        tomorrow = today + timedelta(days=1)
        current_day_idx = today.weekday()  # 0=Mon, 6=Sun
        
        # Compact range: "Jan15-16/25" (today-tomorrow)
        month_abbrev = today.strftime('%b')
        if today.month == tomorrow.month:
            range_str = f"{month_abbrev}{today.day}-{tomorrow.day}/{today.strftime('%y')}"
        else:
            tomorrow_month = tomorrow.strftime('%b')
            range_str = f"{month_abbrev}{today.day}-{tomorrow_month}{tomorrow.day}/{today.strftime('%y')}"
        
        return today, tomorrow, current_day_idx, range_str
    
    def date_to_compact(self, date_obj) -> str:
        """Convert date to compact format: TODAY, TOMORROW, or full date"""
        try:
            if hasattr(date_obj, 'date'):
                date_obj = date_obj.date()
            elif isinstance(date_obj, str):
                date_part = date_obj.split(' ')[0].split('T')[0]
                date_obj = datetime.strptime(date_part, '%Y-%m-%d').date()
            
            today, tomorrow, _, _ = self.get_current_timeframe_info()
            
            if date_obj == today:
                return "TODAY"
            elif date_obj == tomorrow:
                return "TOMORROW"
            else:
                # Outside our 2-day window - use full compact: Jan15/25
                return f"{date_obj.strftime('%b')}{date_obj.day}/{date_obj.strftime('%y')}"
        except Exception as e:
            print(f"DEBUG: Error in date_to_compact: {e}")
            return str(date_obj)
    
    def compact_to_date(self, compact: str) -> Optional[date]:
        """Convert compact format like TODAY, TOMORROW to real date"""
        try:
            compact = compact.strip().upper()
            today, tomorrow, _, _ = self.get_current_timeframe_info()
            
            if compact == "TODAY":
                return today
            elif compact == "TOMORROW":
                return tomorrow
            
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
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        }.get(month_str.upper())
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
            
            # Handle 4-digit times like 1430
            if len(compact) == 4 and compact.isdigit():
                hours = int(compact[:2])
                minutes = int(compact[2:])
                if 0 <= hours <= 23 and 0 <= minutes <= 59:
                    result = time_module(hours, minutes)
                    return result
                    
            # Handle 3-digit times like 930 (9:30)
            elif len(compact) == 3 and compact.isdigit():
                hours = int(compact[0])
                minutes = int(compact[1:])
                if 0 <= hours <= 23 and 0 <= minutes <= 59:
                    result = time_module(hours, minutes)
                    return result
                    
            # Handle 2-digit times like 15 (assume 15:00)
            elif len(compact) == 2 and compact.isdigit():
                hours = int(compact)
                if 0 <= hours <= 23:
                    result = time_module(hours, 0)
                    return result
                    
            # Handle 1-digit times like 9 (assume 9:00)
            elif len(compact) == 1 and compact.isdigit():
                hours = int(compact)
                if 0 <= hours <= 9:
                    result = time_module(hours, 0)
                    return result
            
            print(f"DEBUG: Could not parse compact time: {compact}")
            return None
            
        except Exception as e:
            print(f"DEBUG: Error in compact_to_time: {e}")
            return None
    
    # ==================== RECURRING EVENTS HANDLING ====================
    
    def expand_recurring_events(self, events: List) -> List[Dict]:
        """Expand recurring events for today and tomorrow only"""
        today, tomorrow, _, _ = self.get_current_timeframe_info()
        expanded_events = []
        
        for event in events:
            recurrence_pattern = getattr(event, 'recurrence_pattern', None)
            
            if not recurrence_pattern:
                # Non-recurring event - include if within our timeframe
                event_date = getattr(event, 'date', None)
                if event_date:
                    if hasattr(event_date, 'date'):
                        check_date = event_date.date()
                    elif isinstance(event_date, str):
                        date_part = event_date.split(' ')[0].split('T')[0]
                        check_date = datetime.strptime(date_part, '%Y-%m-%d').date()
                    else:
                        check_date = event_date
                    
                    if check_date in [today, tomorrow]:
                        expanded_events.append({
                            'original_event': event,
                            'occurrence_date': check_date,
                            'is_recurring': False
                        })
            else:
                # Recurring event - expand for today and tomorrow
                try:
                    expanded_events.extend(self._expand_single_recurring_event(event, today, tomorrow))
                except Exception as e:
                    print(f"DEBUG: Error expanding recurring event {getattr(event, 'event_name', 'Unknown')}: {e}")
                    continue
        
        return expanded_events
    
    def _expand_single_recurring_event(self, event, start_date: date, end_date: date) -> List[Dict]:
        """Expand a single recurring event using rrule"""
        recurrence_pattern = event.recurrence_pattern
        event_date = getattr(event, 'date', None)
        
        if not event_date:
            return []
        
        # Get the original event date
        if hasattr(event_date, 'date'):
            original_date = event_date.date()
        elif isinstance(event_date, str):
            date_part = event_date.split(' ')[0].split('T')[0]
            original_date = datetime.strptime(date_part, '%Y-%m-%d').date()
        else:
            original_date = event_date
        
        expanded = []
        
        try:
            # Parse common recurrence patterns
            rrule_obj = self._parse_recurrence_pattern(recurrence_pattern, original_date)
            
            if rrule_obj:
                # Generate occurrences for our date range
                occurrences = rrule_obj.between(
                    datetime.combine(start_date, datetime.min.time()),
                    datetime.combine(end_date + timedelta(days=1), datetime.min.time()),
                    inc=True
                )
                
                for occurrence in occurrences:
                    occurrence_date = occurrence.date()
                    if occurrence_date in [start_date, end_date]:
                        expanded.append({
                            'original_event': event,
                            'occurrence_date': occurrence_date,
                            'is_recurring': True,
                            'original_date': original_date
                        })
            
        except Exception as e:
            print(f"DEBUG: Error in rrule expansion: {e}")
            # Fallback: treat as non-recurring if within range
            if original_date in [start_date, end_date]:
                expanded.append({
                    'original_event': event,
                    'occurrence_date': original_date,
                    'is_recurring': False
                })
        
        return expanded
    
    def _parse_recurrence_pattern(self, pattern: str, start_date: date) -> Optional[rrule.rrule]:
        """Parse recurrence pattern string to rrule object"""
        if not pattern:
            return None
        
        pattern = pattern.upper().strip()
        start_datetime = datetime.combine(start_date, datetime.min.time())
        
        # Common patterns
        if pattern in ['DAILY', 'EVERY DAY']:
            return rrule.rrule(rrule.DAILY, dtstart=start_datetime)
        elif pattern in ['WEEKLY', 'EVERY WEEK']:
            return rrule.rrule(rrule.WEEKLY, dtstart=start_datetime)
        elif pattern in ['MONTHLY', 'EVERY MONTH']:
            return rrule.rrule(rrule.MONTHLY, dtstart=start_datetime)
        elif pattern in ['YEARLY', 'EVERY YEAR']:
            return rrule.rrule(rrule.YEARLY, dtstart=start_datetime)
        elif 'WEEKDAY' in pattern or 'MON-FRI' in pattern:
            return rrule.rrule(rrule.DAILY, byweekday=(rrule.MO, rrule.TU, rrule.WE, rrule.TH, rrule.FR), dtstart=start_datetime)
        elif 'WEEKEND' in pattern:
            return rrule.rrule(rrule.WEEKLY, byweekday=(rrule.SA, rrule.SU), dtstart=start_datetime)
        
        # Try to parse as rrule string directly
        try:
            if pattern.startswith('RRULE:'):
                return rrule.rrulestr(pattern, dtstart=start_datetime)
            else:
                return rrule.rrulestr(f'RRULE:{pattern}', dtstart=start_datetime)
        except:
            print(f"DEBUG: Could not parse recurrence pattern: {pattern}")
            return None
    
    # ==================== CONFLICT DETECTION (Updated for 2-day view) ====================
    
    def parse_event_time(self, event_str: str) -> Optional[Dict]:
        """Parse a compact event string into structured data"""
        try:
            # Format: "A:Team meeting:TODAY:1400-1530"
            parts = event_str.split(':')
            if len(parts) < 4:
                return None
                
            event_id = parts[0]
            event_name = parts[1]
            date_str = parts[2]
            time_str = parts[3]
            
            # Parse date
            event_date = self.compact_to_date(date_str)
            if not event_date:
                return None
            
            # Parse time range
            if '-' not in time_str:
                return None
                
            start_str, end_str = time_str.split('-', 1)
            start_time = self.compact_to_time(start_str)
            end_time = self.compact_to_time(end_str)
            
            if not start_time or not end_time:
                return None
                
            return {
                'id': event_id,
                'name': event_name,
                'date': event_date,
                'start_time': start_time,
                'end_time': end_time,
                'start_minutes': start_time.hour * 60 + start_time.minute,
                'end_minutes': end_time.hour * 60 + end_time.minute,
                'original': event_str
            }
        except Exception as e:
            print(f"DEBUG: Error parsing event {event_str}: {e}")
            return None
    
    def detect_conflicts(self, events_data: List[str], new_event: Dict = None) -> Dict[str, Any]:
        """Detect scheduling conflicts within the same day"""
        # Parse all events
        parsed_events = []
        for event_str in events_data:
            parsed = self.parse_event_time(event_str)
            if parsed:
                parsed_events.append(parsed)
        
        # Add new event if provided
        if new_event:
            parsed_events.append(new_event)
        
        print(f"DEBUG CONFLICT: Checking {len(parsed_events)} events for conflicts")
        
        # Group by date
        events_by_date = {}
        for event in parsed_events:
            date_str = event['date'].strftime('%Y-%m-%d')
            if date_str not in events_by_date:
                events_by_date[date_str] = []
            events_by_date[date_str].append(event)
        
        # Find conflicts within each day
        conflicts = []
        for date_str, day_events in events_by_date.items():
            if len(day_events) <= 1:
                continue
            
            day_events.sort(key=lambda x: x['start_minutes'])
            
            for i in range(len(day_events)):
                for j in range(i + 1, len(day_events)):
                    event1, event2 = day_events[i], day_events[j]
                    
                    overlap_start = max(event1['start_minutes'], event2['start_minutes'])
                    overlap_end = min(event1['end_minutes'], event2['end_minutes'])
                    
                    if overlap_start < overlap_end:
                        conflicts.append({
                            'date': date_str,
                            'event1': event1,
                            'event2': event2,
                            'overlap_start': overlap_start,
                            'overlap_end': overlap_end
                        })
        
        return {
            'has_conflicts': len(conflicts) > 0,
            'conflicts': conflicts,
            'total_events': len(parsed_events),
            'events_by_date': events_by_date
        }
    
    def generate_conflict_summary(self, conflicts: List[Dict]) -> str:
        """Generate human-readable conflict summary"""
        if not conflicts:
            return "No scheduling conflicts detected."
        
        summaries = []
        for conflict in conflicts:
            e1 = conflict['event1']
            e2 = conflict['event2']
            
            def mins_to_time(minutes):
                hours = minutes // 60
                mins = minutes % 60
                period = "AM" if hours < 12 else "PM"
                display_hours = hours if hours <= 12 else hours - 12
                if display_hours == 0:
                    display_hours = 12
                return f"{display_hours}:{mins:02d} {period}"
            
            overlap_start = mins_to_time(conflict['overlap_start'])
            overlap_end = mins_to_time(conflict['overlap_end'])
            
            summary = (f"CONFLICT: '{e1['name']}' ({mins_to_time(e1['start_minutes'])}-{mins_to_time(e1['end_minutes'])}) "
                      f"overlaps with '{e2['name']}' ({mins_to_time(e2['start_minutes'])}-{mins_to_time(e2['end_minutes'])}) "
                      f"during {overlap_start}-{overlap_end}")
            summaries.append(summary)
        
        return "\n".join(summaries)
    
    # ==================== EVENT PROCESSING (Updated for recurring events) ====================
    
    def assign_event_id(self, event_name: str, date_str: str, is_recurring: bool = False) -> str:
        """Assign ultra-compact event ID: A, B, C, etc."""
        suffix = "_R" if is_recurring else ""
        key = f"{event_name.lower().strip()}_{date_str}{suffix}"
        
        if key not in self._event_cache:
            if self._id_counter < 26:
                event_id = chr(ord('A') + self._id_counter)
            else:
                first = chr(ord('A') + (self._id_counter - 26) // 26)
                second = chr(ord('A') + (self._id_counter - 26) % 26)
                event_id = f"{first}{second}"
            
            self._event_cache[key] = event_id
            self._id_counter += 1
        
        return self._event_cache[key]
    
    def fetch_events_ultra_compact(self) -> List[str]:
        """Fetch events in ultra-compact format for today and tomorrow only"""
        if not self.events_function:
            return []
        
        try:
            all_events = self.events_function()
            today, tomorrow, _, _ = self.get_current_timeframe_info()
            
            # Expand recurring events
            expanded_events = self.expand_recurring_events(all_events)
            
            compact_events = []
            self._event_cache.clear()
            self._id_counter = 0
            
            print(f"DEBUG: Processing {len(expanded_events)} expanded events for today/tomorrow")
            
            for expanded_event in expanded_events:
                try:
                    event = expanded_event['original_event']
                    occurrence_date = expanded_event['occurrence_date']
                    is_recurring = expanded_event['is_recurring']
                    
                    # Extract event info
                    name = getattr(event, 'event_name', 'Untitled')
                    start_time = getattr(event, 'start_time', '')
                    end_time = getattr(event, 'end_time', '')
                    db_id = getattr(event, 'id', None)
                    
                    # Format with TODAY/TOMORROW
                    compact_date = self.date_to_compact(occurrence_date)
                    compact_start = self.time_to_compact(start_time)
                    compact_end = self.time_to_compact(end_time)
                    
                    # Assign compact ID
                    event_id = self.assign_event_id(name, str(occurrence_date), is_recurring)
                    
                    # Store mapping to database ID
                    if db_id:
                        cache_key = f"db_{event_id}"
                        if is_recurring:
                            cache_key += f"_{occurrence_date.strftime('%Y%m%d')}"
                        self._event_cache[cache_key] = db_id
                        print(f"DEBUG: Mapped event {event_id} -> database ID {db_id} ({name}) {'[RECURRING]' if is_recurring else ''}")
                    
                    # Add recurring indicator to name if needed
                    display_name = f"{name}{'🔄' if is_recurring else ''}"
                    
                    # Format: ID:Name:Date:StartTime-EndTime
                    compact_event = f"{event_id}:{display_name}:{compact_date}:{compact_start}-{compact_end}"
                    compact_events.append(compact_event)
                
                except Exception as e:
                    print(f"DEBUG: Error processing expanded event: {e}")
                    continue
            
            print(f"DEBUG: Created {len(compact_events)} compact events for today/tomorrow")
            return compact_events
            
        except Exception as e:
            print(f"DEBUG: Error fetching events: {e}")
            return []

    def parse_llm_commands(self, response: str) -> List[Dict]:
        """Parse LLM response for calendar commands - Updated for TODAY/TOMORROW"""
        commands = []
        print(f"DEBUG: LLM OUTPUT\n{response}")

        # Extract commands section
        if "COMMANDS:" in response:
            commands_section = response.split("COMMANDS:", 1)[1].strip()
        else:
            commands_section = response.strip()

        # Clean up formatting
        commands_section = commands_section.replace('```', '').replace('`', '')

        # Process each line
        for raw_line in commands_section.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
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
                continue

            # Split by colon
            parts = line.split(":")
            if len(parts) < 4:
                print(f"WARNING: Skipping invalid command format: {line}")
                continue

            action = parts[0].strip().upper()
            
            # Handle different command formats
            if action == 'C' and len(parts) >= 5:
                event_id = parts[1].strip()
                new_name = parts[2].strip()
                date_part = parts[3].strip()
                time_part = parts[4].strip()
                identifier = event_id
                new_event_name = new_name
            elif len(parts) > 4:
                identifier = ":".join(parts[1:-2])
                date_part = parts[-2]
                time_part = parts[-1]
            else:
                identifier = parts[1].strip()
                date_part = parts[2].strip()
                time_part = parts[3].strip()

            # Convert compact date (TODAY/TOMORROW) to full date
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
                start_time_obj = self.compact_to_time(start_str.strip())
                end_time_obj = self.compact_to_time(end_str.strip())
                
                if not start_time_obj or not end_time_obj:
                    print(f"WARNING: Skipping command due to invalid time range '{time_part}': {line}")
                    continue
            else:
                start_time_obj = self.compact_to_time(time_part)
                if not start_time_obj:
                    print(f"WARNING: Skipping command due to invalid time '{time_part}': {line}")
                    continue
                
                # Add 1 hour for end time
                start_dt = datetime.combine(date.today(), start_time_obj)
                end_dt = start_dt + timedelta(hours=1)
                end_time_obj = end_dt.time()

            # Build command object
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
        """Execute parsed commands with enhanced debug logging"""
        print(f"\n=== EXECUTE_COMMANDS START ===")
        print(f"DEBUG EXEC: Received {len(commands)} commands to execute")
        print(f"DEBUG EXEC: Current event cache keys: {list(self._event_cache.keys())}")
        
        results = {
            'executed': [],
            'failed': [],
            'created': [],
            'updated': [],
            'deleted': []
        }
        
        for i, cmd in enumerate(commands):
            print(f"\nDEBUG EXEC: Processing command {i+1}/{len(commands)}: {cmd['raw_command']}")
            
            try:
                action = cmd['action']
                identifier = cmd['identifier']
                
                if action == 'A':  # Add new event
                    print(f"DEBUG EXEC: ADD command for '{identifier}'")
                    if self.create_event_function:
                        success = self.create_event_function(
                            event_name=identifier,
                            date=cmd['date'],
                            start_time=cmd['start_time'],
                            end_time=cmd['end_time']
                        )
                        if success:
                            print(f"DEBUG EXEC: Successfully created event '{identifier}'")
                            results['executed'].append(cmd)
                            results['created'].append(identifier)
                        else:
                            print(f"DEBUG EXEC: Failed to create event '{identifier}' - create_event_function returned False")
                            results['failed'].append(cmd)
                    else:
                        print(f"DEBUG EXEC: Failed to create event '{identifier}' - no create_event_function")
                        results['failed'].append(cmd)
                
                elif action == 'D':  # Delete event
                    print(f"DEBUG EXEC: DELETE command for '{identifier}'")
                    if self.delete_event_function:
                        db_id = self._find_db_id_for_identifier(identifier)
                        
                        if db_id:
                            print(f"DEBUG EXEC: Deleting event {identifier} with db_id: {db_id}")
                            success = self.delete_event_function(event_id=db_id)
                            if success:
                                print(f"DEBUG EXEC: Successfully deleted event '{identifier}'")
                                results['executed'].append(cmd)
                                results['deleted'].append(identifier)
                            else:
                                print(f"DEBUG EXEC: Failed to delete event '{identifier}' - delete_event_function returned False")
                                results['failed'].append(cmd)
                        else:
                            print(f"DEBUG EXEC: Failed to delete event '{identifier}' - no db_id found")
                            results['failed'].append(cmd)
                    else:
                        print(f"DEBUG EXEC: Failed to delete event '{identifier}' - no delete_event_function")
                        results['failed'].append(cmd)
                
                elif action in ['M', 'C']:  # Move or Change
                    print(f"DEBUG EXEC: {'MOVE' if action == 'M' else 'CHANGE'} command for '{identifier}'")
                    if self.update_event_function:
                        db_id = self._find_db_id_for_identifier(identifier)
                        
                        if db_id:
                            if action == 'C' and 'new_event_name' in cmd:
                                event_name = cmd['new_event_name']
                                print(f"DEBUG EXEC: Using new event name: '{event_name}'")
                            else:
                                event_name = self.get_original_event_name(identifier, events_data)
                                print(f"DEBUG EXEC: Using original event name: '{event_name}'")
                            
                            print(f"DEBUG EXEC: Updating event {identifier} (db_id: {db_id}) to {cmd['date']} {cmd['start_time']}-{cmd['end_time']}")
                            
                            success = self.update_event_function(
                                event_id=db_id,
                                event_name=event_name,
                                date=cmd['date'],
                                start_time=cmd['start_time'],
                                end_time=cmd['end_time']
                            )
                            
                            if success:
                                print(f"DEBUG EXEC: Successfully updated event '{identifier}'")
                                results['executed'].append(cmd)
                                results['updated'].append(identifier)
                            else:
                                print(f"DEBUG EXEC: Failed to update event '{identifier}' - update_event_function returned False")
                                results['failed'].append(cmd)
                        else:
                            print(f"DEBUG EXEC: Failed to update event '{identifier}' - no db_id found")
                            results['failed'].append(cmd)
                    else:
                        print(f"DEBUG EXEC: Failed to update event '{identifier}' - no update_event_function")
                        results['failed'].append(cmd)
                else:
                    print(f"DEBUG EXEC: Unknown action '{action}' for command: {cmd}")
                    results['failed'].append(cmd)
                        
            except Exception as e:
                print(f"DEBUG EXEC: Exception processing command {cmd}: {e}")
                import traceback
                traceback.print_exc()
                results['failed'].append(cmd)
        
        print(f"\nDEBUG EXEC: Final execution results:")
        print(f"  - Executed: {len(results['executed'])} commands")
        print(f"  - Failed: {len(results['failed'])} commands")
        print(f"  - Created: {results['created']}")
        print(f"  - Updated: {results['updated']}")
        print(f"  - Deleted: {results['deleted']}")
        print(f"=== EXECUTE_COMMANDS END ===\n")
        
        return results

    def _find_db_id_for_identifier(self, identifier: str) -> Optional[int]:
        """Find database ID for a given event identifier with enhanced debug logging"""
        print(f"DEBUG ID_LOOKUP: Looking up db_id for identifier '{identifier}'")
        print(f"DEBUG ID_LOOKUP: Available cache keys: {list(self._event_cache.keys())}")
        
        # Get current dates for recurring event lookups
        today, tomorrow, _, _ = self.get_current_timeframe_info()
        
        # Strategy 1: Direct match for non-recurring events
        direct_key = f"db_{identifier}"
        if direct_key in self._event_cache:
            db_id = self._event_cache[direct_key]
            print(f"DEBUG ID_LOOKUP: Found db_id {db_id} using direct key: {direct_key}")
            return db_id
        
        # Strategy 2: Try recurring event patterns
        for date_check in [today, tomorrow]:
            recurring_key = f"db_{identifier}_{date_check.strftime('%Y%m%d')}"
            if recurring_key in self._event_cache:
                db_id = self._event_cache[recurring_key]
                print(f"DEBUG ID_LOOKUP: Found db_id {db_id} using recurring key: {recurring_key}")
                return db_id
        
        # Strategy 3: Search all cache keys containing the identifier
        for cache_key, db_id in self._event_cache.items():
            if cache_key.startswith(f"db_{identifier}") and isinstance(db_id, int):
                print(f"DEBUG ID_LOOKUP: Found db_id {db_id} using partial match key: {cache_key}")
                return db_id
        
        print(f"DEBUG ID_LOOKUP: No db_id found for identifier '{identifier}'")
        return None
        
    
    
    def get_original_event_name(self, event_id: str, events_data: List[str]) -> str:
        """Get original event name from compact event data"""
        for event in events_data:
            if event.startswith(f"{event_id}:"):
                parts = event.split(':')
                if len(parts) >= 2:
                    # Remove recurring indicator if present
                    return parts[1].replace('🔄', '').strip()
        return event_id
    
    def validate_command_for_conflicts(self, command: Dict, events_data: List[str]) -> Dict[str, Any]:
        """Validate command for conflicts - updated for 2-day view"""
        if command['action'] not in ['A', 'M', 'C']:
            return {'valid': True, 'conflicts': []}
        
        try:
            start_time = datetime.strptime(command['start_time'], '%H:%M').time()
            end_time = datetime.strptime(command['end_time'], '%H:%M').time()
            event_date = datetime.strptime(command['date'], '%Y-%m-%d').date()
            
            mock_event = {
                'id': command['identifier'],
                'name': command.get('new_event_name', command['identifier']),
                'date': event_date,
                'start_time': start_time,
                'end_time': end_time,
                'start_minutes': start_time.hour * 60 + start_time.minute,
                'end_minutes': end_time.hour * 60 + end_time.minute,
                'original': f"TEMP:{command['identifier']}:{command['date']}:{command['start_time']}-{command['end_time']}"
            }
            
            # Filter events to only the same date
            same_day_events = []
            for event_str in events_data:
                parsed = self.parse_event_time(event_str)
                if parsed and parsed['date'] == event_date:
                    # If moving/changing, exclude the original
                    if command['action'] in ['M', 'C'] and parsed['id'] == command['identifier']:
                        continue
                    same_day_events.append(event_str)
            
            # Check for conflicts
            conflict_analysis = self.detect_conflicts(same_day_events, mock_event)
            
            return {
                'valid': not conflict_analysis['has_conflicts'],
                'conflicts': conflict_analysis['conflicts'],
                'mock_event': mock_event,
                'same_day_events_checked': len(same_day_events)
            }
            
        except Exception as e:
            return {'valid': False, 'conflicts': [], 'error': str(e)}
    
    def get_prompt_with_dates(self, events_data: List[str], time_range: str, current_day_idx: int) -> str:
        """Generate prompt for today/tomorrow view"""
        today, tomorrow, _, _ = self.get_current_timeframe_info()
        
        # Current day name
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        current_day = day_names[current_day_idx]
        
        events_str = '\n'.join(events_data) if events_data else 'None'
        
        return f"""TODAY/TOMORROW {time_range} (Today: {current_day}, 2025)

EVENTS:
{events_str}

COMMANDS:
M = Move, A = Add, C = Change, D = Delete
M:ID:Date:Time   A:Name:Date:Time   C:ID:New:Date:Time   D:ID

DATES: TODAY, TOMORROW, or <3-letter-month><day>/<2-digit-year> (e.g., Jan15/25)
TIME: Use start-end in 24h format, no colon (e.g. 1430-1530 for 2:30 PM–3:30 PM).

RULES:
- You are a helpful calendar assistant
- Edit TODAY and TOMORROW only
- No event overlaps permitted
- Reschedule events for user using commands in case of conflicts
- Add non-existing events the user asks for
- Use exact event IDs (A,B,...), event names for user chat
- Keep schedules realistic
- Chat to user in 12h time, e.g. 2:00 PM
- Make assumptions for vague situations
- Don't ask user for confirmation
- Mention events by their event name, not letter
- Recurring events are marked with 🔄
- Respond with a single friendly sentence summarizing the changes, concise and natural

FORMAT:
1. Natural response to user
2. "COMMANDS:" on new line
3. Commands listed below

Example: I've cleared your 10:30 slot for today.
COMMANDS:
D:H"""

    def get_enhanced_prompt_with_conflicts(self, events_data: List[str], time_range: str, current_day_idx: int) -> str:
        """Generate enhanced prompt with conflict analysis for 2-day view"""
        base_prompt = self.get_prompt_with_dates(events_data, time_range, current_day_idx)
        
        # Analyze conflicts
        conflict_analysis = self.detect_conflicts(events_data)
        
        # Add conflict information
        conflict_section = ""
        if conflict_analysis['has_conflicts']:
            conflict_summary = self.generate_conflict_summary(conflict_analysis['conflicts'])
            conflict_section = f"\n⚠️ ACTUAL CONFLICTS DETECTED:\n{conflict_summary}\n"
        else:
            conflict_section = "\n✅ NO SCHEDULING CONFLICTS DETECTED\n"
        
        # Show events by day
        events_by_day_section = "\nCURRENT SCHEDULE:\n"
        today, tomorrow, _, _ = self.get_current_timeframe_info()
        
        for check_date, label in [(today, 'TODAY'), (tomorrow, 'TOMORROW')]:
            date_str = check_date.strftime('%Y-%m-%d')
            day_events = conflict_analysis['events_by_date'].get(date_str, [])
            
            events_by_day_section += f"{label} ({check_date.strftime('%A %b %d')}):\n"
            
            if day_events:
                sorted_events = sorted(day_events, key=lambda x: x['start_minutes'])
                for event in sorted_events:
                    start_12hr = event['start_time'].strftime('%I:%M %p').lstrip('0')
                    end_12hr = event['end_time'].strftime('%I:%M %p').lstrip('0')
                    events_by_day_section += f"  • {event['name']}: {start_12hr} - {end_12hr}\n"
            else:
                events_by_day_section += "  • No events scheduled\n"
            events_by_day_section += "\n"
        
        # Find available slots for today
        availability_section = f"\nAVAILABLE SLOTS TODAY:\n"
        today_str = today.strftime('%Y-%m-%d')
        slots = self.find_available_slots(today_str, 30, events_data, work_hours=(8, 22))
        
        if slots:
            slot_times = []
            for slot in slots[:5]:  # Top 5 slots
                start_mins = slot['start_minutes']
                end_mins = min(slot['end_minutes'], slot['start_minutes'] + 120)
                
                def mins_to_12hr(minutes):
                    hours = minutes // 60
                    mins = minutes % 60
                    period = "AM" if hours < 12 else "PM"
                    display_hours = hours if hours <= 12 else hours - 12
                    if display_hours == 0:
                        display_hours = 12
                    return f"{display_hours}:{mins:02d} {period}"
                
                duration = min(120, slot['duration'])
                slot_times.append(f"{mins_to_12hr(start_mins)}-{mins_to_12hr(end_mins)} ({duration}min available)")
            
            availability_section += "\n".join(f"  • {slot}" for slot in slot_times)
        else:
            availability_section += "  • No available slots found"
        
        enhanced_prompt = f"""{base_prompt}

{conflict_section}
{events_by_day_section}
{availability_section}

🚨 CRITICAL CONFLICT RULES:
- Events on DIFFERENT DAYS cannot conflict (TODAY vs TOMORROW = NO CONFLICT)
- Only check conflicts within the SAME day
- If no conflicts shown above, DO NOT move any events
- Only reschedule if there are ACTUAL overlapping times on the SAME day
- When user asks to schedule something, check if time slot is actually free
- Be VERY specific about why you're moving events (mention the exact conflict)
- Recurring events (🔄) follow same conflict rules

WRONG: "Moving X to avoid conflict with Y" (when X is TODAY and Y is TOMORROW)
RIGHT: "Moving X because it conflicts with Y (both at 2PM today)"
RIGHT: "Scheduling X at 3PM today - that time slot is free"
"""
        
        return enhanced_prompt
    
    def find_available_slots(self, date: str, duration_minutes: int, 
                           events_data: List[str], 
                           work_hours: Tuple[int, int] = (9, 17)) -> List[Dict]:
        """Find available time slots of specified duration"""
        date_obj = datetime.strptime(date, '%Y-%m-%d').date() if isinstance(date, str) else date
        
        day_events = []
        for event_str in events_data:
            parsed = self.parse_event_time(event_str)
            if parsed and parsed['date'] == date_obj:
                day_events.append(parsed)
        
        # Sort by start time
        day_events.sort(key=lambda x: x['start_minutes'])
        
        # Find gaps
        available_slots = []
        work_start = work_hours[0] * 60
        work_end = work_hours[1] * 60
        
        current_time = work_start
        
        for event in day_events:
            if current_time + duration_minutes <= event['start_minutes']:
                available_slots.append({
                    'start_minutes': current_time,
                    'end_minutes': event['start_minutes'],
                    'duration': event['start_minutes'] - current_time,
                    'start_time': f"{current_time//60:02d}:{current_time%60:02d}",
                    'end_time': f"{event['start_minutes']//60:02d}:{event['start_minutes']%60:02d}"
                })
            
            current_time = max(current_time, event['end_minutes'])
        
        # Gap after last event
        if current_time + duration_minutes <= work_end:
            available_slots.append({
                'start_minutes': current_time,
                'end_minutes': work_end,
                'duration': work_end - current_time,
                'start_time': f"{current_time//60:02d}:{current_time%60:02d}",
                'end_time': f"{work_end//60:02d}:{work_end%60:02d}"
            })
        
        return available_slots
    
    def calculate_token_savings(self, compact_events: List[str]) -> Dict[str, int]:
        """Calculate approximate token savings from compression"""
        if not compact_events:
            return {'original': 0, 'compressed': 0, 'saved': 0}
        
        # Estimate original format tokens
        original_tokens = 0
        for event in compact_events:
            parts = event.split(':')
            if len(parts) >= 4:
                original_tokens += len(parts[1]) + 12 + 11  # Name + date + time
        
        # Compressed tokens
        compressed_tokens = sum(len(event) for event in compact_events)
        
        return {
            'original_estimate': original_tokens,
            'compressed': compressed_tokens,
            'saved_estimate': original_tokens - compressed_tokens,
            'compression_ratio': round(compressed_tokens / max(original_tokens, 1), 2)
        }
    
    # ==================== MAIN LLM INTERFACE METHODS ====================
    
    def call_llm_with_calendar(self, message: str, include_events: bool = True, use_conflict_detection: bool = True, **kwargs) -> Dict[str, Any]:
        """Main method: ultra-efficient calendar LLM interaction for today/tomorrow only - NO VALIDATION"""
        if not include_events or not self.events_function:
            return self.call_llm(message, **kwargs)
        
        # Get ultra-compact data for today/tomorrow
        events_data = self.fetch_events_ultra_compact()
        today, tomorrow, current_day_idx, time_range = self.get_current_timeframe_info()
        
        # Choose prompt based on conflict detection setting (but we won't validate)
        if use_conflict_detection:
            system_prompt = self.get_enhanced_prompt_with_conflicts(events_data, time_range, current_day_idx)
        else:
            system_prompt = self.get_prompt_with_dates(events_data, time_range, current_day_idx)
        
        # Extract user prompt if provided
        user_prompt = kwargs.pop('prompt', None)
        
        # Combine prompts
        if user_prompt:
            combined_prompt = f"{system_prompt}\n\nAdditional instructions: {user_prompt}"
        else:
            combined_prompt = system_prompt
        
        # Make API call
        result = self.call_llm(message, prompt=combined_prompt, **kwargs)
        
        if result.get("success"):
            response_text = result.get("response", "")
            
            # Parse commands
            commands = self.parse_llm_commands(response_text)
            
            # SKIP ALL VALIDATION - Execute commands directly
            if commands:
                execution_results = self.execute_commands(commands, events_data)
            else:
                execution_results = {'executed': [], 'failed': [], 'created': [], 'updated': [], 'deleted': []}
            
            # Update result with command info (no validation data)
            result.update({
                'commands_found': commands,
                'validated_commands': commands,  # All commands are "validated" since we skip validation
                'conflict_warnings': [],
                'validation_prevented_conflicts': False
            })
            
            # Add execution results
            result.update({
                'execution_results': execution_results,
                'changes_applied': len(execution_results['executed']) > 0
            })
            
            # Refresh events if changes were made
            if execution_results['executed']:
                result['updated_events'] = self.fetch_events_ultra_compact()
            
            # Add analysis results
            result.update({
                'original_events': events_data,
                'conflict_analysis': self.detect_conflicts(events_data) if use_conflict_detection else None,
                'compact_format': True,
                'token_savings': self.calculate_token_savings(events_data),
                'timeframe': f"Today: {today.strftime('%A %b %d')} | Tomorrow: {tomorrow.strftime('%A %b %d')}"
            })
            
            # Clean response for user display
            if "COMMANDS:" in response_text:
                clean_response = response_text.split("COMMANDS:", 1)[0].strip()
                result['response'] = clean_response
        
        return result
    
    def call_llm(self, message: str, prompt: str = None, max_retries: int = 3, **kwargs) -> Dict[str, Any]:
        """Call LLM API - delegates to provider implementation"""
        if not message or not message.strip():
            return {
                "success": False,
                "error": "Message cannot be empty",
                "error_type": "INVALID_INPUT"
            }
        
        return self._make_api_request(message, prompt, max_retries=max_retries, **kwargs)

    # ==================== CONVENIENCE METHODS ====================
    
    def get_schedule_summary(self, include_conflicts: bool = True) -> Dict[str, Any]:
        """Get a summary of today/tomorrow schedule with conflict detection"""
        events_data = self.fetch_events_ultra_compact()
        today, tomorrow, current_day_idx, time_range = self.get_current_timeframe_info()
        
        summary = {
            'timeframe': time_range,
            'total_events': len(events_data),
            'events_by_day': {},
            'conflicts': None,
            'available_slots': {}
        }
        
        # Process today and tomorrow
        for check_date, label in [(today, 'Today'), (tomorrow, 'Tomorrow')]:
            day_events = []
            
            for event_str in events_data:
                parsed = self.parse_event_time(event_str)
                if parsed and parsed['date'] == check_date:
                    start_12hr = parsed['start_time'].strftime('%I:%M %p').lstrip('0')
                    end_12hr = parsed['end_time'].strftime('%I:%M %p').lstrip('0')
                    day_events.append(f"{parsed['name']} ({start_12hr} - {end_12hr})")
            
            summary['events_by_day'][label] = day_events
            
            # Find available slots
            slots = self.find_available_slots(check_date.strftime('%Y-%m-%d'), 30, events_data)
            if slots:
                slot_summaries = []
                for slot in slots[:3]:  # Top 3 slots
                    duration_hours = slot['duration'] // 60
                    duration_mins = slot['duration'] % 60
                    duration_str = f"{duration_hours}h {duration_mins}m" if duration_hours > 0 else f"{duration_mins}m"
                    slot_summaries.append(f"{slot['start_time']}-{slot['end_time']} ({duration_str})")
                summary['available_slots'][label] = slot_summaries
        
        # Add conflict analysis
        if include_conflicts:
            conflict_analysis = self.detect_conflicts(events_data)
            if conflict_analysis['has_conflicts']:
                summary['conflicts'] = self.generate_conflict_summary(conflict_analysis['conflicts'])
        
        return summary






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
WEEKLY_MESSAGE_LIMIT = 5


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
    
    setup_llm_with_calendar(request.user)
    
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
                result = provider.call_llm_with_calendar(message, prompt=system_prompt, **llm_kwargs, use_conflict_detection=True)
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
def setup_providers_with_calendar_and_user(user, events_function=None, update_event_function=None, create_event_function=None, delete_event_function=None):
    """Setup all available providers with calendar functions that include user context"""
    global llm_service
    
    # Create wrapper functions that automatically include the user
    def user_events_function():
        return get_calendar_events(user=user)
    
    def user_update_function(event_id, event_name, date, start_time, end_time):
        return update_calendar_event(event_id, event_name, date, start_time, end_time, user=user)
    
    def user_create_function(event_name, date, start_time, end_time):
        return create_calendar_event(event_name, date, start_time, end_time, user=user)
    
    def user_delete_function(event_id):
        return delete_calendar_event(event_id, user=user)
    
    # Setup calendar functions with user-aware wrappers
    llm_service.setup_calendar_functions(
        user_events_function, 
        user_update_function, 
        user_create_function, 
        user_delete_function
    )
    
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
                    events_function=user_events_function, 
                    update_event_function=user_update_function,
                    create_event_function=user_create_function,
                    delete_event_function=user_delete_function
                )
            elif provider_name == 'openai':
                provider = OpenAIProvider(
                    api_key=api_key, 
                    model=model,
                    events_function=user_events_function, 
                    update_event_function=user_update_function,
                    create_event_function=user_create_function,
                    delete_event_function=user_delete_function
                )
            else:
                continue
            
            llm_service.register_provider(provider_name, provider)
            print(f"Successfully setup {provider_name} provider with calendar functions for user: {user}")
            
        except Exception as e:
            print(f"Failed to setup {provider_name} provider: {e}")
            continue



def get_provider_status():
    """Get status of all registered providers"""
    return llm_service.get_provider_info()




def create_calendar_event(event_name, date, start_time, end_time, user=None):
    """Create a new calendar event in the database"""
    try:
        from myapp.models import CalendarEvent
        from datetime import datetime
        
        # Create new event
        event = CalendarEvent()
        event.event_name = event_name
        
        # Assign user if provided
        if user:
            event.user = user
        
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
        
        event.color = "#AF52DE"
        
        # Save the event
        event.save()
        
        print(f"Successfully created event: {event_name} on {event.date} from {event.start_time} to {event.end_time} for user: {user}")
        return True
        
    except Exception as e:
        print(f"Error creating event: {e}")
        return False


def update_calendar_event(event_id, event_name, date, start_time, end_time, user=None):
    """Update a calendar event in the database"""
    try:
        from myapp.models import CalendarEvent
        from datetime import datetime
        
        # Get the event - filter by user if provided for security
        if user:
            event = CalendarEvent.objects.get(id=event_id, user=user)
        else:
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
        print(f"Event with ID {event_id} not found or user doesn't have permission")
        return False
    except ValueError as e:
        print(f"Error parsing date/time for event {event_id}: {e}")
        return False
    except Exception as e:
        print(f"Error updating event {event_id}: {e}")
        import traceback
        traceback.print_exc()
        return False


def delete_calendar_event(event_id, user=None):
    """Delete a calendar event from the database"""
    try:
        from myapp.models import CalendarEvent
        
        # Get and delete the event - filter by user if provided for security
        if user:
            event = CalendarEvent.objects.get(id=event_id, user=user)
        else:
            event = CalendarEvent.objects.get(id=event_id)
            
        event_name = event.event_name  # Store for logging
        event_date = event.date
        
        event.delete()
        
        print(f"Successfully deleted event {event_id}: {event_name} on {event_date}")
        return True
        
    except CalendarEvent.DoesNotExist:
        print(f"Event with id {event_id} not found or user doesn't have permission")
        return False
    except Exception as e:
        print(f"Error deleting event: {e}")
        return False


def get_calendar_events(user=None):
    """Get calendar events from your models"""
    try:
        from myapp.models import CalendarEvent
        
        if user:
            return CalendarEvent.objects.filter(user=user)
        else:
            # Return all events if no user specified (for admin or system use)
            return CalendarEvent.objects.all()
            
    except ImportError:
        print("CalendarEvent model not found - update the import path")
        return []
    except Exception as e:
        print(f"Error fetching calendar events: {e}")
        return []


def setup_llm_with_calendar(user):
    """Initialize LLM service with calendar integration for specific user"""
    setup_providers_with_calendar_and_user(
        user=user,  # Add the user parameter here
        events_function=get_calendar_events,
        update_event_function=update_calendar_event,
        create_event_function=create_calendar_event,
        delete_event_function=delete_calendar_event
    )
    print(f"LLM service setup complete with calendar integration for user: {user}")

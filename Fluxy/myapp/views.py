from .forms import UserInputForm
from .models import CalendarEvent
from llama_cpp import Llama
import json
import os
import re
import requests
from tqdm import tqdm

import spacy
import dateparser
from datetime import datetime, timedelta
from typing import Dict, Optional, Any, List, Set
from typing import Dict, List, Set, Tuple
from difflib import get_close_matches
from collections import defaultdict

from datetime import datetime, timedelta
from typing import Optional, Union, Dict, List, Tuple
import re
from calendar import month_name, month_abbr
import pytz

class DateHandler:
    def __init__(self):
        # Initialize relative time indicators
        self.relative_indicators = {
            'next': 1,
            'following': 1,
            'upcoming': 1,
            'last': -1,
            'previous': -1,
            'past': -1,
            'this': 0
        }

        # Build comprehensive weekday mappings
        self.weekday_mappings = {
            'monday': 0, 'mon': 0, 'mo': 0,
            'tuesday': 1, 'tue': 1, 'tu': 1, 'tues': 1,
            'wednesday': 2, 'wed': 2, 'we': 2,
            'thursday': 3, 'thu': 3, 'th': 3, 'thur': 3, 'thurs': 3,
            'friday': 4, 'fri': 4, 'fr': 4,
            'saturday': 5, 'sat': 5, 'sa': 5,
            'sunday': 6, 'sun': 6, 'su': 6
        }
        
        # Build month mappings
        self.month_mappings = {}
        for i, (full, abbr) in enumerate(zip(month_name[1:], month_abbr[1:]), 1):
            self.month_mappings.update({
                full.lower(): i,
                abbr.lower(): i,
                full[:3].lower(): i,
                f"{i}": i,
                f"{i:02d}": i
            })

        # Number mappings including ordinals
        self.number_mappings = {
            'one': 1, 'first': 1, '1st': 1,
            'two': 2, 'second': 2, '2nd': 2,
            'three': 3, 'third': 3, '3rd': 3,
            'four': 4, 'fourth': 4, '4th': 4,
            'five': 5, 'fifth': 5, '5th': 5,
            'six': 6, 'sixth': 6, '6th': 6,
            'seven': 7, 'seventh': 7, '7th': 7,
            'eight': 8, 'eighth': 8, '8th': 8,
            'nine': 9, 'ninth': 9, '9th': 9,
            'ten': 10, 'tenth': 10, '10th': 10,
            'eleven': 11, 'eleventh': 11, '11th': 11,
            'twelve': 12, 'twelfth': 12, '12th': 12,
            'thirteen': 13, 'thirteenth': 13, '13th': 13,
            'fourteen': 14, 'fourteenth': 14, '14th': 14,
            'fifteen': 15, 'fifteenth': 15, '15th': 15,
            'sixteen': 16, 'sixteenth': 16, '16th': 16,
            'seventeen': 17, 'seventeenth': 17, '17th': 17,
            'eighteen': 18, 'eighteenth': 18, '18th': 18,
            'nineteen': 19, 'nineteenth': 19, '19th': 19,
            'twenty': 20, 'twentieth': 20, '20th': 20,
            'thirty': 30, 'thirtieth': 30, '30th': 30,
            'thirty-first': 31, '31st': 31
        }

        # Relative day terms
        self.relative_day_terms = {
            'today': 0,
            'tonight': 0,
            'now': 0,
            'tomorrow': 1,
            'tmr': 1,
            'tmrw': 1,
            'tom': 1,
            'yesterday': -1,
            'day after tomorrow': 2,
            'day before yesterday': -2
        }

    def handle_dates(self, text: str) -> Optional[datetime]:
        """Main entry point for date parsing"""
        if not text:
            return None

        text = text.lower().strip()
        
        # Try each parsing method in order
        methods = [
            self._parse_relative_day,
            self._parse_relative_weekday,
            self._parse_specific_date,
            self._parse_month_day,
            self._parse_formal_date
        ]

        for method in methods:
            try:
                result = method(text)
                if result:
                    return result
            except Exception:
                continue

        return None

    def _parse_relative_day(self, text: str) -> Optional[datetime]:
        """Handle relative day expressions"""
        now = datetime.now()
        
        # Check direct matches first
        for term, days in self.relative_day_terms.items():
            if term in text:
                return now + timedelta(days=days)

        # Handle "in X days/weeks"
        in_match = re.search(r'in\s+(\d+|[a-zA-Z\-]+)\s+(day|week)s?', text)
        if in_match:
            number = in_match.group(1)
            unit = in_match.group(2)
            
            # Convert word to number if needed
            if number.isdigit():
                num = int(number)
            else:
                num = self.number_mappings.get(number, 0)
            
            if unit == 'day':
                return now + timedelta(days=num)
            elif unit == 'week':
                return now + timedelta(weeks=num)

        return None

    def _parse_relative_weekday(self, text: str) -> Optional[datetime]:
        """Handle relative weekday expressions"""
        now = datetime.now()
        
        # Match pattern for complex relative weekday expressions
        pattern = r'(?:(next|following|this|last|previous)\s+)?(?:(next)\s+)?([a-zA-Z]+day|mon|tue|wed|thu|fri|sat|sun)'
        match = re.search(pattern, text)
        
        if match:
            first_modifier = match.group(1) or 'this'
            second_modifier = match.group(2)
            weekday = match.group(3)
            
            # Get target weekday number (0-6)
            target_weekday = self.weekday_mappings.get(weekday)
            if target_weekday is None:
                return None
            
            current_weekday = now.weekday()
            
            # Calculate days until the next occurrence of target weekday
            days_ahead = (target_weekday - current_weekday) % 7
            if days_ahead == 0:  # If it's the same day
                days_ahead = 7
                
            result_date = now + timedelta(days=days_ahead)
            
            # Handle modifiers
            if first_modifier in ['next', 'following']:
                # "Next" means the one after the upcoming one
                result_date += timedelta(days=7)
            elif first_modifier in ['last', 'previous']:
                # Go back two weeks and then forward to the target day
                result_date = now - timedelta(days=14)
                days_ahead = (target_weekday - result_date.weekday()) % 7
                result_date += timedelta(days=days_ahead)
            
            # Add extra week for "next next"
            if second_modifier == 'next':
                result_date += timedelta(days=7)
            
            return result_date
        
        return None

    def _parse_specific_date(self, text: str) -> Optional[datetime]:
        """Handle specific date expressions like '8th of January'"""
        now = datetime.now()
        
        # Pattern for "Xth of Month" or "Month Xth"
        patterns = [
            r'(?:the\s+)?(\d+(?:st|nd|rd|th)?|[a-zA-Z\-]+)\s+(?:of\s+)?([a-zA-Z]+)',  # 8th of January
            r'([a-zA-Z]+)\s+(?:the\s+)?(\d+(?:st|nd|rd|th)?|[a-zA-Z\-]+)'  # January 8th
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                groups = match.groups()
                
                # Determine which group is the month and which is the day
                if groups[0].lower() in self.month_mappings:
                    month_str, day_str = groups
                else:
                    day_str, month_str = groups
                
                # Convert month
                month = self.month_mappings.get(month_str.lower())
                if not month:
                    continue
                
                # Convert day
                day_str = re.sub(r'(?:st|nd|rd|th)', '', day_str)
                if day_str.isdigit():
                    day = int(day_str)
                else:
                    day = self.number_mappings.get(day_str.lower())
                
                if day and 1 <= day <= 31:
                    # Try to create date, handling invalid dates (e.g., Feb 31)
                    try:
                        return datetime(now.year, month, day)
                    except ValueError:
                        continue
        
        return None

    def _parse_month_day(self, text: str) -> Optional[datetime]:
        """Handle month and day expressions"""
        now = datetime.now()
        
        # Look for month names
        for month_name, month_num in self.month_mappings.items():
            if month_name in text:
                # Find nearby numbers
                numbers = re.findall(r'\d+', text)
                if numbers:
                    # Use the closest number to the month name as the day
                    try:
                        day = int(numbers[0])
                        if 1 <= day <= 31:
                            return datetime(now.year, month_num, day)
                    except (ValueError, IndexError):
                        continue
        
        return None

    def _parse_formal_date(self, text: str) -> Optional[datetime]:
        """Handle formal date formats (YYYY-MM-DD, MM/DD/YYYY, etc.)"""
        # Try various formal date formats
        formats = [
            "%Y-%m-%d", "%Y/%m/%d",  # ISO format
            "%d/%m/%Y", "%m/%d/%Y",  # US/UK formats
            "%d-%m-%Y", "%m-%d-%Y",  # Alternative separators
            "%d.%m.%Y", "%m.%d.%Y"   # Dot separator
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue
            
        return None

    def is_valid_date(self, date: datetime) -> bool:
        """Validate if a date is reasonable"""
        if not isinstance(date, datetime):
            return False
            
        now = datetime.now()
        hundred_years = timedelta(days=365*100)
        
        try:
            return (now - hundred_years < date < now + hundred_years and
                    1 <= date.month <= 12 and
                    1 <= date.day <= 31)
        except:
            return False

class TimeParser:
    def __init__(self):
        """Initialize time parser with comprehensive patterns for all natural language variations"""
        # Core time patterns
        self.time_formats = [
            # Standard times with meridian
            r'(?P<hour>\d{1,2})[:.](?P<minute>\d{2})\s*(?P<meridian>am|pm|AM|PM|a\.m\.|p\.m\.)',
            # Times with space before meridian
            r'(?P<hour>\d{1,2})\s+(?P<minute>\d{2})\s*(?P<meridian>am|pm|AM|PM|a\.m\.|p\.m\.)',
            # Hour only with meridian
            r'(?P<hour>\d{1,2})\s*(?P<meridian>am|pm|AM|PM|a\.m\.|p\.m\.)',
            # 24-hour format
            r'(?P<hour>\d{2}):?(?P<minute>\d{2})',
            # Simple hour
            r'\b(?P<hour>\d{1,2})\b(?!\d|:|\.|[ap])',
            # Hour and minutes without meridian
            r'(?P<hour>\d{1,2})[:.]\s*(?P<minute>\d{2})(?!\s*[ap]\.?m\.?)',
            # Written numbers (one through twelve)
            r'\b(?P<hour>one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?P<meridian>am|pm|AM|PM|a\.m\.|p\.m\.)',
        ]

        # Context patterns for finding times
        self.time_contexts = [
            # Starting contexts
            r'(?:start(?:s|ing)?(?:\s+at)?|from|begin(?:s|ning)?|commenc(?:es|ing)|open(?:s|ing)?|kicks?\s+off)\s+(?P<time>.*?)(?=\s+(?:to|until|til|till|-|ends?|for|and|\n|$))',
            # Ending contexts
            r'(?:to|until|til|till|-|ends?(?:\s+at)?|finish(?:es|ing)?|clos(?:es|ing)?)\s+(?P<time>.*?)(?=\s+(?:for|and|\n|$))',
            # At specific time
            r'\bat\s+(?P<time>.*?)(?=\s+(?:to|until|til|till|ends?|for|and|\n|$))',
        ]

        # Comprehensive duration patterns
        self.duration_patterns = [
            # Standard format with optional 'for'
            r'(?:for\s+)?(?:an?\s+)?(?P<hours>\d+|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b)\s*(?:hour|hours|hr|hrs|h)s?\b(?:\s+and\s+(?P<minutes>\d+|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty)\b)\s*(?:minute|minutes|min|mins|m)s?\b)?',
            # Just minutes
            r'(?:for\s+)?(?:an?\s+)?(?P<minutes>\d+|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty)\b)\s*(?:minute|minutes|min|mins|m)s?\b',
            # Duration words
            r'(?:for\s+)?(?:an?\s+)?(?:half\s+(?:an?\s+)?hour|quarter\s+(?:of\s+)?(?:an?\s+)?hour|hour\s+and\s+(?:a\s+)?half)',
            # Informal duration
            r'(?:lasting|duration(?:\s+of)?|running\s+for|goes?\s+for)\s+(?P<hours>\d+|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b)\s*(?:hour|hours|hr|hrs|h)s?',
            # Very informal duration
            r'\b(?:an?\s+hour|half\s+hour|quarter\s+hour)\b',
        ]

        # Number word mappings
        self.number_words = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
            'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18,
            'nineteen': 19, 'twenty': 20, 'twentyone': 21, 'twenty one': 21, 'twenty-one': 21,
            'twentytwo': 22, 'twenty two': 22, 'twenty-two': 22,
            'twentythree': 23, 'twenty three': 23, 'twenty-three': 23,
            'twentyfour': 24, 'twenty four': 24, 'twenty-four': 24,
            'twentyfive': 25, 'twenty five': 25, 'twenty-five': 25,
            'twentysix': 26, 'twenty six': 26, 'twenty-six': 26,
            'twentyseven': 27, 'twenty seven': 27, 'twenty-seven': 27,
            'twentyeight': 28, 'twenty eight': 28, 'twenty-eight': 28,
            'twentynine': 29, 'twenty nine': 29, 'twenty-nine': 29,
            'thirty': 30, 'thirtyone': 31, 'thirty one': 31, 'thirty-one': 31,
            'thirtytwo': 32, 'thirty two': 32, 'thirty-two': 32,
            'thirtythree': 33, 'thirty three': 33, 'thirty-three': 33,
            'thirtyfour': 34, 'thirty four': 34, 'thirty-four': 34,
            'thirtyfive': 35, 'thirty five': 35, 'thirty-five': 35,
            'thirtysix': 36, 'thirty six': 36, 'thirty-six': 36,
            'thirtyseven': 37, 'thirty seven': 37, 'thirty-seven': 37,
            'thirtyeight': 38, 'thirty eight': 38, 'thirty-eight': 38,
            'thirtynine': 39, 'thirty nine': 39, 'thirty-nine': 39,
            'forty': 40, 'fortyone': 41, 'forty one': 41, 'forty-one': 41,
            'fortytwo': 42, 'forty two': 42, 'forty-two': 42,
            'fortythree': 43, 'forty three': 43, 'forty-three': 43,
            'fortyfour': 44, 'forty four': 44, 'forty-four': 44,
            'fortyfive': 45, 'forty five': 45, 'forty-five': 45,
            'fortysix': 46, 'forty six': 46, 'forty-six': 46,
            'fortyseven': 47, 'forty seven': 47, 'forty-seven': 47,
            'fortyeight': 48, 'forty eight': 48, 'forty-eight': 48,
            'fortynine': 49, 'forty nine': 49, 'forty-nine': 49,
            'fifty': 50, 'fiftyone': 51, 'fifty one': 51, 'fifty-one': 51,
            'fiftytwo': 52, 'fifty two': 52, 'fifty-two': 52,
            'fiftythree': 53, 'fifty three': 53, 'fifty-three': 53,
            'fiftyfour': 54, 'fifty four': 54, 'fifty-four': 54,
            'fiftyfive': 55, 'fifty five': 55, 'fifty-five': 55,
            'fiftysix': 56, 'fifty six': 56, 'fifty-six': 56,
            'fiftyseven': 57, 'fifty seven': 57, 'fifty-seven': 57,
            'fiftyeight': 58, 'fifty eight': 58, 'fifty-eight': 58,
            'fiftynine': 59, 'fifty nine': 59, 'fifty-nine': 59,
            'sixty': 60
        }


        # Special time expressions
        self.special_times = {
            'noon': '12:00',
            'midnight': '00:00',
            'midday': '12:00',
            'morning': '09:00',
            'afternoon': '14:00',
            'evening': '19:00',
            'night': '20:00',
            'lunchtime': '12:00',
            'lunch': '12:00',
            'breakfast': '08:00',
            'dinner': '18:00',
            'dawn': '06:00',
            'dusk': '18:00',
            'sunset': '18:00',
            'sunrise': '06:00',
        }

        # Special duration expressions
        self.special_durations = {
            'an hour': 60,
            'a hour': 60,
            'half hour': 30,
            'half an hour': 30,
            'quarter hour': 15,
            'quarter of an hour': 15,
            'hour and a half': 90,
            'hour and half': 90,
            'couple hours': 120,
            'a few hours': 180,  # "A few hours" is typically 3 hours
            'several hours': 240,
        }

        # Compile all patterns
        self.time_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.time_formats]
        self.context_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.time_contexts]
        self.duration_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.duration_patterns]
        self.special_times_pattern = re.compile(r'\b(' + '|'.join(self.special_times.keys()) + r')\b', re.IGNORECASE)

    def parse_time(self, text: str) -> Dict[str, Any]:
        """Parse text to extract time information with improved accuracy"""
        result = {
            'start_time': None,
            'end_time': None,
            'duration': None,
            'is_all_day': False,
            'debug_info': {}  # For debugging purposes
        }

        # Check for all-day indicators
        if self._is_all_day(text):
            result['is_all_day'] = True
            return result

        # First try to extract times with context
        times_with_context = self._extract_times_with_context(text)
        if times_with_context.get('start_time'):
            result['start_time'] = times_with_context['start_time']
        if times_with_context.get('end_time'):
            result['end_time'] = times_with_context['end_time']

        # If no times found with context, try to find any times
        if not result['start_time']:
            all_times = self._find_all_times(text)
            if all_times:
                result['start_time'] = all_times[0]
                if len(all_times) > 1:
                    result['end_time'] = all_times[1]

        # Extract duration and calculate end time
        duration_info = self._extract_duration(text)
        if duration_info:
            result['duration'] = duration_info['total_minutes']
            result['debug_info']['duration_found'] = duration_info

            # Calculate end time if we have start time
            if result['start_time']:
                start_dt = datetime.strptime(result['start_time'], '%H:%M')
                end_dt = start_dt + timedelta(minutes=duration_info['total_minutes'])
                result['end_time'] = end_dt.strftime('%H:%M')

        return result

    def _is_all_day(self, text: str) -> bool:
        """Check if the event is all-day with expanded patterns"""
        all_day_indicators = [
            'all day', 'all-day', 'whole day', 'full day', 'entire day',
            'throughout the day', 'during the day', 'all day long',
            'all through the day', 'the whole day'
        ]
        return any(indicator in text.lower() for indicator in all_day_indicators)


    def _extract_times_with_context(self, text: str) -> Dict[str, Optional[str]]:
        """Extract times with their context (start/end)"""
        result = {'start_time': None, 'end_time': None}
        
        # Replace special time words
        for special_word, time_value in self.special_times.items():
            text = re.sub(r'\b' + special_word + r'\b', time_value, text, flags=re.IGNORECASE)

        # Find start and end times using context
        for pattern in self.context_patterns:
            match = pattern.search(text)
            if match:
                time_text = match.group('time')
                parsed_time = self._parse_single_time(time_text)
                
                if 'start' in pattern.pattern or 'from' in pattern.pattern:
                    result['start_time'] = parsed_time
                elif 'end' in pattern.pattern or 'until' in pattern.pattern:
                    result['end_time'] = parsed_time

        return result

    def _find_all_times(self, text: str) -> list:
        """Find all time mentions in the text"""
        times = []
        
        # Check for special times
        special_matches = self.special_times_pattern.finditer(text)
        for match in special_matches:
            word = match.group().lower()
            times.append(self.special_times[word])

        # Check for regular time patterns
        for pattern in self.time_patterns:
            matches = pattern.finditer(text)
            for match in matches:
                time = self._parse_time_match(match)
                if time:
                    times.append(time)

        return sorted(list(set(times)))


    def _parse_time_match(self, match: re.Match) -> Optional[str]:
        """Parse time with enhanced meridian handling and null safety"""
        try:
            groups = match.groupdict()
            
            # Add null safety checks for hour and minute
            hour_str = groups.get('hour')
            if hour_str is None:
                return None
                
            minute_str = groups.get('minute', '0')  # Default to '0' for minute
            meridian = groups.get('meridian', '').lower().replace('.', '')

            # Convert word numbers to digits if necessary
            if not isinstance(hour_str, str) or not hour_str.isdigit():
                hour_str = str(self.number_words.get(str(hour_str).lower(), 0))
            if not isinstance(minute_str, str) or not minute_str.isdigit():
                minute_str = str(self.number_words.get(str(minute_str).lower(), 0))

            hour = int(hour_str)
            minute = int(minute_str)

            # Convert to 24-hour format
            if meridian:
                if meridian.startswith('p') and hour != 12:
                    hour += 12
                elif meridian.startswith('a') and hour == 12:
                    hour = 0
            elif hour < 12:
                # If no meridian and hour < 12, keep as is (assumes 24-hour format)
                pass

            # Validate time
            if not (0 <= hour <= 23 and 0 <= minute <= 59):
                return None

            return f"{hour:02d}:{minute:02d}"

        except (ValueError, AttributeError) as e:
            print(f"Error parsing time match: {e}")  # Add debugging
            return None


    def _parse_single_time(self, time_text: str) -> Optional[str]:
        """Parse a single time string"""
        # Check if it's a special time
        if time_text.lower() in self.special_times:
            return self.special_times[time_text.lower()]

        # Try each time pattern
        for pattern in self.time_patterns:
            match = pattern.search(time_text)
            if match:
                return self._parse_time_match(match)

        return None

    def _extract_duration(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract duration with enhanced pattern matching and null safety"""

        
        result = {
            'total_minutes': 0,
            'hours': 0,
            'minutes': 0,
            'pattern_matched': None
        }

        # First check special duration expressions
        for expr, minutes in self.special_durations.items():
            if expr in text.lower():
                result['total_minutes'] = minutes
                result['hours'] = minutes // 60
                result['minutes'] = minutes % 60
                result['pattern_matched'] = f"special_duration:{expr}"
                return result

        # Then check regular duration patterns
        for pattern in self.duration_patterns:
            match = pattern.search(text)
            if match:
                groups = match.groupdict()
                
                # Convert word numbers to digits if necessary
                hours_str = str(groups.get('hours', '0'))
                minutes_str = str(groups.get('minutes', '0'))
                
                
                # Convert to integers with word number support
                if hours_str.isdigit():
                    hours = int(hours_str)
                else:
                    hours = self.number_words.get(hours_str.lower(), 0)
                    
                if minutes_str.isdigit():
                    minutes = int(minutes_str)
                else:
                    minutes = self.number_words.get(minutes_str.lower(), 0)
                
                
                result['hours'] = hours
                result['minutes'] = minutes
                result['total_minutes'] = hours * 60 + minutes
                result['pattern_matched'] = pattern.pattern
                return result

        return None

class ScheduleSpellChecker:
    def __init__(self):
        # Load spaCy model for basic tokenization and lemmatization
        self.nlp = spacy.load("en_core_web_sm")
        
        # Common schedule-related word variations and misspellings
        self.common_corrections = {
            # Time-related
            "oclock": "o'clock",
            "oclock": "o'clock",
            "pm": "PM",
            "am": "AM",
            "a.m": "AM",
            "p.m": "PM",
            
            # Days
            "mon": "Monday",
            "tue": "Tuesday",
            "tues": "Tuesday",
            "wed": "Wednesday",
            "thu": "Thursday",
            "thur": "Thursday",
            "thurs": "Thursday",
            "fri": "Friday",
            "sat": "Saturday",
            "sun": "Sunday",
            
            # Common schedule words
            "meetin": "meeting",
            "mtg": "meeting",
            "appt": "appointment",
            "appoitment": "appointment",
            "appointmnt": "appointment",
            "schdule": "schedule",
            "scheduale": "schedule",
            "tommorow": "tomorrow",
            "tomorro": "tomorrow",
            "tomorow": "tomorrow",
            "tmrw": "tomorrow",
            "tonite": "tonight",
            "2nite": "tonight",
            "2morrow": "tomorrow",
            "2day": "today",
            
            # Virtual meeting platforms
            "zoom": "Zoom",
            "skype": "Skype",
            "teams": "Teams",
            "googlemeet": "Google Meet",
            "gmeet": "Google Meet",
            
            # Common time patterns
            "mins": "minutes",
            "min": "minute",
            "hr": "hour",
            "hrs": "hours"
        }
        
        # Build reverse lookup dictionary for case-insensitive matching
        self.corrections_lookup = {}
        for wrong, right in self.common_corrections.items():
            self.corrections_lookup[wrong.lower()] = right
            
        # Time pattern corrections
        self.time_patterns = {
            r'(\d{1,2}):\s*(\d{2})': r'\1:\2',  # Fix spaces in time (e.g., "3: 30" -> "3:30")
            r'(\d{1,2})\s*:\s*(\d{2})': r'\1:\2',  # Fix multiple spaces around colon
            r'(\d{1,2})([ap])m': r'\1 \2m',  # Add space before am/pm
            r'(\d{1,2})([AP])M': r'\1 \2M',  # Add space before AM/PM
        }
        
        # Build domain-specific vocabulary
        self.domain_vocab = set()
        self._build_domain_vocabulary()
    

    
    def _build_domain_vocabulary(self):
        """Build a comprehensive vocabulary of domain-specific terms"""
        # Add all correct forms from common_corrections
        self.domain_vocab.update(self.common_corrections.values())
        
        # Add additional schedule-related terms
        schedule_terms = {
            # Time intervals
            "daily", "weekly", "monthly", "yearly", "biweekly", "quarterly",
            
            # Schedule actions
            "schedule", "reschedule", "cancel", "postpone", "book", "reserve",
            
            # Event types
            "meeting", "appointment", "conference", "call", "session", "workshop",
            "seminar", "presentation", "interview", "review", "sync", "checkin",
            
            # Locations
            "office", "room", "conference room", "virtual", "online", "remote",
            
            # Time-related
            "morning", "afternoon", "evening", "night", "noon", "midnight",
            "today", "tomorrow", "yesterday", "weekend", "weekday"
        }
        self.domain_vocab.update(schedule_terms)

    def _fix_time_patterns(self, text: str) -> str:
        """Fix common time pattern issues"""
        for pattern, replacement in self.time_patterns.items():
            text = re.sub(pattern, replacement, text)
        return text

    def _fix_common_misspellings(self, word: str) -> str:
        """Check and fix common misspellings"""
        word_lower = word.lower()
        
        # Check in corrections lookup
        if word_lower in self.corrections_lookup:
            return self.corrections_lookup[word_lower]
        
        # Try to find close matches in domain vocabulary
        close_matches = get_close_matches(word_lower, 
                                        [w.lower() for w in self.domain_vocab], 
                                        n=1, 
                                        cutoff=0.8)
        
        if close_matches:
            # Find the original case version of the match
            for vocab_word in self.domain_vocab:
                if vocab_word.lower() == close_matches[0]:
                    return vocab_word
        
        return word

    def correct_text(self, text: str) -> str:
        """Main method to correct schedule-related text"""
        # Fix time patterns first
        text = self._fix_time_patterns(text)
        
        # Tokenize the text using spaCy
        doc = self.nlp(text)
        
        # Process each token
        corrected_words = []
        for token in doc:
            # Skip punctuation and whitespace
            if token.is_punct or token.is_space:
                corrected_words.append(token.text)
                continue
            
            # Fix common misspellings
            corrected_word = self._fix_common_misspellings(token.text)
            corrected_words.append(corrected_word)
        
        # Reconstruct the text while preserving spacing
        corrected_text = ""
        for i, token in enumerate(doc):
            if token.is_punct:
                corrected_text += corrected_words[i]
            elif token.is_space:
                corrected_text += token.text
            else:
                if i > 0 and not doc[i-1].is_punct and not doc[i-1].is_space:
                    corrected_text += " "
                corrected_text += corrected_words[i]
        
        return corrected_text.strip()
    
    
class AdvancedScheduleExtractor:
    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")
        self.spell_checker = ScheduleSpellChecker()  # Add this line

        
        # Comprehensive category hierarchy and relationships
        self.category_hierarchy = {
            'school': {
                'keywords': ['school', 'class', 'lecture', 'study', 'education', 'lesson', 'course'],
                'subcategories': {
                    'academic': ['homework', 'assignment', 'project', 'essay', 'paper', 'report', 'exam', 'test', 'quiz', 'midterm', 'final', 'thesis', 'dissertation'],
                    'extracurricular': ['club', 'student council', 'debate', 'science fair', 'math team', 'art class', 'drama club'],
                    'administrative': ['registration', 'advisor meeting', 'counselor', 'office hours', 'orientation', 'graduation']
                },
                'related_verbs': ['study', 'write', 'complete', 'submit', 'attend', 'present', 'review', 'enroll'],
                'locations': ['classroom', 'library', 'lab', 'lecture hall', 'school', 'university', 'college', 'campus']
            },
            'sports': {
                'keywords': ['sports', 'game', 'practice', 'training', 'fitness', 'exercise', 'workout'],
                'subcategories': {
                    'team_sports': ['soccer', 'basketball', 'football', 'baseball', 'volleyball', 'hockey', 'rugby'],
                    'individual_sports': ['tennis', 'golf', 'swimming', 'track', 'gymnastics', 'cycling', 'martial arts'],
                    'training': ['practice', 'workout', 'conditioning', 'drills', 'strength training'],
                    'competition': ['game', 'match', 'tournament', 'meet', 'competition', 'championship', 'league']
                },
                'related_verbs': ['play', 'practice', 'compete', 'train', 'workout', 'participate'],
                'locations': ['field', 'court', 'gym', 'pool', 'stadium', 'arena', 'track', 'dojo']
            },
            'work': {
                'keywords': ['work', 'job', 'business', 'career', 'office'],
                'subcategories': {
                    'meetings': ['meeting', 'conference', 'presentation', 'review', 'briefing', 'standup', 'call', 'sync'],
                    'deadlines': ['deadline', 'deliverable', 'milestone', 'release', 'submission'],
                    'administrative': ['interview', 'evaluation', 'training', 'onboarding', 'payroll', 'review'],
                    'client': ['client meeting', 'customer', 'presentation', 'proposal', 'pitch', 'networking']
                },
                'related_verbs': ['present', 'meet', 'review', 'discuss', 'prepare', 'deliver', 'call'],
                'locations': ['office', 'conference room', 'meeting room', 'headquarters', 'branch', 'home office']
            },
            'social': {
                'keywords': ['social', 'party', 'gathering', 'event', 'fun', 'entertainment'],
                'subcategories': {
                    'casual': ['coffee', 'lunch', 'dinner', 'drinks', 'hangout', 'meetup', 'brunch'],
                    'events': ['party', 'celebration', 'wedding', 'birthday', 'anniversary', 'festival', 'gala'],
                    'entertainment': ['movie', 'concert', 'show', 'performance', 'exhibition', 'theater', 'sports game'],
                    'group': ['club meeting', 'group activity', 'team building', 'community service']
                },
                'related_verbs': ['meet', 'celebrate', 'attend', 'join', 'hang out', 'enjoy'],
                'locations': ['restaurant', 'cafe', 'bar', 'venue', 'theater', 'home', 'park']
            },
            'family': {
                'keywords': ['family', 'relatives', 'home'],
                'subcategories': {
                    'events': ['reunion', 'gathering', 'dinner', 'celebration', 'holiday', 'anniversary'],
                    'care': ['doctor appointment', 'checkup', 'school pickup', 'childcare', 'babysitting'],
                    'activities': ['outing', 'vacation', 'trip', 'visit', 'game night']
                },
                'related_verbs': ['visit', 'care', 'pick up', 'spend time', 'attend', 'celebrate'],
                'locations': ['home', 'relative\'s house', 'park', 'restaurant', 'beach']
            },
            'health_and_wellness': {
                'keywords': ['health', 'wellness', 'fitness', 'doctor', 'therapy'],
                'subcategories': {
                    'appointments': ['doctor', 'dentist', 'therapy', 'physiotherapy', 'checkup'],
                    'activities': ['yoga', 'meditation', 'exercise', 'workout', 'run', 'walk', 'hike'],
                    'nutrition': ['meal planning', 'dietitian', 'cooking class']
                },
                'related_verbs': ['attend', 'exercise', 'practice', 'meditate', 'run', 'relax'],
                'locations': ['gym', 'clinic', 'hospital', 'studio', 'park', 'home']
            },
            'travel': {
                'keywords': ['travel', 'vacation', 'trip', 'journey'],
                'subcategories': {
                    'personal': ['vacation', 'holiday', 'weekend trip', 'road trip'],
                    'business': ['business trip', 'conference travel', 'site visit'],
                    'transport': ['flight', 'train', 'bus', 'car', 'ferry']
                },
                'related_verbs': ['travel', 'visit', 'explore', 'pack', 'fly', 'drive'],
                'locations': ['airport', 'station', 'hotel', 'resort', 'destination']
            },
            'public_events': {
                'keywords': ['public', 'event', 'festival', 'parade', 'rally'],
                'subcategories': {
                    'community': ['festival', 'fair', 'market', 'parade', 'open house'],
                    'political': ['rally', 'protest', 'campaign', 'debate'],
                    'entertainment': ['concert', 'fireworks', 'performance', 'art show']
                },
                'related_verbs': ['attend', 'celebrate', 'protest', 'participate'],
                'locations': ['park', 'venue', 'downtown', 'stadium']
            }
        }


        # Time patterns with variations
        self.time_patterns = {
            'exact': r'(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)',
            'hour_only': r'(\d{1,2})\s*(am|pm|AM|PM)',
            'military': r'(\d{4})|(\d{2})(\d{2})',
            'descriptive': r'(noon|midnight|morning|afternoon|evening)',
            'relative': r'(in|after|before|around|about)\s(\d+)\s(hour|minute|min)s?'
        }

        # Duration patterns
        self.duration_patterns = {
            'explicit': r'for\s(\d+)\s(hour|minute|min)s?',
            'until': r'until\s(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?',
            'range': r'(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?\s*-\s*(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?'
        }

        # Urgency indicators with context
        self.urgency_indicators = {
            'high': {
                'keywords': ['urgent', 'asap', 'emergency', 'immediate', 'critical', 'important'],
                'phrases': ['need.*by', 'must.*complete', 'due.*today', 'deadline.*tomorrow'],
                'time_related': ['last minute', 'running out of time', 'as soon as possible']
            },
            'medium': {
                'keywords': ['soon', 'upcoming', 'approaching', 'scheduled'],
                'phrases': ['need.*this week', 'should.*complete', 'would like.*by'],
                'time_related': ['next week', 'coming up', 'in a few days']
            },
            'low': {
                'keywords': ['flexible', 'whenever', 'casual', 'optional'],
                'phrases': ['when.*time', 'if.*possible', 'could.*sometime'],
                'time_related': ['no rush', 'at your convenience', 'sometime later']
            }
        }

        # Virtual meeting indicators
        self.virtual_indicators = {
            'platforms': ['zoom', 'teams', 'meet', 'skype', 'webex', 'discord'],
            'keywords': ['virtual', 'online', 'remote', 'video call', 'conference call'],
            'links': [r'https?://[^\s]+', r'www\.[^\s]+'],
            'meeting_ids': [r'\d{9,11}', r'\d{3}[-\s]\d{3}[-\s]\d{3}']
        }

        # Recurrence patterns with variations
        self.recurrence_patterns = {
            'daily': {
                'exact': ['every day', 'daily'],
                'variations': ['each day', 'per day', 'once a day']
            },
            'weekly': {
                'exact': ['every week', 'weekly'],
                'variations': ['each week', 'per week', 'once a week'],
                'days': ['every monday', 'every tuesday', 'every wednesday', 'every thursday', 'every friday', 'every saturday', 'every sunday']
            },
            'monthly': {
                'exact': ['every month', 'monthly'],
                'variations': ['each month', 'per month', 'once a month'],
                'specific': [r'(\d+)(st|nd|rd|th) of every month']
            },
            'custom': {
                'every_other': ['every other', 'alternate'],
                'specific': [r'every (\d+) (day|week|month)s?']
            }
        }

        self.compile_patterns()

    def _extract_time_info(self, text: str) -> Dict[str, Any]:
        """Extract comprehensive time information"""
        result = {
            'start_time': None,
            'end_time': None,
            'duration': None,
            'is_all_day': False
        }

        # Check for all-day indicators
        all_day_patterns = ['all day', 'full day', 'whole day']
        if any(pattern in text.lower() for pattern in all_day_patterns):
            result['is_all_day'] = True
            return result

        # Extract times using compiled patterns
        for pattern_type, pattern in self.compiled_patterns['time'].items():
            matches = pattern.finditer(text)
            times = []
            
            for match in matches:
                parsed_time = self._parse_time_match(match, pattern_type)
                if parsed_time:
                    times.append(parsed_time)

            if times:
                result['start_time'] = times[0]
                if len(times) > 1:
                    result['end_time'] = times[1]

        # Extract duration if present
        for pattern_type, pattern in self.compiled_patterns['duration'].items():
            match = pattern.search(text)
            if match:
                result['duration'] = self._parse_duration_match(match, pattern_type)

        return result
    
    def _parse_time_match(self, match, pattern_type):
        """Parse different types of time patterns and return standardized time"""
        if pattern_type == 'exact':
            hour, minute, meridian = match.groups()
            hour = int(hour)
            minute = int(minute)
            if meridian.lower() == 'pm' and hour != 12:
                hour += 12
            elif meridian.lower() == 'am' and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute:02d}"
            
        elif pattern_type == 'hour_only':
            hour, meridian = match.groups()
            hour = int(hour)
            if meridian.lower() == 'pm' and hour != 12:
                hour += 12
            elif meridian.lower() == 'am' and hour == 12:
                hour = 0
            return f"{hour:02d}:00"
            
        elif pattern_type == 'military':
            if match.group(1):  # Full 4-digit format
                return f"{match.group(1)[:2]}:{match.group(1)[2:]}"
            else:  # Separated format
                return f"{match.group(2)}:{match.group(3)}"
                
        elif pattern_type == 'descriptive':
            time_map = {
                'noon': '12:00',
                'midnight': '00:00',
                'morning': '09:00',
                'afternoon': '14:00',
                'evening': '19:00'
            }
            return time_map.get(match.group(1).lower())
            
        return None

    def _parse_duration_match(self, match, pattern_type):
        """Parse duration patterns and return standardized duration"""
        if pattern_type == 'explicit':
            amount, unit = match.groups()
            amount = int(amount)
            if 'hour' in unit:
                return amount * 60
            return amount
            
        elif pattern_type == 'until':
            hour = int(match.group(1))
            minute = int(match.group(2)) if match.group(2) else 0
            meridian = match.group(3)
            
            if meridian and meridian.lower() == 'pm' and hour != 12:
                hour += 12
            elif meridian and meridian.lower() == 'am' and hour == 12:
                hour = 0
                
            return {'end_time': f"{hour:02d}:{minute:02d}"}
            
        elif pattern_type == 'range':
            start_hour = int(match.group(1))
            start_minute = int(match.group(2)) if match.group(2) else 0
            start_meridian = match.group(3)
            
            end_hour = int(match.group(4))
            end_minute = int(match.group(5)) if match.group(5) else 0
            end_meridian = match.group(6)
            
            # Convert to 24-hour format
            if start_meridian and start_meridian.lower() == 'pm' and start_hour != 12:
                start_hour += 12
            elif start_meridian and start_meridian.lower() == 'am' and start_hour == 12:
                start_hour = 0
                
            if end_meridian and end_meridian.lower() == 'pm' and end_hour != 12:
                end_hour += 12
            elif end_meridian and end_meridian.lower() == 'am' and end_hour == 12:
                end_hour = 0
                
            return {
                'start_time': f"{start_hour:02d}:{start_minute:02d}",
                'end_time': f"{end_hour:02d}:{end_minute:02d}"
            }
        
        return None

    def _check_if_virtual(self, text):
        """Check if the event is virtual based on platform mentions and keywords"""
        text_lower = text.lower()
        
        # Check for platform mentions
        for platform in self.virtual_indicators['platforms']:
            if platform in text_lower:
                return True
        
        # Check for virtual keywords
        for keyword in self.virtual_indicators['keywords']:
            if keyword in text_lower:
                return True
        
        # Check for meeting links
        for link_pattern in self.virtual_indicators['links']:
            if re.search(link_pattern, text):
                return True
        
        # Check for meeting IDs
        for id_pattern in self.virtual_indicators['meeting_ids']:
            if re.search(id_pattern, text):
                return True
        
        return False



    def _extract_location(self, doc):
        """Extract location information from the text using spaCy named entities"""
        locations = []
        
        # Extract named entities that are locations
        for ent in doc.ents:
            if ent.label_ in ['FAC', 'GPE', 'LOC', 'ORG']:
                locations.append(ent.text)
        
        # Check for location keywords from category hierarchy
        text_lower = doc.text.lower()
        for category in self.category_hierarchy.values():
            for location in category['locations']:
                if location in text_lower:
                    locations.append(location)
        
        # Return the first found location or None if no locations found
        return locations[0] if locations else None

    def _determine_urgency(self, text):
        """Determine the urgency level of the event"""
        text_lower = text.lower()
        urgency_scores = {'high': 0, 'medium': 0, 'low': 0}

        for level, indicators in self.urgency_indicators.items():
            # Check keywords
            for keyword in indicators['keywords']:
                if keyword in text_lower:
                    urgency_scores[level] += 2

            # Check phrases using regex
            for phrase in indicators['phrases']:
                if re.search(phrase, text_lower):
                    urgency_scores[level] += 3

            # Check time-related indicators
            for indicator in indicators['time_related']:
                if indicator in text_lower:
                    urgency_scores[level] += 2


        # If all urgency scores are zero, return 'medium' directly
        if all(score == 0 for score in urgency_scores.values()):
            return 'medium'

        # Otherwise, return the urgency level with the highest score
        return max(urgency_scores.items(), key=lambda x: x[1])[0]


    def _extract_recurrence(self, text):
        """Extract recurrence pattern from the text"""
        text_lower = text.lower()
        
        # Check daily patterns
        for pattern in self.recurrence_patterns['daily']['exact'] + self.recurrence_patterns['daily']['variations']:
            if pattern in text_lower:
                return {'type': 'daily', 'interval': 1}
        
        # Check weekly patterns
        for pattern in self.recurrence_patterns['weekly']['exact'] + self.recurrence_patterns['weekly']['variations']:
            if pattern in text_lower:
                return {'type': 'weekly', 'interval': 1}
        
        # Check specific weekdays
        for day_pattern in self.recurrence_patterns['weekly']['days']:
            if day_pattern in text_lower:
                return {'type': 'weekly', 'day': day_pattern.split()[-1], 'interval': 1}
        
        # Check monthly patterns
        for pattern in self.recurrence_patterns['monthly']['exact'] + self.recurrence_patterns['monthly']['variations']:
            if pattern in text_lower:
                return {'type': 'monthly', 'interval': 1}
        
        # Check for specific monthly dates
        for pattern in self.recurrence_patterns['monthly']['specific']:
            match = re.search(pattern, text_lower)
            if match:
                return {'type': 'monthly', 'day': int(match.group(1)), 'interval': 1}
        
        # Check custom patterns
        for pattern in self.recurrence_patterns['custom']['every_other']:
            if pattern in text_lower:
                # Try to determine what type of interval (day/week/month)
                for unit in ['day', 'week', 'month']:
                    if unit in text_lower:
                        return {'type': unit + 'ly', 'interval': 2}
        
        # Check specific intervals
        for pattern in self.recurrence_patterns['custom']['specific']:
            match = re.search(pattern, text_lower)
            if match:
                interval = int(match.group(1))
                unit = match.group(2)
                return {'type': unit + 'ly', 'interval': interval}
        
        return None

    def _standardize_time_format(self, time):
        """Standardize time format to HH:MM in 24-hour format"""
        if isinstance(time, str):
            # If already in HH:MM format, return as is
            if re.match(r'^\d{2}:\d{2}$', time):
                return time
                
            # Try to parse the time string
            try:
                parsed_time = datetime.strptime(time, '%I:%M %p')
                return parsed_time.strftime('%H:%M')
            except ValueError:
                try:
                    parsed_time = datetime.strptime(time, '%H:%M')
                    return parsed_time.strftime('%H:%M')
                except ValueError:
                    return None
        
        return None


        

    def compile_patterns(self):
        """Compile all regex patterns for better performance"""
        self.compiled_patterns = {
            'time': {k: re.compile(v) for k, v in self.time_patterns.items()},
            'duration': {k: re.compile(v) for k, v in self.duration_patterns.items()}
        }

    def _extract_category_and_context(self, text: str) -> Dict[str, Any]:
        """
        Extract event category with improved context awareness and strict categorization rules.
        Prevents false positives and miscategorization by considering full context.
        """
        text_lower = text.lower()
        words = set(text_lower.split())
        doc = self.nlp(text_lower)
        
        # Define strict category patterns with required and excluded terms
        category_rules = {
            'school': {
                'required_contexts': [
                    # Must have educational institution or academic terms
                    (['class', 'lecture', 'school', 'university', 'college', 'course'], 1),
                    # Or specific academic activities
                    (['exam', 'study', 'homework', 'assignment', 'thesis'], 1)
                ],
                'exclude_if': ['party', 'contest', 'game', 'social'],
                'context_override': {
                    'art class': 'social',  # Art class outside school context is likely social
                    'cooking class': 'social',
                    'fitness class': 'health_and_wellness'
                }
            },
            'work': {
                'required_contexts': [
                    # Must have business-specific terms
                    (['meeting', 'presentation', 'client', 'work', 'office', 'business'], 1),
                    # Or specific work activities
                    (['interview', 'deadline', 'conference', 'review'], 1)
                ],
                'exclude_if': ['school', 'party', 'social'],
                'context_override': {
                    'social meeting': 'social',
                    'club meeting': 'social'
                }
            },
            'social': {
                'required_contexts': [
                    # Social gatherings and events
                    (['party', 'gathering', 'celebration', 'dinner', 'lunch', 'drinks'], 1),
                    # Or entertainment activities
                    (['movie', 'concert', 'show', 'festival', 'entertainment'], 1)
                ],
                'exclude_if': [],  # Social can overlap with other categories
                'context_override': {
                    'business dinner': 'work',
                    'family dinner': 'family'
                }
            },
            'sports': {
                'required_contexts': [
                    # Sports activities
                    (['game', 'match', 'practice', 'training', 'competition'], 1),
                    # Specific sports
                    (['soccer', 'basketball', 'football', 'tennis', 'golf'], 1)
                ],
                'exclude_if': ['video game', 'board game'],
                'context_override': {
                    'sports party': 'social',
                    'game night': 'social'
                }
            },
            'health_and_wellness': {
                'required_contexts': [
                    # Medical appointments
                    (['doctor', 'dentist', 'therapy', 'checkup', 'appointment'], 1),
                    # Health activities
                    (['workout', 'exercise', 'yoga', 'meditation'], 1)
                ],
                'exclude_if': [],
                'context_override': {
                    'workout party': 'social'
                }
            },
            'family': {
                'required_contexts': [
                    # Family-specific events
                    (['family', 'parents', 'kids', 'relatives'], 1),
                    # Family activities
                    (['reunion', 'gathering', 'visit'], 1)
                ],
                'exclude_if': [],
                'context_override': {}
            }
        }
        
        # Helper function to check if any terms from a list are in the text
        def has_terms(terms: List[str], min_count: int) -> bool:
            return sum(1 for term in terms if term in text_lower) >= min_count
        
        # Check for category matches with strict rules
        matched_categories = []
        for category, rules in category_rules.items():
            # Skip if any excluded terms are present
            if any(excl in text_lower for excl in rules['exclude_if']):
                continue
                
            # Check for override conditions first
            override_found = False
            for context, new_category in rules['context_override'].items():
                if context in text_lower:
                    matched_categories.append((new_category, 0.9))
                    override_found = True
                    break
                    
            if override_found:
                continue
                
            # Check if required contexts are met
            context_score = 0
            for terms, min_count in rules['required_contexts']:
                if has_terms(terms, min_count):
                    context_score += 0.5
                    
            if context_score > 0:
                matched_categories.append((category, context_score))
        
        # Special case: Contest/Competition detection
        if 'contest' in text_lower or 'competition' in text_lower:
            # Analyze surrounding context to determine category
            contest_words = text_lower.split()
            contest_idx = next((i for i, word in enumerate(contest_words) 
                            if word in ['contest', 'competition']), -1)
            
            if contest_idx > 0:
                # Look at words before contest/competition for context
                context_word = contest_words[contest_idx - 1]
                for category, rules in category_rules.items():
                    if any(context_word in term_list for term_list, _ in rules['required_contexts']):
                        matched_categories.append((category, 0.8))
                        break
                else:
                    # If no specific category matches, default to public_events
                    matched_categories.append(('public_events', 0.6))
        
        # Select best category or return None
        if matched_categories:
            best_match = max(matched_categories, key=lambda x: x[1])
            return {
                'category': best_match[0],
                'confidence': best_match[1],
                'subcategories': []  # Simplified as requested
            }
        
        return {
            'category': None,
            'confidence': 0,
            'subcategories': []
        }

    def _extract_event_name(self, text):
        """
        Extract meaningful event name from natural language input using advanced NLP techniques.
        Creates context-aware, intelligent event names handling complex scenarios.
        
        Args:
            text (str): Natural language input describing the event
                
        Returns:
            str: Intelligently formatted event name
        """
        import re
        from collections import defaultdict
        
        patterns = {
            'business': [
                r'(?i)(meeting|call|conference|presentation|interview|training|workshop)',
                r'(?i)(sync|standup|review|planning|sprint|quarterly|weekly)',
                r'(?i)(discussion|briefing|session|alignment|consultation)',
                r'(?i)(webinar|seminar|retreat|business summit|client meeting)',
                r'(?i)(negotiation|strategy session|product launch|kickoff)',
                r'(?i)(corporate event|board meeting|team meeting|town hall)',
            ],
            'education': [
                r'(?i)(class|lecture|exam|study|assignment|tutorial|homework)',
                r'(?i)(seminar|course|project|research|thesis|defense)',
                r'(?i)(workshop|lab|presentation|workshop|study group)',
                r'(?i)(degree|graduation|enrollment|academic advising)',
                r'(?i)(school event|education fair|career fair|college visit)',
            ],
            'personal': [
                r'(?i)(appointment|checkup|visit|reservation|booking)',
                r'(?i)(workout|practice|training|game|match|race)',
                r'(?i)(haircut|spa|massage|therapy)',
                r'(?i)(errand|shopping|grocery|meal prep|pick up)',
                r'(?i)(dentist|doctor|therapy|counseling)',
                r'(?i)(vacation|holiday|weekend getaway)',
            ],
            'social': [
                r'(?i)(party|celebration|gathering|dinner|lunch|brunch)',
                r'(?i)(wedding|birthday|anniversary|reunion|meetup)',
                r'(?i)(outing|picnic|cocktail hour|happy hour|barbecue)',
                r'(?i)(concert|festival|show|theater|club event)',
                r'(?i)(holiday party|new year party|christmas party)',
                r'(?i)(date night|friends gathering|family reunion)',
            ],
            'action_verbs': [
                r'(?i)(attending|going to|having|hosting|organizing)',
                r'(?i)(meeting with|working on|studying for|preparing for)',
                r'(?i)(visiting|interviewing|coaching|consulting)',
                r'(?i)(presenting|speaking at|delivering|moderating)',
                r'(?i)(training for|competing in|joining)',
                r'(?i)(watching|observing|listening to)',
                r'(?i)(celebrating|participating in|arranging for)',
            ],
            'time_markers': [
                r'(?i)(daily|weekly|monthly|quarterly|annual)',
                r'(?i)(recurring|regular|periodic)',
                r'(?i)(every (monday|tuesday|wednesday|thursday|friday|saturday|sunday))',
                r'(?i)(this week|next week|this month|next month|this year)',
                r'(?i)(on (monday|tuesday|wednesday|thursday|friday|saturday|sunday))',
                r'(?i)(bi-weekly|bi-monthly|every other (week|month))',
                r'(?i)(every (hour|day|week|month))',
                r'(?i)(from (morning|afternoon|evening) till (morning|afternoon|evening))',
                r'(?i)(once a year|twice a year|once in a while)',
            ],
            'locations': [
                r'(?i)(office|workspace|home|gym|park|restaurant|bar|cafe)',
                r'(?i)(conference room|meeting room|auditorium|lobby|venue|hall)',
                r'(?i)(stadium|court|field|race track|swimming pool|arena)',
                r'(?i)(beach|mountain|vacation spot|cabin|resort|hotel)',
                r'(?i)(library|study room|classroom|lecture hall|lab)',
                r'(?i)(hotel|airbnb|bnb|apartment|motel)',
                r'(?i)(virtual|online|zoom|webinar|team call|video conference)',
            ],
            'event_types': [
                r'(?i)(conference|summit|symposium|meetup|webinar|web conference)',
                r'(?i)(party|celebration|gathering|reception|banquet|ceremony)',
                r'(?i)(class|seminar|course|workshop|training|lecture|discussion)',
                r'(?i)(presentation|pitch|demo|meeting|conference call)',
                r'(?i)(interview|recruitment|evaluation|screening|selection)',
                r'(?i)(concert|movie|show|performance|theater|gig)',
                r'(?i)(workshop|hackathon|design sprint|ideation session|retreat)',
            ],
            'weather_related': [
                r'(?i)(rain|storm|snow|sunny|windy|cloudy|foggy|hail|blizzard|heatwave)',
                r'(?i)(drizzle|downpour|thunderstorm|lightning|tornado|cyclone|hurricane)',
                r'(?i)(hot|cold|warm|freezing|humid|drought|monsoon|breeze)',
            ],
            'special_occasions': [
                r'(?i)(holiday|celebration|festivity|festival|observance|occasion)',
                r'(?i)(new year|christmas|thanksgiving|eid|diwali|halloween)',
                r'(?i)(wedding|anniversary|birthday|graduation|baby shower|engagement)',
                r'(?i)(thanksgiving|valentine\'s day|mother\'s day|father\'s day)',
                r'(?i)(national day|independence day|labor day|memorial day)',
            ],
            'task_related': [
                r'(?i)(task|to-do|action item|project|goal|deliverable|objective)',
                r'(?i)(assignment|workload|deadline|plan|target|milestone)',
                r'(?i)(checklist|priority|assignment|work package|workstream)',
                r'(?i)(review|update|status check|follow-up|feedback)',
            ],
        }
        
        # Clean and normalize input text
        cleaned_text = ' '.join(re.sub(r'[^\w\s]', ' ', text).split())
        text_lower = cleaned_text.lower()
        
        # Component storage with priority handling
        event_components = {
            'primary_type': [],    # Main event/activity (highest priority)
            'secondary_type': [],  # Additional type information
            'subject': [],         # People, organizations
            'context': [],         # Department, team, location, etc.
        }
        
        # Words to remove (expanded list)
        noise_words = {
            'from', 'to', 'at', 'in', 'on', 'the', 'a', 'an', 'this', 'next',
            'every', 'attending', 'going', 'having', 'hosting', 'organizing',
            'with', 'for', 'by', 'until', 'through', 'via', 'using', 'during'
        }
        
        # Time-related words to remove
        time_words = {
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
            'tomorrow', 'tonight', 'today', 'morning', 'afternoon', 'evening', 'night',
            'weekly', 'daily', 'monthly', 'yearly', 'biweekly', 'weekend', 'weekday'
        }
        
        def clean_word_list(words):
            """Remove noise words and time references"""
            return [w for w in words if w.lower() not in noise_words and w.lower() not in time_words]
        
        # First pass: Extract the primary event type/activity
        all_patterns = []
        for category in ['business', 'education', 'personal', 'social', 'event_types']:
            all_patterns.extend(patterns[category])
        
        # Find all potential event types
        event_matches = []
        for pattern in all_patterns:
            matches = re.finditer(pattern, text_lower)
            for match in matches:
                event_type = match.group().strip()
                if event_type and event_type not in noise_words and event_type not in time_words:
                    event_matches.append((event_type, match.start()))
        
        # Sort by position (earlier mentions often more important)
        event_matches.sort(key=lambda x: x[1])
        
        # Add event types to appropriate categories
        if event_matches:
            event_components['primary_type'].append(event_matches[0][0])
            for event_type, _ in event_matches[1:]:
                event_components['secondary_type'].append(event_type)
        
        # Extract named entities if spaCy is available
        if hasattr(self, 'nlp'):
            doc = self.nlp(cleaned_text)
            
            # Get named entities
            for ent in doc.ents:
                if ent.label_ in ['PERSON', 'ORG', 'GPE']:
                    event_components['subject'].append(ent.text)
            
            # Get noun phrases that might be important context
            for chunk in doc.noun_chunks:
                if not any(word.is_stop for word in chunk) and \
                not any(word.text.lower() in time_words for word in chunk):
                    event_components['context'].append(chunk.text)
        
        def format_component(text):
            """Format component with proper capitalization"""
            words = clean_word_list(text.split())
            return ' '.join(w.capitalize() for w in words)
        
        # Build the event name with proper prioritization
        name_parts = []
        
        # Primary event type is mandatory
        if event_components['primary_type']:
            name_parts.append(format_component(event_components['primary_type'][0]))
        else:
            # Fallback: look for capitalized words or first non-time word
            words = cleaned_text.split()
            for word in words:
                if word.lower() not in noise_words and word.lower() not in time_words:
                    name_parts.append(word.capitalize())
                    break
        
        # Add subject if available
        if event_components['subject']:
            subject = format_component(event_components['subject'][0])
            if subject:
                name_parts.append(subject)
        
        # Add context if it adds value
        if event_components['context']:
            context = format_component(event_components['context'][0])
            if context and context not in name_parts:
                name_parts.append(context)
        
        # Construct final name
        event_name = ' '.join(name_parts)
        
        # Final cleanup
        event_name = re.sub(r'\s+', ' ', event_name).strip()
        
        #AHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH REMOVE REPEATED WORDS FROM OUTPUT BECAUSE AI IS DUMB
        def remove_repeated_words(text):
            words = text.split()  # Split the string into a list of words
            seen = set()  # A set to keep track of words we've already seen
            result = []  # A list to store the words without duplicates
            
            for word in words:
                if word.lower() not in seen:  # Ignore case while checking for duplicates
                    seen.add(word.lower())  # Add word to the set
                    result.append(word)  # Append the word to the result list
            
            return ' '.join(result)  # Join the words back into a string
        
        event_name = remove_repeated_words(event_name)
        
        return event_name
        
    def extract_info(self, text: str) -> Dict[str, Any]:
        """Main extraction function with enhanced accuracy"""
        # Basic NLP processing
        doc = self.nlp(text)
        
        # Initialize TimeParser
        time_parser = TimeParser()
        date_handler = DateHandler()
        
        # Initialize result
        result = {
            'event_name': None,
            'date': None,
            'start_time': None,
            'end_time': None,
            'location': None,
            'virtual': False,
            'urgency': 'medium',
            'notes': None,
            'type': None,
            'category': None,
            'subcategories': [],
            'recurrence_pattern': None,
            'deadline': None,
            'confidence_scores': {}
        }
        
        # Extract event name
        result['event_name'] = self._extract_event_name(text)   

        # Extract category with context
        category_info = self._extract_category_and_context(text)
        result['category'] = category_info['category']
        result['subcategories'] = category_info['subcategories']
        result['confidence_scores']['category'] = category_info['confidence']

        # Use TimeParser to extract time information
        time_info = time_parser.parse_time(text)
        result['start_time'] = time_info['start_time']
        result['end_time'] = time_info['end_time']

        # Extract date using dateparser with custom settings
        date_info = date_handler.handle_dates(text)
        result['date'] = date_info


        # Determine if virtual
        result['virtual'] = self._check_if_virtual(text)

        # Extract location if not virtual
        if not result['virtual']:
            location_info = self._extract_location(doc)
            if location_info:
                result['location'] = location_info

        # Extract urgency
        result['urgency'] = self._determine_urgency(text)

        # Extract recurrence pattern
        result['recurrence_pattern'] = self._extract_recurrence(text)

        # Clean and validate results
        return self._validate_and_clean_results(result)

    def _validate_and_clean_results(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean extracted information"""
        # Remove None values from subcategories
        result['subcategories'] = [s for s in result['subcategories'] if s]
        
        # No need for time format standardization since TimeParser already handles this
        return result

# Initialize extractor
extractor = AdvancedScheduleExtractor()

def extract_schedule_info(user_input: str) -> dict:
    """Wrapper function that includes spell checking before extraction"""
    print("Debug: Received user input:", user_input)  # Debug point 1
    
    corrected_input = extractor.spell_checker.correct_text(user_input)
    print("Debug: Corrected input:", corrected_input)  # Debug point 2
    
    try:
        # Process the corrected input through the extractor
        result = extractor.extract_info(corrected_input)
        print("Debug: Extraction result:", result)  # Debug point 3
        return result
    except Exception as e:
        print(f"Debug: Error occurred during extraction: {str(e)}")  # Debug point 4
        raise  # Re-raise the exception after logging it



def home(request):
    result = None
    if request.method == "POST":
        form = UserInputForm(request.POST)
        if form.is_valid():
            user_input = form.cleaned_data['user_input']
            result = extract_schedule_info(user_input)
            
            if result and not result.get('error'):
                CalendarEvent.objects.create(
                    event=result['event'],
                    time=result['time'],
                    date=result['date']
                )
    else:
        form = UserInputForm()
    
    events = CalendarEvent.objects.all()
    
    return render(request, 'home.html', {
        'form': form,
        'result': result,
        'events': events,
    })

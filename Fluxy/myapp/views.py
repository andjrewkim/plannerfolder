from .forms import UserInputForm
from .models import CalendarEvent

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
from typing import Optional, Union, Dict, List, Tuple
from calendar import month_name, month_abbr
import pytz
from typing import Optional, Dict, Any
import calendar



class DateHandler:
    def __init__(self):
        # Build month mappings including variants
        self.month_mappings: Dict[str, int] = {}
        for i, month in enumerate(calendar.month_name[1:], 1):
            self.month_mappings[month.lower()] = i
            self.month_mappings[month[:3].lower()] = i
        # Add numeric months
        for i in range(1, 13):
            self.month_mappings[str(i)] = i
            self.month_mappings[f"{i:02d}"] = i

        # Weekday mappings (0 = Monday, 6 = Sunday)
        self.weekday_mappings = {
            'monday': 0, 'mon': 0,
            'tuesday': 1, 'tue': 1,
            'wednesday': 2, 'wed': 2,
            'thursday': 3, 'thu': 3,
            'friday': 4, 'fri': 4,
            'saturday': 5, 'sat': 5,
            'sunday': 6, 'sun': 6
        }

        # Special date keywords
        self.special_dates = {
            'today': 0,
            'tomorrow': 1,
            'yesterday': -1,
            'in a couple days': 2,
            'day after tomorrow': 2,
            'next week': 7,
            'last week': -7
        }

    def parse_date(self, text: str) -> Optional[datetime]:
        """Main entry point for date parsing"""
        if not text:
            return None

        text = text.lower().strip()
        
        # Try each parser in order
        parsers = [
            self._parse_special_date,
            self._parse_relative_weekday,
            self._parse_month_day,
            self._parse_formal_date
        ]

        for parser in parsers:
            try:
                result = parser(text)
                if result:
                    return result
            except Exception as e:
                continue

        return None

    def _parse_special_date(self, text: str) -> Optional[datetime]:
        """Parse special date terms like 'today', 'tomorrow', etc."""
        now = datetime.now()
        
        # Check special dates dictionary
        for term, days in self.special_dates.items():
            if term in text:
                return now + timedelta(days=days)

        # Handle "in X days"
        match = re.search(r'in\s+(\d+)\s+days?', text)
        if match:
            days = int(match.group(1))
            return now + timedelta(days=days)

        return None

    def _parse_relative_weekday(self, text: str) -> Optional[datetime]:
        """Parse weekday expressions like 'next monday', 'this friday'"""
        now = datetime.now()

        # Match weekday patterns
        for day, day_num in self.weekday_mappings.items():
            if day not in text:
                continue

            is_next = 'next' in text
            is_last = 'last' in text
            
            current_weekday = now.weekday()
            target_weekday = day_num
            
            if is_last:
                # Go back to last occurrence
                days_diff = (current_weekday - target_weekday) % 7
                if days_diff == 0:
                    days_diff = 7
                return now - timedelta(days=days_diff)
            
            # Calculate days until next occurrence
            days_ahead = (target_weekday - current_weekday) % 7
            if days_ahead == 0 and not is_next:
                days_ahead = 7
            
            # Add extra week if "next" is specified
            if is_next:
                days_ahead += 7
                
            return now + timedelta(days=days_ahead)

        return None

    def _parse_month_day(self, text: str) -> Optional[datetime]:
        """Parse month and day combinations"""
        now = datetime.now()
        
        # Remove common words and clean up text
        text = re.sub(r'\b(of|the|st|nd|rd|th)\b', '', text)
        text = ' '.join(text.split())
        
        # Try to find month
        found_month = None
        month_value = None
        
        for month_name, month_num in self.month_mappings.items():
            if month_name in text:
                found_month = month_name
                month_value = month_num
                break
        
        if not found_month:
            return None

        # Find day number
        day_match = re.search(r'\b(\d{1,2})\b', text)
        if not day_match:
            # If just month is specified, use the 1st
            day_value = 1
        else:
            day_value = int(day_match.group(1))
            
        # Validate day
        if not (1 <= day_value <= 31):
            return None
            
        # Try to create date
        try:
            # If the date would be in the past, use next year
            year = now.year
            date = datetime(year, month_value, day_value)
            if date < now:
                date = datetime(year + 1, month_value, day_value)
            return date
        except ValueError:
            return None

    def _parse_formal_date(self, text: str) -> Optional[datetime]:
        """Parse formal date formats (YYYY-MM-DD, DD/MM/YYYY, etc.)"""
        # Remove any surrounding text
        text = text.strip()
        
        # Common date formats
        formats = [
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y/%m/%d",
            "%d-%m-%Y",
            "%m-%d-%Y"
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue
                
        return None

# Example usage
if __name__ == "__main__":
    handler = DateHandler()
    
    test_cases = [
        "april 15",
        "15th of april",
        "next monday",
        "last friday",
        "tomorrow",
        "in 3 days",
        "next week",
        "2024-01-05",
        "this wednesday",
        "april",
        "tomorrow at 3pm",
        "next thursday",
        "may 1st",
    ]
    
    for test in test_cases:
        result = handler.parse_date(test)
        print(f"{test}: {result}")
        
        
import re
from typing import Dict, Optional, List, Any
from datetime import datetime, timedelta
from typing import Dict, Optional
import re

class TimeParser:
    def __init__(self):
        """Initialize time parser with comprehensive patterns"""
        # Core time patterns (ordered by specificity)
        self.time_patterns = [
            # Enhanced 24-hour format with optional seconds
            r'(?P<hour>2[0-3]|[01]\d)(?::?(?P<minute>[0-5]\d))(?:[:](?P<second>[0-5]\d))?\b',
            
            # Word-based hours with meridian
            r'(?P<hour>one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+'
            r'(?P<meridian>am|pm|a\.m\.|p\.m\.|noon|midnight)\b',
            
            # Enhanced AM/PM formats with flexible spacing
            r'(?P<hour>\d{1,2})(?:[:. ]?(?P<minute>\d{2}))?\s*'
            r'(?P<meridian>am|pm|a\.m\.|p\.m\.|noon|midnight)\b',
            
            # Cross-meridian range handling
            r'(?P<start_hour>\d{1,2})(?::(?P<start_minute>\d{2}))?'
            r'(?:\s*(?P<start_meridian>am|pm|a\.m\.|p\.m\.))?\s*-\s*'
            r'(?P<end_hour>\d{1,2})(?::(?P<end_minute>\d{2}))?'
            r'(?:\s*(?P<end_meridian>am|pm|a\.m\.|p\.m\.))?',
            
            # Explicit range indicators
            r'(?P<start_time>(\d{1,2}(?::\d{2})?)\s*(?:am|pm|a\.m\.|p\.m\.)?)\s+'
            r'(?:to|until|through|thru|-|–|—)\s+'
            r'(?P<end_time>(\d{1,2}(?::\d{2})?)\s*(?:am|pm|a\.m\.|p\.m\.)?)',
        ]

        # Enhanced date patterns
        self.date_patterns = [
            r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b',
            r'\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b',
            r'\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b',  # MM/DD/YY or DD-MM-YYYY
            r'\b\d{4}-\d{1,2}-\d{1,2}\b',  # ISO format
        ]

        # Add weekday patterns
        self.weekday_patterns = [
            r'\b(?:mon|tues|wed|thurs|fri|sat|sun)[a-z]*\b',  # Weekday abbreviations
            r'\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',  # Full weekday names
        ]

        # Event indicator terms (for day markings)
        self.event_indicators = {
            r'\bexam\b': 'Exam', 
            r'\btest\b': 'Test', 
            r'\bquiz\b': 'Quiz', 
            r'\bassignment\b': 'Assignment', 
            r'\bdue\b': 'Due Date', 
            r'\bdeadline\b': 'Deadline',
            r'\bmeeting\b': 'Meeting', 
            r'\bappointment\b': 'Appointment', 
            r'\binterview\b': 'Interview', 
            r'\bpresentation\b': 'Presentation',
            r'\bconcert\b': 'Concert', 
            r'\bshow\b': 'Show', 
            r'\bevent\b': 'Event', 
            r'\bparty\b': 'Party', 
            r'\bcelebration\b': 'Celebration',
            r'\bconference\b': 'Conference', 
            r'\bworkshop\b': 'Workshop', 
            r'\bseminar\b': 'Seminar', 
            r'\blecture\b': 'Lecture',
            r'\bholiday\b': 'Holiday', 
            r'\bvacation\b': 'Vacation', 
            r'\btrip\b': 'Trip', 
            r'\bvisit\b': 'Visit',
            r'\bbirthday\b': 'Birthday', 
            r'\banniversary\b': 'Anniversary', 
            r'\bwedding\b': 'Wedding', 
            r'\bgraduation\b': 'Graduation',
            r'\bpapers\b': 'Papers Due',
            r'\bproject\b': 'Project',
            r'\bresearch\b': 'Research',
            r'\blabs\b': 'Laboratory',
            r'\bstudy\b': 'Study Session',
            r'\breview\b': 'Review Session',
            r'\bconsultation\b': 'Consultation',
            r'\bcheckup\b': 'Checkup',
            r'\bappointment\b': 'Appointment',
            r'\bflight\b': 'Flight',
            r'\bdemo\b': 'Demo',
            r'\bdemonstration\b': 'Demonstration',
            r'\blaunch\b': 'Launch',
            r'\breleases?\b': 'Release'
        }

        # Subject/category patterns (to describe the type of event)
        self.subject_patterns = {
            r'\bmath\b|\bmathematics\b': 'Math',
            r'\bchem\b|\bchemistry\b': 'Chemistry',
            r'\bphysics\b': 'Physics',
            r'\bbio\b|\bbiology\b': 'Biology',
            r'\bhistory\b': 'History',
            r'\bliterature\b|\benglish\b': 'English/Literature',
            r'\bcomputer\b|\bcs\b|\bprogramming\b': 'Computer Science',
            r'\bart\b|\bdrawing\b|\bpainting\b': 'Art',
            r'\bmusic\b': 'Music',
            r'\bdoctor\b|\bmedical\b|\bhealth\b': 'Medical',
            r'\bdental\b|\bdentist\b': 'Dental',
            r'\blegal\b|\blawyer\b|\blaw\b': 'Legal',
            r'\bfinancial\b|\bfinance\b|\baccounting\b': 'Financial',
            r'\bsocial\b': 'Social',
            r'\bfamily\b': 'Family',
            r'\bbusiness\b': 'Business',
            r'\bwork\b': 'Work',
            r'\bschool\b|\bcollege\b|\buniversity\b|\bacademic\b': 'School',
            r'\bsports?\b|\bgym\b|\bfitness\b|\bexercise\b': 'Sports/Fitness',
            r'\btravel\b': 'Travel'
        }

        # Enhanced special times
        self.special_times = {
            'noon': '12:00', 'midnight': '00:00', 'morning': '09:00',
            'afternoon': '14:00', 'evening': '19:00', 'night': '22:00',
            'dawn': '06:00', 'dusk': '18:00', 'midday': '12:00',
            'lunchtime': '12:00', 'sunrise': '06:00', 'sunset': '18:00'
        }

        # Enhanced number words mapping
        self.number_words = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
            'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18,
            'nineteen': 19, 'twenty': 20, 'thirty': 30, 'forty': 40,
            'fifty': 50
        }

        # Enhanced duration patterns
        self.duration_patterns = [
            # Standard patterns
            r'(?:\bfor\s+)?(?P<hours>\d+\.?\d*)\s*(?:h|hr|hour|hours)s?'
            r'(?:\s+(?:and\s+)?(?P<minutes>\d+)\s*(?:m|min|minute|minutes)s?)?\b',
            
            # Word-based durations
            r'(?:\bfor\s+)?(?P<hours>one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)'
            r'(?:\s+and\s+(?:a\s+)?(?P<fraction>half|quarter))?\s*(?:hour|hours)s?\b',
            
            # Fractional durations
            r'\b(?:a\s+)?half(?:\s+an?\s+hour)?\b',
            r'\b(?:a\s+)?quarter(?:\s+of\s+an?\s+hour)?\b',
        ]

        # Enhanced special durations
        self.special_durations = {
            'an hour': 60, 'a hour': 60, 'half hour': 30, 'half an hour': 30,
            'quarter hour': 15, 'quarter of an hour': 15, 'an hour and a half': 90,
            'a half hour': 30, 'quarter hour': 15
        }

        # Compile all patterns
        self.compiled_time_patterns = [re.compile(p, re.IGNORECASE) for p in self.time_patterns]
        self.compiled_duration_patterns = [re.compile(p, re.IGNORECASE) for p in self.duration_patterns]
        self.compiled_date_patterns = [re.compile(p, re.IGNORECASE) for p in self.date_patterns]
        self.compiled_weekday_patterns = [re.compile(p, re.IGNORECASE) for p in self.weekday_patterns]
        self.compiled_event_indicators = {re.compile(p, re.IGNORECASE): label for p, label in self.event_indicators.items()}
        self.compiled_subject_patterns = {re.compile(p, re.IGNORECASE): label for p, label in self.subject_patterns.items()}
        self.special_times_pattern = re.compile(
            r'\b(' + '|'.join(self.special_times.keys()) + r')\b',
            re.IGNORECASE
        )

    def parse_time(self, text: str) -> Dict[str, Optional[str]]:
        """
        Parse time and duration from text and return start and end times.
        
        Args:
            text: Input text containing time information
            
        Returns:
            Dictionary with 'start_time', 'end_time', and 'day_marking_title' keys (values may be None)
        """
        if not isinstance(text, str):
            return {'start_time': None, 'end_time': None, 'day_marking_title': None}

        result = {
            'start_time': None,
            'end_time': None,
            'day_marking_title': None
        }

        # Check for special times first
        special_match = self.special_times_pattern.search(text)
        if special_match:
            result['start_time'] = self.special_times[special_match.group().lower()]

        # Process time patterns
        for pattern in self.compiled_time_patterns:
            matches = pattern.finditer(text)
            for match in matches:
                # Skip if part of a date
                if self._is_part_of_date(text, match.start(), match.end()):
                    continue

                groups = match.groupdict()
                
                # Handle explicit time ranges
                if all(key in groups for key in ['start_hour', 'end_hour']):
                    range_result = self._handle_range(
                        groups.get('start_hour', ''),
                        groups.get('end_hour', ''),
                        groups.get('start_meridian', ''),
                        groups.get('end_meridian', ''),
                        groups.get('start_minute', '0'),
                        groups.get('end_minute', '0')
                    )
                    if range_result:
                        result.update(range_result)
                        return result
                
                # Handle single time
                time = self._parse_time_match(match)
                if time:
                    if not result['start_time']:
                        result['start_time'] = time
                    elif not result['end_time']:
                        result['end_time'] = time

        # Process duration if we have start time but no end time
        if result['start_time'] and not result['end_time']:
            duration_minutes = self._extract_duration(text)
            if duration_minutes:
                try:
                    start_dt = datetime.strptime(result['start_time'], '%H:%M')
                    end_dt = start_dt + timedelta(minutes=duration_minutes)
                    result['end_time'] = end_dt.strftime('%H:%M')
                except ValueError:
                    pass



        is_day_marking = not result.get('start_time') and not result.get('end_time')
        # Check for day marking if no time was found
        print(is_day_marking)
        print("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB")
        result['day_marking_title'] = is_day_marking
            
            
        return result

        
    def _is_part_of_date(self, text: str, start_pos: int, end_pos: int) -> bool:
        """Check if the matched text is part of a date"""
        try:
            for pattern in self.compiled_date_patterns:
                for match in pattern.finditer(text):
                    if start_pos >= match.start() and end_pos <= match.end():
                        return True
            return False
        except (TypeError, AttributeError):
            return False

    def _parse_time_match(self, match: re.Match) -> Optional[str]:
        """Parse a time match and return in 24-hour format"""
        try:
            groups = match.groupdict()
            if not groups or 'hour' not in groups:
                return None
                
            hour_str = groups.get('hour')
            if not hour_str:
                return None
            
            # Convert word numbers to digits
            if isinstance(hour_str, str) and hour_str.lower() in self.number_words:
                hour = self.number_words[hour_str.lower()]
            else:
                try:
                    hour = int(hour_str)
                except (ValueError, TypeError):
                    return None
                
            # Safely convert minute with default
            try:
                minute = int(groups.get('minute', '0') or '0')
            except (ValueError, TypeError):
                minute = 0
                
            meridian = (groups.get('meridian') or '').lower().replace('.', '')

            # Handle special cases
            if meridian in ['noon', 'midnight']:
                return '12:00' if meridian == 'noon' else '00:00'

            # Convert to 24-hour format
            if meridian:
                if meridian.startswith('p') and hour != 12:
                    hour += 12
                elif meridian.startswith('a') and hour == 12:
                    hour = 0

            # Validate time
            if not (0 <= hour <= 23 and 0 <= minute <= 59):
                return None

            return f"{hour:02d}:{minute:02d}"

        except (ValueError, AttributeError, TypeError):
            return None

    def _extract_duration(self, text: str) -> Optional[int]:
        """Extract duration from text and return total minutes"""
        try:
            # Check special durations first
            for special, minutes in self.special_durations.items():
                if special in text.lower():
                    return minutes

            # Process duration patterns
            for pattern in self.compiled_duration_patterns:
                match = pattern.search(text)
                if match:
                    groups = match.groupdict()
                    total_minutes = 0
                    
                    # Handle hours
                    if groups.get('hours'):
                        hours_str = groups['hours']
                        if hours_str.isdigit():
                            hours = float(hours_str)
                        else:
                            hours = self.number_words.get(hours_str.lower(), 0)
                        total_minutes += int(hours * 60)
                    
                    # Handle minutes
                    if groups.get('minutes'):
                        try:
                            minutes = int(groups['minutes'])
                            total_minutes += minutes
                        except (ValueError, TypeError):
                            pass
                    
                    # Handle fractions
                    if groups.get('fraction'):
                        fraction = groups['fraction'].lower()
                        if fraction == 'half':
                            total_minutes += 30
                        elif fraction == 'quarter':
                            total_minutes += 15
                    
                    return total_minutes

            return None
        except (ValueError, AttributeError, TypeError):
            return None

    def _handle_range(self, start_hour_str: str, end_hour_str: str, 
                     start_meridian: str, end_meridian: str,
                     start_minute_str: str = '0', end_minute_str: str = '0') -> Optional[Dict[str, str]]:
        """Handle time ranges with enhanced meridian handling and None checks"""
        try:
            # Early validation of inputs
            if not all(isinstance(x, str) for x in [start_hour_str, end_hour_str]):
                return None
                
            # Convert word numbers if necessary
            if start_hour_str.lower() in self.number_words:
                start_hour = self.number_words[start_hour_str.lower()]
            else:
                try:
                    start_hour = int(start_hour_str)
                except (ValueError, TypeError):
                    return None
                
            if end_hour_str.lower() in self.number_words:
                end_hour = self.number_words[end_hour_str.lower()]
            else:
                try:
                    end_hour = int(end_hour_str)
                except (ValueError, TypeError):
                    return None
            
            # Safely convert minutes with defaults
            try:
                start_minute = int(start_minute_str or '0')
                end_minute = int(end_minute_str or '0')
            except (ValueError, TypeError):
                start_minute = 0
                end_minute = 0
            
            # Process meridians with None handling
            start_meridian = (start_meridian or '').lower().replace('.', '')
            end_meridian = (end_meridian or '').lower().replace('.', '')
            
            # Convert start time to 24-hour format
            if start_meridian.startswith('p'):
                if start_hour != 12:
                    start_hour += 12
            elif start_meridian.startswith('a'):
                if start_hour == 12:
                    start_hour = 0
                    
            # Convert end time to 24-hour format
            if end_meridian.startswith('p'):
                if end_hour != 12:
                    end_hour += 12
            elif end_meridian.startswith('a'):
                if end_hour == 12:
                    end_hour = 0
            
            # Handle cross-meridian ranges (e.g., 11pm-1am)
            if not end_meridian and start_meridian:
                if start_hour > end_hour:
                    if start_meridian.startswith('p'):
                        end_hour += 12
                else:
                    if start_meridian.startswith('p'):
                        end_hour += 12
                    elif start_meridian.startswith('a'):
                        end_hour = end_hour % 12
            
            # Final validation
            if not (0 <= start_hour <= 23 and 0 <= end_hour <= 23 and
                   0 <= start_minute <= 59 and 0 <= end_minute <= 59):
                return None
            
            return {
                'start_time': f"{start_hour:02d}:{start_minute:02d}",
                'end_time': f"{end_hour:02d}:{end_minute:02d}"
            }
            
        except (ValueError, AttributeError, TypeError):
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
            #date correction

            "janruary": "January",
            
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





        #REGEX RECURRENCE PATTERNS_________________________________________________________________________________________________

        self.recurrence_patterns = {
            'daily': {
                'exact': ['every day', 'daily'],
                'variations': [
                    'each day', 'per day', 'once a day', 'a day', 
                    'everyday', 'all days', 'on a daily basis'
                ],
                'intervals': [
                    r'every\s+(\d+)\s+days?',
                    r'each\s+(\d+)\s+days?',
                    r'once\s+every\s+(\d+)\s+days?',
                    r'(\d+)\s+days?\s+interval'
                ]
            },
            'weekly': {
                'exact': ['every week', 'weekly'],
                'variations': [
                    'each week', 'per week', 'once a week', 'a week',
                    'on a weekly basis'
                ],
                'intervals': [
                    r'every\s+(\d+)\s+weeks?',
                    r'each\s+(\d+)\s+weeks?',
                    r'once\s+every\s+(\d+)\s+weeks?',
                    r'(\d+)\s+weeks?\s+interval'
                ],
                'days': {
                    'monday': ['monday', 'mon', 'mondays'],
                    'tuesday': ['tuesday', 'tue', 'tues', 'tuesdays'],
                    'wednesday': ['wednesday', 'wed', 'wednesdays'],
                    'thursday': ['thursday', 'thu', 'thur', 'thurs', 'thursdays'],
                    'friday': ['friday', 'fri', 'fridays'],
                    'saturday': ['saturday', 'sat', 'saturdays'],
                    'sunday': ['sunday', 'sun', 'sundays']
                },
                'day_patterns': [
                    r'every\s+([a-zA-Z]+day)',
                    r'each\s+([a-zA-Z]+day)',
                    r'on\s+([a-zA-Z]+days?)',
                    r'every\s+(mon|tue|wed|thu|fri|sat|sun)',
                ]
            },
            'monthly': {
                'exact': ['every month', 'monthly'],
                'variations': [
                    'each month', 'per month', 'once a month', 'a month',
                    'on a monthly basis'
                ],
                'intervals': [
                    r'every\s+(\d+)\s+months?',
                    r'each\s+(\d+)\s+months?',
                    r'once\s+every\s+(\d+)\s+months?',
                    r'(\d+)\s+months?\s+interval'
                ],
                'specific_date': [
                    r'(\d+)(?:st|nd|rd|th)?\s+(?:of\s+)?(?:every|each)\s+month',
                    r'on\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)',
                    r'month(?:ly)?\s+on\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)',
                ],
                'relative_date': [
                    r'(?:on\s+)?(?:the\s+)?(first|second|third|fourth|fifth|last)\s+(?:[a-zA-Z]+day)\s+(?:of\s+)?(?:every|each|the)\s+month',
                    r'(?:on\s+)?(?:the\s+)?(first|second|third|fourth|fifth|last)\s+week(?:end)?\s+(?:of\s+)?(?:every|each|the)\s+month'
                ]
            },
            'yearly': {
                'exact': ['every year', 'yearly', 'annually'],
                'variations': [
                    'each year', 'per year', 'once a year', 'a year',
                    'on a yearly basis', 'once every year'
                ],
                'intervals': [
                    r'every\s+(\d+)\s+years?',
                    r'each\s+(\d+)\s+years?',
                    r'once\s+every\s+(\d+)\s+years?',
                    r'(\d+)\s+years?\s+interval'
                ],
                'specific_date': [
                    r'(?:every|each)\s+([a-zA-Z]+)\s+(\d+)(?:st|nd|rd|th)?',
                    r'(?:on\s+)?([a-zA-Z]+)\s+(\d+)(?:st|nd|rd|th)?\s+(?:every|each)\s+year'
                ]
            },
            'custom': {
                'relative': [
                    r'every\s+other\s+(day|week|month|year)',
                    r'alternate\s+(day|week|month|year)s?',
                    r'every\s+second\s+(day|week|month|year)'
                ]
            }
        }
        
        #REGEX RECURRENCE PATTERNS_________________________________________________________________________________________________

        
        

        
        self.relative_numbers = {
            'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
            'last': -1
        }
        
        self.month_names = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4,
            'may': 5, 'june': 6, 'july': 7, 'august': 8,
            'september': 9, 'october': 10, 'november': 11, 'december': 12,
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
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


    def _match_pattern_list(self, text: str, patterns: list) -> Optional[re.Match]:
        """Try to match any pattern from a list against the text."""
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match
        return None

    def _find_weekday(self, text: str) -> Optional[str]:
        """Find weekday mentioned in the text."""
        for day, variations in self.recurrence_patterns['weekly']['days'].items():
            for variation in variations:
                if variation in text.lower():
                    return day
        return None

    def _extract_recurrence(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract recurrence pattern from the text."""
        text = text.lower().strip()
        
        # Check daily patterns with intervals
        match = self._match_pattern_list(text, self.recurrence_patterns['daily']['intervals'])
        if match:
            interval = int(match.group(1))
            return {'type': 'daily', 'interval': interval, 'day': 1}
        
        # Check daily patterns
        for pattern in self.recurrence_patterns['daily']['exact'] + self.recurrence_patterns['daily']['variations']:
            if pattern in text:
                return {'type': 'daily', 'interval': 1, 'day': 1}

        # Check weekly patterns with specific days
        weekday = self._find_weekday(text)
        if weekday:
            match = self._match_pattern_list(text, self.recurrence_patterns['weekly']['day_patterns'])
            if match:
                # Use the default day from weekday
                return {'type': 'weekly', 'interval': 1, 'day': weekday}

        # Check weekly patterns with intervals
        match = self._match_pattern_list(text, self.recurrence_patterns['weekly']['intervals'])
        if match:
            interval = int(match.group(1))
            # Default to Monday (1) if no specific day mentioned
            return {'type': 'weekly', 'interval': interval, 'day': 'monday'}

        # Check weekly patterns without specific days
        for pattern in self.recurrence_patterns['weekly']['exact'] + self.recurrence_patterns['weekly']['variations']:
            if pattern in text:
                # Default to Monday (1) if no specific day mentioned
                return {'type': 'weekly', 'interval': 1, 'day': 'monday'}

        # Check monthly patterns with intervals
        match = self._match_pattern_list(text, self.recurrence_patterns['monthly']['intervals'])
        if match:
            interval = int(match.group(1))
            # Default to 1st day of month
            return {'type': 'monthly', 'interval': interval, 'day': 1}

        # Check monthly patterns with specific dates
        match = self._match_pattern_list(text, self.recurrence_patterns['monthly']['specific_date'])
        if match:
            day = int(match.group(1))
            if 1 <= day <= 31:
                return {'type': 'monthly', 'interval': 1, 'day': day}

        # Check monthly patterns with relative dates
        match = self._match_pattern_list(text, self.recurrence_patterns['monthly']['relative_date'])
        if match:
            position = self.relative_numbers.get(match.group(1))
            if position:
                # Still need a default day (1st)
                return {'type': 'monthly', 'interval': 1, 'day': 1, 'relative_position': position}

        # Check basic monthly patterns
        for pattern in self.recurrence_patterns['monthly']['exact'] + self.recurrence_patterns['monthly']['variations']:
            if pattern in text:
                # Default to 1st day of month
                return {'type': 'monthly', 'interval': 1, 'day': 1}

        # Check yearly patterns with intervals
        match = self._match_pattern_list(text, self.recurrence_patterns['yearly']['intervals'])
        if match:
            interval = int(match.group(1))
            # Default to January 1st
            return {'type': 'yearly', 'interval': interval, 'month': 1, 'day': 1}

        # Check yearly patterns with specific dates
        match = self._match_pattern_list(text, self.recurrence_patterns['yearly']['specific_date'])
        if match:
            month = self.month_names.get(match.group(1).lower())
            day = int(match.group(2))
            if month and 1 <= day <= 31:
                return {'type': 'yearly', 'interval': 1, 'month': month, 'day': day}

        # Check basic yearly patterns
        for pattern in self.recurrence_patterns['yearly']['exact'] + self.recurrence_patterns['yearly']['variations']:
            if pattern in text:
                # Default to January 1st
                return {'type': 'yearly', 'interval': 1, 'month': 1, 'day': 1}

        # Check relative intervals (every other day, etc.)
        match = self._match_pattern_list(text, self.recurrence_patterns['custom']['relative'])
        if match:
            unit = match.group(1)
            if unit == 'day':
                return {'type': 'daily', 'interval': 2, 'day': 1}
            elif unit == 'week':
                return {'type': 'weekly', 'interval': 2, 'day': 'monday'}
            elif unit == 'month':
                return {'type': 'monthly', 'interval': 2, 'day': 1}
            elif unit == 'year':
                return {'type': 'yearly', 'interval': 2, 'month': 1, 'day': 1}

        return None

    def parse(self, text: str) -> Dict[str, Any]:
        """
        Parse text and return recurrence pattern.
        Returns None if no pattern is found.
        """
        result = self._extract_recurrence(text)
        if result:
            result['original_text'] = text
            return result
        return {'type': 'unknown', 'original_text': text}

    def validate_pattern(self, pattern: Dict[str, Any]) -> bool:
        """Validate the extracted pattern."""
        if not pattern or pattern['type'] == 'unknown':
            return False
            
        if 'interval' not in pattern or pattern['interval'] < 1:
            return False
            
        # Make sure 'day' is present for all pattern types
        if 'day' not in pattern:
            return False
            
        if pattern['type'] == 'monthly' and not (1 <= pattern['day'] <= 31):
            return False
                
        if 'month' in pattern and not (1 <= pattern['month'] <= 12):
            return False
            
        return True
    
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
        Extract event category with comprehensive context awareness and robust categorization rules.
        Handles a wide variety of event types while maintaining accuracy and context sensitivity.
        """
        text_lower = text.lower()
        words = set(text_lower.split())
        doc = self.nlp(text_lower)
        
        # Define comprehensive category patterns with required and excluded terms
        category_rules = {
            'travel': {
                'required_contexts': [
                    # Transportation
                    (['flight', 'plane', 'train', 'bus', 'ship', 'cruise'], 1),
                    # Travel activities
                    (['trip', 'vacation', 'journey', 'travel', 'touring', 'sightseeing'], 1),
                    # Travel logistics
                    (['airport', 'station', 'terminal', 'boarding', 'departure', 'arrival'], 1)
                ],
                'exclude_if': [],
                'context_override': {
                    'virtual trip': 'virtual_event',
                    'business trip': 'work'
                }
            },
            'school': {
                'required_contexts': [
                    # Educational institutions
                    (['school', 'university', 'college', 'academy', 'institute', 'campus'], 1),
                    # Academic activities
                    (['class', 'lecture', 'seminar', 'workshop', 'tutorial', 'lab'], 1),
                    # Academic tasks
                    (['exam', 'test', 'quiz', 'assignment', 'homework', 'thesis', 'project'], 1),
                    # Academic events
                    (['graduation', 'orientation', 'ceremony', 'symposium'], 1)
                ],
                'exclude_if': ['party'],
                'context_override': {
                    'art class': 'hobby_and_leisure',
                    'cooking class': 'hobby_and_leisure',
                    'fitness class': 'health_and_wellness'
                }
            },
            'work': {
                'required_contexts': [
                    # Business activities
                    (['meeting', 'presentation', 'conference', 'workshop', 'training', 'seminar'], 1),
                    # Work-related
                    (['work', 'office', 'business', 'job', 'career', 'professional'], 1),
                    # Professional events
                    (['interview', 'deadline', 'review', 'report', 'project', 'launch'], 1),
                    # Remote work
                    (['remote', 'virtual', 'online', 'zoom', 'teams', 'webinar'], 1)
                ],
                'exclude_if': ['party'],
                'context_override': {
                    'social meeting': 'social',
                    'club meeting': 'social'
                }
            },
            'social': {
                'required_contexts': [
                    # Social gatherings
                    (['party', 'gathering', 'meetup', 'hangout', 'get-together', 'celebration'], 1),
                    # Social activities
                    (['dinner', 'lunch', 'brunch', 'drinks', 'coffee', 'dating'], 1),
                    # Entertainment
                    (['movie', 'concert', 'show', 'festival', 'theater', 'club'], 1),
                    # Social events
                    (['wedding', 'reception', 'anniversary', 'birthday', 'shower', 'engagement'], 1)
                ],
                'exclude_if': [],
                'context_override': {
                    'business dinner': 'work',
                    'family dinner': 'family'
                }
            },
            'sports': {
                'required_contexts': [
                    # Sports events
                    (['game', 'match', 'tournament', 'competition', 'race', 'marathon'], 1),
                    # Training
                    (['practice', 'training', 'workout', 'exercise', 'session', 'class'], 1),
                    # Specific sports
                    (['soccer', 'basketball', 'football', 'tennis', 'golf', 'baseball', 'volleyball'], 1),
                    # Fitness activities
                    (['gym', 'swimming', 'cycling', 'running', 'hiking', 'climbing'], 1)
                ],
                'exclude_if': ['video game', 'board game'],
                'context_override': {
                    'sports party': 'social',
                    'game night': 'social'
                }
            },
            'health': {
                'required_contexts': [
                    # Medical
                    (['doctor', 'dentist', 'physician', 'specialist', 'clinic', 'hospital'], 1),
                    # Appointments
                    (['appointment', 'checkup', 'consultation', 'examination', 'screening', 'test'], 1),
                    # Mental health
                    (['therapy', 'counseling', 'psychiatrist', 'psychologist', 'treatment'], 1),
                    # Wellness activities
                    (['yoga', 'meditation', 'massage', 'spa', 'wellness', 'healing'], 1)
                ],
                'exclude_if': [],
                'context_override': {
                    'wellness party': 'social'
                }
            },
            'family': {
                'required_contexts': [
                    # Family members
                    (['family', 'parents', 'children', 'kids', 'relatives', 'siblings', 'mother', 'father', 'son', 'daughter', 'brother', 'sister', 'aunt', 'uncle', 'grandparents', 'grandmother', 'grandfather', 'nephew', 'niece', 'cousin', 'in-laws', 'stepmother', 'stepfather', 'stepsister', 'stepbrother', 'half-sibling', 'guardian'], 1),
                    
                    # Family events
                    (['reunion', 'gathering', 'dinner', 'celebration', 'party', 'holiday', 'wedding', 'anniversary', 'birthday', 'christmas', 'thanksgiving', 'easter', 'new year', 'family event', 'picnic', 'barbecue', 'family outing', 'family gathering', 'family celebration', 'graduation', 'baby shower', 'wedding anniversary', 'brunch', 'reception', 'family barbecue'], 1),
                    
                    # Family activities
                    (['visit', 'vacation', 'trip', 'outing', 'meal', 'celebration', 'holiday', 'road trip', 'staycation', 'reunion', 'camping', 'hiking', 'picnic', 'pool party', 'movie night', 'board games', 'family fun', 'game night', 'family movie', 'family hike', 'park visit', 'family bonding', 'family games'], 1)
                ],
                'exclude_if': [],
                'context_override': {
                    'family business': 'work'
                }
            },
            'hobby_and_leisure': {
                'required_contexts': [
                    # Creative hobbies
                    (['painting', 'drawing', 'crafting', 'photography', 'writing', 'music'], 1),
                    # Learning
                    (['class', 'workshop', 'lesson', 'tutorial', 'practice', 'session'], 1),
                    # Gaming
                    (['gaming', 'game', 'playing', 'stream', 'tournament', 'competition'], 1),
                    # Other hobbies
                    (['gardening', 'cooking', 'baking', 'reading', 'collecting', 'making'], 1)
                ],
                'exclude_if': [],
                'context_override': {
                    'work project': 'work',
                    'school project': 'school'
                }
            },
            'virtual_event': {
                'required_contexts': [
                    # Online events
                    (['webinar', 'livestream', 'broadcast', 'stream', 'virtual', 'online'], 1),
                    # Virtual activities
                    (['zoom', 'teams', 'meet', 'hangout', 'call', 'conference'], 1)
                ],
                'exclude_if': [],
                'context_override': {}
            },
            'shopping_and_errands': {
                'required_contexts': [
                    # Shopping
                    (['shopping', 'store', 'mall', 'market', 'shop', 'buying'], 1),
                    # Errands
                    (['errand', 'pickup', 'delivery', 'return', 'purchase', 'order'], 1),
                    # Services
                    (['appointment', 'service', 'maintenance', 'repair', 'installation'], 1)
                ],
                'exclude_if': [],
                'context_override': {}
            },
            'cultural': {
                'required_contexts': [
                    # East Asian Traditions
                    (['jesa', 'charye', 'seollal', 'chuseok', 'qingming', 'chunfen', 'dongzhi',  # Korean and Chinese
                    'hanami', 'obon', 'shichigosan', 'setsubun', 'tanabata',  # Japanese
                    'tet', 'ghost festival', 'mid-autumn', 'lunar new year', 'spring festival'], 1),  # Vietnamese & General
                    
                    # South Asian Celebrations
                    (['diwali', 'holi', 'navratri', 'durga puja', 'sankranti', 'lohri', 'pongal',
                    'onam', 'baisakhi', 'karva chauth', 'raksha bandhan', 'ganesh chaturthi',
                    'buddha purnima', 'magh bihu', 'gudi padwa', 'ugadi'], 1),
                    
                    # Middle Eastern & Islamic
                    (['ramadan', 'eid al-fitr', 'eid al-adha', 'ashura', 'mawlid',
                    'nowruz', 'muharram', 'shab-e-barat', 'laylat al-qadr',
                    'sukkot', 'passover', 'hanukkah', 'rosh hashanah', 'yom kippur'], 1),
                    
                    # European Traditions
                    (['oktoberfest', 'bastille day', 'guy fawkes', 'st patrick', 'burns night',
                    'midsummer', 'krampusnacht', 'sinterklaas', 'la tomatina',
                    'carnival', 'fasching', 'swedish lucia', 'hogmanay'], 1),
                    
                    # African Celebrations
                    (['kwanzaa', 'homowo', 'egungun', 'enkutatash', 'timkat',
                    'umhlanga', 'zulu reed dance', 'mombasa carnival', 'fete gede',
                    'essaouira gnawa', 'festima', 'gerewol'], 1),
                    
                    # Latin American & Caribbean
                    (['dia de los muertos', 'carnival', 'cinco de mayo', 'las posadas',
                    'feria de las flores', 'inti raymi', 'fiesta de la candelaria',
                    'junkanoo', 'crop over', 'carnival', 'independence day'], 1),
                    
                    # Pacific & Indigenous
                    (['matariki', 'pasifika', 'heiva i tahiti', 'merrie monarch',
                    'naidoc week', 'national aboriginal day', 'pow wow',
                    'gathering of nations', 'indigenous peoples day'], 1),
                    
                    # Religious Festivals (Cross-Cultural)
                    (['christmas', 'easter', 'vesak', 'bodhi day', 'magha puja',
                    'guru purnima', 'krishna janmashtami', 'makar sankranti',
                    'beltane', 'samhain', 'ostara', 'yule', 'imbolc', 'lughnasadh'], 1),
                    
                    # Modern Cultural Events
                    (['pride parade', 'cultural festival', 'heritage day', 'independence day',
                    'national day', 'new year', 'lantern festival', 'harvest festival',
                    'food festival', 'cultural fair', 'ethnic celebration'], 1),
                    
                    # Traditional Activities
                    (['ceremony', 'ritual', 'procession', 'pilgrimage', 'blessing',
                    'feast', 'offering', 'prayer', 'meditation', 'commemoration',
                    'ancestral worship', 'traditional dance', 'folk music'], 1),
                    
                    # Cultural Locations
                    (['temple', 'shrine', 'mosque', 'church', 'synagogue', 'monastery',
                    'cultural center', 'community hall', 'sacred site', 'heritage site',
                    'historical site', 'traditional market', 'festival grounds'], 1),
                    
                    # Cultural Arts & Performances
                    (['traditional dance', 'folk music', 'cultural performance',
                    'traditional theater', 'puppet show', 'story telling',
                    'tea ceremony', 'calligraphy', 'traditional art',
                    'martial arts demonstration', 'traditional crafts'], 1),
                    
                    # Traditional Food Events
                    (['feast', 'food festival', 'traditional cooking', 'ceremonial meal',
                    'harvest celebration', 'tea ceremony', 'traditional banquet',
                    'food offering', 'communal dining', 'festive meal'], 1),
                    
                    # Cultural Games & Sports
                    (['traditional games', 'folk sports', 'ritual competition',
                    'traditional wrestling', 
                    'ceremonial race', 'traditional boat race', 'kite festival'], 1),
                    
                    # Seasonal & Natural Events
                    (['harvest festival', 'spring festival', 'summer solstice',
                    'winter solstice', 'equinox celebration', 'full moon festival',
                    'new year celebration', 'seasonal ritual', 'planting festival'], 1)
                ],
                'exclude_if': ['cancelled', 'postponed'],
                'context_override': {
                    'cultural appropriation': None,
                    'cultural sensitivity training': 'work',
                    'cultural studies class': 'school'
                }
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
        
        # Select best category or return None
        if matched_categories:
            best_match = max(matched_categories, key=lambda x: x[1])
            return {
                'category': best_match[0],
                'confidence': best_match[1],
                'subcategories': []
            }
        
        return {
            'category': None,
            'confidence': 0,
            'subcategories': []
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
            'activities': [
                # Exercise & Sports
        r'(?i)(workout|gym|training|exercising|lifting|cardio|running|swimming|cycling|hiking|climbing|jogging|skiing|snowboarding|surfing|boxing|martial arts|sparring|fitness|pilates|yoga|crossfit|jump rope|sprints|stretching|rowing|spin class|aerobics|kickboxing|gymnastics|Zumba|boxing match|wrestling|taekwondo|archery)',
        r'(?i)(gaming|streaming|playing|speedrunning|streaming|raid|match|game night|board games|video games|party games|poker|chess|esports|multiplayer|LAN party|role-playing|strategy games|arcade|trivia|quiz night|virtual reality|card games|tabletop games|dungeons and dragons|game tournament)',
        r'(?i)(sleep|nap|rest|relaxing|meditation|mindfulness|break|chill|hanging out|lounging|unwinding|downtime|taking it easy|power nap|catnap|recharging|repose|siesta|mental health break)',
        r'(?i)(drinking|partying|clubbing|bar hopping|pub crawl|night out|cocktail hour|happy hour|celebration|event|date|hangout|meetup|gathering|get-together|catch up|party|birthday|wedding|reunion|socializing|festival|theater|show|concert|performance|gig|open mic|music concert|comedy show|karaoke|stand-up|art exhibit|gallery opening|film screening)',
        r'(?i)(eating|dining|lunch|dinner|breakfast|brunch|snack|cookout|bbq|barbecue|picnic|potluck|feast|tasting|restaurant|cafe|food truck|coffee date|food delivery|grocery shopping|meal prep|grilling|cooking|baking|meal planning|food prep|fast food|takeout|cooking class|wine tasting|tea time)',
        r'(?i)(flight|trip|journey|travel|commute|drive|ride|vacation|getaway|tour|expedition|excursion|visit|holiday|road trip|staycation|business trip|cruise|weekend trip|tourism|flight booking|trip planning|transportation|bus ride|train ride|subway ride|carpool|uber|lyft|taxi|public transport)',
        r'(?i)(meeting|call|conference|presentation|interview|training|work|shift|overtime|project|task|assignment|deadline|briefing|consultation|workshop|teleconference|seminar|team call|virtual meeting|project planning|client call|one-on-one|review|catch-up|business lunch|networking event|performance review|business presentation|job interview|coaching session|audit|staff meeting|conference call)',
        r'(?i)(haircut|massage|spa|therapy|doctor|dentist|checkup|appointment|consultation|treatment|procedure|wellness check|facial|pedicure|manicure|skin care|acupuncture|chiropractic appointment|health screening|medical checkup|optometrist|physiotherapy|dental cleaning|therapist appointment|personal grooming|beauty treatment)',
        r'(?i)(cleaning|laundry|groceries|shopping|errands|chores|maintenance|repair|installation|setup|moving|organizing|decluttering|dishwashing|vacuuming|dusting|mopping|yard work|gardening|lawn care|car wash|home repairs|home improvement|grocery shopping|decluttering|home organizing|home decor shopping|tidying up|spring cleaning|furniture assembly)',
        r'(?i)(studying|reading|learning|practice|homework|research|class|lecture|seminar|workshop|tutorial|lesson|exam|test|assignment|project|course|degree|certificate|online course|webinar|conference|self-study|study session|reading group|language class|coding bootcamp|e-learning|training session|workshop|educational event|book club|learning new skill|personal development)',
        r'(?i)(painting|drawing|sculpting|crafting|diy|knitting|crocheting|sewing|embroidery|pottery|art class|craft fair|art exhibit|crafting workshop|creative writing|photography|videography|film making|digital art|scrapbooking|origami|jewelry making|woodworking|printmaking|design|calligraphy|graphic design|makeup artistry)',
        r'(?i)(hiking|camping|fishing|picnic|beach day|gardening|stargazing|birdwatching|boating|kayaking|canoeing|rock climbing|nature walk|outdoor adventure|barbecue|nature hike|wildlife watching|forest walk|trail walking|cycling trip|backpacking|outdoor sports|wilderness exploration|campfire|fishing trip|lake day|mountain climbing)',
        r'(?i)(baby sitting|childcare|family outing|family gathering|family dinner|parenting|playdate|birthday party|school event|school run|parent-teacher meeting|baby shower|family vacation|kids party|birthday celebration|family game night|parenting class|school pick-up|school drop-off)',
        r'(?i)(church|mass|temple|mosque|prayer|bible study|sabbath|spiritual gathering|meditation group|spiritual retreat|fasting|pilgrimage|holy day|religious service|spiritual cleansing|baptism|bar mitzvah|christening|ritual|satsang|yoga retreat|religious celebration|prayer group|faith meeting)',
        r'(?i)(volunteer|charity|donation|fundraising|food drive|community event|service project|nonprofit|volunteer work|charity event|outreach program|donation drive|blood donation|helping hand|community service|social cause|volunteering|group project|neighborhood meeting|donation pickup)',
        r'(?i)(shopping|fashion|clothing|store visit|outlet|shopping spree|fashion show|mall trip|retail therapy|online shopping|wardrobe update|styling|shoe shopping|accessory shopping|jewelry shopping|makeup shopping|designer shopping|gift shopping|thrift store|second-hand shopping|vintage shopping|buying new clothes|fashion consultation)',
        r'(?i)(coding|programming|hacking|gaming|tech meetup|hackathon|startup|software development|hardware building|AI project|machine learning|data science|tech conference|technology lecture|robotics|tech seminar|3d printing|gadget testing|app development|blockchain|cybersecurity|virtual reality demo|AR workshop|developer meetup)',
        r'(?i)(conference|workshop|meeting|event|session|presentation|discussion|webinar|seminar|forum|training|retreat|summit|exhibition|webcast|showcase|product launch|grand opening|press release|panel discussion|open house|expo|trade show|announcement|live demo|show and tell|lecture)',
        r'(?i)(therapy session|counseling|self-care|mental health day|personal retreat|yoga|journaling|meditation|mindfulness|relaxation|breathing exercises|positive thinking|therapy appointment|stress relief|mental health checkup|wellness session|personal development|self-improvement|emotional well-being)',
        r'(?i)(blogging|vlogging|writing|photography|crafting|diy project|gardening|drawing|painting|knitting|piano practice|musical instrument|songwriting|modeling|filmmaking|creative writing|scrapbooking|woodworking|pottery|sewing|photography session|creative session|hobby project|home improvement project|art project)',
        r'(?i)(vet appointment|dog walk|cat playtime|pet grooming|pet training|pet sitting|dog park|animal rescue|pet adoption|animal shelter|pet care|pet feeding|dog run|pet therapy|pet check-up|pet playdate|horseback riding|dog obedience training|bird watching)',
        r'(?i)(interior design|home improvement|furniture shopping|decorating|home renovation|home styling|housewarming|painting|remodeling|flooring installation|appliance shopping|lighting upgrade|space planning|organization|reorganization|design consultation|cleaning out closet|furniture assembly|wallpaper installation)'
            ],
            'modifiers': [
                r'(?i)(weekly|daily|regular|quick|long|intense|casual)',
                r'(?i)(group|solo|team|private|public|social|virtual)',
                r'(?i)(business|personal|family|friend|work|school)',
            ]
        }
        
        # Clean input text
        cleaned_text = ' '.join(re.sub(r'[^\w\s]', ' ', text).split())
        text_lower = cleaned_text.lower()
        
        # Words to ignore
        ignore_words = {
            # Time-related
            'today', 'tomorrow', 'tonight', 'morning', 'afternoon', 'evening',
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
            'next', 'last', 'this', 'every', 'daily', 'weekly', 'monthly',
            # Prepositions and articles
            'to', 'at', 'in', 'on', 'the', 'a', 'an', 'for', 'with', 'by',
            # Action verbs to ignore
            'going', 'having', 'doing', 'attending', 'planning', 'scheduled'
        }
        
        def find_main_activity(text):
            """Find the primary activity/event from the text"""
            matches = []
            
            # Look for activity patterns
            for pattern in patterns['activities']:
                found = re.search(pattern, text_lower)
                if found:
                    activity = found.group().strip()
                    start_pos = found.start()
                    matches.append((activity, start_pos))
            
            # Sort by position (earlier mentions usually more important)
            matches.sort(key=lambda x: x[1])
            
            if matches:
                return matches[0][0]
                
            # Fallback: take first significant word
            words = text_lower.split()
            for word in words:
                if word not in ignore_words:
                    return word
                    
            return "Event"  # Ultimate fallback
        
        def find_relevant_modifier(text, activity):
            """Find relevant modifier for the activity"""
            for pattern in patterns['modifiers']:
                found = re.search(pattern, text_lower)
                if found:
                    modifier = found.group().strip()
                    if modifier not in ignore_words and modifier not in activity:
                        return modifier
            return None
        
        def format_name(parts):
            """Format the event name properly"""
            # Capitalize each word
            parts = [p.capitalize() for p in parts if p]
            # Remove duplicates while preserving order
            seen = set()
            unique_parts = []
            for part in parts:
                if part.lower() not in seen:
                    seen.add(part.lower())
                    unique_parts.append(part)
            return ' '.join(unique_parts)
        
        # Extract main components
        activity = find_main_activity(text_lower)
        modifier = find_relevant_modifier(text_lower, activity)
        
        # Build name
        name_parts = []
        if modifier:
            name_parts.append(modifier)
        name_parts.append(activity)
        
        # Get important context if spaCy is available
        if hasattr(self, 'nlp'):
            doc = self.nlp(cleaned_text)
            for ent in doc.ents:
                if ent.label_ in ['PERSON', 'ORG'] and \
                ent.text.lower() not in [p.lower() for p in name_parts]:
                    name_parts.append(ent.text)
                    break
        
        return format_name(name_parts)
   
   
    def extract_event_type(self, text):
        """
        Classifier to determine if something is a calendar event, a task, or a day marker.
        Calendar events: Have specific times/dates or are scheduled appointments
        Tasks: Flexible activities, to-dos, or things without specific timing
        Day markers: Intent to mark or highlight a date without specific timing
        """
        text = text.lower()
        
        # 0. Check for marking intent
        marking_words = ['mark', 'remember', 'highlight', 'note', 'important day']
        is_marking = any(word in text for word in marking_words)
        if is_marking and not any(time_marker in text for time_marker in ['am', 'pm', ':00', ':15', ':30', ':45']):
            return 'marking'
            
        # 1. Check for specific times
        time_markers = ['am', 'pm', ':00', ':15', ':30', ':45', 'oclock', "o'clock"]
        has_time = any(marker in text for marker in time_markers)
        if has_time:
            return 'event'
            
        # 2. Check for specific dates/days
        day_markers = [
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
            'tomorrow', 'tonight', 'today'
        ]
        has_date = any(marker in text for marker in day_markers)
        if has_date:
            return 'event'
            
        # 3. Check for scheduling words
        schedule_words = [
            'appointment', 'meeting', 'scheduled', 'reservation', 'booked',
            'starts at', 'begins at', 'ends at'
        ]
        is_scheduled = any(word in text for word in schedule_words)
        if is_scheduled:
            return 'event'
            
        # 4. Check for task/todo indicators
        task_words = [
            'need to', 'should', 'todo', 'to-do', 'task', 'sometime',
            'eventually', 'when', 'if', 'maybe', 'later'
        ]
        is_task = any(word in text for word in task_words)
        if is_task:
            return 'task'
            
        # If no clear indicators, use a simple heuristic:
        # If it has "at" or "on" without other task words, probably an event
        if ' at ' in text or ' on ' in text:
            return 'event'
            
        # Default to task - if it's not clearly scheduled, it's probably flexible
        return 'task'
        
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
            'day_marking_title': None,  # New field for descriptive day marking
            'confidence_scores': {}
        }
        
        event_name = self._extract_event_name(text)   
        
        # Extract event name
        result['event_name'] = event_name
        # Extract category with context
        category_info = self._extract_category_and_context(text)
        result['category'] = category_info['category']
        result['subcategories'] = category_info['subcategories']
        result['confidence_scores']['category'] = category_info['confidence']

        # Use TimeParser to extract time information
        time_info = time_parser.parse_time(text)
        result['start_time'] = time_info['start_time']
        result['end_time'] = time_info['end_time']
        
        if result['day_marking_title']:  # If True, we want a day marking
            result['day_marking_title'] = None  # or just leave it as False
        else:  # If False, no day marking needed
            result['day_marking_title'] = event_name  # Use event name or default

        # Extract date using dateparser with custom settings
        date_info = date_handler.parse_date(text)
        result['date'] = date_info

        # First check for explicit marking intent
        event_type = self.extract_event_type(text)
        
        # If marking type was detected or no times were found but we have a day marking title
        if event_type == 'marking' or (result['date'] and not result['start_time'] and result['day_marking_title']):
            result['type'] = 'marking'  # This will mark the day as important
            

        else:
            result['type'] = event_type  # Regular type extraction

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
        """Validate and clean the extracted information"""
        # Ensure event_name is not empty or None
        if not result['event_name']:
            # Try to generate a name from other fields if possible
            if result['category']:
                result['event_name'] = f"{result['category']} Event"
        
        # Ensure times are in proper format
        if result['start_time'] and not isinstance(result['start_time'], str):
            result['start_time'] = str(result['start_time'])
        
        if result['end_time'] and not isinstance(result['end_time'], str):
            result['end_time'] = str(result['end_time'])
        
        # Format date to yyyy-MM-dd
        if result['date']:
            date_str = str(result['date'])
            # Remove timestamp if present
            if ' ' in date_str:
                date_str = date_str.split(' ')[0]
            elif 'T' in date_str:
                date_str = date_str.split('T')[0]
            result['date'] = date_str
        
        # Set confidence scores for fields that don't have them
        for key in result:
            if key != 'confidence_scores' and key not in result['confidence_scores']:
                result['confidence_scores'][key] = 0.5  # Default confidence
        
        # Validate urgency is one of the expected values
        valid_urgency = ['low', 'medium', 'high']
        if result['urgency'] not in valid_urgency:
            result['urgency'] = 'medium'  # Default to medium
        
        # Clean empty lists
        if not result['subcategories']:
            result['subcategories'] = []
        
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



from .models import TodoTask


def home(request):
    result = None
    if request.method == "POST":
        form = UserInputForm(request.POST)
        if form.is_valid():
            user_input = form.cleaned_data['user_input']
            result = extract_schedule_info(user_input)
            
            if result and not result.get('error'):
                if result.get('type') == 'task':
                    # Create TodoTask
                    TodoTask.objects.create(
                        event=result.get('event_name'),
                        date=result.get('date'),
                    )
                elif result.get('type') == 'event':
                    # Create CalendarEvent
                    CalendarEvent.objects.create(
                        event_name=result.get('event_name'),
                        date=result.get('date'),
                        start_time=result.get('start_time'),
                        end_time=result.get('end_time'),
                        location=result.get('location'),
                        virtual=result.get('virtual', False),
                        urgency=result.get('urgency', 'medium'),
                        notes=result.get('notes'),
                        event_type='event',
                        category=result.get('category'),
                        subcategories=result.get('subcategories', ''),
                        recurrence_pattern=result.get('recurrence_pattern'),
                        color=result.get('color', "#000"),
                    )
    else:
        form = UserInputForm()
    
    # Get both tasks and events
    events = CalendarEvent.objects.all()
    tasks = TodoTask.objects.all()
    
    return render(request, 'home.html', {
        'form': form,
        'result': result,
        'events': events,
    })



# views.py
from django.http import HttpResponse
from django.middleware.csrf import get_token

def get_csrf_token(request):
    response = HttpResponse()
    response['X-CSRFToken'] = get_token(request)
    return response
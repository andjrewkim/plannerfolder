from django.utils import timezone
from datetime import datetime, date, time
import pytz
from rest_framework.exceptions import ValidationError


def get_user_timezone(request=None):
    user_timezone_str = None
    
    if request:
        checks = [
            ('META.HTTP_X_TIMEZONE', request.META.get('HTTP_X_TIMEZONE')),
            ('META.HTTP_X_USER_TIMEZONE', request.META.get('HTTP_X_USER_TIMEZONE')),
        ]
        
        if hasattr(request, 'headers'):
            checks.extend([
                ('headers[X-Timezone]', request.headers.get('X-Timezone')),
                ('headers[X-User-Timezone]', request.headers.get('X-User-Timezone')),
                ('headers[x-timezone]', request.headers.get('x-timezone')),
                ('headers[x-user-timezone]', request.headers.get('x-user-timezone')),
            ])
        
        for check_name, check_value in checks:
            if check_value and not user_timezone_str:
                user_timezone_str = check_value
                break
        
        if not user_timezone_str and hasattr(request, 'GET'):
            query_tz = request.GET.get('timezone')
            if query_tz:
                user_timezone_str = query_tz
    
    if not user_timezone_str:
        user_timezone_str = 'UTC'
    
    try:
        tz = pytz.timezone(user_timezone_str)
        return tz
    except pytz.exceptions.UnknownTimeZoneError:
        return pytz.UTC


def get_user_local_date(request=None):
    user_tz = get_user_timezone(request)
    utc_now = timezone.now()
    user_local_time = utc_now.astimezone(user_tz)
    return user_local_time.date()


def parse_date_in_user_timezone(date_input, request=None):
    if isinstance(date_input, date) and not isinstance(date_input, datetime):
        return date_input
    
    if isinstance(date_input, datetime):
        user_tz = get_user_timezone(request)
        if date_input.tzinfo is None:
            date_input = user_tz.localize(date_input)
        return date_input.astimezone(user_tz).date()
    
    if not isinstance(date_input, str):
        date_input = str(date_input)
    
    date_input = date_input.strip()
    
    try:
        user_tz = get_user_timezone(request)
        
        if 'T' in date_input or ' ' in date_input:
            dt_str = date_input.replace('Z', '+00:00')
            dt = datetime.fromisoformat(dt_str)
            
            if dt.tzinfo is None:
                dt = user_tz.localize(dt)
            else:
                dt = dt.astimezone(user_tz)
            
            return dt.date()
        else:
            return datetime.strptime(date_input, '%Y-%m-%d').date()
            
    except (ValueError, AttributeError) as e:
        raise ValidationError(
            f"Invalid date format: {date_input}. "
            f"Expected YYYY-MM-DD or ISO 8601 format. Error: {str(e)}"
        )
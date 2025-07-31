from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.views import View
from django.conf import settings
import json
import requests
import time
import os
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from django.utils import timezone
import pytz
from myapp.models import LLMUsage


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
    """Base class for LLM providers with shared calendar functionality"""
    
    def __init__(self, api_key: str, model: str, events_function=None, update_event_function=None):
        if not api_key or not api_key.strip():
            raise ValueError(f"{self.__class__.__name__} API key cannot be empty")
        if not model or not model.strip():
            raise ValueError(f"{self.__class__.__name__} model cannot be empty")
            
        self.api_key = api_key.strip()
        self.model = model.strip()
        self.events_function = events_function
        self.update_event_function = update_event_function
        
        # Test API key validity during initialization
        self._validate_api_key()
    
    @abstractmethod
    def _validate_api_key(self):
        """Test if API key is valid - implemented by each provider"""
        pass
    
    @abstractmethod
    def _make_api_request(self, message: str, prompt: str = None, max_retries: int = 3, **kwargs) -> Dict[str, Any]:
        """Make the actual API request - implemented by each provider"""
        pass
    
    def format_date(self, date_obj):
        """Format date object to YYYY-MM-DD string"""
        try:
            if hasattr(date_obj, 'date'):
                return date_obj.date().strftime('%Y-%m-%d')
            elif hasattr(date_obj, 'strftime'):
                return date_obj.strftime('%Y-%m-%d')
            else:
                # Handle string dates
                date_str = str(date_obj)
                if ' ' in date_str:
                    date_str = date_str.split(' ')[0]
                if '+' in date_str:
                    date_str = date_str.split('+')[0]
                return date_str
        except Exception:
            return str(date_obj)
    
    def get_week_date_range(self):
        """Get the start and end dates for the current week"""
        try:
            pacific_tz = pytz.timezone('America/Los_Angeles')
            now_pacific = timezone.now().astimezone(pacific_tz)
            today = now_pacific.date()
            week_start = today
            week_end = today + timedelta(days=6)
            return week_start, week_end
        except Exception:
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
                event_date = getattr(event, 'date', None)
                if event_date:
                    if hasattr(event_date, 'date'):
                        event_date = event_date.date()
                    elif isinstance(event_date, str):
                        event_date = datetime.strptime(event_date.split(' ')[0], '%Y-%m-%d').date()
                    
                    if week_start <= event_date <= week_end:
                        filtered_events.append(event)
            except Exception:
                # Include event if we can't determine its date
                filtered_events.append(event)
        
        return filtered_events
    
    def fetch_calendar_events(self):
        """Fetch events using the provided database function"""
        if not self.events_function:
            return []
            
        try:
            all_events = self.events_function()
            week_events = self.filter_events_by_week(all_events)
            
            events_list = []
            for event in week_events:
                event_dict = {
                    'name': getattr(event, 'event_name', 'Untitled'),
                    'date': self.format_date(getattr(event, 'date', 'No date')),
                    'start': str(getattr(event, 'start_time', 'No time')),
                    'end': str(getattr(event, 'end_time', 'No time')),
                    'id': getattr(event, 'id', None)
                }
                events_list.append(event_dict)
            
            return events_list
        except Exception as e:
            print(f"Error fetching calendar events: {e}")
            return []
    
    def format_events_for_context(self, events_data):
        """Format events for LLM context"""
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
        try:
            pacific_tz = pytz.timezone('America/Los_Angeles')
            now_pacific = timezone.now().astimezone(pacific_tz)
            today = now_pacific.strftime('%Y-%m-%d')
            week_start, week_end = self.get_week_date_range()
            week_range = f"{week_start} to {week_end}"
        except Exception:
            today = datetime.now().strftime('%Y-%m-%d')
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
- If user asks to schedule outside this week, mention you can only see the next 7 days"""
    
    def parse_event_changes(self, response_text):
        """Parse CHANGE: lines from LLM response"""
        changes = []
        lines = response_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if line.startswith('CHANGE:'):
                try:
                    change_data = line[7:]  # Remove "CHANGE:"
                    parts = change_data.split('|')
                    
                    if len(parts) == 3:
                        name = parts[0].strip()
                        date = parts[1].strip()
                        time_range = parts[2].strip()
                        
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
        
        return changes
    
    def clean_response_text(self, response_text):
        """Remove CHANGE: lines from response text for user display"""
        lines = response_text.split('\n')
        cleaned_lines = [line for line in lines if not line.strip().startswith('CHANGE:')]
        return '\n'.join(cleaned_lines).strip()
    
    def find_matching_event(self, change, original_events):
        """Find matching event by name"""
        change_name = change['name'].lower().strip()
        
        # Exact match first
        for event in original_events:
            if event['name'].lower().strip() == change_name:
                return event
        
        # Partial match
        for event in original_events:
            if change_name in event['name'].lower() or event['name'].lower() in change_name:
                return event
        
        return None
    
    def apply_event_changes(self, changes, original_events):
        """Apply event changes to the database"""
        if not self.update_event_function or not changes:
            return False
        
        updated_events = []
        for change in changes:
            matching_event = self.find_matching_event(change, original_events)
            
            if matching_event and matching_event['id']:
                try:
                    success = self.update_event_function(
                        event_id=matching_event['id'],
                        event_name=change['name'],
                        date=change['date'],
                        start_time=change['start_time'],
                        end_time=change['end_time']
                    )
                    
                    if success:
                        updated_events.append(matching_event['id'])
                except Exception as e:
                    print(f"Error updating event {matching_event['id']}: {e}")
                    continue
        
        return len(updated_events) > 0
    
    def call_llm_with_calendar(self, message: str, include_events: bool = True, prompt: str = None, **kwargs) -> Dict[str, Any]:
        """Call LLM with calendar context"""
        if include_events and self.events_function:
            events_data = self.fetch_calendar_events()
            calendar_context = self.format_events_for_context(events_data)
            
            if prompt is None:
                prompt = self.get_event_management_prompt()
            
            enhanced_message = f"""Context: {calendar_context}

User: {message}"""
            
            result = self.call_llm(enhanced_message, prompt=prompt, **kwargs)
            
            if result.get("success"):
                response_text = result.get("response", "")
                changes = self.parse_event_changes(response_text)
                cleaned_response = self.clean_response_text(response_text)
                
                result["response"] = cleaned_response
                result["event_changes"] = changes
                result["has_changes"] = len(changes) > 0
                
                if changes and self.update_event_function:
                    update_success = self.apply_event_changes(changes, events_data)
                    result["changes_applied"] = update_success
                    
                    if update_success:
                        result["updated_events"] = self.fetch_calendar_events()
                else:
                    result["changes_applied"] = False
                
                result["original_events"] = events_data
            
            return result
        else:
            return self.call_llm(message, prompt=prompt, **kwargs)
    
    def call_llm(self, message: str, prompt: str = None, max_retries: int = 3, **kwargs) -> Dict[str, Any]:
        """Call LLM API with retry logic - delegates to provider-specific implementation"""
        if not message or not message.strip():
            return {
                "success": False,
                "error": "Message cannot be empty",
                "error_type": "INVALID_INPUT"
            }
        
        return self._make_api_request(message, prompt, max_retries=max_retries, **kwargs)


class GeminiProvider(BaseLLMProvider):
    """Google Gemini API provider"""
    
    def __init__(self, api_key: str, model: str, events_function=None, update_event_function=None):
        super().__init__(api_key, model, events_function, update_event_function)
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
    
    def __init__(self, api_key: str, model: str, events_function=None, update_event_function=None):
        super().__init__(api_key, model, events_function, update_event_function)
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
                    provider = GeminiProvider(api_key, model)
                elif provider_name == 'openai':
                    provider = OpenAIProvider(api_key, model)
                else:
                    print(f"Unknown provider: {provider_name}")
                    continue
                
                self.providers[provider_name] = provider
                print(f"Successfully initialized {provider_name} provider with model: {model}")
                
            except Exception as e:
                print(f"Failed to initialize {provider_name} provider: {e}")
                continue
    
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
def setup_providers_with_calendar(events_function=None, update_event_function=None):
    """Setup all available providers with calendar functions"""
    enabled_providers = LLMConfig.get_enabled_providers()
    
    for provider_name in enabled_providers:
        try:
            api_key = LLMConfig.get_api_key(provider_name)
            model = LLMConfig.get_model(provider_name)
            
            if provider_name == 'gemini':
                provider = GeminiProvider(api_key, model, events_function, update_event_function)
            elif provider_name == 'openai':
                provider = OpenAIProvider(api_key, model, events_function, update_event_function)
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


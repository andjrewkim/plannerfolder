from django.apps import AppConfig
from django.conf import settings
from .views_llm_text import llm_service, GeminiProvider, update_calendar_event, get_calendar_events

class YourAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'myapp'  # Replace with your actual app name
    
    def ready(self):
        # Import here to avoid circular imports
        
        def get_calendar_events():
            """Function to fetch calendar events from your database"""
            # Replace 'CalendarEvent' with your actual model name
            from .models import CalendarEvent  # Import your actual event model
            return CalendarEvent.objects.all()  # Or whatever query you need
        
    if hasattr(settings, 'GEMINI_API_KEY'):
        llm_service.register_provider("gemini", GeminiProvider(
            api_key=settings.GEMINI_API_KEY,
            model=getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash'),
            events_function=get_calendar_events,        # THIS WAS MISSING
            update_event_function=update_calendar_event  # THIS WAS MISSING
        ))
        print("DEBUG: Registered Gemini provider with update function")
    else:
        print("ERROR: GEMINI_API_KEY not found in settings")
        
        # You can add other providers here when you implement them
        # if hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY:
        #     llm_service.register_provider("openai", OpenAIProvider(
        #         api_key=settings.OPENAI_API_KEY,
        #         model=getattr(settings, 'OPENAI_MODEL', 'gpt-3.5-turbo')
        #     ))
        
        providers = llm_service.list_providers()
        print(f"Available LLM providers: {providers}")
        
        if not providers:
            print("⚠️  WARNING: No LLM providers configured! Check your API keys in settings.py")
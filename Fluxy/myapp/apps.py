# myapp/apps.py

import os
from django.apps import AppConfig
from django.conf import settings
import posthog

class YourAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'myapp'  # Update if your app name is different

    def ready(self):
        posthog.api_key = 'phc_pAf2ERGqruJ2pmDOTZZFzADQ1nGxoHsSdm3Q9HI9MVi'
        posthog.host = 'https://us.i.posthog.com'
        posthog.capture("user_signed_up", properties={"example_property": "with_some_value"})

        from .views_llm_text import (
            llm_service,
            OpenAIProvider,
            GeminiProvider,
            update_calendar_event
        )

        def get_calendar_events():
            from .models import CalendarEvent
            return CalendarEvent.objects.all()

        # ✅ Register OpenAI provider
        if hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY:
            try:
                llm_service.register_provider("openai", OpenAIProvider(
                    api_key=settings.OPENAI_API_KEY,
                    model=getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini'),
                    events_function=get_calendar_events,
                    update_event_function=update_calendar_event
                ))
                print("✅ Registered OpenAI provider")
            except Exception as e:
                print(f"❌ Failed to register OpenAI provider: {e}")
        else:
            print("❌ OPENAI_API_KEY not found in settings")

        # ✅ Optionally register Gemini provider
        if hasattr(settings, 'GEMINI_API_KEY') and settings.GEMINI_API_KEY:
            try:
                llm_service.register_provider("gemini", GeminiProvider(
                    api_key=settings.GEMINI_API_KEY,
                    model=getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash'),
                    events_function=get_calendar_events,
                    update_event_function=update_calendar_event
                ))
                print("✅ Registered Gemini provider")
            except Exception as e:
                print(f"❌ Failed to register Gemini provider: {e}")
        else:
            print("⚠️ GEMINI_API_KEY not found in settings (Gemini will not be available)")

        # 🧪 Print all available providers
        providers = llm_service.list_providers()
        print(f"📦 Available LLM providers: {providers}")
        if not providers:
            print("⚠️  WARNING: No LLM providers configured! Check your API keys in settings.py")

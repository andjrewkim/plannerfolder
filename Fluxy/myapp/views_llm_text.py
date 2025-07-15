from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import requests
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    def call_llm(self, message: str, **kwargs) -> Dict[str, Any]:
        """Call the LLM API and return response"""
        pass


class OpenAIProvider(LLMProvider):
    """OpenAI API provider"""
    
    def __init__(self, api_key: str, model: str = "gpt-3.5-turbo"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.openai.com/v1/chat/completions"
    
    def call_llm(self, message: str, **kwargs) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": message}],
            "max_tokens": kwargs.get("max_tokens", 1000),
            "temperature": kwargs.get("temperature", 0.7)
        }
        
        try:
            response = requests.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return {
                "success": True,
                "response": data["choices"][0]["message"]["content"],
                "model": self.model
            }
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": str(e)
            }


class AnthropicProvider(LLMProvider):
    """Anthropic Claude API provider"""
    
    def __init__(self, api_key: str, model: str = "claude-3-sonnet-20240229"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.anthropic.com/v1/messages"
    
    def call_llm(self, message: str, **kwargs) -> Dict[str, Any]:
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
        
        payload = {
            "model": self.model,
            "max_tokens": kwargs.get("max_tokens", 1000),
            "messages": [{"role": "user", "content": message}]
        }
        
        try:
            response = requests.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return {
                "success": True,
                "response": data["content"][0]["text"],
                "model": self.model
            }
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": str(e)
            }


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


# Initialize LLM service (you would typically do this in settings or apps.py)
llm_service = LLMService()

# Register providers with API keys from settings
# llm_service.register_provider("openai", OpenAIProvider(api_key="your-openai-key"))
# llm_service.register_provider("anthropic", AnthropicProvider(api_key="your-anthropic-key"))


@csrf_exempt
@require_http_methods(["POST"])
def llm_text(request):
    """
    Django view for LLM chat functionality
    
    Expected POST data:
    {
        "message": "User input message",
        "provider": "openai" or "anthropic" (optional, defaults to first available),
        "max_tokens": 1000 (optional),
        "temperature": 0.7 (optional)
    }
    """
    try:
        # Parse request data
        data = json.loads(request.body)
        message = data.get("message", "").strip()
        provider_name = data.get("provider")
        
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
        
        # Call LLM
        result = provider.call_llm(message, **llm_kwargs)
        
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
        return JsonResponse({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }, status=500)
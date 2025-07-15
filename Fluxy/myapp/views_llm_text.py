from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import requests
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod
from django.conf import settings



class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    def call_llm(self, message: str, **kwargs) -> Dict[str, Any]:
        """Call the LLM API and return response"""
        pass



class GeminiProvider(LLMProvider):
    """Google Gemini API provider with prompt support"""
    
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    
    def call_llm(self, message: str, prompt: str = None, **kwargs) -> Dict[str, Any]:
        headers = {
            "Content-Type": "application/json"
        }
        
        # Gemini API configuration
        generation_config = {
            "maxOutputTokens": kwargs.get("max_tokens", 1000),
            "temperature": kwargs.get("temperature", 0.7),
            "topP": kwargs.get("top_p", 0.95),
            "topK": kwargs.get("top_k", 40)
        }
        
        # Prepare the contents array
        contents = []
        
        # Add system prompt as separate content entry if provided
        if prompt:
            contents.append({
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            })
        
        # Add user message as separate content entry
        contents.append({
            "parts": [
                {
                    "text": message
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




# Usage examples:
"""
# Basic usage with inline prompt
provider = GeminiProvider(api_key="your_api_key")
result = provider.call_llm(
    message="What is the capital of France?",
    prompt="You are a helpful geography assistant. Provide concise, accurate answers."
)

# Using the convenience method
result = provider.call_llm_with_system_prompt(
    message="What is the capital of France?",
    system_prompt="You are a helpful geography assistant. Provide concise, accurate answers."
)

# Using the system instruction approach (if supported by Gemini)
provider2 = GeminiProviderWithSystemInstruction(api_key="your_api_key")
result = provider2.call_llm(
    message="What is the capital of France?",
    prompt="You are a helpful geography assistant. Provide concise, accurate answers."
)
"""



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
    Django view for LLM chat functionality
    
    Expected POST data:
    {
        "message": "User input message",
        "provider": "openai", "anthropic", or "gemini" (optional, defaults to first available),
        "max_tokens": 1000 (optional),
        "temperature": 0.7 (optional),
        "top_p": 0.95 (optional, for Gemini),
        "top_k": 40 (optional, for Gemini)
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
        # Additional parameters for Gemini
        if "top_p" in data:
            llm_kwargs["top_p"] = data["top_p"]
        if "top_k" in data:
            llm_kwargs["top_k"] = data["top_k"]
        
        # Call LLM
        result = provider.call_llm(message, prompt="Your system prompt text here", **llm_kwargs)
        
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



# Example usage in settings.py or apps.py
"""
from django.conf import settings
from .views import llm_service, OpenAIProvider, AnthropicProvider, GeminiProvider

# Register providers with API keys from settings
if hasattr(settings, 'OPENAI_API_KEY'):
    llm_service.register_provider("openai", OpenAIProvider(
        api_key=settings.OPENAI_API_KEY,
        model=getattr(settings, 'OPENAI_MODEL', 'gpt-3.5-turbo')
    ))

if hasattr(settings, 'ANTHROPIC_API_KEY'):
    llm_service.register_provider("anthropic", AnthropicProvider(
        api_key=settings.ANTHROPIC_API_KEY,
        model=getattr(settings, 'ANTHROPIC_MODEL', 'claude-3-sonnet-20240229')
    ))

if hasattr(settings, 'GEMINI_API_KEY'):
    llm_service.register_provider("gemini", GeminiProvider(
        api_key=settings.GEMINI_API_KEY,
        model=getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash')
    ))
"""
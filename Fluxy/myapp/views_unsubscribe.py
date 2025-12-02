from django.shortcuts import render, redirect
from django.contrib.auth import get_user_model
from django.contrib import messages
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

User = get_user_model()

# Your existing view
@require_http_methods(["GET", "POST"])
def unsubscribe(request):
    """Handle email unsubscribe requests"""
    
    email = request.GET.get('email') or request.POST.get('email')
    
    if request.method == 'POST':
        if not email:
            messages.error(request, "No email address provided.")
            return redirect('unsubscribe')
        
        try:
            user = User.objects.get(email=email)
            user.email_notifications = False
            user.save()
            
            messages.success(request, "You've been unsubscribed from marketing emails.")
            return render(request, 'unsubscribe_success.html', {'email': email})
            
        except User.DoesNotExist:
            messages.error(request, "Email address not found.")
            return redirect('unsubscribe')
    
    return render(request, 'unsubscribe.html', {'email': email})


# ADD THIS FUNCTION
@csrf_exempt
@require_http_methods(["POST"])
def unsubscribe_api(request):
    """API endpoint for Next.js frontend"""
    try:
        data = json.loads(request.body)
        email = data.get('email')
        
        if not email:
            return JsonResponse({'error': 'No email provided'}, status=400)
        
        user = User.objects.get(email=email)
        user.email_notifications = False
        user.save()
        
        return JsonResponse({'success': True, 'message': 'Unsubscribed successfully'})
        
    except User.DoesNotExist:
        return JsonResponse({'error': 'Email not found'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
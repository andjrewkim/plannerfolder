from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model

User = get_user_model()

@api_view(['GET'])
@permission_classes([AllowAny])  # Keep AllowAny and do manual token checking
def check_login(request):
    # Debug: Log every request
    import time
    print(f"🔍 Check login called at {time.strftime('%H:%M:%S')} from {request.META.get('REMOTE_ADDR', 'unknown')}")
    # Extract token from authorization header
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    
    if not auth_header.startswith('Token '):
        return Response({
            'isAuthenticated': False,
            'user': None
        })
    
    token_key = auth_header[6:]  # Remove 'Token ' prefix
    
    # Check if token exists in database and get associated user
    try:
        token_obj = Token.objects.get(key=token_key)
        user = token_obj.user
        
        # Check if user is active
        if not user.is_active:
            return Response({
                'isAuthenticated': False,
                'user': None
            })
            
        return Response({
            'isAuthenticated': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
            }
        })
        
    except Token.DoesNotExist:
        return Response({
            'isAuthenticated': False,
            'user': None
        })
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes, authentication_classes

@csrf_exempt

@api_view(['POST'])
@permission_classes([AllowAny]) 
@authentication_classes([])  # disable any auth on login view

def login_user(request):
    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(username=username, password=password)
    if user is not None:
        # You can generate a token here or just send a success message
        # For simplicity, just sending a success response:
        return Response({
            'message': 'Login successful',
            'user': {
                'username': user.username,
                'email': user.email,
            },
            # 'token': 'your_token_here'  # If you add token auth
        }, status=200)
    else:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

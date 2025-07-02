# views_user.py
from django.contrib.auth import get_user_model
User = get_user_model()

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.views.decorators.csrf import csrf_exempt
import json

@api_view(['POST'])
@permission_classes([AllowAny])  # Allow unauthenticated users to register
def register_user(request):
    try:
        # Get data from request
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        
        # Validate required fields
        if not username or not email or not password:
            return Response({
                'error': 'Username, email, and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            return Response({
                'error': 'Username already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        if User.objects.filter(email=email).exists():
            return Response({
                'error': 'Email already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        # Create or get token for the user
        token, created = Token.objects.get_or_create(user=user)
        
        # Return success response with token and user data
        return Response({
            'message': 'User created successfully',
            'token': token.key,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': f'Registration failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    try:
        print(f"DEBUG: Login attempt - Session key: {request.session.session_key}")
        print(f"DEBUG: Current user authenticated: {request.user.is_authenticated}")
        print(f"DEBUG: Cookies: {request.COOKIES}")
        
        email = request.data.get('email')
        password = request.data.get('password')
        
        print(f"DEBUG: Email: {email}, Password provided: {bool(password)}")
        
        # Validate required fields
        if not email or not password:
            return Response({
                'error': 'Email and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find user by email first
        try:
            user = User.objects.get(email=email)
            print(f"DEBUG: User found - ID: {user.id}, Active: {user.is_active}")
        except User.DoesNotExist:
            print(f"DEBUG: User not found for email: {email}")
            return Response({
                'error': 'Invalid email or password'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check if the password is correct
        if not user.check_password(password):
            print(f"DEBUG: Password check failed for user: {email}")
            return Response({
                'error': 'Invalid email or password'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check if user is active
        if not user.is_active:
            return Response({
                'error': 'Account is deactivated'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # DELETE OLD TOKENS AND CREATE NEW ONE
        Token.objects.filter(user=user).delete()  # Delete any existing tokens
        token = Token.objects.create(user=user)   # Create a fresh token
        
        print(f"DEBUG: New token created: {token.key}")
        
        print(f"DEBUG: Login successful - User ID: {user.id}")
        print(f"DEBUG: Session after login: {request.session.session_key}")
        
        return Response({
            'message': 'Login successful',
            'token': token.key,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"DEBUG: Exception in login: {str(e)}")
        return Response({
            'error': f'Login failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
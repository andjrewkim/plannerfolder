# views_user.py
from django.contrib.auth import get_user_model, login as django_login
User = get_user_model()

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from google.oauth2 import id_token
from google.auth.transport import requests
import json
import logging

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
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
        
        # Create Django session for persistent login
        django_login(request, user)
        request.session.set_expiry(31536000)  # 1 year
        
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
                'has_seen_onboarding': user.has_seen_onboarding,  # ADD THIS
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
        
        # Create Django session for persistent login
        django_login(request, user)
        request.session.set_expiry(31536000)  # 1 year - never expires
        
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
                'has_seen_onboarding': user.has_seen_onboarding,  # ADD THIS
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"DEBUG: Exception in login: {str(e)}")
        return Response({
            'error': f'Login failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth(request):
    """
    Handle Google OAuth authentication - integrated with existing token system
    """
    try:
        credential = request.data.get('credential')
        
        if not credential:
            return Response({
                'error': 'No Google credential provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify the token with Google
        try:
            idinfo = id_token.verify_oauth2_token(
                credential, 
                requests.Request(), 
                settings.GOOGLE_OAUTH_CLIENT_ID
            )
        except ValueError as e:
            logger.error(f"Google token verification failed: {e}")
            return Response({
                'error': 'Invalid Google token'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract user information from Google
        email = idinfo.get('email')
        first_name = idinfo.get('given_name', '')
        last_name = idinfo.get('family_name', '')
        google_id = idinfo.get('sub')
        
        if not email:
            return Response({
                'error': 'No email provided by Google'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create user (same logic as your existing system)
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,  # Use email as username like your system
                'first_name': first_name,
                'last_name': last_name,
                'is_active': True,
            }
        )
        
        # Update user info if they already exist but info has changed
        if not created:
            updated = False
            if user.first_name != first_name:
                user.first_name = first_name
                updated = True
            if user.last_name != last_name:
                user.last_name = last_name
                updated = True
            if updated:
                user.save()
        
        # Create Django session for persistent login
        django_login(request, user)
        request.session.set_expiry(31536000)  # 1 year - never expires
        
        # Use the SAME token system as your existing login
        Token.objects.filter(user=user).delete()  # Delete any existing tokens
        token = Token.objects.create(user=user)   # Create a fresh token
        
        print(f"DEBUG: Google auth successful - User ID: {user.id}")
        print(f"DEBUG: New token created: {token.key}")
        
        # Return response in SAME format as your existing login
        return Response({
            'message': f'Google {"registration" if created else "login"} successful',
            'token': token.key,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'has_seen_onboarding': user.has_seen_onboarding,  # ADD THIS
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        return Response({
            'error': f'Google authentication failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# NEW ENDPOINT: Mark onboarding as seen
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_onboarding_seen(request):
    """
    Mark that the user has seen the onboarding
    """
    try:
        user = request.user
        user.has_seen_onboarding = True
        user.save(update_fields=['has_seen_onboarding'])
        
        print(f"DEBUG: Onboarding marked as seen for user {user.id}")
        
        return Response({
            'success': True,
            'message': 'Onboarding status updated'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error marking onboarding as seen: {e}")
        return Response({
            'error': f'Failed to update onboarding status: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
# views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

@api_view(['POST'])
@permission_classes([IsAuthenticated])  # ← ADD THIS to override the global setting
def logout_view(request):
    try:
        print(f"=== BEFORE LOGOUT ===")
        print(f"User: {request.user}")
        print(f"Is authenticated: {request.user.is_authenticated}")
        print(f"Session key BEFORE: {request.session.session_key}")
        print(f"Session data BEFORE: {dict(request.session)}")
        
        if request.user.is_authenticated:
            # Clear token if exists
            if hasattr(request.user, 'auth_token'):
                request.user.auth_token.delete()
                print("Token deleted")
            
            # Clear session
            from django.contrib.auth import logout
            logout(request)
            print("logout() called")
            
            print(f"=== AFTER LOGOUT ===")
            print(f"User AFTER: {request.user}")
            print(f"Is authenticated AFTER: {request.user.is_authenticated}")
            print(f"Session key AFTER: {request.session.session_key}")
        
        return Response({"message": "Logged out successfully"}, status=200)
    except Exception as e:
        print(f"Logout error: {e}")
        return Response({"message": "Logged out successfully"}, status=200)
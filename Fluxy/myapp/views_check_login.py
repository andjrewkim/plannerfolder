from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
@api_view(['GET'])
@permission_classes([AllowAny])  # ← ADD THIS
def check_login(request):
    print(f"=== CHECK LOGIN DEBUG ===")
    print(f"Request user: {request.user}")
    print(f"Is authenticated: {request.user.is_authenticated}")
    print(f"Auth header: {request.META.get('HTTP_AUTHORIZATION', 'No auth header')}")
    print(f"Session key: {request.session.session_key}")
    print(f"Session data: {dict(request.session)}")
    print(f"Cookies: {list(request.COOKIES.keys())}")
    
    return Response({
        "isAuthenticated": request.user.is_authenticated,
        "user": request.user.username if request.user.is_authenticated else None
    })
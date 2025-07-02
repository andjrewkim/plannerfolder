from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])  # Temporarily change this
def check_login(request):
    print("=== DETAILED CHECK LOGIN DEBUG ===")
    print(f"Request method: {request.method}")
    print(f"User agent: {request.META.get('HTTP_USER_AGENT', 'No user agent')}")
    print(f"Referer: {request.META.get('HTTP_REFERER', 'No referer')}")
    print(f"Request path: {request.path}")
    print(f"Query params: {request.GET}")
    print(f"Is AJAX: {request.headers.get('X-Requested-With') == 'XMLHttpRequest'}")
    print(f"Accept header: {request.META.get('HTTP_ACCEPT', 'No accept header')}")
    print(f"Auth header: {request.META.get('HTTP_AUTHORIZATION', 'No auth header')}")
    
    # Check if it's a browser navigation vs fetch
    accept_header = request.META.get('HTTP_ACCEPT', '')
    if 'text/html' in accept_header:
        print("🚨 THIS IS A BROWSER NAVIGATION REQUEST!")
    elif 'application/json' in accept_header:
        print("✅ This is a proper API request")
    
    return Response({
        'isAuthenticated': request.user.is_authenticated,
        'user': None
    })
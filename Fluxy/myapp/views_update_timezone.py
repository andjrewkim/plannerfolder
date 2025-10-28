# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from zoneinfo import ZoneInfo

class UpdateTimezoneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tz = request.data.get('timezone')
        if not tz:
            return Response({'error': 'No timezone provided.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Validate timezone string
            ZoneInfo(tz)
        except Exception:
            return Response({'error': 'Invalid timezone.'}, status=status.HTTP_400_BAD_REQUEST)

        # Save to the user
        user = request.user
        user.timezone = tz
        user.save(update_fields=['timezone'])

        return Response({'status': 'success', 'timezone': tz}, status=status.HTTP_200_OK)

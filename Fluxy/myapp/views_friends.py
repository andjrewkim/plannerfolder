from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.core.exceptions import ObjectDoesNotExist
from .models import CustomUser, FriendRequest
from .serializers import (
    SendFriendRequestSerializer,
    FriendRequestSerializer,
    UserProfileSerializer,
    PendingFriendRequestsSerializer,
    UserBasicSerializer
)


class SendFriendRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SendFriendRequestSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if serializer.is_valid():
            friend_request = serializer.save()
            return Response({
                "success": "Friend request sent",
                "friend_request": FriendRequestSerializer(friend_request).data
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AcceptFriendRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, request_id):
        try:
            friend_request = FriendRequest.objects.get(
                id=request_id, 
                receiver=request.user, 
                accepted=False
            )
        except ObjectDoesNotExist:
            return Response(
                {"error": "Friend request not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        friend_request.accept()
        return Response({
            "success": "Friend request accepted",
            "friend": UserBasicSerializer(friend_request.sender).data
        }, status=status.HTTP_200_OK)


class DeclineFriendRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, request_id):
        try:
            friend_request = FriendRequest.objects.get(
                id=request_id, 
                receiver=request.user, 
                accepted=False
            )
        except ObjectDoesNotExist:
            return Response(
                {"error": "Friend request not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        friend_request.decline()
        return Response(
            {"success": "Friend request declined"}, 
            status=status.HTTP_200_OK
        )


class PendingFriendRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        received_requests = FriendRequest.objects.filter(
            receiver=request.user, 
            accepted=False
        ).select_related('sender')
        
        sent_requests = FriendRequest.objects.filter(
            sender=request.user, 
            accepted=False
        ).select_related('receiver')
        
        data = {
            'received': FriendRequestSerializer(received_requests, many=True).data,
            'sent': FriendRequestSerializer(sent_requests, many=True).data
        }
        
        return Response(data, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    """Fetch a single user profile with stats - TIMEZONE SAFE"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        try:
            user = CustomUser.objects.prefetch_related('friends').get(id=user_id)
        except ObjectDoesNotExist:
            return Response(
                {"error": "User not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # CRITICAL FIX: Pass request context to serializer for timezone handling
        serializer = UserProfileSerializer(user, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class BatchUserProfileView(APIView):
    """Fetch multiple user profiles in a single request - TIMEZONE SAFE"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_ids_param = request.query_params.get('user_ids', '')
        
        if not user_ids_param:
            return Response(
                {"error": "user_ids parameter is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Parse comma-separated user IDs
            user_ids = [int(uid.strip()) for uid in user_ids_param.split(',') if uid.strip()]
        except ValueError:
            return Response(
                {"error": "Invalid user_ids format. Expected comma-separated integers."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not user_ids:
            return Response([], status=status.HTTP_200_OK)
        
        # Limit to prevent abuse
        if len(user_ids) > 100:
            return Response(
                {"error": "Maximum 100 user IDs allowed per request"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Fetch users efficiently with prefetch
        users = CustomUser.objects.filter(id__in=user_ids).prefetch_related('friends')
        
        # CRITICAL FIX: Pass request context to serializer for timezone handling
        # This ensures all friend profiles are calculated using the requesting user's timezone
        serializer = UserProfileSerializer(users, many=True, context={'request': request})
        
        return Response(serializer.data, status=status.HTTP_200_OK)


class MyFriendsView(APIView):
    """List all friends of the authenticated user"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        friends = request.user.friends.all()
        serializer = UserBasicSerializer(friends, many=True)
        return Response({
            "count": friends.count(),
            "friends": serializer.data
        }, status=status.HTTP_200_OK)


class RemoveFriendView(APIView):
    """Remove a friend from the authenticated user's friend list"""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, friend_id):
        try:
            friend = CustomUser.objects.get(id=friend_id)
        except ObjectDoesNotExist:
            return Response(
                {"error": "User not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if they are actually friends
        if friend not in request.user.friends.all():
            return Response(
                {"error": "This user is not in your friends list"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Remove from both sides (symmetrical relationship)
        request.user.friends.remove(friend)
        
        return Response(
            {"success": f"Removed {friend.username} from friends"}, 
            status=status.HTTP_200_OK
        )
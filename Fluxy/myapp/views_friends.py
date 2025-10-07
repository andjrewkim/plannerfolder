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
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        try:
            user = CustomUser.objects.prefetch_related('friends').get(id=user_id)
        except ObjectDoesNotExist:
            return Response(
                {"error": "User not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = UserProfileSerializer(user)
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
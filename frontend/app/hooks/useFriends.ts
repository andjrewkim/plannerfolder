import { useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../../lib/auth';

export interface Friend {
  id: number;
  username: string;
  email: string;
}

export interface FriendRequest {
  id: number;
  sender: {
    id: number;
    username: string;
    email: string;
  };
  receiver: {
    id: number;
    username: string;
    email: string;
  };
  accepted: boolean;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  created_at: string;
  today_completion_percentage: number;
  overall_completion_percentage: number;
  total_assignments_today: number;
  completed_assignments_today: number;
  total_assignments_overall: number;
  completed_assignments_overall: number;
  friends: Friend[];
}

interface PendingRequestsResponse {
  received: FriendRequest[];
  sent: FriendRequest[];
}

interface MyFriendsResponse {
  count: number;
  friends: Friend[];
}

interface UseFriendsReturn {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchFriends: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  sendFriendRequest: (email: string) => Promise<boolean>;
  acceptFriendRequest: (requestId: number) => Promise<boolean>;
  declineFriendRequest: (requestId: number) => Promise<boolean>;
  removeFriend: (friendId: number) => Promise<boolean>;
  getUserProfile: (userId: number) => Promise<UserProfile | null>;
  
  // Utility
  clearError: () => void;
}

export const useFriends = (): UseFriendsReturn => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for preventing multiple fetches
  const hasInitializedRef = useRef(false);
  const fetchInProgressRef = useRef(false);

  const clearError = () => setError(null);

  const handleError = (err: any, defaultMessage: string) => {
    console.error(defaultMessage, err);
    const errorMessage = err?.response?.data?.error || err?.message || defaultMessage;
    setError(errorMessage);
  };

  // Fetch friends list
  const fetchFriends = useCallback(async () => {
    if (fetchInProgressRef.current) {
      console.log('Fetch already in progress, skipping...');
      return;
    }

    try {
      fetchInProgressRef.current = true;
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/list/`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch friends: ${response.status}`);
      }

      const data: MyFriendsResponse = await response.json();
      setFriends(data.friends);
    } catch (err) {
      handleError(err, 'Failed to fetch friends');
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, []);

  // Fetch pending friend requests (both received and sent)
  const fetchPendingRequests = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/pending/`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch pending requests: ${response.status}`);
      }

      const data: PendingRequestsResponse = await response.json();
      setPendingRequests(data.received);
      setSentRequests(data.sent);
    } catch (err) {
      handleError(err, 'Failed to fetch pending requests');
    } finally {
      setLoading(false);
    }
  }, []);

  // Send friend request by email
  const sendFriendRequest = useCallback(async (email: string): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/send/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.email?.[0] || `Failed to send friend request: ${response.status}`);
      }

      // Refresh pending requests after sending
      await fetchPendingRequests();
      return true;
    } catch (err) {
      handleError(err, 'Failed to send friend request');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchPendingRequests]);

  // Accept friend request
  const acceptFriendRequest = useCallback(async (requestId: number): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/accept/${requestId}/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to accept friend request: ${response.status}`);
      }

      // Refresh both friends list and pending requests
      await Promise.all([
        fetchFriends(),
        fetchPendingRequests(),
      ]);
      
      return true;
    } catch (err) {
      handleError(err, 'Failed to accept friend request');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchFriends, fetchPendingRequests]);

  // Decline friend request
  const declineFriendRequest = useCallback(async (requestId: number): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/decline/${requestId}/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to decline friend request: ${response.status}`);
      }

      // Refresh pending requests after declining
      await fetchPendingRequests();
      return true;
    } catch (err) {
      handleError(err, 'Failed to decline friend request');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchPendingRequests]);

  // Remove friend
  const removeFriend = useCallback(async (friendId: number): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/remove/${friendId}/`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove friend: ${response.status}`);
      }

      // Optimistically update the friends list
      setFriends(prev => prev.filter(friend => friend.id !== friendId));
      
      return true;
    } catch (err) {
      handleError(err, 'Failed to remove friend');
      // Refetch to restore correct state on error
      await fetchFriends();
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchFriends]);

  // Get user profile with stats
  const getUserProfile = useCallback(async (userId: number): Promise<UserProfile | null> => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/profile/${userId}/`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.status}`);
      }

      const data: UserProfile = await response.json();
      return data;
    } catch (err) {
      handleError(err, 'Failed to fetch user profile');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch friends on mount
  useEffect(() => {
    if (!hasInitializedRef.current && !fetchInProgressRef.current) {
      hasInitializedRef.current = true;
      fetchFriends();
      fetchPendingRequests();
    }
  }, [fetchFriends, fetchPendingRequests]);

  return {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    error,
    
    // Actions
    fetchFriends,
    fetchPendingRequests,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    getUserProfile,
    
    // Utility
    clearError,
  };
};
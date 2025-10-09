import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  friendProfiles: Map<number, UserProfile>;
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  loading: boolean;
  error: string | null;
  
  fetchFriends: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  fetchAllFriendProfiles: () => Promise<void>;
  refreshFriendProfiles: () => Promise<void>;
  sendFriendRequest: (email: string) => Promise<boolean>;
  acceptFriendRequest: (requestId: number) => Promise<boolean>;
  declineFriendRequest: (requestId: number) => Promise<boolean>;
  removeFriend: (friendId: number) => Promise<boolean>;
  getUserProfile: (userId: number) => Promise<UserProfile | null>;
  clearError: () => void;
}

const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return 'UTC';
  }
};

const getTimezoneHeaders = (): Record<string, string> => {
  return {
    'X-User-Timezone': getUserTimezone(),
  };
};

export const useFriends = (autoRefreshInterval: number = 30000): UseFriendsReturn => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Map<number, UserProfile>>(new Map());
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasInitializedRef = useRef(false);
  const fetchInProgressRef = useRef(false);
  const profileFetchInProgressRef = useRef(false);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFriendIdsRef = useRef<string>('');

  const clearError = () => setError(null);

  const handleError = (err: any, defaultMessage: string) => {
    const errorMessage = err?.response?.data?.error || err?.message || defaultMessage;
    setError(errorMessage);
  };

  const fetchFriends = useCallback(async () => {
    if (fetchInProgressRef.current) return;

    try {
      fetchInProgressRef.current = true;
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/list/`,
        { 
          method: 'GET',
          headers: getTimezoneHeaders(),
        }
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

  const fetchAllFriendProfiles = useCallback(async () => {
    if (profileFetchInProgressRef.current || friends.length === 0) return;

    try {
      profileFetchInProgressRef.current = true;
      setLoading(true);
      clearError();
      
      const userIds = friends.map(f => f.id).join(',');
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/profiles/batch/?user_ids=${userIds}`,
        { 
          method: 'GET',
          headers: getTimezoneHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch friend profiles: ${response.status}`);
      }

      const profiles: UserProfile[] = await response.json();
      
      const profileMap = new Map<number, UserProfile>();
      profiles.forEach(profile => {
        profileMap.set(profile.id, profile);
      });
      
      setFriendProfiles(profileMap);
    } catch (err) {
      handleError(err, 'Failed to fetch friend profiles');
    } finally {
      setLoading(false);
      profileFetchInProgressRef.current = false;
    }
  }, [friends]);

  const refreshFriendProfiles = useCallback(async () => {
    if (friends.length === 0 || profileFetchInProgressRef.current) return;

    try {
      profileFetchInProgressRef.current = true;
      
      const userIds = friends.map(f => f.id).join(',');
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/profiles/batch/?user_ids=${userIds}`,
        { 
          method: 'GET',
          headers: getTimezoneHeaders(),
        }
      );

      if (!response.ok) return;

      const profiles: UserProfile[] = await response.json();
      const profileMap = new Map<number, UserProfile>();
      profiles.forEach(profile => {
        profileMap.set(profile.id, profile);
      });
      
      setFriendProfiles(profileMap);
    } catch (err) {
      // Silent fail for background refresh
    } finally {
      profileFetchInProgressRef.current = false;
    }
  }, [friends]);

  const fetchPendingRequests = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/pending/`,
        { 
          method: 'GET',
          headers: getTimezoneHeaders(),
        }
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

  const sendFriendRequest = useCallback(async (email: string): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/send/`,
        {
          method: 'POST',
          headers: {
            ...getTimezoneHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.email?.[0] || `Failed to send friend request: ${response.status}`);
      }

      await fetchPendingRequests();
      return true;
    } catch (err) {
      handleError(err, 'Failed to send friend request');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchPendingRequests]);

  const acceptFriendRequest = useCallback(async (requestId: number): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/accept/${requestId}/`,
        {
          method: 'POST',
          headers: {
            ...getTimezoneHeaders(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to accept friend request: ${response.status}`);
      }

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

  const declineFriendRequest = useCallback(async (requestId: number): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/decline/${requestId}/`,
        {
          method: 'POST',
          headers: {
            ...getTimezoneHeaders(),
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to decline friend request: ${response.status}`);
      }

      await fetchPendingRequests();
      return true;
    } catch (err) {
      handleError(err, 'Failed to decline friend request');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchPendingRequests]);

  const removeFriend = useCallback(async (friendId: number): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/friends/remove/${friendId}/`,
        {
          method: 'DELETE',
          headers: getTimezoneHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove friend: ${response.status}`);
      }

      setFriends(prev => prev.filter(friend => friend.id !== friendId));
      setFriendProfiles(prev => {
        const newMap = new Map(prev);
        newMap.delete(friendId);
        return newMap;
      });
      
      return true;
    } catch (err) {
      handleError(err, 'Failed to remove friend');
      await fetchFriends();
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchFriends]);

  const getUserProfile = useCallback(async (userId: number): Promise<UserProfile | null> => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/profile/${userId}/`,
        { 
          method: 'GET',
          headers: getTimezoneHeaders(),
        }
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

  const friendIds = useMemo(() => 
    friends.map(f => f.id).sort().join(','),
    [friends]
  );

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchFriends();
      fetchPendingRequests();
    }
  }, [fetchFriends, fetchPendingRequests]);

  useEffect(() => {
    if (friendIds && friendIds !== lastFriendIdsRef.current) {
      lastFriendIdsRef.current = friendIds;
      if (friends.length > 0) {
        fetchAllFriendProfiles();
      } else {
        setFriendProfiles(new Map());
      }
    }
  }, [friendIds, friends.length, fetchAllFriendProfiles]);

  useEffect(() => {
    if (autoRefreshInterval > 0 && friends.length > 0) {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }

      autoRefreshTimerRef.current = setInterval(() => {
        refreshFriendProfiles();
      }, autoRefreshInterval);

      return () => {
        if (autoRefreshTimerRef.current) {
          clearInterval(autoRefreshTimerRef.current);
          autoRefreshTimerRef.current = null;
        }
      };
    }
  }, [autoRefreshInterval, friends.length, refreshFriendProfiles]);

  return {
    friends,
    friendProfiles,
    pendingRequests,
    sentRequests,
    loading,
    error,
    
    fetchFriends,
    fetchPendingRequests,
    fetchAllFriendProfiles,
    refreshFriendProfiles,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    getUserProfile,
    
    clearError,
  };
};
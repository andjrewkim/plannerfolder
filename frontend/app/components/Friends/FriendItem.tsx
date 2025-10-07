import React, { useState } from 'react';
import { useFriends, Friend, FriendRequest, UserProfile } from '../../hooks/useFriends';

interface FriendItemProps {
  friend: Friend;
  onRemove: (friendId: number) => void;
  onViewProfile: (userId: number) => void;
}

const FriendItem: React.FC<FriendItemProps> = ({ friend, onRemove, onViewProfile }) => {
  const [showRemove, setShowRemove] = useState(false);

  return (
    <div
      style={{
        padding: '8px 10px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        border: '1px solid #e5e7eb',
        transition: 'all 0.15s',
        cursor: 'pointer',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#e5e7eb';
        setShowRemove(true);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#f3f4f6';
        setShowRemove(false);
      }}
      onClick={() => onViewProfile(friend.id)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ 
          flex: 1, 
          minWidth: 0,
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#1f2937',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '2px'
          }}>
            {friend.username}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#6b7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {friend.email}
          </div>
        </div>

        {showRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Remove ${friend.username} from friends?`)) {
                onRemove(friend.id);
              }
            }}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontWeight: '500',
              flexShrink: 0
            }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
};

interface FriendRequestItemProps {
  request: FriendRequest;
  onAccept: (requestId: number) => void;
  onDecline: (requestId: number) => void;
}

const FriendRequestItem: React.FC<FriendRequestItemProps> = ({ request, onAccept, onDecline }) => {
  return (
    <div style={{
      padding: '8px',
      backgroundColor: '#fef3c7',
      borderRadius: '4px',
      border: '1px solid #fbbf24',
      marginBottom: '6px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: '#1f2937',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {request.sender.username}
          </span>
          <span style={{ 
            fontSize: '11px', 
            color: '#6b7280',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {request.sender.email}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={() => onAccept(request.id)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Accept
          </button>
          <button
            onClick={() => onDecline(request.id)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

interface ProfileModalProps {
  profile: UserProfile | null;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ profile, onClose }) => {
  if (!profile) return null;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return '#10b981';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
            {profile.username}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0 4px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#6b7280' }}>
            {profile.email}
          </p>
        </div>

        {/* Today's Stats */}
        <div style={{
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          marginBottom: '12px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
            Today's Progress
          </h3>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                {profile.completed_assignments_today} / {profile.total_assignments_today} completed
              </span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: getProgressColor(profile.today_completion_percentage) }}>
                {profile.today_completion_percentage}%
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div
                style={{
                  width: `${profile.today_completion_percentage}%`,
                  height: '100%',
                  backgroundColor: getProgressColor(profile.today_completion_percentage),
                  transition: 'width 0.3s ease',
                  borderRadius: '4px'
                }}
              />
            </div>
          </div>
        </div>

        {/* Overall Stats */}
        <div style={{
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          marginBottom: '12px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
            Overall Progress
          </h3>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                {profile.completed_assignments_overall} / {profile.total_assignments_overall} completed
              </span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: getProgressColor(profile.overall_completion_percentage) }}>
                {profile.overall_completion_percentage}%
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div
                style={{
                  width: `${profile.overall_completion_percentage}%`,
                  height: '100%',
                  backgroundColor: getProgressColor(profile.overall_completion_percentage),
                  transition: 'width 0.3s ease',
                  borderRadius: '4px'
                }}
              />
            </div>
          </div>
        </div>

        {/* Friends Count */}
        <div style={{
          padding: '12px',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            <strong>{profile.friends.length}</strong> friends
          </span>
        </div>
      </div>
    </div>
  );
};

const FriendList: React.FC = () => {
  const {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    error,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    getUserProfile,
    clearError,
  } = useFriends();

  const [newFriendEmail, setNewFriendEmail] = useState('');
  const [showSentRequests, setShowSentRequests] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const handleSendRequest = async () => {
    if (!newFriendEmail || !newFriendEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    const success = await sendFriendRequest(newFriendEmail);
    if (success) {
      setNewFriendEmail('');
      alert('Friend request sent successfully!');
    }
  };

  const handleAccept = async (requestId: number) => {
    const success = await acceptFriendRequest(requestId);
    if (success) {
      alert('Friend request accepted!');
    }
  };

  const handleDecline = async (requestId: number) => {
    const success = await declineFriendRequest(requestId);
    if (success) {
      alert('Friend request declined.');
    }
  };

  const handleViewProfile = async (userId: number) => {
    setProfileLoading(true);
    const profile = await getUserProfile(userId);
    setProfileLoading(false);
    if (profile) {
      setSelectedProfile(profile);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '600px', 
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h2 style={{ marginBottom: '16px', fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
        Friends
      </h2>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              color: '#991b1b',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: 'bold',
              padding: '0 4px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Add Friend Section */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#1f2937' }}>
          Add Friend
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="email"
            value={newFriendEmail}
            onChange={(e) => setNewFriendEmail(e.target.value)}
            placeholder="Enter friend's email"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px'
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendRequest();
              }
            }}
          />
          <button
            onClick={handleSendRequest}
            disabled={loading || !newFriendEmail}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || !newFriendEmail ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: loading || !newFriendEmail ? 0.5 : 1
            }}
          >
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </div>

      {/* Sent Requests Toggle */}
      {sentRequests.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setShowSentRequests(!showSentRequests)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#e5e7eb',
              color: '#1f2937',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>Sent Requests ({sentRequests.length})</span>
            <span>{showSentRequests ? '▼' : '▶'}</span>
          </button>
          {showSentRequests && (
            <div style={{ marginTop: '8px' }}>
              {sentRequests.map((request) => (
                <div key={request.id} style={{
                  padding: '8px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  marginBottom: '4px',
                  fontSize: '13px',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontWeight: '500', color: '#1f2937' }}>
                    {request.receiver.username}
                  </div>
                  <div style={{ fontSize: '11px' }}>
                    {request.receiver.email}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#1f2937' }}>
            Pending Requests ({pendingRequests.length})
          </h3>
          {pendingRequests.map((request) => (
            <FriendRequestItem
              key={request.id}
              request={request}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))}
        </div>
      )}

      {/* Friends List */}
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#1f2937' }}>
        My Friends ({friends.length})
      </h3>
      
      {loading && friends.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px', 
          color: '#6b7280',
          fontSize: '14px'
        }}>
          Loading friends...
        </div>
      ) : friends.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px', 
          color: '#6b7280',
          backgroundColor: '#f9fafb',
          borderRadius: '4px',
          border: '1px dashed #d1d5db'
        }}>
          <p style={{ margin: 0, fontSize: '14px' }}>No friends yet.</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Send a friend request to get started!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {friends.map((friend) => (
            <FriendItem
              key={friend.id}
              friend={friend}
              onRemove={removeFriend}
              onViewProfile={handleViewProfile}
            />
          ))}
        </div>
      )}

      {/* Profile Modal */}
      {selectedProfile && (
        <ProfileModal
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}

      {profileLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            Loading profile...
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendList;
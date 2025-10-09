import React, { useState, useMemo, memo } from 'react';
import { useFriends, Friend, FriendRequest, UserProfile } from '../../hooks/useFriends';

interface FriendItemProps {
  friend: Friend;
  profile: UserProfile | undefined;
  onRemove: (friendId: number) => void;
}

const interpolateColor = (color1: string, color2: string, t: number): string => {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);
  
  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;
  
  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;
  
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

const FriendItem = memo<FriendItemProps>(({ friend, profile, onRemove }) => {
  const [isHovered, setIsHovered] = useState(false);

  const displayName = (friend as any).name || friend.username;

  const completionData = useMemo(() => {
    if (!profile) {
      return { percentage: 0, color: '#ef4444', completed: 0, total: 0 };
    }
    
    let percentage = profile.today_completion_percentage;
    
    if (percentage === undefined || percentage === null) {
      percentage = profile.total_assignments_today > 0 
        ? (profile.completed_assignments_today / profile.total_assignments_today) * 100 
        : 0;
    }
    
    let color: string;
    if (percentage === 100) {
      color = '#22c55e';
    } else if (percentage >= 75) {
      const t = (percentage - 75) / 25;
      color = interpolateColor('#84cc16', '#22c55e', t);
    } else if (percentage >= 50) {
      const t = (percentage - 50) / 25;
      color = interpolateColor('#eab308', '#84cc16', t);
    } else if (percentage >= 25) {
      const t = (percentage - 25) / 25;
      color = interpolateColor('#f59e0b', '#eab308', t);
    } else {
      const t = percentage / 25;
      color = interpolateColor('#ef4444', '#f59e0b', t);
    }
    
    return { 
      percentage, 
      color,
      completed: profile.completed_assignments_today,
      total: profile.total_assignments_today
    };
  }, [profile]);

  const { percentage, color, completed, total } = completionData;
  const loadingProfile = !profile;

  return (
    <div
      className="friend-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        borderBottom: '1px solid hsl(var(--border) / 0.2)',
        transition: 'background-color 0.15s ease',
        background: 'transparent',
        position: 'relative',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Remove ${displayName}?`)) {
              onRemove(friend.id);
            }
          }}
          className="remove-button"
          style={{
            position: 'absolute',
            top: '8px',
            right: '10px',
            width: '20px',
            height: '20px',
            border: 'none',
            background: 'hsl(var(--destructive) / 0.1)',
            color: 'hsl(var(--destructive))',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            fontSize: '14px',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          ×
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, hsl(var(--accent) / 0.6) 0%, hsl(var(--primary) / 0.6) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '600',
          fontSize: '14px',
          flexShrink: 0,
        }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '500',
            color: 'hsl(var(--foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayName}
          </div>
          
          {profile && !loadingProfile && (
            <div style={{ marginTop: '4px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <div style={{
                  flex: 1,
                  height: '4px',
                  backgroundColor: 'hsl(var(--muted) / 0.3)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${percentage}%`,
                    backgroundColor: color,
                    borderRadius: '2px',
                    transition: 'width 0.3s ease, background-color 0.3s ease',
                  }} />
                </div>
                <span style={{
                  fontSize: '11px',
                  color: 'hsl(var(--muted-foreground))',
                  fontWeight: '500',
                  minWidth: '45px',
                  textAlign: 'right',
                }}>
                  {completed}/{total}
                </span>
              </div>
            </div>
          )}
          
          {loadingProfile && (
            <div style={{
              marginTop: '4px',
              height: '4px',
              backgroundColor: 'hsl(var(--muted) / 0.3)',
              borderRadius: '2px',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: '30%',
                backgroundColor: 'hsl(var(--muted-foreground) / 0.5)',
                borderRadius: '2px',
                animation: 'loading 1.5s ease-in-out infinite',
              }} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { left: -30%; }
          100% { left: 100%; }
        }
        
        .friend-item:hover {
          background-color: hsl(var(--accent) / 0.1);
        }
        
        .remove-button:hover {
          background: hsl(var(--destructive)) !important;
          color: white !important;
        }
      `}</style>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.friend.id === nextProps.friend.id &&
    prevProps.friend.username === nextProps.friend.username &&
    prevProps.profile?.completed_assignments_today === nextProps.profile?.completed_assignments_today &&
    prevProps.profile?.total_assignments_today === nextProps.profile?.total_assignments_today &&
    prevProps.profile?.today_completion_percentage === nextProps.profile?.today_completion_percentage
  );
});

FriendItem.displayName = 'FriendItem';

interface FriendRequestItemProps {
  request: FriendRequest;
  onAccept: (requestId: number) => void;
  onDecline: (requestId: number) => void;
}

const FriendRequestItem = memo<FriendRequestItemProps>(({ request, onAccept, onDecline }) => {
  const displayName = (request.sender as any).name || request.sender.username;
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px',
      margin: '4px 0',
      borderRadius: '6px',
      background: 'linear-gradient(135deg, hsl(var(--primary) / 0.05) 0%, hsl(var(--accent) / 0.05) 100%)',
      border: '1px solid hsl(var(--primary) / 0.1)',
    }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.6) 0%, hsl(var(--accent) / 0.6) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '600',
          fontSize: '13px',
          flexShrink: 0,
        }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: 'hsl(var(--foreground))',
          fontWeight: '500',
          fontSize: '14px',
        }}>
          {displayName}
        </span>
      </div>
      
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={() => onAccept(request.id)}
          className="accept-button"
          style={{
            padding: '1px 8px',
            fontSize: '12px !important',
            fontWeight: '600',
            background: 'linear-gradient(135deg, hsl(var(--accent)/0.5) 0%, hsl(var(--primary)/0.5) 500%)',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Accept
        </button>
        <button
          onClick={() => onDecline(request.id)}
          className="decline-button"
          style={{
            padding: '6px 8px',
            fontSize: '12px !important',
            fontWeight: '500',
            backgroundColor: 'hsl(var(--muted) / 0.7)',
            color: 'hsl(var(--foreground))',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Decline
        </button>
      </div>
      
      <style>{`
        .accept-button:hover {
          transform: translateY(-1px);
        }
        .accept-button {
          font-size: 13px !important;
        }
              
        .decline-button:hover {
          background-color: hsl(var(--muted) / 0.7);
        }
        .decline-button {
          font-size: 13px !important;
        }
      `}</style>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.request.id === nextProps.request.id;
});

FriendRequestItem.displayName = 'FriendRequestItem';

const FriendList: React.FC = () => {
  const {
    friends,
    friendProfiles,
    pendingRequests,
    sentRequests,
    loading,
    error,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    clearError,
    refreshFriendProfiles,
  } = useFriends(15000);

  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [newFriendInput, setNewFriendInput] = useState('');
  const [showRequests, setShowRequests] = useState(true);
  const [showSentRequests, setShowSentRequests] = useState(true);

  const handleAddFriend = async () => {
    if (newFriendInput.trim()) {
      const success = await sendFriendRequest(newFriendInput);
      if (success) {
        setNewFriendInput('');
        setIsAddingFriend(false);
      }
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      background: 'transparent',
      fontFamily: "'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{
        padding: '12px 10px 8px',
        borderBottom: '1px solid hsl(var(--border) / 0.2)',
      }}>
        <p style={{
          margin: '-20px 0 0',
          fontSize: '11px',
          color: 'hsl(var(--muted-foreground))',
          lineHeight: '1.4',
        }}>
          Progress bars track your friend's daily assignment progress. Auto-refreshes every 15s.
        </p>
      </div>
      
      {isAddingFriend && (
        <div style={{ 
          padding: '8px 10px',
          borderBottom: '1px solid hsl(var(--border) / 0.2)',
        }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="text"
              value={newFriendInput}
              onChange={(e) => setNewFriendInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFriend();
                if (e.key === 'Escape') {
                  setIsAddingFriend(false);
                  setNewFriendInput('');
                }
              }}
              placeholder="Enter email..."
              autoFocus
              style={{
                flex: 1,
                padding: '6px 10px',
                border: '1px solid hsl(var(--accent) / 0.3)',
                borderRadius: '6px',
                fontSize: '13px',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                outline: 'none',
              }}
            />
            <button
              onClick={handleAddFriend}
              disabled={!newFriendInput.trim()}
              style={{
                padding: '6px 10px',
                background: newFriendInput.trim() 
                  ? 'linear-gradient(135deg, hsl(var(--accent)/0.75) 100%, hsl(var(--primary)) 100%)'
                  : 'hsl(var(--muted) / 0.3)',
                color: newFriendInput.trim() ? 'white' : 'hsl(var(--muted-foreground))',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: newFriendInput.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                transition: 'all 0.15s ease',
              }}
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAddingFriend(false);
                setNewFriendInput('');
              }}
              style={{
                padding: '6px 10px',
                backgroundColor: 'hsl(var(--muted) / 0.4)',
                color: 'hsl(var(--foreground))',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.15s ease',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '8px 10px',
          margin: '6px 10px',
          backgroundColor: 'hsl(var(--destructive) / 0.1)',
          color: 'hsl(var(--destructive))',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: '6px',
          border: '1px solid hsl(var(--destructive) / 0.2)',
        }}>
          <span>{error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              color: 'hsl(var(--destructive))',
              cursor: 'pointer',
              fontSize: '16px',
              padding: 0,
              fontWeight: 'bold',
            }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'thin',
        scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) transparent',
      }}>
        {pendingRequests.length > 0 && (
          <div style={{ padding: '0 10px', marginTop: '6px' }}>
            <button
              onClick={() => setShowRequests(!showRequests)}
              style={{
                width: '100%',
                padding: '2px 0',
                backgroundColor: 'transparent',
                color: 'hsl(var(--accent))',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '600',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <span>Friend Requests ({pendingRequests.length})</span>
              <span style={{ fontSize: '10px' }}>{showRequests ? '▼' : '▶'}</span>
            </button>
            {showRequests && (
              <div style={{ maxHeight: '200px', overflowY: 'auto', width: '108%', marginLeft: '-4%' }}>
                {pendingRequests.map((request) => (
                  <FriendRequestItem
                    key={request.id}
                    request={request}
                    onAccept={acceptFriendRequest}
                    onDecline={declineFriendRequest}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {sentRequests.length > 0 && (
          <div style={{ padding: '0 10px', marginTop: '6px' }}>
            <button
              onClick={() => setShowSentRequests(!showSentRequests)}
              style={{
                width: '100%',
                padding: '6px 0',
                backgroundColor: 'transparent',
                color: 'hsl(var(--muted-foreground))',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '600',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <span>Sent Requests ({sentRequests.length})</span>
              <span style={{ fontSize: '10px' }}>{showSentRequests ? '▼' : '▶'}</span>
            </button>
            {showSentRequests && (
              <div>
                {sentRequests.map((request) => {
                  const receiverName = (request.receiver as any).name || request.receiver.username;
                  return (
                    <div
                      key={request.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px',
                        margin: '6px 0',
                        borderRadius: '6px',
                        background: 'hsl(var(--muted) / 0.3)',
                        border: '1px solid hsl(var(--border) / 0.3)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, hsl(var(--muted-foreground) / 0.4) 0%, hsl(var(--muted-foreground) / 0.2) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'hsl(var(--muted-foreground))',
                          fontWeight: '600',
                          fontSize: '13px',
                          flexShrink: 0,
                        }}>
                          {receiverName.charAt(0).toUpperCase()}
                        </div>
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'hsl(var(--foreground))',
                            fontWeight: '500',
                            fontSize: '14px',
                            display: 'block',
                          }}>
                            {receiverName}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            color: 'hsl(var(--muted-foreground))',
                          }}>
                            Pending...
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {loading && friends.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: 'hsl(var(--muted-foreground))',
            fontSize: '13px',
            padding: '16px',
          }}>
            Loading...
          </div>
        ) : friends.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '10px 16px',
          }}>
            <div style={{
              fontSize: '32px',
              marginBottom: '8px',
            }}></div>
            <div style={{
              color: 'hsl(var(--muted-foreground))',
              fontSize: '13px',
              marginBottom: '8px',
            }}>
              No friends yet. Invite your classmates to join you!
            </div>
            <button
              onClick={() => setIsAddingFriend(true)}
              className="add-friend-empty"
              style={{
                padding: '6px 14px',
                background: 'linear-gradient(135deg, hsl(var(--accent)/0.8) 100%, hsl(var(--primary)) 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.15s ease',
              }}
            >
              Add Friend
            </button>
          </div>
        ) : (
          <div>
            {friends.map(friend => (
              <FriendItem
                key={friend.id}
                friend={friend}
                profile={friendProfiles.get(friend.id)}
                onRemove={removeFriend}
              />
            ))}
          </div>
        )}
      </div>

      {!isAddingFriend && friends.length > 0 && (
        <div style={{ 
          padding: '10px',
          borderTop: '1px solid hsl(var(--border) / 0.2)',
        }}>
          <button
            onClick={() => setIsAddingFriend(true)}
            className="add-friend-button"
            style={{
              width: '100%',
              padding: '8px',
              background: 'linear-gradient(135deg, hsl(var(--accent) / 0.1) 0%, hsl(var(--primary) / 0.05) 100%)',
              color: 'hsl(var(--accent))',
              border: '1px dashed hsl(var(--accent) / 0.3)',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '16px' }}>+</span>
            Add Friend
          </button>
        </div>
      )}
      
      <style>{`
        .add-friend-empty:hover {
          transform: translateY(-1px);
        }
        
        .add-friend-button:hover {
          background: linear-gradient(135deg, hsl(var(--accent) / 0.15) 0%, hsl(var(--primary) / 0.1) 100%);
          border-color: hsl(var(--accent) / 0.5);
        }
      `}</style>
    </div>
  );
};

export default FriendList;
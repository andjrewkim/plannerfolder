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
      return { percentage: 0, color: '#ef4444', gradient: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)', completed: 0, total: 0 };
    }
    
    let percentage = profile.today_completion_percentage;
    
    if (percentage === undefined || percentage === null) {
      percentage = profile.total_assignments_today > 0 
        ? (profile.completed_assignments_today / profile.total_assignments_today) * 100 
        : 0;
    }
    
    let color: string;
    let gradient: string;
    
    if (percentage === 100) {
      color = '#10b981';
      gradient = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
    } else if (percentage >= 75) {
      const t = (percentage - 75) / 25;
      color = interpolateColor('#84cc16', '#10b981', t);
      gradient = `linear-gradient(90deg, ${color} 0%, ${interpolateColor('#65a30d', '#059669', t)} 100%)`;
    } else if (percentage >= 50) {
      const t = (percentage - 50) / 25;
      color = interpolateColor('#facc15', '#84cc16', t);
      gradient = `linear-gradient(90deg, ${color} 0%, ${interpolateColor('#eab308', '#65a30d', t)} 100%)`;
    } else if (percentage >= 25) {
      const t = (percentage - 25) / 25;
      color = interpolateColor('#fb923c', '#facc15', t);
      gradient = `linear-gradient(90deg, ${color} 0%, ${interpolateColor('#f97316', '#eab308', t)} 100%)`;
    } else {
      const t = percentage / 25;
      color = interpolateColor('#ef4444', '#fb923c', t);
      gradient = `linear-gradient(90deg, ${color} 0%, ${interpolateColor('#dc2626', '#f97316', t)} 100%)`;
    }
    
    return { 
      percentage, 
      color,
      gradient,
      completed: profile.completed_assignments_today,
      total: profile.total_assignments_today
    };
  }, [profile]);

  const { percentage, gradient, completed, total } = completionData;
  const loadingProfile = !profile;

  return (
    <div
      className="friend-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderBottom: '1px solid hsl(var(--border) / 0.15)',
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
            top: '6px',
            right: '10px',
            width: '18px',
            height: '18px',
            border: 'none',
            background: 'hsl(var(--destructive) / 0.1)',
            color: 'hsl(var(--destructive))',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '3px',
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
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, hsl(var(--accent) / 0.6) 0%, hsl(var(--primary) / 0.6) 100%)',
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
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'hsl(var(--foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '3px',
          }}>
            {displayName}
          </div>
          
          {profile && !loadingProfile && (
            <div style={{ marginTop: '4px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}>
                <div style={{
                  fontSize: '11px',
                  color: 'hsl(var(--muted-foreground))',
                  fontWeight: '500',
                }}>
                  {completed}/{total}
                </div>
                <span style={{
                  fontSize: '11px',
                  color: 'hsl(var(--foreground))',
                  fontWeight: '700',
                }}>
                  {Math.round(percentage)}%
                </span>
              </div>
              
              <div style={{
                display: 'flex',
                gap: '2px',
              }}>
                {Array.from({ length: total }).map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: '8px',
                      borderRadius: '4px',
                      background: idx < completed ? gradient : 'hsl(var(--muted) / 0.25)',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          
          {loadingProfile && (
            <div style={{
              marginTop: '6px',
              height: '3px',
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
          background-color: hsl(var(--accent) / 0.06);
        }
        
        .remove-button:hover {
          background: hsl(var(--destructive)) !important;
          color: white !important;
        }
      `}</style>
    </div>
  );
}, (prevProps, nextProps) => {
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
      padding: '6px 8px',
      margin: '4px 0',
      borderRadius: '6px',
      background: 'linear-gradient(135deg, hsl(var(--primary) / 0.05) 0%, hsl(var(--accent) / 0.05) 100%)',
      border: '1px solid hsl(var(--primary) / 0.1)',
    }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.6) 0%, hsl(var(--accent) / 0.6) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '600',
          fontSize: '12px',
          flexShrink: 0,
        }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: 'hsl(var(--foreground))',
          fontWeight: '600',
          fontSize: '13px',
        }}>
          {displayName}
        </span>
      </div>
      
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        <button
          onClick={() => onAccept(request.id)}
          className="accept-button"
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: '600',
            background: 'linear-gradient(135deg, hsl(var(--accent)/0.5) 0%, hsl(var(--primary)/0.5) 100%)',
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
            padding: '4px 10px',
            fontSize: '11px',
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
              
        .decline-button:hover {
          background-color: hsl(var(--muted));
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
  } = useFriends(45000);

  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [newFriendInput, setNewFriendInput] = useState('');
  const [showRequests, setShowRequests] = useState(true);
  const [showSentRequests, setShowSentRequests] = useState(true);

  const motivationStats = useMemo(() => {
    let finishedCount = 0;
    
    friends.forEach(friend => {
      const profile = friendProfiles.get(friend.id);
      if (profile) {
        const percentage = profile.today_completion_percentage ?? 
          (profile.total_assignments_today > 0 
            ? (profile.completed_assignments_today / profile.total_assignments_today) * 100 
            : 0);
        
        if (percentage === 100) {
          finishedCount++;
        }
      }
    });
    
    return { finishedCount };
  }, [friends, friendProfiles]);

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
        padding: '8px 10px',
        borderBottom: '1px solid hsl(var(--border) / 0.15)',
      }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '-8px', marginBottom: '6px' }}>
          {!isAddingFriend ? (
            <button
              onClick={() => setIsAddingFriend(true)}
              className="add-friend-button"
              style={{
                width: '100%',
                padding: '4px',
                background: 'linear-gradient(135deg, hsl(var(--accent) / 0.08) 0%, hsl(var(--primary) / 0.04) 100%)',
                color: 'hsl(var(--accent))',
                border: '1px dashed hsl(var(--accent) / 0.25)',
                borderRadius: '5px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '12px' }}>+</span>
              Add Friend
            </button>
          ) : (
            <>
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
                  minWidth: 0,
                  padding: '5px 8px',
                  border: '1px solid hsl(var(--accent) / 0.3)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleAddFriend}
                disabled={!newFriendInput.trim()}
                style={{
                  padding: '5px 10px',
                  background: newFriendInput.trim() 
                    ? 'linear-gradient(135deg, hsl(var(--accent)/0.75) 100%, hsl(var(--primary)) 100%)'
                    : 'hsl(var(--muted) / 0.3)',
                  color: newFriendInput.trim() ? 'white' : 'hsl(var(--muted-foreground))',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '11px',
                  cursor: newFriendInput.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
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
                  padding: '5px 10px',
                  backgroundColor: 'hsl(var(--muted) / 0.4)',
                  color: 'hsl(var(--foreground))',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </>
          )}
        </div>
        
        {friends.length > 0 && (
          <p style={{
            margin: '0',
            fontSize: '10px',
            color: 'hsl(var(--muted-foreground))',
            lineHeight: '1.3',
          }}>
            Progress bars track your friend's daily assignment progress. Auto-refreshes every minute.
          </p>
        )}
      </div>

      {error && (
        <div style={{
          padding: '6px 10px',
          margin: '6px 10px',
          backgroundColor: 'hsl(var(--destructive) / 0.1)',
          color: 'hsl(var(--destructive))',
          fontSize: '11px',
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
              fontSize: '14px',
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
                padding: '3px 0',
                backgroundColor: 'transparent',
                color: 'hsl(var(--accent))',
                border: 'none',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '700',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
              <span>Friend Requests ({pendingRequests.length})</span>
              <span style={{ fontSize: '9px' }}>{showRequests ? '▼' : '▶'}</span>
            </button>
            {showRequests && (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
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
                padding: '3px 0',
                backgroundColor: 'transparent',
                color: 'hsl(var(--muted-foreground))',
                border: 'none',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '700',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
              <span>Sent Requests ({sentRequests.length})</span>
              <span style={{ fontSize: '9px' }}>{showSentRequests ? '▼' : '▶'}</span>
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
                        padding: '6px 8px',
                        margin: '4px 0',
                        borderRadius: '6px',
                        background: 'hsl(var(--muted) / 0.25)',
                        border: '1px solid hsl(var(--border) / 0.25)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, hsl(var(--muted-foreground) / 0.3) 0%, hsl(var(--muted-foreground) / 0.15) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'hsl(var(--muted-foreground))',
                          fontWeight: '600',
                          fontSize: '12px',
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
                            fontSize: '13px',
                            display: 'block',
                          }}>
                            {receiverName}
                          </span>
                          <span style={{
                            fontSize: '10px',
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
            fontSize: '12px',
            padding: '16px',
          }}>
            Loading...
          </div>
        ) : friends.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '16px',
          }}>

          <div
            style={{
              color: 'hsl(var(--muted-foreground) / 0.9)',
              fontSize: '11px',
              lineHeight: '1.4',
            }}
          >
            Connect with classmates who want to stay on top of their homework. Add your classmates now and see their progress in real time.
            <p style={{ margin:0 }}>
              <br />
              Color themes unlock after adding one friend.
            </p>
          </div>
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
      
      {friends.length > 0 && motivationStats.finishedCount > 0 && (
        <div style={{
          padding: '5px 8px',
          margin: '6px 10px',
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--accent) / 0.08) 100%)',
          borderRadius: '5px',
          border: '1px solid hsl(var(--primary) / 0.15)',
          fontSize: '10px',
          fontWeight: '600',
          color: 'hsl(var(--primary))',
          textAlign: 'center',
        }}>
          {motivationStats.finishedCount} {motivationStats.finishedCount === 1 ? 'friend has' : 'friends have'} finished today 🎉
        </div>
      )}
      
      <style>{`
        .add-friend-button:hover {
          background: linear-gradient(135deg, hsl(var(--accent) / 0.12) 0%, hsl(var(--primary) / 0.08) 100%);
          border-color: hsl(var(--accent) / 0.4);
        }
      `}</style>
    </div>
  );
};

export default FriendList;
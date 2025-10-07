import React, { useState } from 'react';
import { Friend } from './FriendList';

interface FriendItemProps {
  friend: Friend;
  onRemove: (friendId: string) => void;
}

const FriendItem: React.FC<FriendItemProps> = ({ friend, onRemove }) => {
  const [showRemove, setShowRemove] = useState(false);
  
  const completionPercentage = friend.totalTasks > 0 
    ? Math.round((friend.completedTasks / friend.totalTasks) * 100)
    : 0;

  // Determine color based on completion percentage
  const getProgressColor = () => {
    if (completionPercentage >= 80) return '#10b981'; // green
    if (completionPercentage >= 50) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  return (
    <div
      style={{
        padding: '6px 8px',
        backgroundColor: 'var(--muted)',
        borderRadius: '4px',
        border: '1px solid hsl(var(--border)/0.3)',
        transition: 'all 0.15s',
        cursor: 'pointer',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--accent)';
        setShowRemove(true);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--muted)';
        setShowRemove(false);
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
        <div style={{ 
          flex: 1, 
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {friend.name}
          </span>
          <span style={{ 
            fontSize: '10px', 
            color: 'var(--muted-foreground)',
            fontWeight: '600',
            whiteSpace: 'nowrap'
          }}>
            {friend.completedTasks}/{friend.totalTasks}
          </span>
        </div>

        {/* Progress Bar - Compact */}
        <div style={{
          width: '50px',
          height: '4px',
          backgroundColor: 'hsl(var(--border)/0.3)',
          borderRadius: '2px',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          <div
            style={{
              width: `${completionPercentage}%`,
              height: '100%',
              backgroundColor: getProgressColor(),
              transition: 'width 0.3s ease',
              borderRadius: '2px'
            }}
          />
        </div>

        <span style={{
          fontSize: '10px',
          color: getProgressColor(),
          fontWeight: '600',
          minWidth: '32px',
          textAlign: 'right',
          flexShrink: 0
        }}>
          {completionPercentage}%
        </span>
        
        {showRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(friend.id);
            }}
            style={{
              padding: '2px 5px',
              fontSize: '10px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontWeight: '500',
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              lineHeight: '1'
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default FriendItem;
import React, { useState } from 'react';
import FriendItem from './FriendItem';

export interface Friend {
  id: string;
  name: string;
  completedTasks: number;
  totalTasks: number;
  lastActive: string;
}

const FriendList: React.FC = () => {
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [friends, setFriends] = useState<Friend[]>([
    {
      id: '1',
      name: 'jacob kim',
      completedTasks: 7,
      totalTasks: 10,
      lastActive: '2 hours ago'
    },
    {
      id: '2',
      name: 'david poo poo',
      completedTasks: 4,
      totalTasks: 8,
      lastActive: '5 hours ago'
    },
    {
      id: '3',
      name: 'pee pee',
      completedTasks: 9,
      totalTasks: 9,
      lastActive: '30 minutes ago'
    },
    {
      id: '4',
      name: 'stupid perons',
      completedTasks: 5,
      totalTasks: 12,
      lastActive: '1 day ago'
    }
  ]);

  const handleAddFriend = () => {
    if (newFriendName.trim()) {
      const newFriend: Friend = {
        id: Date.now().toString(),
        name: newFriendName.trim(),
        completedTasks: 0,
        totalTasks: 0,
        lastActive: 'just now'
      };
      setFriends([...friends, newFriend]);
      setNewFriendName('');
      setIsAddingFriend(false);
    }
  };

  const handleRemoveFriend = (friendId: string) => {
    setFriends(friends.filter(f => f.id !== friendId));
  };

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Compact Header with Search and Add */}
      <div style={{ 
        padding: '6px', 
        borderBottom: '1px solid hsl(var(--border)/0.3)',
        display: 'flex',
        gap: '4px',
        alignItems: 'center'
      }}>
        {isAddingFriend ? (
          <>
            <input
              type="text"
              value={newFriendName}
              onChange={(e) => setNewFriendName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFriend();
                if (e.key === 'Escape') {
                  setIsAddingFriend(false);
                  setNewFriendName('');
                }
              }}
              placeholder="Name..."
              autoFocus
              style={{
                flex: 1,
                padding: '4px 8px',
                border: '1px solid hsl(var(--border)/0.5)',
                borderRadius: '3px',
                fontSize: '12.5px',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)'
              }}
            />
            <button
              onClick={handleAddFriend}
              disabled={!newFriendName.trim()}
              style={{
                padding: '4px 8px',
                backgroundColor: newFriendName.trim() ? '#007bff' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '11.5px',
                cursor: newFriendName.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '500',
                minWidth: '40px'
              }}
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAddingFriend(false);
                setNewFriendName('');
              }}
              style={{
                padding: '4px 8px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '11.5px',
                cursor: 'pointer',
                fontWeight: '500',
                minWidth: '30px'
              }}
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '4px 8px',
                border: '1px solid hsl(var(--border)/0.5)',
                borderRadius: '3px',
                fontSize: '12px',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)'
              }}
            />
            <button
              onClick={() => setIsAddingFriend(true)}
              style={{
                padding: '4px 10px',
                backgroundColor: 'var(--muted)',
                color: 'var(--foreground)',
                border: '1px solid hsl(var(--border)/0.5)',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '500',
                whiteSpace: 'nowrap'
              }}
            >
              +
            </button>
          </>
        )}
      </div>

      {/* Friends List - Scrollable */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '6px'
      }}>
        {filteredFriends.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--muted-foreground)',
            fontSize: '12px',
            padding: '16px 8px'
          }}>
            {searchQuery ? 'No friends found' : 'No friends yet'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredFriends.map(friend => (
              <FriendItem
                key={friend.id}
                friend={friend}
                onRemove={handleRemoveFriend}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendList;
import { User } from 'lucide-react';

function UsersList({ users, currentUserId, typingUsers = {} }) {
  return (
    <div className="users-list">
      <h3>👥 Room Collaborators ({users.length})</h3>
      <ul>
        {users.map(user => {
          const isMe = user.id === currentUserId;
          const isTyping = typingUsers[user.id];

          return (
            <li key={user.id} className="user-item">
              <div
                className="user-avatar-badge"
                style={{
                  backgroundColor: user.color,
                  boxShadow: `0 0 8px ${user.color}40`
                }}
              >
                {user.username ? user.username[0].toUpperCase() : '?'}
              </div>
              
              <div className="user-info">
                <span className="user-name">
                  {user.username} {isMe && <span className="self-tag">(You)</span>}
                </span>
                
                {/* Active file presence */}
                {user.activeFile ? (
                  <span className="user-active-file">
                    editing <code>{user.activeFile}</code>
                  </span>
                ) : (
                  <span className="user-active-file idle">idle</span>
                )}
              </div>

              {/* Animated typing dots */}
              {isTyping && (
                <div className="typing-indicator" title="Typing...">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default UsersList;

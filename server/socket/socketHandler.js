const Room = require('../models/Room');

// Store active users per room (in-memory)
const roomUsers = new Map();

// Debounce timers for saving code
const saveTimers = new Map();

const setupSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join room
    socket.on('join-room', async ({ roomId, username }) => {
      socket.join(roomId);
      
      // Initialize room users if not exists
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }
      
      // Add user to room
      const users = roomUsers.get(roomId);
      const userColor = generateColor();
      users.set(socket.id, {
        id: socket.id,
        username,
        color: userColor,
        cursor: null
      });
      
      // Get room data from database
      const room = await Room.findOne({ roomId });
      
      if (room) {
        // Send current room state to joining user
        socket.emit('room-state', {
          code: room.code,
          language: room.language,
          users: Array.from(users.values())
        });
        
        // Notify others about new user
        socket.to(roomId).emit('user-joined', {
          user: users.get(socket.id),
          users: Array.from(users.values())
        });
      }
      
      console.log(`${username} joined room ${roomId}`);
    });

    // Code change — Last Write Wins strategy
    socket.on('code-change', async ({ roomId, code }) => {
      // Broadcast to all OTHER users in room immediately
      socket.to(roomId).emit('code-update', { code });
      
      // Debounced save to database (saves after 1 second of inactivity)
      if (saveTimers.has(roomId)) {
        clearTimeout(saveTimers.get(roomId));
      }
      
      saveTimers.set(roomId, setTimeout(async () => {
        try {
          await Room.findOneAndUpdate(
            { roomId },
            { code },
            { new: true }
          );
          console.log(`Code saved for room ${roomId}`);
        } catch (error) {
          console.error('Error saving code:', error);
        }
      }, 1000));
    });

    // Cursor movement — broadcast only, never persist
    socket.on('cursor-move', ({ roomId, cursor }) => {
      const users = roomUsers.get(roomId);
      if (users && users.has(socket.id)) {
        users.get(socket.id).cursor = cursor;
        
        // Broadcast cursor to others (not self)
        socket.to(roomId).emit('cursor-update', {
          id: socket.id,
          cursor
        });
      }
    });

    // Selection change
    socket.on('selection-change', ({ roomId, selection }) => {
      socket.to(roomId).emit('selection-update', {
        id: socket.id,
        selection
      });
    });

    // Language change
    socket.on('language-change', async ({ roomId, language }) => {
      // Broadcast to all users in room
      io.in(roomId).emit('language-update', { language });
      
      // Save to database
      try {
        await Room.findOneAndUpdate({ roomId }, { language });
      } catch (error) {
        console.error('Error saving language:', error);
      }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      
      // Find and remove user from their room
      for (const [roomId, users] of roomUsers.entries()) {
        if (users.has(socket.id)) {
          const user = users.get(socket.id);
          users.delete(socket.id);
          
          // Notify others
          io.in(roomId).emit('user-left', {
            id: socket.id,
            username: user.username,
            users: Array.from(users.values())
          });
          
          // Clean up empty rooms
          if (users.size === 0) {
            roomUsers.delete(roomId);
          }
          
          break;
        }
      }
    });

    // Leave room explicitly
    socket.on('leave-room', ({ roomId }) => {
      socket.leave(roomId);
      
      const users = roomUsers.get(roomId);
      if (users && users.has(socket.id)) {
        const user = users.get(socket.id);
        users.delete(socket.id);
        
        socket.to(roomId).emit('user-left', {
          id: socket.id,
          username: user.username,
          users: Array.from(users.values())
        });
      }
    });
  });
};

// Generate random color for user cursor
function generateColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#FF8C00'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

module.exports = setupSocket;

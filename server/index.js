const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

// Connect to Database
const connectDB = require('./config/db');
connectDB();

// Models
const { Room } = require('./models/db');

// Routes
const executeRoutes = require('./routes/execute');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/room');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));

app.use(express.json());

// Mount API routes
app.use('/execute', executeRoutes);
app.use('/auth', authRoutes);
app.use('/room', roomRoutes);

app.get('/', (req, res) => {
  res.send("CodeRoom API Server is running");
});

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Store active users per room (in-memory)
// Structure: roomId -> Map(socketId -> { id, username, color, activeFile })
const roomUsers = new Map();

// Debounce timers for saving code: key is "roomId-fileName" -> timeout
const saveTimers = new Map();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'coderoom_secret_key_123';

// Socket JWT Handshake validation
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  } catch (err) {
    return next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.username} (${socket.id})`);

  // Handle room joining
  socket.on("join-room", async ({ roomId }) => {
    try {
      socket.join(roomId);

      // Initialize room users list if not exists
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }

      const usersMap = roomUsers.get(roomId);
      
      // Assign a random color if not already assigned
      const userColor = generateColor();
      usersMap.set(socket.id, {
        id: socket.id,
        username: socket.username,
        userId: socket.userId,
        color: userColor,
        activeFile: null
      });

      // Get room state from database
      const room = await Room.findOne({ roomId });
      if (!room) {
        socket.emit("error-message", { message: "Room not found in database" });
        return;
      }

      // Send the current room files, language, and user list to the joined user
      socket.emit("room-state", {
        files: room.files,
        users: Array.from(usersMap.values())
      });

      // Broadcast user-joined to all other sockets in the room
      socket.to(roomId).emit("user-joined", {
        user: usersMap.get(socket.id),
        users: Array.from(usersMap.values())
      });

      console.log(`${socket.username} joined room ${roomId}`);
    } catch (err) {
      console.error("Error in join-room socket event:", err);
      socket.emit("error-message", { message: "Failed to load room state" });
    }
  });

  // Handle real-time code change per file
  socket.on("code-change", ({ roomId, fileName, code }) => {
    // Broadcast code change to other users in the room
    socket.to(roomId).emit("code-update", { fileName, code });

    // Debounced database save (saves after 1 second of typing silence)
    const timerKey = `${roomId}-${fileName}`;
    if (saveTimers.has(timerKey)) {
      clearTimeout(saveTimers.get(timerKey));
    }

    saveTimers.set(timerKey, setTimeout(async () => {
      try {
        await Room.findOneAndUpdate(
          { roomId, "files.name": fileName },
          { $set: { "files.$.code": code } }
        );
        saveTimers.delete(timerKey);
      } catch (error) {
        console.error(`Error saving file ${fileName} content:`, error);
      }
    }, 1000));
  });

  // Handle real-time file language change
  socket.on("language-change", async ({ roomId, fileName, language }) => {
    try {
      socket.to(roomId).emit("language-update", { fileName, language });

      await Room.findOneAndUpdate(
        { roomId, "files.name": fileName },
        { $set: { "files.$.language": language } }
      );
    } catch (error) {
      console.error(`Error saving language for file ${fileName}:`, error);
    }
  });

  // Create a new file in the room
  socket.on("file-create", async ({ roomId, name, language, code = "" }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      // Check if file name already exists
      if (room.files.some(f => f.name === name)) {
        socket.emit("error-message", { message: "File already exists" });
        return;
      }

      const newFile = { name, language, code };
      room.files.push(newFile);
      await room.save();

      // Broadcast to all users in the room
      io.in(roomId).emit("file-created", { file: newFile });
    } catch (error) {
      console.error("Error creating file:", error);
      socket.emit("error-message", { message: "Failed to create file" });
    }
  });

  // Rename an existing file
  socket.on("file-rename", async ({ roomId, oldName, newName }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      // Validate new name uniqueness
      if (room.files.some(f => f.name === newName)) {
        socket.emit("error-message", { message: "A file with that name already exists" });
        return;
      }

      const file = room.files.find(f => f.name === oldName);
      if (!file) return;

      file.name = newName;
      await room.save();

      io.in(roomId).emit("file-renamed", { oldName, newName });
    } catch (error) {
      console.error("Error renaming file:", error);
      socket.emit("error-message", { message: "Failed to rename file" });
    }
  });

  // Delete a file
  socket.on("file-delete", async ({ roomId, name }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      room.files = room.files.filter(f => f.name !== name);
      await room.save();

      io.in(roomId).emit("file-deleted", { name });
    } catch (error) {
      console.error("Error deleting file:", error);
      socket.emit("error-message", { message: "Failed to delete file" });
    }
  });

  // Cursor movement synchronization
  socket.on("cursor-move", ({ roomId, fileName, cursor }) => {
    socket.to(roomId).emit("cursor-update", {
      id: socket.id,
      fileName,
      cursor
    });
  });

  // Handle active file selection change (active tab presence)
  socket.on("active-file-change", ({ roomId, fileName }) => {
    const usersMap = roomUsers.get(roomId);
    if (usersMap && usersMap.has(socket.id)) {
      usersMap.get(socket.id).activeFile = fileName;
      
      socket.to(roomId).emit("active-file-update", {
        id: socket.id,
        fileName
      });
    }
  });

  // Typing indicators
  socket.on("typing", ({ roomId, isTyping }) => {
    socket.to(roomId).emit("typing-update", {
      id: socket.id,
      username: socket.username,
      isTyping
    });
  });

  // Live room chat messaging
  socket.on("send-message", ({ roomId, message }) => {
    io.in(roomId).emit("receive-message", {
      username: socket.username,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Disconnection cleanup
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.username}`);
    cleanupUser(socket);
  });

  socket.on("leave-room", ({ roomId }) => {
    socket.leave(roomId);
    cleanupUser(socket);
  });
});

function cleanupUser(socket) {
  for (const [roomId, usersMap] of roomUsers.entries()) {
    if (usersMap.has(socket.id)) {
      usersMap.delete(socket.id);
      
      // Notify remaining users
      io.in(roomId).emit("user-left", {
        id: socket.id,
        username: socket.username,
        users: Array.from(usersMap.values())
      });

      // Clean up room memory if empty
      if (usersMap.size === 0) {
        roomUsers.delete(roomId);
      }
      break;
    }
  }
}

// Generate a random cursor color for new connections
function generateColor() {
  const colors = [
    '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
    '#e11d48', '#f97316', '#eab308', '#22c55e',
    '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
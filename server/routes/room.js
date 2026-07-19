const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../models/db');
const authMiddleware = require('../middleware/authMiddleware');

// @route   POST /room/create
// @desc    Create a new room
// @access  Private
router.post('/create', authMiddleware, async (req, res) => {
  const { roomId, isPrivate, password } = req.body;

  if (!roomId) {
    return res.status(400).json({ success: false, message: 'Room ID is required' });
  }

  try {
    // Check if room already exists
    const roomExists = await db.Room.findOne({ roomId });
    if (roomExists) {
      return res.status(400).json({ success: false, message: 'Room already exists' });
    }

    const newRoom = db.NewRoom({
      roomId,
      creator: req.user.id,
      isPrivate: !!isPrivate,
      files: [
        {
          name: 'index.js',
          code: `// Welcome to your collaborative room!
console.log("Hello, CodeRoom!");
`,
          language: 'javascript'
        }
      ]
    });

    if (isPrivate && password) {
      const salt = await bcrypt.genSalt(10);
      newRoom.password = await bcrypt.hash(password, salt);
    }

    await newRoom.save();

    res.status(201).json({
      success: true,
      roomId: newRoom.roomId,
      message: 'Room created successfully'
    });
  } catch (err) {
    console.error('Room Creation Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during room creation' });
  }
});

// @route   GET /room/info/:roomId
// @desc    Get room metadata
// @access  Private
router.get('/info/:roomId', authMiddleware, async (req, res) => {
  try {
    const room = await db.Room.findOne({ roomId: req.params.roomId })
      .populate('creator', 'username');

    if (!room) {
      return res.json({ success: false, exists: false, message: 'Room not found' });
    }

    res.json({
      success: true,
      exists: true,
      isPrivate: room.isPrivate,
      creatorName: room.creator ? room.creator.username : 'Unknown'
    });
  } catch (err) {
    console.error('Fetch Room Info Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error fetching room info' });
  }
});

// @route   POST /room/verify-password
// @desc    Verify passcode for a private room
// @access  Private
router.post('/verify-password', authMiddleware, async (req, res) => {
  const { roomId, password } = req.body;

  if (!roomId || !password) {
    return res.status(400).json({ success: false, message: 'Room ID and password are required' });
  }

  try {
    const room = await db.Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (!room.isPrivate) {
      return res.json({ success: true, message: 'Room is public' });
    }

    const isMatch = await bcrypt.compare(password, room.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid password' });
    }

    res.json({ success: true, message: 'Password verified successfully' });
  } catch (err) {
    console.error('Password Verification Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error verifying password' });
  }
});

module.exports = router;

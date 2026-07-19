const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  code: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'javascript'
  }
});

const RoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    default: null
  },
  files: {
    type: [FileSchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Room', RoomSchema);
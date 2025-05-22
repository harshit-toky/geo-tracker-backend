// models/Friend.js
const mongoose = require('mongoose');

const FriendSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  friend: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  }
});

FriendSchema.index({ user: 1, friend: 1 }, { unique: true });

module.exports = mongoose.model('Friend', FriendSchema);

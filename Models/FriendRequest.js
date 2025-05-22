const mongoose = require('mongoose');
const FriendRequestSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from creation
    }
  });
  FriendRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); 
  module.exports = mongoose.model('FriendRequest', FriendRequestSchema);
  
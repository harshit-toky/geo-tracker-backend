// routes/friends.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Friend = require('./Models/Friend');
const User = require('./Models/user');
const isAuthenticated = require('./auth');
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const currentUser = await User.findOne({ username: req.session.user.username });

    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const friendsData = await Friend.find({ user: currentUser._id })
      .populate('friend', 'username') // only populate username, email not needed
      .select('friend lastSeen');

    const friends = friendsData.map(entry => ({
      username: entry.friend.username,
      lastSeen: entry.lastSeen
    }));

    res.json({ friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;

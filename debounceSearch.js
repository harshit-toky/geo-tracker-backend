const rateLimit = require('express-rate-limit');

// Create rate limiter for search (set your limit as per your need)
const searchRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow 5 requests per minute per user
  message: { error: "Too many requests, please try again later." }
});

// module.exports = searchRateLimiter;

const express = require('express');
const isAuthenticated = require('./auth');
const router = express.Router();
const User = require("./Models/user");

// Friend search route with rate-limiting applied
router.get('/', isAuthenticated, searchRateLimiter, async (req, res) => {
  const { query, searchBy } = req.query;

  if (!query || !searchBy) {
    return res.status(400).json({ error: "Query is required" });
  }
  try {
    // Replace this with your actual search logic
    let friends = [];
    if(searchBy === "username"){
      friends = await User.find({
          $and: [
            { username: { $regex: query, $options: 'i' } },
            { username: { $ne: req.session.user.username } }
          ]
        }).select('username');
    }else{
      friends = await User.find({
        $and: [
          { email: { $regex: query, $options: 'i' } },
          { username: { $ne: req.session.user.username } }
        ]
      }).select('email');
    }
      
      res.json({
        users: friends
      });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;

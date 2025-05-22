const express = require("express");
const router = express.Router();
const FriendRequest = require("./Models/FriendRequest");
const Friend = require("./Models/Friend");
const User = require("./Models/user");
const isAuthenticated = require('./auth');

//Send Friend Request
router.post("/request",isAuthenticated, async (req, res) => {
  // console.log(req.body);
  const { username: receiverUsername, searchBy } = req.body;
  const senderUsername = req.session.user.username;
  // console.log(receiverUsername);  // should print 'harshit' now


//   if (!senderUsername) return res.status(401).json({ message: "Unauthorized" });

  const sender = await User.findOne({ username: senderUsername });
  const receiver = await User.findOne({ username: receiverUsername });

  if(sender === receiver){
    return res.status(404).json({message : "Can't Send Request to urself"});
  }

  if (!receiver) return res.status(404).json({ message: "User not found" });

  // Prevent duplicate requests
  const existing = await FriendRequest.findOne({
    sender: sender._id,
    receiver: receiver._id,
    status: "pending"
  });
  if (existing) return res.status(400).json({ message: "Request already sent" });

  const request = await FriendRequest.create({
    sender: sender._id,
    receiver: receiver._id,
    status: "pending",
    createdAt: new Date()
  });

  // 🔔 Real-time notification
  const socketId = req.onlineUsers.get(receiver.username);
  if (socketId) {
    req.io.to(socketId).emit("friend_request", {
      from: sender.username,
      message: "You received a friend request"
    });
  }else {
    // If the receiver is not online, send a push notification
    // const receiver = await User.findOne({ username: receiverUsername });
    const fcmToken = receiver.fcmToken; // assuming you store the FCM token for each user

    if (fcmToken) {
      sendPushNotification(fcmToken, `You have a new friend request from ${sender.username}`);
    }
  }

  res.status(200).json({ message: "Friend request sent" });
});

//Receive Friend Request
router.get("/receiveRequests",isAuthenticated, async (req, res) => {
    const username = req.session.user.username;
    // if (!username) return res.status(401).json({ message: "Unauthorized" });
  
    const user = await User.findOne({ username });
  
    const requests = await FriendRequest.find({
      receiver: user._id,
      status: "pending"
    }).populate("sender", "username");
  
    res.status(200).json({requests, count : requests.length });

});

// router.get("/count", async (req, res) => {
//     const username = req.session.user?.username;
//     if (!username) return res.status(401).json({ message: "Unauthorized" });
  
//     const user = await User.findOne({ username });
  
//     const count = await FriendRequest.countDocuments({
//       receiver: user._id,
//       status: "pending"
//     });
  
//     res.status(200).json({ count });
// });
  
router.post("/respond",isAuthenticated, async (req, res) => {
    const { senderUsername, action } = req.body; // action: 'accept' or 'reject'
    const receiverUsername = req.session.user.username;
  
    // if (!receiverUsername) return res.status(401).json({ message: "Unauthorized" });
  
    const sender = await User.findOne({ username: senderUsername });
    const receiver = await User.findOne({ username: receiverUsername });
  
    const request = await FriendRequest.findOne({
      sender: sender._id,
      receiver: receiver._id,
      status: "pending"
    });
  
    if (!request) return res.status(404).json({ message: "Request not found" });
  
    if (action === "accept") {
      request.status = "accepted";
      await request.save();
  
      // Save both sides of friendship
      await Friend.create({ user: sender._id, friend: receiver._id });
      await Friend.create({ user: receiver._id, friend: sender._id });
  
      // 🔔 Real-time notification
      const socketId = req.onlineUsers.get(sender.username);
      if (socketId) {
        req.io.to(socketId).emit("friend_request_accepted", {
          by: receiver.username,
          message: "Your friend request was accepted"
        });
      }
  
      return res.status(200).json({ message: "Request accepted" });
  
    } else if (action === "reject") {
      request.status = "rejected";
      await request.save();

    //   const senderUser = await User.findById(request.sender);
        const senderSocketId = onlineUsers[sender.username];
        if (senderSocketId) {
            io.to(senderSocketId).emit('friendRequest:rejected', {
            receiver: req.session.user.username
            });
        }
      return res.status(200).json({ message: "Request rejected" });
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }
  });

//Gives Sender sent pending requests
// GET /api/friends/sent
router.get('/sent',isAuthenticated, async (req, res) => {
    const username = req.session.user.username;
  
    const user = await User.findOne({ username });
  
    const sentRequests = await FriendRequest.find({
      sender: user._id,
      status: 'pending'
    }).populate("receiver", "username");

    const usernames = sentRequests.map(req => req.receiver.username);
  
    res.status(200).json({ requests: usernames });
  });
  
// DELETE /api/friends/unsend/:receiverUsername
router.delete('/unsend/:receiverUsername',isAuthenticated, async (req, res) => {
    const senderUsername = req.session.user.username;
    const { receiverUsername } = req.params;
  
    if (!senderUsername || !receiverUsername) {
      return res.status(400).json({ message: "Invalid request" });
    }
  
    const sender = await User.findOne({ username: senderUsername });
    const receiver = await User.findOne({ username: receiverUsername });
  
    if (!sender || !receiver) return res.status(404).json({ message: "User not found" });
  
    await FriendRequest.deleteOne({
      sender: sender._id,
      receiver: receiver._id,
      status: 'pending'
    });
  
    // Notify receiver in real-time if online
    const receiverSocket = onlineUsers[receiver.username];
    if (receiverSocket) {
      io.to(receiverSocket).emit('friendRequest:unsent', sender.username);
    }
  
    res.json({ message: "Friend request unsent" });
  });


  const admin = require('firebase-admin');

  // Get the service account JSON from the environment variable
  const serviceAccount = require('./Safe/geo-tracker-1a432-firebase-adminsdk-fbsvc-848600f3b2.json');
  
  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  
  const sendPushNotification = (fcmToken, message) => {
    const payload = {
      notification: {
        title: 'New Notification',
        body: message,
        click_action: 'http://localhost:3000/notifications', // Link to open upon notification click
      },
    };
  
    admin.messaging().sendToDevice(fcmToken, payload)
      .then((response) => {
        console.log('Successfully sent message:', response);
      })
      .catch((error) => {
        console.error('Error sending message:', error);
      });
  };
module.exports = router;
  
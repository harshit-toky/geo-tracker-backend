const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const User = require("./Models/user");
const http = require("http");
const MongoStore = require('connect-mongo');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app); // Create HTTP server

// === Socket.IO Server ===
// const io = new Server(server, {
//   cors: {
//     origin: "http://localhost:3000",
//     credentials: true
//   }
// });

const io = new Server(server, {
  cors: {
    origin: "https://geo-tracker-frontend.vercel.app",
    credentials: true
  }
});

// === Socket.IO Logic ===
const onlineUsers = new Map(); // Map username -> socket.id

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("register-user", (username) => {
    if (username) {
      onlineUsers.set(username, socket.id);
      console.log(`User ${username} registered with socket ${socket.id}`);
    }
  });

  socket.on("send-friend-request", ({ sender, receiver }) => {
    const receiverSocketId = onlineUsers.get(receiver);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("friend-request-received", { from: sender });
    }
  });

  socket.on("disconnect", () => {
    for (let [username, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(username);
        break;
      }
    }
    console.log("Socket disconnected:", socket.id);
  });
});
// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = onlineUsers;
  next();
});


// Middlewares
app.use(express.json()); // to parse JSON
const cookieParser = require('cookie-parser');
app.use(cookieParser()); // ✅ Add this
app.set("trust proxy", 1); // trust first proxy (Render)


// Update CORS configuration
// app.use(cors({
//   origin: "http://localhost:3000",
//   credentials: true, // THIS IS CRUCIAL
//   exposedHeaders: ['set-cookie'] // Helps with cookie issues
// }));
app.use(cors({
  origin: "https://geo-tracker-frontend.vercel.app",
  credentials: true, // THIS IS CRUCIAL
  exposedHeaders: ['set-cookie'] // Helps with cookie issues
}));



// Connect to MongoDB Atlas (or local)
mongoose.connect("mongodb+srv://harshittoky2020:hello%40123@geo-tracker.2pvajrf.mongodb.net/?retryWrites=true&w=majority&appName=geo-tracker", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ Mongo Error:", err));


// Enhance session configuration
app.use(session({
  secret: "yourSecretKey",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60, // 1 hour
    httpOnly: true,
    sameSite: 'lax', // or 'none' for cross-site
    secure: process.env.NODE_ENV === 'production' // true for HTTPS
    // sameSite : 'none',
    // secure : true
  },
  store: MongoStore.create({
    client: mongoose.connection.getClient(), // Re-use existing connection
    collectionName: 'sessions', // Optional
    ttl: 14 * 24 * 60 * 60 // 14 days in seconds
  }),
}));

  // ---- ROUTES ----

// Registration route
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;

  // Basic field checks
  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  // Email format check
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ message: "Invalid email format" });

  // Check if username/email exists
  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser)
    return res.status(400).json({ message: "Username or email already exists" });

  // Save new user
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, email, password: hashedPassword });
  await newUser.save();

  req.session.user = { username };
  req.session.save(() => {
    res.json({ message: "Login successful" });
  });
  
});


// Login route
app.post("/api/login", async (req, res) => {
  const { username, password, fcmToken } = req.body;

  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  if (fcmToken) {
    user.fcmToken = fcmToken; // Update user's FCM token
    await user.save();
  }
  req.session.user = { username };
  req.session.save(() => {
    res.json({ message: "Login successful" });
  });
  
});

// Example session check
app.get("/api/user", (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ message: "Not logged in" });
  }
});

// Logout route to clear session
app.post('/api/logout', (req, res) => {
  // Destroy the session in the store first
  req.session.destroy(err => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).send('Logout failed');
    }

    // Clear the session cookie explicitly
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
      // sameSite: 'none',
      // secure: true

    });

    res.status(200).send('Logged out successfully');
  });
});


app.use('/api/friends', require('./friends'));
app.use('/api/search', require('./debounceSearch'));
app.use('/api/friend', require("./friendRequestRoute"));
// Start server

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


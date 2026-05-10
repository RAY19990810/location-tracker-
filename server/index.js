const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// The password is set via environment variable for security.
// Default to 'kudan' if not set (user should change this in Render settings)
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || 'kudan';

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// State: { socketId: { name: string, room: string, isAuthenticated: boolean } }
const users = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', (password) => {
    if (password === ACCESS_PASSWORD) {
      users[socket.id] = { name: null, room: null, isAuthenticated: true };
      socket.emit('auth-success');
      // Immediately send the current user list to the newly authenticated user
      socket.emit('current-users', users);
      console.log(`Socket ${socket.id} authenticated`);
    } else {
      socket.emit('auth-failure', 'パスワードが正しくありません');
    }
  });

  socket.on('join', (name) => {
    if (users[socket.id] && users[socket.id].isAuthenticated) {
      users[socket.id].name = name;
      console.log(`${name} joined`);
      io.emit('current-users', users);
    }
  });

  socket.on('move', (roomName) => {
    if (users[socket.id] && users[socket.id].isAuthenticated && users[socket.id].name) {
      users[socket.id].room = roomName;
      console.log(`${users[socket.id].name} moved to ${roomName}`);
      io.emit('current-users', users);
    }
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const name = users[socket.id].name;
      if (name) console.log(`${name} disconnected`);
      delete users[socket.id];
      io.emit('current-users', users);
    }
  });
});

// Handle React routing, return all requests to React app
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../client/dist/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).send('Front-end files not found. Make sure build is successful.');
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
});

const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const realtimeHub = require('./realtime');
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

// Initialize WebSockets
realtimeHub.initialize(server);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static frontend
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Public share route support
app.get('/share/:token', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// SPA fallback (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`  KURO SYNC PLATFORM SERVER IS RUNNING`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://0.0.0.0:${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`===============================================`);
});

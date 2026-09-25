const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('../database');
const { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  authMiddleware, 
  detectDeviceInfo,
  generatePairingCode 
} = require('../auth');
const realtimeHub = require('../realtime');

// Register
router.post('/register', (req, res) => {
  try {
    const { email, password, name, deviceName, deviceType } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const userName = name || email.split('@')[0];

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, storage_quota)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, email.toLowerCase().trim(), passwordHash, userName, 20 * 1024 * 1024 * 1024);

    // Register initial device
    const detected = detectDeviceInfo(req.headers['user-agent']);
    const deviceId = crypto.randomUUID();
    const finalDeviceName = deviceName || detected.name;
    const finalDeviceType = deviceType || detected.type;

    db.prepare(`
      INSERT INTO devices (id, user_id, name, type, os, browser, is_online)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(deviceId, userId, finalDeviceName, finalDeviceType, detected.os, detected.browser);

    const token = generateToken({ id: userId, email: email.toLowerCase().trim(), deviceId });

    res.json({
      success: true,
      token,
      user: { id: userId, email: email.toLowerCase().trim(), name: userName },
      device: { id: deviceId, name: finalDeviceName, type: finalDeviceType }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password, deviceName, deviceType } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user || !comparePassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Register or update device
    const detected = detectDeviceInfo(req.headers['user-agent']);
    const deviceId = crypto.randomUUID();
    const finalDeviceName = deviceName || detected.name;
    const finalDeviceType = deviceType || detected.type;

    db.prepare(`
      INSERT INTO devices (id, user_id, name, type, os, browser, is_online, last_active)
      VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).run(deviceId, user.id, finalDeviceName, finalDeviceType, detected.os, detected.browser);

    const token = generateToken({ id: user.id, email: user.email, deviceId });

    // Notify other devices
    realtimeHub.broadcastToUser(user.id, {
      type: 'DEVICE_JOINED',
      device: { id: deviceId, name: finalDeviceName, type: finalDeviceType, isOnline: true }
    });

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, storage_used: user.storage_used, storage_quota: user.storage_quota },
      device: { id: deviceId, name: finalDeviceName, type: finalDeviceType }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// One-click Instant Workspace (for quick testing/demo on any device)
router.post('/instant-demo', (req, res) => {
  try {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const email = `demo_${randomSuffix}@kurosync.id.ly`;
    const password = `demo_${Date.now()}`;
    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const userName = `Kuro User ${randomSuffix}`;

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, storage_quota)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, email, passwordHash, userName, 20 * 1024 * 1024 * 1024);

    const detected = detectDeviceInfo(req.headers['user-agent']);
    const deviceId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO devices (id, user_id, name, type, os, browser, is_online)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(deviceId, userId, detected.name, detected.type, detected.os, detected.browser);

    const token = generateToken({ id: userId, email, deviceId });

    res.json({
      success: true,
      token,
      user: { id: userId, email, name: userName, storage_used: 0, storage_quota: 20 * 1024 * 1024 * 1024 },
      device: { id: deviceId, name: detected.name, type: detected.type }
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not create instant workspace: ' + err.message });
  }
});

// Get Current User Profile & Devices
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, name, storage_used, storage_quota, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentDeviceId = req.user.deviceId;
    const devices = db.prepare(`
      SELECT id, name, type, os, browser, is_online, last_active, created_at,
             (id = ?) as is_current
      FROM devices 
      WHERE user_id = ? 
      ORDER BY is_online DESC, last_active DESC
    `).all(currentDeviceId, req.user.id);

    res.json({ user, devices, currentDeviceId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate Device Pairing Code & QR (called from authenticated device)
router.post('/pairing/generate', authMiddleware, async (req, res) => {
  try {
    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Delete any existing codes for this user
    db.prepare('DELETE FROM pairing_codes WHERE user_id = ?').run(req.user.id);

    db.prepare(`
      INSERT INTO pairing_codes (code, user_id, device_name, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(code, req.user.id, 'New Device', expiresAt);

    // Generate pairing URL and QR Data URL
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const pairingUrl = `${protocol}://${host}/?pair=${code}`;
    const qrDataUrl = await QRCode.toDataURL(pairingUrl, {
      margin: 1,
      color: {
        dark: '#7D1D2D',
        light: '#FFFFFF'
      },
      width: 280
    });

    res.json({
      success: true,
      code,
      pairingUrl,
      qrDataUrl,
      expiresAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate pairing code: ' + err.message });
  }
});

// Claim Pairing Code (called from unauthenticated new device e.g. iPad or phone)
router.post('/pairing/claim', (req, res) => {
  try {
    const { code, deviceName, deviceType } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Pairing code is required' });
    }

    const record = db.prepare(`
      SELECT * FROM pairing_codes 
      WHERE code = ? AND expires_at > CURRENT_TIMESTAMP
    `).get(code.toUpperCase().trim());

    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired pairing code' });
    }

    const user = db.prepare('SELECT id, email, name, storage_used, storage_quota FROM users WHERE id = ?').get(record.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    // Register the new device
    const detected = detectDeviceInfo(req.headers['user-agent']);
    const deviceId = crypto.randomUUID();
    const finalDeviceName = deviceName || detected.name;
    const finalDeviceType = deviceType || detected.type;

    db.prepare(`
      INSERT INTO devices (id, user_id, name, type, os, browser, is_online, last_active)
      VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).run(deviceId, user.id, finalDeviceName, finalDeviceType, detected.os, detected.browser);

    // Consume pairing code
    db.prepare('DELETE FROM pairing_codes WHERE code = ?').run(code);

    const token = generateToken({ id: user.id, email: user.email, deviceId });

    // Notify other devices
    realtimeHub.broadcastToUser(user.id, {
      type: 'DEVICE_JOINED',
      device: { id: deviceId, name: finalDeviceName, type: finalDeviceType, isOnline: true }
    });

    res.json({
      success: true,
      token,
      user,
      device: { id: deviceId, name: finalDeviceName, type: finalDeviceType }
    });
  } catch (err) {
    res.status(500).json({ error: 'Pairing failed: ' + err.message });
  }
});

// List Devices
router.get('/devices', authMiddleware, (req, res) => {
  try {
    const currentDeviceId = req.user.deviceId;
    const devices = db.prepare(`
      SELECT id, name, type, os, browser, is_online, last_active, created_at,
             (id = ?) as is_current
      FROM devices 
      WHERE user_id = ? 
      ORDER BY is_online DESC, last_active DESC
    `).all(currentDeviceId, req.user.id);

    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Device (Rename)
router.patch('/devices/:id', authMiddleware, (req, res) => {
  try {
    const { name, type } = req.body;
    db.prepare(`
      UPDATE devices 
      SET name = COALESCE(?, name), type = COALESCE(?, type)
      WHERE id = ? AND user_id = ?
    `).run(name, type, req.params.id, req.user.id);

    realtimeHub.broadcastToUser(req.user.id, {
      type: 'DEVICE_STATUS',
      deviceId: req.params.id,
      name,
      type
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disconnect / Remove Device
router.delete('/devices/:id', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM devices WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);

    realtimeHub.broadcastToUser(req.user.id, {
      type: 'DEVICE_LEFT',
      deviceId: req.params.id
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

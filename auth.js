const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'kuro-sync-super-secret-key-2026-safe-cross-device';
const TOKEN_EXPIRY = '30d';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Express Auth Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  req.user = decoded;
  next();
}

// Detect device info from User-Agent
function detectDeviceInfo(userAgent = '') {
  const ua = userAgent.toLowerCase();
  let type = 'desktop';
  let name = 'Web Device';
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  // Detect OS & Type
  if (ua.includes('ipad')) {
    type = 'ipad';
    name = 'iPad Pro';
    os = 'iPadOS';
  } else if (ua.includes('iphone')) {
    type = 'phone';
    name = 'iPhone';
    os = 'iOS';
  } else if (ua.includes('android')) {
    if (ua.includes('tablet') || ua.includes('pad')) {
      type = 'tablet';
      name = 'Android Tablet';
    } else {
      type = 'phone';
      name = 'Android Phone';
    }
    os = 'Android';
  } else if (ua.includes('macintosh') || ua.includes('mac os')) {
    // Check if it's an iPad posing as Mac (Safari on iPadOS 13+)
    if (ua.includes('mobile')) {
      type = 'ipad';
      name = 'iPad';
      os = 'iPadOS';
    } else {
      type = 'laptop';
      name = 'MacBook Pro';
      os = 'macOS';
    }
  } else if (ua.includes('windows')) {
    type = 'laptop';
    name = 'Windows Laptop';
    os = 'Windows 11';
  } else if (ua.includes('linux')) {
    type = 'desktop';
    name = 'Linux PC';
    os = 'Linux';
  }

  // Detect Browser
  if (ua.includes('edg/')) {
    browser = 'Edge';
  } else if (ua.includes('chrome/') && !ua.includes('edg/')) {
    browser = 'Chrome';
  } else if (ua.includes('safari/') && !ua.includes('chrome/')) {
    browser = 'Safari';
  } else if (ua.includes('firefox/')) {
    browser = 'Firefox';
  }

  return { type, name, os, browser };
}

// Generate human-friendly 6-character pairing code
function generatePairingCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  authMiddleware,
  detectDeviceInfo,
  generatePairingCode
};

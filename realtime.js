const WebSocket = require('ws');
const { verifyToken } = require('./auth');
const db = require('./database');

class RealtimeHub {
  constructor() {
    // Map: userId -> Set of WebSocket clients
    this.userClients = new Map();
    this.heartbeatInterval = null;
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Device presence cleanup every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.checkPresence();
    }, 30000);
  }

  handleConnection(ws, req) {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const deviceId = url.searchParams.get('deviceId');

    if (!token) {
      ws.close(4001, 'Token required');
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      ws.close(4002, 'Invalid token');
      return;
    }

    const userId = decoded.id;
    ws.userId = userId;
    ws.deviceId = deviceId || decoded.deviceId;

    // Register client
    if (!this.userClients.has(userId)) {
      this.userClients.set(userId, new Set());
    }
    this.userClients.get(userId).add(ws);

    // Update device status in database to online
    if (ws.deviceId) {
      try {
        db.prepare(`
          UPDATE devices 
          SET is_online = 1, last_active = CURRENT_TIMESTAMP 
          WHERE id = ? AND user_id = ?
        `).run(ws.deviceId, userId);

        // Notify user's other devices about presence
        this.broadcastToUser(userId, {
          type: 'DEVICE_STATUS',
          deviceId: ws.deviceId,
          isOnline: true,
          lastActive: new Date().toISOString()
        }, ws);
      } catch (err) {
        console.error('Error updating device presence:', err);
      }
    }

    // Send initial ACK
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Kuro Sync Realtime Gateway Connected',
      timestamp: Date.now()
    }));

    // Handle incoming messages (e.g. heartbeat or client action)
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleClientMessage(ws, data);
      } catch (e) {
        // ignore malformed message
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      const clients = this.userClients.get(userId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          this.userClients.delete(userId);
        }
      }

      // Check if this device has other open tabs
      let hasOtherDeviceTabs = false;
      if (clients && ws.deviceId) {
        for (const client of clients) {
          if (client.deviceId === ws.deviceId && client.readyState === WebSocket.OPEN) {
            hasOtherDeviceTabs = true;
            break;
          }
        }
      }

      if (!hasOtherDeviceTabs && ws.deviceId) {
        try {
          db.prepare(`
            UPDATE devices 
            SET is_online = 0, last_active = CURRENT_TIMESTAMP 
            WHERE id = ? AND user_id = ?
          `).run(ws.deviceId, userId);

          this.broadcastToUser(userId, {
            type: 'DEVICE_STATUS',
            deviceId: ws.deviceId,
            isOnline: false,
            lastActive: new Date().toISOString()
          });
        } catch (err) {
          console.error('Error updating device offline status:', err);
        }
      }
    });

    ws.on('error', (err) => {
      console.warn('WebSocket error on client:', err.message);
    });
  }

  handleClientMessage(ws, data) {
    if (data.type === 'PING') {
      ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      if (ws.deviceId) {
        db.prepare(`UPDATE devices SET last_active = CURRENT_TIMESTAMP WHERE id = ?`).run(ws.deviceId);
      }
    } else if (data.type === 'DEVICE_PING') {
      if (ws.deviceId) {
        db.prepare(`UPDATE devices SET last_active = CURRENT_TIMESTAMP, is_online = 1 WHERE id = ?`).run(ws.deviceId);
      }
    }
  }

  // Broadcast an event to all connected devices of a specific user
  broadcastToUser(userId, event, excludeWs = null) {
    const clients = this.userClients.get(userId);
    if (!clients || clients.size === 0) return;

    const payload = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        client.send(payload);
      }
    }
  }

  // Check and purge inactive devices
  checkPresence() {
    try {
      // Mark devices inactive if no ping in 2 minutes
      db.prepare(`
        UPDATE devices 
        SET is_online = 0 
        WHERE is_online = 1 AND (strftime('%s', 'now') - strftime('%s', last_active)) > 120
      `).run();
    } catch (e) {
      // ignore
    }
  }
}

const realtimeHub = new RealtimeHub();
module.exports = realtimeHub;

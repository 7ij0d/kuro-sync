// ==========================================================
// KURO SYNC CLIENT REALTIME ENGINE
// ==========================================================

class RealtimeClient {
  constructor() {
    this.ws = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.status = 'offline'; // 'synced', 'syncing', 'offline'
  }

  connect() {
    const token = window.api ? window.api.getToken() : null;
    const deviceId = window.api ? window.api.getDeviceId() : null;

    if (!token) return;

    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(deviceId || '')}`;

    this.setStatus('syncing');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('synced');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (e) {
          console.warn('Realtime parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('offline');
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.setStatus('offline');
      };
    } catch (err) {
      this.setStatus('offline');
      this.scheduleReconnect();
    }
  }

  handleEvent(event) {
    // Briefly show "syncing..." dot then back to "synced"
    this.setStatus('syncing');
    setTimeout(() => this.setStatus('synced'), 600);

    // Dispatch global event for listeners
    window.dispatchEvent(new CustomEvent('kuro_realtime_event', { detail: event }));
  }

  setStatus(newStatus) {
    this.status = newStatus;
    const indicator = document.getElementById('realtime-indicator');
    const indicatorText = document.getElementById('realtime-indicator-text');
    const dot = document.getElementById('realtime-pulse-dot');

    if (!indicator || !indicatorText || !dot) return;

    const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;

    dot.className = 'pulse-dot';
    if (newStatus === 'synced') {
      indicatorText.textContent = t('syncedAll');
    } else if (newStatus === 'syncing') {
      dot.classList.add('syncing');
      indicatorText.textContent = t('syncing');
    } else {
      dot.classList.add('offline');
      indicatorText.textContent = t('offline');
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 25000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (window.api && window.api.getToken()) {
        this.connect();
      }
    }, 4000);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.setStatus('offline');
  }
}

const realtime = new RealtimeClient();
window.realtime = realtime;

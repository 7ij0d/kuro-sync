// ==========================================================
// KURO SYNC CLIENT API SERVICE
// ==========================================================

const api = {
  getToken() {
    return localStorage.getItem('kuro_sync_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('kuro_sync_token', token);
    } else {
      localStorage.removeItem('kuro_sync_token');
    }
  },

  getDeviceId() {
    return localStorage.getItem('kuro_sync_device_id');
  },

  setDeviceId(id) {
    if (id) {
      localStorage.setItem('kuro_sync_device_id', id);
    } else {
      localStorage.removeItem('kuro_sync_device_id');
    }
  },

  async request(url, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      // Token expired or invalid
      this.setToken(null);
      window.dispatchEvent(new CustomEvent('auth_required'));
      throw new Error('Unauthorized');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.error || 'Request failed');
      err.data = data;
      err.status = response.status;
      throw err;
    }

    return data;
  },

  // Auth & Devices
  async login(email, password, deviceName) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, deviceName })
    });
    this.setToken(res.token);
    this.setDeviceId(res.device.id);
    return res;
  },

  async register(data) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.token);
    this.setDeviceId(res.device.id);
    return res;
  },

  async instantDemo() {
    const res = await this.request('/api/auth/instant-demo', {
      method: 'POST'
    });
    this.setToken(res.token);
    this.setDeviceId(res.device.id);
    return res;
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async generatePairing() {
    return this.request('/api/auth/pairing/generate', { method: 'POST' });
  },

  async claimPairing(code) {
    const res = await this.request('/api/auth/pairing/claim', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
    this.setToken(res.token);
    this.setDeviceId(res.device.id);
    return res;
  },

  async getDevices() {
    return this.request('/api/auth/devices');
  },

  async updateDevice(id, data) {
    return this.request(`/api/auth/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async removeDevice(id) {
    return this.request(`/api/auth/devices/${id}`, {
      method: 'DELETE'
    });
  },

  // Items
  async getItems(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/items?${query}`);
  },

  async createTextItem(data, force = false) {
    return this.request(`/api/items/text${force ? '?force=true' : ''}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async uploadFile(file, folderId = null, force = false) {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folder_id', folderId);

    const token = this.getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`/api/items/upload${force ? '?force=true' : ''}`, {
      method: 'POST',
      headers,
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.error || 'Upload failed');
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data;
  },

  async saveLink(data) {
    return this.request('/api/items/link', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateItem(id, data) {
    return this.request(`/api/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async deleteItem(id) {
    return this.request(`/api/items/${id}`, {
      method: 'DELETE'
    });
  },

  async restoreItem(id) {
    return this.request(`/api/items/${id}/restore`, {
      method: 'POST'
    });
  },

  async permanentDeleteItem(id) {
    return this.request(`/api/items/${id}/permanent`, {
      method: 'DELETE'
    });
  },

  async emptyTrash() {
    return this.request('/api/items/trash/empty', {
      method: 'POST'
    });
  },

  // Folders
  async getFolders() {
    return this.request('/api/folders');
  },

  async createFolder(name) {
    return this.request('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  async deleteFolder(id) {
    return this.request(`/api/folders/${id}`, {
      method: 'DELETE'
    });
  },

  // Shares
  async createShare(itemId, expiryHours = 24) {
    return this.request('/api/shares', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId, expiry_hours: expiryHours })
    });
  },

  async getShareData(token) {
    return fetch(`/api/shares/${token}`).then(r => r.json());
  },

  // Sample Pack for testing visual reference items
  async loadSamplePack() {
    return this.request('/api/demo/sample-pack', {
      method: 'POST'
    });
  }
};

window.api = api;

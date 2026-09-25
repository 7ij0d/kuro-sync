// ==========================================================
// KURO SYNC CLIENT API SERVICE (DUAL MODE: CLOUD & GITHUB PAGES)
// ==========================================================

// Client-side fallback store for static hosting (e.g. GitHub Pages)
const LocalKuroStore = {
  get(key, defaultVal) {
    try {
      const v = localStorage.getItem('kuro_local_' + key);
      return v ? JSON.parse(v) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem('kuro_local_' + key, JSON.stringify(val));
    } catch (e) {}
  },
  getItems() {
    return this.get('items', []);
  },
  saveItems(items) {
    this.set('items', items);
  },
  getFolders() {
    return this.get('folders', [
      { id: 'f-dental', name: 'Dental Study', item_count: 0 },
      { id: 'f-pathology', name: 'Pathology', item_count: 0 }
    ]);
  }
};

const api = {
  isStaticHost: window.location.hostname.endsWith('github.io'),

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
    return localStorage.getItem('kuro_sync_device_id') || 'dev-local';
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

    try {
      const response = await fetch(url, { ...options, headers });
      
      if (response.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth_required'));
        throw new Error('Unauthorized');
      }

      if (response.status === 404 && this.isStaticHost) {
        throw new Error('StaticHostFallback');
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err = new Error(data.error || 'Request failed');
        err.data = data;
        err.status = response.status;
        throw err;
      }

      return data;
    } catch (err) {
      if (this.isStaticHost || err.message === 'Failed to fetch' || err.message === 'StaticHostFallback') {
        return this.handleStaticFallback(url, options);
      }
      throw err;
    }
  },

  // Fallback for GitHub Pages
  async handleStaticFallback(url, options) {
    const method = (options.method || 'GET').toUpperCase();
    const u = new URL(url, window.location.origin);
    const pathname = u.pathname;

    // 1. Auth Me
    if (pathname.includes('/auth/me')) {
      return {
        user: { id: 'u-local', email: 'student@kurosync.com', name: 'Kuro Student', storage_used: 4200000, storage_quota: 21474836480 },
        devices: [
          { id: 'dev-1', name: 'iPad Pro', type: 'ipad', is_online: 1, is_current: false, last_active: new Date().toISOString() },
          { id: 'dev-2', name: 'Windows Laptop', type: 'laptop', is_online: 1, is_current: true, last_active: new Date().toISOString() },
          { id: 'dev-3', name: 'iPhone 15', type: 'phone', is_online: 0, is_current: false, last_active: new Date(Date.now() - 300000).toISOString() }
        ],
        currentDeviceId: 'dev-2'
      };
    }

    // 2. Instant Demo / Login
    if (pathname.includes('/auth/login') || pathname.includes('/auth/register') || pathname.includes('/auth/instant-demo')) {
      const token = 'ghp-mock-token-' + Date.now();
      this.setToken(token);
      this.setDeviceId('dev-2');
      return {
        success: true,
        token,
        user: { id: 'u-local', name: 'Kuro Student', email: 'student@kurosync.com' },
        device: { id: 'dev-2', name: 'Web Device', type: 'laptop' }
      };
    }

    // 3. Devices
    if (pathname.includes('/auth/devices')) {
      return [
        { id: 'dev-1', name: 'iPad Pro', type: 'ipad', is_online: 1, is_current: false, last_active: new Date().toISOString() },
        { id: 'dev-2', name: 'Windows Laptop', type: 'laptop', is_online: 1, is_current: true, last_active: new Date().toISOString() },
        { id: 'dev-3', name: 'iPhone 15', type: 'phone', is_online: 0, is_current: false, last_active: new Date(Date.now() - 300000).toISOString() }
      ];
    }

    // 4. Pairing Generate
    if (pathname.includes('/auth/pairing/generate')) {
      return {
        code: 'K-9824',
        pairingUrl: window.location.origin + window.location.pathname + '?pair=K-9824',
        qrDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="%23fff" width="200" height="200"/><rect fill="%237d1d2d" x="20" y="20" width="50" height="50"/><rect fill="%237d1d2d" x="130" y="20" width="50" height="50"/><rect fill="%237d1d2d" x="20" y="130" width="50" height="50"/><text x="100" y="105" text-anchor="middle" fill="%237d1d2d" font-family="sans-serif" font-weight="bold" font-size="14">KURO SYNC</text></svg>'
      };
    }

    // 5. Items List
    if (pathname.endsWith('/items') && method === 'GET') {
      const items = LocalKuroStore.getItems();
      const trash = u.searchParams.get('trash') === '1';
      const type = u.searchParams.get('type');
      const filtered = items.filter(i => {
        if (trash) return i.deleted_at !== null;
        if (i.deleted_at !== null) return false;
        if (type && type !== 'all' && i.type !== type) return false;
        return true;
      });

      return {
        items: filtered,
        counts: {
          all: items.filter(i => i.deleted_at === null).length,
          text: items.filter(i => i.type === 'text' && i.deleted_at === null).length,
          images: items.filter(i => i.type === 'image' && i.deleted_at === null).length,
          files: items.filter(i => i.type === 'file' && i.deleted_at === null).length,
          links: items.filter(i => i.type === 'link' && i.deleted_at === null).length,
          clipboard: items.filter(i => i.type === 'clipboard' && i.deleted_at === null).length,
          favorites: items.filter(i => i.is_favorite && i.deleted_at === null).length,
          trash: items.filter(i => i.deleted_at !== null).length
        },
        storage: { used: 4200000, quota: 21474836480 }
      };
    }

    // 6. Text / Note Create
    if (pathname.includes('/items/text') && method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      const newItem = {
        id: 'item-' + Date.now(),
        type: body.type || 'text',
        title: body.title || 'Note',
        content: body.content || '',
        is_favorite: body.is_favorite ? 1 : 0,
        device_name: 'iPad Pro',
        device_type: 'ipad',
        created_at: new Date().toISOString(),
        deleted_at: null
      };
      const items = LocalKuroStore.getItems();
      items.unshift(newItem);
      LocalKuroStore.saveItems(items);
      return { success: true, item: newItem };
    }

    // 7. Save Link
    if (pathname.includes('/items/link') && method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      const newItem = {
        id: 'link-' + Date.now(),
        type: 'link',
        title: body.title || body.url,
        content: body.url,
        device_name: 'iPad Pro',
        device_type: 'ipad',
        created_at: new Date().toISOString(),
        deleted_at: null
      };
      const items = LocalKuroStore.getItems();
      items.unshift(newItem);
      LocalKuroStore.saveItems(items);
      return { success: true, item: newItem };
    }

    // 8. Delete / Restore
    if (pathname.includes('/items/') && method === 'DELETE') {
      const id = pathname.split('/').pop();
      const items = LocalKuroStore.getItems();
      const item = items.find(i => i.id === id);
      if (item) item.deleted_at = new Date().toISOString();
      LocalKuroStore.saveItems(items);
      return { success: true };
    }

    if (pathname.includes('/restore') && method === 'POST') {
      const id = pathname.split('/')[2];
      const items = LocalKuroStore.getItems();
      const item = items.find(i => i.id === id);
      if (item) item.deleted_at = null;
      LocalKuroStore.saveItems(items);
      return { success: true };
    }

    // 9. Folders
    if (pathname.includes('/folders')) {
      return LocalKuroStore.getFolders();
    }

    // 10. Sample Pack
    if (pathname.includes('/demo/sample-pack')) {
      const samples = [
        {
          id: 'sp-1',
          type: 'image',
          title: 'Tooth development - Bell stage',
          content: 'Key points:\n- Enamel organ\n- Dental papilla\n- Dental follicle\n- Stellate reticulum',
          file_name: 'tooth_bell_stage.svg',
          file_path: './assets/samples/histology_bell_stage.svg',
          file_size: 1024 * 780,
          device_name: 'iPad Pro',
          device_type: 'ipad',
          created_at: new Date().toISOString(),
          deleted_at: null
        },
        {
          id: 'sp-2',
          type: 'file',
          title: 'Pathology.pdf',
          file_name: 'Pathology.pdf',
          file_path: './assets/samples/Pathology.pdf',
          file_size: 2.4 * 1024 * 1024,
          device_name: 'iPad Pro',
          device_type: 'ipad',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          deleted_at: null
        },
        {
          id: 'sp-3',
          type: 'text',
          title: 'Operative Dentistry Notes',
          content: 'Cavity preparation principles:\n1. Retention form\n2. Resistance form\n3. Convenience form\n4. Removal of remaining carious dentin\n5. Finishing enamel walls\n6. Cleaning the cavity',
          file_size: 180,
          device_name: 'iPad Pro',
          device_type: 'ipad',
          created_at: new Date(Date.now() - 7200000).toISOString(),
          deleted_at: null
        },
        {
          id: 'sp-4',
          type: 'image',
          title: 'IMG_3287.jpg',
          file_name: 'IMG_3287.jpg',
          file_path: './assets/samples/notebook_notes.svg',
          file_size: 1.8 * 1024 * 1024,
          device_name: 'iPad Pro',
          device_type: 'ipad',
          created_at: new Date(Date.now() - 10800000).toISOString(),
          deleted_at: null
        }
      ];
      LocalKuroStore.saveItems(samples);
      return { success: true, count: 4 };
    }

    return { success: true };
  },

  // Auth & Devices
  async login(email, password, deviceName) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, deviceName })
    });
    this.setToken(res.token);
    this.setDeviceId(res.device ? res.device.id : 'dev-2');
    return res;
  },

  async register(data) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.token);
    this.setDeviceId(res.device ? res.device.id : 'dev-2');
    return res;
  },

  async instantDemo() {
    const res = await this.request('/api/auth/instant-demo', {
      method: 'POST'
    });
    this.setToken(res.token);
    this.setDeviceId(res.device ? res.device.id : 'dev-2');
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
    this.setDeviceId(res.device ? res.device.id : 'dev-2');
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
    if (this.isStaticHost) {
      // Store local base64 on GitHub Pages
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const isImg = file.type.startsWith('image/');
          const newItem = {
            id: 'upload-' + Date.now(),
            type: isImg ? 'image' : 'file',
            title: file.name,
            file_name: file.name,
            file_path: reader.result,
            file_size: file.size,
            device_name: 'iPad Pro',
            device_type: 'ipad',
            created_at: new Date().toISOString(),
            deleted_at: null
          };
          const items = LocalKuroStore.getItems();
          items.unshift(newItem);
          LocalKuroStore.saveItems(items);
          resolve({ success: true, item: newItem });
        };
        reader.readAsDataURL(file);
      });
    }

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

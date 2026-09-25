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
    const raw = localStorage.getItem('kuro_local_items');
    if (raw === null) {
      const defaultItems = [
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
          deleted_at: null,
          is_favorite: 1
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
          deleted_at: null,
          is_favorite: 0
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
          deleted_at: null,
          is_favorite: 1
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
          deleted_at: null,
          is_favorite: 0
        }
      ];
      this.saveItems(defaultItems);
      return defaultItems;
    }
    try {
      return JSON.parse(raw) || [];
    } catch (e) {
      return [];
    }
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
    if (this.isStaticHost) {
      return this.handleStaticFallback(url, options);
    }

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

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err = new Error(data.error || 'Request failed');
        err.data = data;
        err.status = response.status;
        throw err;
      }

      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        return this.handleStaticFallback(url, options);
      }
      throw err;
    }
  },

  // Fallback for GitHub Pages / Static Hosting
  async handleStaticFallback(url, options = {}) {
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

    // 2. Instant Demo / Login / Register
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

    // 5. Permanent Delete: DELETE .../items/:id/permanent
    if (pathname.includes('/permanent') && method === 'DELETE') {
      const match = pathname.match(/\/items\/([^/]+)\/permanent/);
      const id = match ? match[1] : pathname.split('/').filter(Boolean).slice(-2)[0];
      if (window.KuroSupabase && window.KuroSupabase.isConfigured()) {
        try { return await window.KuroSupabase.permanentDeleteItem(id); } catch (e) { console.warn('Supabase permanent delete error:', e); }
      }
      let items = LocalKuroStore.getItems();
      items = items.filter(i => String(i.id) !== String(id));
      LocalKuroStore.saveItems(items);
      return { success: true };
    }

    // 6. Empty Trash: POST .../trash/empty
    if (pathname.includes('/trash/empty') && method === 'POST') {
      if (window.KuroSupabase && window.KuroSupabase.isConfigured()) {
        try { return await window.KuroSupabase.emptyTrash(); } catch (e) { console.warn('Supabase empty trash error:', e); }
      }
      let items = LocalKuroStore.getItems();
      items = items.filter(i => !i.deleted_at);
      LocalKuroStore.saveItems(items);
      return { success: true };
    }

    // 7. Restore: POST .../items/:id/restore
    if (pathname.includes('/restore') && method === 'POST') {
      const match = pathname.match(/\/items\/([^/]+)\/restore/);
      const id = match ? match[1] : null;
      if (window.KuroSupabase && window.KuroSupabase.isConfigured() && id) {
        try { return await window.KuroSupabase.restoreItem(id); } catch (e) { console.warn('Supabase restore error:', e); }
      }
      if (id) {
        const items = LocalKuroStore.getItems();
        const item = items.find(i => String(i.id) === String(id));
        if (item) item.deleted_at = null;
        LocalKuroStore.saveItems(items);
      }
      return { success: true };
    }

    // 8. Soft Delete: DELETE .../items/:id
    if (method === 'DELETE' && pathname.includes('/items/')) {
      const match = pathname.match(/\/items\/([^/]+)$/);
      const id = match ? match[1] : pathname.split('/').filter(Boolean).pop();
      if (window.KuroSupabase && window.KuroSupabase.isConfigured() && id) {
        try { return await window.KuroSupabase.deleteItem(id); } catch (e) { console.warn('Supabase delete error:', e); }
      }
      const items = LocalKuroStore.getItems();
      const item = items.find(i => String(i.id) === String(id));
      if (item) {
        item.deleted_at = new Date().toISOString();
        LocalKuroStore.saveItems(items);
      } else {
        const updated = items.filter(i => String(i.id) !== String(id));
        LocalKuroStore.saveItems(updated);
      }
      return { success: true };
    }

    // 9. Update Item: PATCH .../items/:id
    if (method === 'PATCH' && pathname.includes('/items/')) {
      const match = pathname.match(/\/items\/([^/]+)$/);
      const id = match ? match[1] : pathname.split('/').filter(Boolean).pop();
      const body = JSON.parse(options.body || '{}');
      if (window.KuroSupabase && window.KuroSupabase.isConfigured() && id) {
        try { return await window.KuroSupabase.updateItem(id, body); } catch (e) { console.warn('Supabase update error:', e); }
      }
      const items = LocalKuroStore.getItems();
      const item = items.find(i => String(i.id) === String(id));
      if (item) {
        Object.assign(item, body);
        item.updated_at = new Date().toISOString();
        LocalKuroStore.saveItems(items);
        return { success: true, item };
      }
      return { success: true };
    }

    // 10. Items List: GET .../items
    if (pathname.includes('/items') && method === 'GET') {
      if (window.KuroSupabase && window.KuroSupabase.isConfigured()) {
        try {
          const params = Object.fromEntries(u.searchParams.entries());
          return await window.KuroSupabase.getItems(params);
        } catch (e) {
          console.warn('Supabase getItems fallback to local:', e);
        }
      }

      const items = LocalKuroStore.getItems();
      const trash = u.searchParams.get('trash') === '1';
      const type = u.searchParams.get('type');
      const isFav = u.searchParams.get('is_favorite') === '1';
      const search = (u.searchParams.get('search') || '').toLowerCase().trim();

      const filtered = items.filter(i => {
        if (trash) {
          if (!i.deleted_at) return false;
        } else {
          if (i.deleted_at) return false;
        }
        if (isFav && !i.is_favorite) return false;
        if (type && type !== 'all' && i.type !== type) return false;
        if (search) {
          const matchTitle = (i.title || '').toLowerCase().includes(search);
          const matchContent = (i.content || '').toLowerCase().includes(search);
          const matchFile = (i.file_name || '').toLowerCase().includes(search);
          if (!matchTitle && !matchContent && !matchFile) return false;
        }
        return true;
      });

      return {
        items: filtered,
        counts: {
          all: items.filter(i => !i.deleted_at).length,
          text: items.filter(i => i.type === 'text' && !i.deleted_at).length,
          images: items.filter(i => i.type === 'image' && !i.deleted_at).length,
          files: items.filter(i => i.type === 'file' && !i.deleted_at).length,
          links: items.filter(i => i.type === 'link' && !i.deleted_at).length,
          clipboard: items.filter(i => i.type === 'clipboard' && !i.deleted_at).length,
          favorites: items.filter(i => i.is_favorite && !i.deleted_at).length,
          trash: items.filter(i => !!i.deleted_at).length
        },
        storage: { used: 4200000, quota: 21474836480 }
      };
    }

    // 11. Text / Note Create: POST .../items/text
    if (pathname.includes('/items/text') && method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      if (window.KuroSupabase && window.KuroSupabase.isConfigured()) {
        try {
          return await window.KuroSupabase.createItem(body);
        } catch (e) {
          console.warn('Supabase createTextItem fallback to local:', e);
        }
      }

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

    // 12. Save Link: POST .../items/link
    if (pathname.includes('/items/link') && method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      if (window.KuroSupabase && window.KuroSupabase.isConfigured()) {
        try {
          return await window.KuroSupabase.createItem({
            type: 'link',
            title: body.title || body.url,
            content: body.url,
            is_favorite: body.is_favorite ? 1 : 0
          });
        } catch (e) {
          console.warn('Supabase saveLink fallback to local:', e);
        }
      }

      const newItem = {
        id: 'link-' + Date.now(),
        type: 'link',
        title: body.title || body.url,
        content: body.url,
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

    // 13. Folders
    if (pathname.includes('/folders')) {
      return LocalKuroStore.getFolders();
    }

    // 14. Sample Pack
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
          deleted_at: null,
          is_favorite: 1
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
          deleted_at: null,
          is_favorite: 0
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
          deleted_at: null,
          is_favorite: 1
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
          deleted_at: null,
          is_favorite: 0
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
      // Store local base64 or upload to Supabase
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
          const isImg = file.type.startsWith('image/');
          const newItem = {
            id: 'upload-' + Date.now(),
            type: isImg ? 'image' : 'file',
            title: file.name,
            file_name: file.name,
            file_path: reader.result,
            file_size: file.size,
            mime_type: file.type,
            device_name: 'Web Device',
            device_type: 'laptop',
            created_at: new Date().toISOString(),
            deleted_at: null
          };

          if (window.KuroSupabase && window.KuroSupabase.isConfigured()) {
            try {
              const res = await window.KuroSupabase.createItem(newItem);
              resolve(res);
              return;
            } catch (e) {
              console.warn('Supabase upload fallback:', e);
            }
          }

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

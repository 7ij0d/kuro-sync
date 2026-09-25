// ==========================================================
// KURO SYNC SUPABASE CLOUD REST CLIENT (ZERO-DEPENDENCY)
// Enables cross-device shared cloud persistence via Supabase
// Works out of the box with Kuro Fangs Supabase project!
// ==========================================================

const KuroSupabase = {
  getUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramUrl = urlParams.get('sbUrl');
    if (paramUrl) {
      try { localStorage.setItem('kuro_supabase_url', paramUrl); } catch (e) {}
      return paramUrl;
    }
    let stored = '';
    try { stored = localStorage.getItem('kuro_supabase_url') || ''; } catch (e) {}
    return stored || (window.KURO_CONFIG && window.KURO_CONFIG.SUPABASE_URL) || 'https://vqrpodmnzubpcsvqohwj.supabase.co';
  },

  getKey() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramKey = urlParams.get('sbKey');
    if (paramKey) {
      try { localStorage.setItem('kuro_supabase_key', paramKey); } catch (e) {}
      return paramKey;
    }
    let stored = '';
    try { stored = localStorage.getItem('kuro_supabase_key') || ''; } catch (e) {}
    return stored || (window.KURO_CONFIG && window.KURO_CONFIG.SUPABASE_ANON_KEY) || 'sb_publishable_bISG70YeoKP4mu8BKlgsuQ_xPprjcc1';
  },

  setConfig(url, key) {
    try {
      if (url) localStorage.setItem('kuro_supabase_url', url.trim().replace(/\/+$/, ''));
      else localStorage.removeItem('kuro_supabase_url');

      if (key) localStorage.setItem('kuro_supabase_key', key.trim());
      else localStorage.removeItem('kuro_supabase_key');
    } catch (e) {}
  },

  isConfigured() {
    const u = this.getUrl();
    const k = this.getKey();
    return Boolean(u && k && u.startsWith('http') && !u.includes('YOUR_'));
  },

  async request(path, options = {}) {
    const baseUrl = this.getUrl().replace(/\/+$/, '');
    const url = `${baseUrl}/rest/v1${path}`;
    const key = this.getKey();
    const headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      const errorObj = new Error(err.message || 'Supabase request failed');
      errorObj.status = res.status;
      errorObj.code = err.code;
      throw errorObj;
    }
    return res.json().catch(() => ({}));
  },

  async testConnection() {
    if (!this.isConfigured()) return { success: false, error: 'يرجى إدخال الرابط والمفتاح أولاً' };
    try {
      await this.request('/settings?limit=1');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  getCachedItems() {
    try {
      const raw = localStorage.getItem('kuro_cached_supabase_items');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  setCachedItems(items) {
    try {
      if (Array.isArray(items)) {
        localStorage.setItem('kuro_cached_supabase_items', JSON.stringify(items));
      }
    } catch (e) {}
  },

  // 1. Get Items
  async getItems(params = {}) {
    const isTrash = params.trash === '1';

    // Fetch all Kuro Sync items from settings table
    let rows = [];
    try {
      rows = await this.request('/settings?key=like.ks_item_*&select=*');
    } catch (err) {
      console.warn('Supabase fetch failed, trying local cache:', err);
      const cached = this.getCachedItems();
      if (cached && Array.isArray(cached)) {
        rows = cached.map(v => ({ key: 'ks_item_' + v.id, value: v }));
      } else {
        throw err;
      }
    }

    let items = (Array.isArray(rows) ? rows : []).map(r => r.value).filter(Boolean);

    // Save active items to local cache for instant SWR loading on next visit
    if (!isTrash && !params.search && (!params.type || params.type === 'all')) {
      this.setCachedItems(items.filter(i => !i.deleted_at));
    }

    // Filter by Trash vs Active
    const allActive = items.filter(i => !i.deleted_at);
    const trashItems = items.filter(i => !!i.deleted_at);

    let filtered = isTrash ? trashItems : allActive;

    // Filter by Type
    if (params.type && params.type !== 'all') {
      filtered = filtered.filter(i => i.type === params.type);
    }

    // Filter by Favorite
    if (params.is_favorite === '1') {
      filtered = filtered.filter(i => Boolean(i.is_favorite));
    }

    // Filter by Search Query
    if (params.search) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(i => {
        const title = (i.title || '').toLowerCase();
        const content = (i.content || '').toLowerCase();
        const fileName = (i.file_name || '').toLowerCase();
        return title.includes(q) || content.includes(q) || fileName.includes(q);
      });
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const totalUsed = allActive.reduce((acc, i) => acc + (i.file_size || (i.content ? i.content.length : 120)), 0);

    return {
      items: filtered,
      counts: {
        all: allActive.length,
        text: allActive.filter(i => i.type === 'text').length,
        images: allActive.filter(i => i.type === 'image').length,
        files: allActive.filter(i => i.type === 'file').length,
        links: allActive.filter(i => i.type === 'link').length,
        clipboard: allActive.filter(i => i.type === 'clipboard').length,
        favorites: allActive.filter(i => Boolean(i.is_favorite)).length,
        trash: trashItems.length
      },
      storage: {
        used: totalUsed,
        quota: 21474836480 // 20GB
      }
    };
  },

  // 2. Create Item
  async createItem(item) {
    const id = item.id || ('ks_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
    const payload = {
      id,
      type: item.type || 'text',
      title: item.title || (item.type === 'link' ? (item.content || 'Link') : 'Untitled'),
      content: item.content || '',
      file_name: item.file_name || null,
      file_path: item.file_path || null,
      file_size: item.file_size || (item.content ? item.content.length : 100),
      mime_type: item.mime_type || null,
      device_name: item.device_name || this.detectDeviceName(),
      device_type: item.device_type || this.detectDeviceType(),
      is_favorite: item.is_favorite ? 1 : 0,
      created_at: item.created_at || new Date().toISOString(),
      deleted_at: null,
      updated_at: new Date().toISOString()
    };

    await this.request('/settings', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        key: 'ks_item_' + id,
        value: payload
      })
    });

    return { success: true, item: payload };
  },

  // 3. Update Item (Optimized single round-trip with instant optimistic cache update)
  async updateItem(id, updates) {
    let current = (window.currentItems || []).find(i => String(i.id) === String(id));
    if (!current) {
      const cached = this.getCachedItems() || [];
      current = cached.find(i => String(i.id) === String(id)) || {};
    }

    if (!current || !current.id) {
      try {
        const rows = await this.request(`/settings?key=eq.ks_item_${encodeURIComponent(id)}&select=value`);
        if (Array.isArray(rows) && rows.length > 0) current = rows[0].value || {};
      } catch (e) {}
    }

    const merged = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Instant local cache update (0ms latency!)
    try {
      const cached = this.getCachedItems() || [];
      const idx = cached.findIndex(i => String(i.id) === String(id));
      if (idx !== -1) cached[idx] = merged;
      else cached.unshift(merged);
      this.setCachedItems(cached);
    } catch (e) {}

    // Direct PATCH to Supabase
    await this.request(`/settings?key=eq.ks_item_${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ value: merged })
    });

    return { success: true, item: merged };
  },

  // 4. Soft Delete (Move to Trash)
  async deleteItem(id) {
    return this.updateItem(id, { deleted_at: new Date().toISOString() });
  },

  // 5. Restore Item
  async restoreItem(id) {
    return this.updateItem(id, { deleted_at: null });
  },

  // 6. Permanent Delete
  async permanentDeleteItem(id) {
    await this.request(`/settings?key=eq.ks_item_${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return { success: true };
  },

  // 7. Empty Trash
  async emptyTrash() {
    const rows = await this.request('/settings?key=like.ks_item_*&select=key,value');
    if (!Array.isArray(rows)) return { success: true };

    const trashKeys = rows.filter(r => r.value && r.value.deleted_at).map(r => r.key);
    if (trashKeys.length === 0) return { success: true };

    for (const k of trashKeys) {
      await this.request(`/settings?key=eq.${encodeURIComponent(k)}`, {
        method: 'DELETE'
      }).catch(() => {});
    }
    return { success: true };
  },



  detectDeviceName() {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (/iPad/i.test(ua)) return 'iPad Pro';
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/Macintosh/i.test(ua)) return 'MacBook';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Android/i.test(ua)) return 'Android Device';
    return 'Web Browser';
  },

  detectDeviceType() {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (/iPad|Tablet/i.test(ua)) return 'ipad';
    if (/iPhone|Android.*Mobile/i.test(ua)) return 'phone';
    return 'laptop';
  }
};

window.KuroSupabase = KuroSupabase;

// ==========================================================
// KURO SYNC SUPABASE CLOUD REST CLIENT (ZERO-DEPENDENCY)
// Enables cross-device shared cloud persistence via Supabase
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
    return stored || (window.KURO_CONFIG && window.KURO_CONFIG.SUPABASE_URL) || '';
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
    return stored || (window.KURO_CONFIG && window.KURO_CONFIG.SUPABASE_ANON_KEY) || '';
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
      throw new Error(err.message || 'Supabase request failed');
    }
    return res.json().catch(() => ({}));
  },

  async testConnection() {
    if (!this.isConfigured()) return { success: false, error: 'يرجى إدخال الرابط والمفتاح أولاً' };
    try {
      await this.request('/items?select=id&limit=1');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // 1. Get Items
  async getItems(params = {}) {
    const isTrash = params.trash === '1';
    let query = `/items?select=*&order=created_at.desc`;
    if (isTrash) {
      query += `&deleted_at=not.is.null`;
    } else {
      query += `&deleted_at=is.null`;
    }
    if (params.type && params.type !== 'all') {
      query += `&type=eq.${encodeURIComponent(params.type)}`;
    }
    if (params.is_favorite === '1') {
      query += `&is_favorite=eq.1`;
    }
    if (params.search) {
      query += `&or=(title.ilike.*${encodeURIComponent(params.search)}*,content.ilike.*${encodeURIComponent(params.search)}*)`;
    }

    const items = await this.request(query);

    // Get count metrics for sidebar badges
    const allActive = await this.request('/items?select=id,type,is_favorite&deleted_at=is.null').catch(() => []);
    const trashItems = await this.request('/items?select=id&deleted_at=not.is.null').catch(() => []);

    return {
      items: Array.isArray(items) ? items : [],
      counts: {
        all: allActive.length,
        text: allActive.filter(i => i.type === 'text').length,
        images: allActive.filter(i => i.type === 'image').length,
        files: allActive.filter(i => i.type === 'file').length,
        links: allActive.filter(i => i.type === 'link').length,
        clipboard: allActive.filter(i => i.type === 'clipboard').length,
        favorites: allActive.filter(i => i.is_favorite).length,
        trash: trashItems.length
      },
      storage: {
        used: (Array.isArray(items) ? items : []).reduce((acc, i) => acc + (i.file_size || 0), 0),
        quota: 21474836480
      }
    };
  },

  // 2. Create Item
  async createItem(item) {
    const payload = {
      id: item.id || ('item-' + Date.now()),
      type: item.type || 'text',
      title: item.title || 'Untitled',
      content: item.content || '',
      file_name: item.file_name || null,
      file_path: item.file_path || null,
      file_size: item.file_size || 0,
      mime_type: item.mime_type || null,
      device_name: item.device_name || 'Web Device',
      device_type: item.device_type || 'laptop',
      is_favorite: item.is_favorite ? 1 : 0,
      created_at: new Date().toISOString(),
      deleted_at: null
    };

    const res = await this.request('/items', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return { success: true, item: Array.isArray(res) && res[0] ? res[0] : payload };
  },

  // 3. Update Item
  async updateItem(id, updates) {
    const res = await this.request(`/items?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    return { success: true, item: Array.isArray(res) && res[0] ? res[0] : updates };
  },

  // 4. Soft Delete (Move to Trash)
  async deleteItem(id) {
    await this.request(`/items?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ deleted_at: new Date().toISOString() })
    });
    return { success: true };
  },

  // 5. Restore
  async restoreItem(id) {
    await this.request(`/items?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ deleted_at: null })
    });
    return { success: true };
  },

  // 6. Permanent Delete
  async permanentDeleteItem(id) {
    await this.request(`/items?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return { success: true };
  },

  // 7. Empty Trash
  async emptyTrash() {
    await this.request(`/items?deleted_at=not.is.null`, {
      method: 'DELETE'
    });
    return { success: true };
  }
};

window.KuroSupabase = KuroSupabase;

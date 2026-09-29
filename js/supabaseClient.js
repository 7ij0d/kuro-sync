// ==========================================================
// KURO SYNC SUPABASE CLOUD REST & STORAGE CLIENT (EGRESS-OPTIMIZED)
// - Stores files/images/thumbnails in Supabase Storage (ZERO Base64 in DB)
// - Stores ONLY lightweight metadata in `settings`:
//   item_id, user_id, file_name, mime_type, file_size, storage_path, metadata, created_at, updated_at
// - In-memory + CacheStorage + localStorage delta sync (prevents redundant fetches)
// - Lazy on-demand loading of full files, high-res images, and long text notes
// ==========================================================

const STORAGE_BUCKET = 'pdf-sheets';
const MEDIA_CACHE_NAME = 'kuro-sync-storage-media-v1';
const blobUrlMemoryCache = new Map(); // storageUrl -> blobUrl
const fullContentMemoryCache = new Map(); // itemId -> fullText
const inflightBlobRequests = new Map();

const KuroSupabase = {
  _allItemsCache: null,
  _lastSyncTimestamp: 0,
  _syncInFlight: null,
  SYNC_TTL_MS: 30000, // 30s in-memory freshness window unless mutated

  getUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramUrl = urlParams.get('sbUrl');
    if (paramUrl) {
      try { localStorage.setItem('kuro_supabase_url', paramUrl); } catch (e) {}
      return paramUrl;
    }
    let stored = '';
    try {
      stored = localStorage.getItem('kuro_supabase_url') || '';
      if (stored && (stored.includes('vqrpodmnzubpcsvqohwj') || stored.includes('placeholder') || stored.includes('sslip.io'))) {
        localStorage.removeItem('kuro_supabase_url');
        stored = '';
      }
    } catch (e) {}
    return stored || (window.KURO_CONFIG && window.KURO_CONFIG.SUPABASE_URL) || 'https://api.kurofangs.id.ly';
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

  getPublicStorageUrl(storagePath) {
    if (!storagePath) return '';
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://') || storagePath.startsWith('blob:') || storagePath.startsWith('data:')) {
      return storagePath;
    }
    const baseUrl = this.getUrl().replace(/\/+$/, '');
    const cleanPath = storagePath.replace(/^\/+/, '');
    return `${baseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${cleanPath}`;
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
    if (res.status === 204 || options.headers?.Prefer === 'return=minimal') {
      return {};
    }
    return res.json().catch(() => ({}));
  },

  async testConnection() {
    if (!this.isConfigured()) return { success: false, error: 'يرجى إدخال الرابط والمفتاح أولاً' };
    try {
      await this.request('/settings?select=key&limit=1');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // Convert dataURL or File/Blob to binary Blob + upload to Supabase Storage
  dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(5, commaIdx);
    const mime = header.split(';')[0] || 'application/octet-stream';
    const bstr = atob(dataUrl.slice(commaIdx + 1));
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  },

  sanitizeFileName(name, mimeType = '') {
    let ext = 'bin';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('gif')) ext = 'gif';
    else if (mimeType.includes('svg')) ext = 'svg';
    else if (mimeType.includes('pdf')) ext = 'pdf';
    else if (mimeType.includes('text')) ext = 'txt';

    if (!name || typeof name !== 'string') return `file_${Date.now()}.${ext}`;
    const clean = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
    if (!clean || clean === '_' || !clean.includes('.')) {
      return `file_${Date.now()}.${ext}`;
    }
    return clean;
  },

  async uploadToStorage(storagePath, blobOrBuffer) {
    const baseUrl = this.getUrl().replace(/\/+$/, '');
    const key = this.getKey();
    const url = `${baseUrl}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/pdf',
        'cache-control': 'max-age=31536000',
        'x-upsert': 'true'
      },
      body: blobOrBuffer
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Storage upload failed (${res.status}): ${errText}`);
    }
    return this.getPublicStorageUrl(storagePath);
  },

  // Resolve a Supabase Storage URL into a browser-renderable Blob URL with CacheStorage persistence
  async resolveStorageBlobUrl(urlOrPath, mimeType = 'image/jpeg') {
    if (!urlOrPath) return '';
    if (urlOrPath.startsWith('blob:') || urlOrPath.startsWith('data:') || urlOrPath.startsWith('./') || urlOrPath.startsWith('assets')) {
      return urlOrPath;
    }

    const fullUrl = this.getPublicStorageUrl(urlOrPath);
    if (blobUrlMemoryCache.has(fullUrl)) {
      return blobUrlMemoryCache.get(fullUrl);
    }

    if (inflightBlobRequests.has(fullUrl)) {
      return inflightBlobRequests.get(fullUrl);
    }

    const promise = (async () => {
      try {
        let arrayBuffer = null;

        // 1. Check CacheStorage first (0 network egress on repeat visits)
        if ('caches' in window) {
          try {
            const cache = await caches.open(MEDIA_CACHE_NAME);
            const cachedRes = await cache.match(fullUrl);
            if (cachedRes && cachedRes.ok) {
              arrayBuffer = await cachedRes.arrayBuffer();
            }
          } catch (e) {}
        }

        // 2. Fetch from Cloudflare CDN / Supabase Storage if not in CacheStorage
        if (!arrayBuffer) {
          const res = await fetch(fullUrl, { cache: 'force-cache' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          if ('caches' in window) {
            try {
              const cache = await caches.open(MEDIA_CACHE_NAME);
              await cache.put(fullUrl, res.clone());
            } catch (e) {}
          }
          arrayBuffer = await res.arrayBuffer();
        }

        const resolvedMime = (mimeType && mimeType !== 'application/pdf' && !fullUrl.toLowerCase().endsWith('.pdf'))
          ? mimeType
          : (fullUrl.toLowerCase().endsWith('.png') ? 'image/png' : (fullUrl.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'));

        const blob = new Blob([arrayBuffer], { type: resolvedMime });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlMemoryCache.set(fullUrl, blobUrl);
        return blobUrl;
      } catch (err) {
        console.warn('[KuroSupabase] resolveStorageBlobUrl failed:', fullUrl, err);
        return fullUrl;
      } finally {
        inflightBlobRequests.delete(fullUrl);
      }
    })();

    inflightBlobRequests.set(fullUrl, promise);
    return promise;
  },

  // On-demand full content loader for items whose long text (>600 chars) is stored in Storage
  async ensureFullItemContent(item) {
    if (!item) return '';
    if (!item.content_truncated && !item.content_storage_url && !item.content_storage_path) {
      return item.content || '';
    }
    if (fullContentMemoryCache.has(item.id)) {
      item.content = fullContentMemoryCache.get(item.id);
      item.content_truncated = false;
      return item.content;
    }

    const targetUrl = item.content_storage_url || this.getPublicStorageUrl(item.content_storage_path);
    if (!targetUrl) return item.content || '';

    try {
      const res = await fetch(targetUrl, { cache: 'force-cache' });
      if (res.ok) {
        const fullText = await res.text();
        fullContentMemoryCache.set(item.id, fullText);
        item.content = fullText;
        item.content_truncated = false;
        return fullText;
      }
    } catch (err) {
      console.warn('[KuroSupabase] ensureFullItemContent error:', err);
    }
    return item.content || '';
  },

  // On-demand full high-res media loader (only called when user opens Viewer, copies image, or downloads file)
  async ensureFullItemMedia(item) {
    if (!item) return '';
    if (item._resolvedFullBlobUrl) return item._resolvedFullBlobUrl;

    const rawUrl = item.storage_url || (item.storage_path ? this.getPublicStorageUrl(item.storage_path) : '') || item.file_path;
    if (!rawUrl) return '';

    const blobUrl = await this.resolveStorageBlobUrl(rawUrl, item.mime_type || (item.type === 'image' ? 'image/jpeg' : 'application/octet-stream'));
    if (blobUrl) {
      item._resolvedFullBlobUrl = blobUrl;
      item.file_path = blobUrl;
    }

    // If multi-image item, resolve all gallery images on demand
    if (item.images && Array.isArray(item.images) && item.images.length > 0) {
      await Promise.all(item.images.map(async (img) => {
        const imgRaw = img.storage_url || (img.storage_path ? this.getPublicStorageUrl(img.storage_path) : '') || img.url;
        if (imgRaw) {
          img.url = await this.resolveStorageBlobUrl(imgRaw, img.mime_type || 'image/jpeg');
        }
      }));
    }

    return blobUrl || rawUrl;
  },

  // Normalize a settings row (9-field schema or legacy format) into runtime item object
  normalizeSettingsRow(row) {
    if (!row) return null;
    let val = row.value;
    if (typeof val === 'string') {
      try { val = JSON.parse(val); } catch (e) { return null; }
    }
    if (!val || typeof val !== 'object') return null;

    // New 9-key schema: { item_id, user_id, file_name, mime_type, file_size, storage_path, metadata, created_at, updated_at }
    const meta = (val.metadata && typeof val.metadata === 'object') ? val.metadata : {};
    const id = String(val.item_id || meta.id || val.id || (row.key ? row.key.replace(/^ks_item_/, '') : ''));
    if (!id) return null;

    const storagePath = val.storage_path || meta.storage_path || null;
    const storageUrl = meta.storage_url || (storagePath ? this.getPublicStorageUrl(storagePath) : null);
    const thumbStoragePath = meta.thumb_storage_path || null;
    const thumbStorageUrl = meta.thumb_storage_url || (thumbStoragePath ? this.getPublicStorageUrl(thumbStoragePath) : null);

    let legacyFilePath = val.file_path;
    if (legacyFilePath && typeof legacyFilePath === 'object' && legacyFilePath.dataUrl) {
      legacyFilePath = legacyFilePath.dataUrl;
    } else if (legacyFilePath && typeof legacyFilePath === 'object') {
      legacyFilePath = '';
    }

    const item = {
      id,
      item_id: id,
      user_id: val.user_id || meta.user_id || 'u-local',
      type: meta.type || val.type || 'text',
      title: meta.title || val.title || 'Untitled',
      content: meta.content !== undefined ? meta.content : (val.content || ''),
      content_truncated: Boolean(meta.content_truncated),
      content_full_length: meta.content_full_length || 0,
      content_storage_path: meta.content_storage_path || null,
      content_storage_url: meta.content_storage_url || (meta.content_storage_path ? this.getPublicStorageUrl(meta.content_storage_path) : null),
      file_name: val.file_name !== undefined ? val.file_name : (meta.file_name || null),
      mime_type: val.mime_type || meta.mime_type || null,
      file_size: val.file_size !== undefined ? val.file_size : (meta.file_size || 0),
      storage_path: storagePath,
      storage_url: storageUrl,
      thumb_storage_path: thumbStoragePath,
      thumb_storage_url: thumbStorageUrl,
      // Do NOT set file_path to heavy Base64; use resolved blob URL or storage URL when requested
      file_path: blobUrlMemoryCache.get(storageUrl) || legacyFilePath || storageUrl || '',
      thumbnail: blobUrlMemoryCache.get(thumbStorageUrl) || (typeof val.thumbnail === 'string' ? val.thumbnail : '') || thumbStorageUrl || '',
      images: Array.isArray(meta.images) ? meta.images : (Array.isArray(val.images) ? val.images : null),
      image_count: meta.image_count || val.image_count || (Array.isArray(meta.images) ? meta.images.length : 1),
      folder_id: meta.folder_id || val.folder_id || null,
      device_name: meta.device_name || val.device_name || 'iPad Pro',
      device_type: meta.device_type || val.device_type || 'ipad',
      is_favorite: (meta.is_favorite !== undefined ? meta.is_favorite : val.is_favorite) ? 1 : 0,
      created_at: val.created_at || meta.created_at || new Date().toISOString(),
      deleted_at: meta.deleted_at !== undefined ? meta.deleted_at : (val.deleted_at || null),
      updated_at: val.updated_at || meta.updated_at || new Date().toISOString()
    };

    if (fullContentMemoryCache.has(id)) {
      item.content = fullContentMemoryCache.get(id);
      item.content_truncated = false;
    }

    return item;
  },

  // Convert an item object into the strict 9-field database schema for `settings.value`
  buildSettingsValueRecord(item, overrides = {}) {
    const merged = { ...item, ...overrides };
    const itemId = String(merged.item_id || merged.id);
    const rawContent = merged.content || '';
    const isTruncated = Boolean(merged.content_truncated) || rawContent.length > 600;
    const metadataContent = rawContent.length > 600 ? rawContent.slice(0, 260) : rawContent;

    return {
      item_id: itemId,
      user_id: merged.user_id || 'u-local',
      file_name: merged.file_name || null,
      mime_type: merged.mime_type || (merged.type === 'image' ? 'image/jpeg' : 'text/plain'),
      file_size: merged.file_size || (rawContent ? rawContent.length : 0),
      storage_path: merged.storage_path || null,
      metadata: {
        id: itemId,
        type: merged.type || 'text',
        title: merged.title || 'Untitled',
        content: metadataContent,
        content_truncated: isTruncated,
        content_full_length: merged.content_full_length || rawContent.length,
        content_storage_path: merged.content_storage_path || null,
        content_storage_url: merged.content_storage_url || null,
        is_favorite: merged.is_favorite ? 1 : 0,
        deleted_at: merged.deleted_at || null,
        device_name: merged.device_name || this.detectDeviceName(),
        device_type: merged.device_type || this.detectDeviceType(),
        folder_id: merged.folder_id || null,
        image_count: merged.image_count || (Array.isArray(merged.images) ? merged.images.length : (merged.type === 'image' ? 1 : 0)),
        images: Array.isArray(merged.images) ? merged.images.map(img => ({
          id: img.id,
          name: img.name,
          size: img.size,
          mime_type: img.mime_type || 'image/jpeg',
          storage_path: img.storage_path || null,
          storage_url: img.storage_url || null,
          thumb_storage_path: img.thumb_storage_path || null,
          thumb_storage_url: img.thumb_storage_url || null
        })) : null,
        storage_url: merged.storage_url || null,
        thumb_storage_path: merged.thumb_storage_path || null,
        thumb_storage_url: merged.thumb_storage_url || null
      },
      created_at: merged.created_at || new Date().toISOString(),
      updated_at: merged.updated_at || new Date().toISOString()
    };
  },

  getCachedItems() {
    if (this._allItemsCache && Array.isArray(this._allItemsCache)) {
      return this._allItemsCache;
    }
    try {
      const raw = localStorage.getItem('kuro_cached_supabase_items_v2') || localStorage.getItem('kuro_cached_supabase_items');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed.filter(Boolean);
    } catch (e) {
      return null;
    }
  },

  setCachedItems(items) {
    try {
      if (!Array.isArray(items)) return;
      this._allItemsCache = items;
      // Strip any transient blob: or data: URLs before saving to localStorage
      const cleanForStorage = items.map(item => {
        if (!item) return null;
        const copy = { ...item };
        delete copy._resolvedFullBlobUrl;
        if (typeof copy.file_path === 'string' && (copy.file_path.startsWith('data:') || copy.file_path.startsWith('blob:'))) {
          copy.file_path = copy.storage_url || '';
        }
        if (typeof copy.thumbnail === 'string' && (copy.thumbnail.startsWith('data:') || copy.thumbnail.startsWith('blob:'))) {
          copy.thumbnail = copy.thumb_storage_url || '';
        }
        return copy;
      }).filter(Boolean);

      localStorage.setItem('kuro_cached_supabase_items_v2', JSON.stringify(cleanForStorage));
    } catch (e) {
      console.warn('localStorage setCachedItems error:', e);
    }
  },

  // Sync metadata from Supabase using lightweight conditional/delta fetching
  async syncMetadataFromCloud(forceNetwork = false) {
    const now = Date.now();
    if (!forceNetwork && this._allItemsCache && (now - this._lastSyncTimestamp < this.SYNC_TTL_MS)) {
      return this._allItemsCache;
    }

    if (this._syncInFlight) {
      return this._syncInFlight;
    }

    this._syncInFlight = (async () => {
      try {
        const localItems = this.getCachedItems() || [];
        const localByKey = new Map();
        for (const item of localItems) {
          if (item && item.id) {
            localByKey.set(`ks_item_${item.id}`, item);
          }
        }

        // If we already have cached items, perform an ultra-lightweight delta check first (~3 KB)
        if (localByKey.size > 0) {
          const deltaRows = await this.request('/settings?key=like.ks_item_*&select=key,updated_at:value->>updated_at');
          if (Array.isArray(deltaRows)) {
            const remoteKeys = new Set();
            const changedOrNewKeys = [];

            for (const r of deltaRows) {
              if (!r || !r.key) continue;
              remoteKeys.add(r.key);
              const existing = localByKey.get(r.key);
              if (!existing || (r.updated_at && existing.updated_at !== r.updated_at)) {
                changedOrNewKeys.push(r.key);
              }
            }

            // Remove any locally cached items that were permanently deleted remotely
            let anyDeletedRemotely = false;
            for (const k of localByKey.keys()) {
              if (!remoteKeys.has(k)) {
                localByKey.delete(k);
                anyDeletedRemotely = true;
              }
            }

            // If 0 rows changed, return cached items with ZERO additional downloads!
            if (changedOrNewKeys.length === 0) {
              const finalItems = Array.from(localByKey.values());
              this._allItemsCache = finalItems;
              this._lastSyncTimestamp = Date.now();
              if (anyDeletedRemotely) this.setCachedItems(finalItems);
              return finalItems;
            }

            // If only a few rows changed (<= 10), fetch ONLY those specific keys!
            if (changedOrNewKeys.length <= 10) {
              const inList = changedOrNewKeys.map(k => `"${k}"`).join(',');
              const updatedRows = await this.request(`/settings?key=in.(${encodeURIComponent(inList)})&select=key,value`);
              if (Array.isArray(updatedRows)) {
                for (const ur of updatedRows) {
                  const norm = this.normalizeSettingsRow(ur);
                  if (norm) localByKey.set(ur.key, norm);
                }
              }
              const mergedItems = Array.from(localByKey.values());
              this.setCachedItems(mergedItems);
              this._lastSyncTimestamp = Date.now();
              return mergedItems;
            }
          }
        }

        // Initial load: fetch lightweight metadata rows (no select=*, only key and metadata value)
        const rows = await this.request('/settings?key=like.ks_item_*&select=key,value');
        const items = (Array.isArray(rows) ? rows : [])
          .map(r => this.normalizeSettingsRow(r))
          .filter(Boolean);

        this.setCachedItems(items);
        this._lastSyncTimestamp = Date.now();
        return items;
      } catch (err) {
        console.warn('[KuroSupabase] syncMetadataFromCloud failed, using cache:', err);
        const cached = this.getCachedItems();
        if (cached) return cached;
        throw err;
      } finally {
        this._syncInFlight = null;
      }
    })();

    return this._syncInFlight;
  },

  // 1. Get Items (Filters & Paginates in-memory from cached metadata without redundant network calls)
  async getItems(params = {}) {
    const isTrash = params.trash === '1';
    const forceNetwork = Boolean(params.forceRefresh);

    const items = await this.syncMetadataFromCloud(forceNetwork);

    // Filter by Trash vs Active
    const allActive = items.filter(i => !i.deleted_at);
    const trashItems = items.filter(i => !!i.deleted_at);

    let filtered = isTrash ? [...trashItems] : [...allActive];

    // Filter by Folder
    if (params.folder_id) {
      filtered = filtered.filter(i => String(i.folder_id) === String(params.folder_id));
    }

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

    // Sort newest or oldest
    if (params.sort === 'oldest') {
      filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else {
      filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    const totalUsed = allActive.reduce((acc, i) => acc + (Number(i.file_size) || (i.content ? i.content.length : 120)), 0);

    return {
      items: filtered,
      counts: {
        all: allActive.length,
        text: allActive.filter(i => i.type === 'text' || i.type === 'note').length,
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

  // 2. Create Item (Uploads files/images/thumbnails/long-text to Supabase Storage first, saves ONLY metadata in settings)
  async createItem(item) {
    const id = item.id || ('ks_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
    const nowIso = new Date().toISOString();

    let storagePath = item.storage_path || null;
    let storageUrl = item.storage_url || null;
    let thumbStoragePath = item.thumb_storage_path || null;
    let thumbStorageUrl = item.thumb_storage_url || null;
    let fileSize = item.file_size || 0;
    let mimeType = item.mime_type || (item.type === 'image' ? 'image/jpeg' : 'text/plain');
    let fileName = item.file_name || null;

    // A. If item has binary File/Blob or Base64 file_path, upload to Supabase Storage
    let rawFp = item.file_path;
    if (rawFp && typeof rawFp === 'object' && rawFp.dataUrl) rawFp = rawFp.dataUrl;

    if (item._rawFile instanceof Blob) {
      const safeName = this.sanitizeFileName(fileName || item._rawFile.name, item._rawFile.type);
      fileName = fileName || safeName;
      mimeType = item._rawFile.type || mimeType;
      fileSize = item._rawFile.size;
      storagePath = `kuro-sync/items/${encodeURIComponent(id)}/${safeName}`;
      storageUrl = await this.uploadToStorage(storagePath, item._rawFile);
    } else if (typeof rawFp === 'string' && rawFp.startsWith('data:')) {
      const blob = this.dataUrlToBlob(rawFp);
      if (blob) {
        mimeType = item.mime_type || blob.type || mimeType;
        fileSize = blob.size;
        const safeName = this.sanitizeFileName(fileName || `${id}.jpg`, mimeType);
        fileName = fileName || safeName;
        storagePath = `kuro-sync/items/${encodeURIComponent(id)}/${safeName}`;
        storageUrl = await this.uploadToStorage(storagePath, blob);
      }
    }

    // B. Upload thumbnail to Supabase Storage if Base64
    if (typeof item.thumbnail === 'string' && item.thumbnail.startsWith('data:')) {
      const thumbBlob = this.dataUrlToBlob(item.thumbnail);
      if (thumbBlob) {
        thumbStoragePath = `kuro-sync/thumbs/${encodeURIComponent(id)}.jpg`;
        thumbStorageUrl = await this.uploadToStorage(thumbStoragePath, thumbBlob);
      }
    }

    // C. Upload multi-images array to Supabase Storage if present
    let processedImagesMeta = null;
    if (Array.isArray(item.images) && item.images.length > 0) {
      processedImagesMeta = await Promise.all(item.images.map(async (img, idx) => {
        let imgStoragePath = img.storage_path || null;
        let imgStorageUrl = img.storage_url || null;
        let imgThumbPath = img.thumb_storage_path || null;
        let imgThumbUrl = img.thumb_storage_url || null;
        let imgSize = img.size || 0;

        if (typeof img.url === 'string' && img.url.startsWith('data:')) {
          const b = this.dataUrlToBlob(img.url);
          if (b) {
            imgSize = b.size;
            const sName = this.sanitizeFileName(img.name || `img_${idx}.jpg`, b.type);
            imgStoragePath = `kuro-sync/items/${encodeURIComponent(id)}/${idx}_${sName}`;
            imgStorageUrl = await this.uploadToStorage(imgStoragePath, b);
          }
        }
        if (typeof img.thumbnail === 'string' && img.thumbnail.startsWith('data:')) {
          const tb = this.dataUrlToBlob(img.thumbnail);
          if (tb) {
            imgThumbPath = `kuro-sync/thumbs/${encodeURIComponent(id)}_${idx}.jpg`;
            imgThumbUrl = await this.uploadToStorage(imgThumbPath, tb);
          }
        }
        return {
          id: img.id || `img-${id}-${idx}`,
          name: img.name || `Image ${idx + 1}`,
          size: imgSize,
          mime_type: img.mime_type || 'image/jpeg',
          storage_path: imgStoragePath,
          storage_url: imgStorageUrl,
          thumb_storage_path: imgThumbPath,
          thumb_storage_url: imgThumbUrl
        };
      }));
      if (!storagePath && processedImagesMeta[0]) {
        storagePath = processedImagesMeta[0].storage_path;
        storageUrl = processedImagesMeta[0].storage_url;
        thumbStoragePath = processedImagesMeta[0].thumb_storage_path;
        thumbStorageUrl = processedImagesMeta[0].thumb_storage_url;
      }
    }

    // D. Offload large text content (> 600 chars) to Storage
    const rawContent = item.content || '';
    let contentStoragePath = null;
    let contentStorageUrl = null;
    if (rawContent.length > 600) {
      const textBlob = new Blob([rawContent], { type: 'text/plain; charset=utf-8' });
      contentStoragePath = `kuro-sync/content/${encodeURIComponent(id)}.txt`;
      contentStorageUrl = await this.uploadToStorage(contentStoragePath, textBlob);
      fullContentMemoryCache.set(id, rawContent);
      if (!storagePath) {
        storagePath = contentStoragePath;
        fileSize = textBlob.size;
      }
    }

    const normalizedItem = {
      id,
      item_id: id,
      user_id: item.user_id || 'u-local',
      type: item.type || 'text',
      title: item.title || (item.type === 'link' ? (rawContent || 'Link') : 'Untitled'),
      content: rawContent,
      content_truncated: rawContent.length > 600,
      content_full_length: rawContent.length,
      content_storage_path: contentStoragePath,
      content_storage_url: contentStorageUrl,
      file_name: fileName,
      mime_type: mimeType,
      file_size: fileSize || (rawContent ? rawContent.length : 100),
      storage_path: storagePath,
      storage_url: storageUrl,
      thumb_storage_path: thumbStoragePath,
      thumb_storage_url: thumbStorageUrl,
      images: processedImagesMeta,
      image_count: processedImagesMeta ? processedImagesMeta.length : (item.image_count || 1),
      folder_id: item.folder_id || null,
      device_name: item.device_name || this.detectDeviceName(),
      device_type: item.device_type || this.detectDeviceType(),
      is_favorite: item.is_favorite ? 1 : 0,
      created_at: item.created_at || nowIso,
      deleted_at: null,
      updated_at: nowIso
    };

    const settingsValue = this.buildSettingsValueRecord(normalizedItem);

    await this.request('/settings', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        key: 'ks_item_' + id,
        value: settingsValue
      })
    });

    const runtimeItem = this.normalizeSettingsRow({ key: 'ks_item_' + id, value: settingsValue });
    if (this._allItemsCache) {
      this._allItemsCache = [runtimeItem, ...this._allItemsCache.filter(i => String(i.id) !== String(id))];
      this.setCachedItems(this._allItemsCache);
    }

    return { success: true, item: runtimeItem };
  },

  // 3. Update Item (Updates Storage if file/content changed, updates single row in settings & in-memory cache)
  async updateItem(id, updates) {
    let existing = (this._allItemsCache || []).find(i => String(i.id) === String(id));
    if (!existing) {
      const rows = await this.request(`/settings?key=eq.ks_item_${encodeURIComponent(id)}&select=key,value`);
      if (Array.isArray(rows) && rows.length > 0) {
        existing = this.normalizeSettingsRow(rows[0]);
      }
    }
    if (!existing) existing = { id: String(id), item_id: String(id) };

    const merged = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // If image was replaced with a new Base64 dataUrl, upload to Storage first
    if (typeof updates.file_path === 'string' && updates.file_path.startsWith('data:')) {
      const blob = this.dataUrlToBlob(updates.file_path);
      if (blob) {
        const safeName = this.sanitizeFileName(merged.file_name || `${id}.jpg`, blob.type);
        merged.storage_path = `kuro-sync/items/${encodeURIComponent(id)}/${Date.now()}_${safeName}`;
        merged.storage_url = await this.uploadToStorage(merged.storage_path, blob);
        merged.file_size = blob.size;
        merged.file_path = merged.storage_url;
      }
    }
    if (typeof updates.thumbnail === 'string' && updates.thumbnail.startsWith('data:')) {
      const thumbBlob = this.dataUrlToBlob(updates.thumbnail);
      if (thumbBlob) {
        merged.thumb_storage_path = `kuro-sync/thumbs/${encodeURIComponent(id)}_${Date.now()}.jpg`;
        merged.thumb_storage_url = await this.uploadToStorage(merged.thumb_storage_path, thumbBlob);
        merged.thumbnail = merged.thumb_storage_url;
      }
    }

    // If text content was updated and exceeds 600 chars, upload full text to Storage
    if (updates.content !== undefined) {
      const rawContent = updates.content || '';
      fullContentMemoryCache.set(String(id), rawContent);
      if (rawContent.length > 600) {
        const textBlob = new Blob([rawContent], { type: 'text/plain; charset=utf-8' });
        merged.content_storage_path = `kuro-sync/content/${encodeURIComponent(id)}.txt`;
        merged.content_storage_url = await this.uploadToStorage(merged.content_storage_path, textBlob);
        merged.content_truncated = true;
        merged.content_full_length = rawContent.length;
      } else {
        merged.content_truncated = false;
        merged.content_full_length = rawContent.length;
      }
    }

    const settingsValue = this.buildSettingsValueRecord(merged);

    await this.request(`/settings?key=eq.ks_item_${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ value: settingsValue })
    });

    const updatedRuntime = this.normalizeSettingsRow({ key: 'ks_item_' + id, value: settingsValue });
    if (this._allItemsCache) {
      const idx = this._allItemsCache.findIndex(i => String(i.id) === String(id));
      if (idx !== -1) {
        this._allItemsCache[idx] = updatedRuntime;
      } else {
        this._allItemsCache.unshift(updatedRuntime);
      }
      this.setCachedItems(this._allItemsCache);
    }

    return { success: true, item: updatedRuntime };
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
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' }
    });
    if (this._allItemsCache) {
      this._allItemsCache = this._allItemsCache.filter(i => String(i.id) !== String(id));
      this.setCachedItems(this._allItemsCache);
    }
    return { success: true };
  },

  // 7. Empty Trash
  async emptyTrash() {
    const items = this._allItemsCache || (await this.syncMetadataFromCloud(false));
    const trashItems = (items || []).filter(i => i && i.deleted_at);
    if (trashItems.length === 0) return { success: true };

    for (const item of trashItems) {
      await this.request(`/settings?key=eq.ks_item_${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: { 'Prefer': 'return=minimal' }
      }).catch(() => {});
    }

    if (this._allItemsCache) {
      this._allItemsCache = this._allItemsCache.filter(i => !i.deleted_at);
      this.setCachedItems(this._allItemsCache);
    }
    return { success: true };
  },

  // IntersectionObserver for Lazy Loading Card Thumbnails from Supabase Storage
  _imgObserver: null,
  observeLazyStorageImages(rootEl = document) {
    if (!('IntersectionObserver' in window)) {
      rootEl.querySelectorAll('img[data-storage-src]').forEach(img => this._loadImgElement(img));
      return;
    }
    if (!this._imgObserver) {
      this._imgObserver = new IntersectionObserver((entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const img = entry.target;
            obs.unobserve(img);
            this._loadImgElement(img);
          }
        }
      }, { rootMargin: '180px 0px' });
    }
    rootEl.querySelectorAll('img[data-storage-src]').forEach(img => {
      if (img.dataset.storageLoaded === '1') return;
      this._imgObserver.observe(img);
    });
  },

  async _loadImgElement(img) {
    if (!img || img.dataset.storageLoaded === '1') return;
    img.dataset.storageLoaded = '1';
    const src = img.dataset.storageSrc;
    const mime = img.dataset.storageMime || 'image/jpeg';
    if (!src) return;
    const blobUrl = await this.resolveStorageBlobUrl(src, mime);
    if (blobUrl) {
      img.src = blobUrl;
    }
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

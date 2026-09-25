// ==========================================================
// KURO SYNC OFFLINE & INDEXEDDB QUEUE
// ==========================================================

const offlineManager = {
  db: null,

  async init() {
    this.setupListeners();
    await this.initDB();
  },

  setupListeners() {
    window.addEventListener('online', () => {
      if (window.realtime) window.realtime.setStatus('syncing');
      if (window.utils) window.utils.showToast('Back online — syncing pending items...', 'info');
      this.drainQueue();
      if (window.realtime) window.realtime.connect();
    });

    window.addEventListener('offline', () => {
      if (window.realtime) window.realtime.setStatus('offline');
      if (window.utils) window.utils.showToast('Working offline — changes will sync when reconnected', 'warning');
    });
  },

  async initDB() {
    return new Promise((resolve) => {
      const request = indexedDB.open('kuro_sync_offline_db', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('pending_actions')) {
          db.createObjectStore('pending_actions', { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = () => {
        resolve(); // Continue even if indexeddb unavailable
      };
    });
  },

  async queueAction(actionType, payload) {
    if (!this.db) return;
    const tx = this.db.transaction('pending_actions', 'readwrite');
    const store = tx.objectStore('pending_actions');
    store.add({ actionType, payload, timestamp: Date.now() });
  },

  async drainQueue() {
    if (!this.db || !navigator.onLine) return;
    const tx = this.db.transaction('pending_actions', 'readwrite');
    const store = tx.objectStore('pending_actions');
    const request = store.getAll();

    request.onsuccess = async () => {
      const pending = request.result;
      if (!pending || pending.length === 0) return;

      for (const item of pending) {
        try {
          if (item.actionType === 'create_text') {
            await window.api.createTextItem(item.payload);
          } else if (item.actionType === 'delete_item') {
            await window.api.deleteItem(item.payload.id);
          }
        } catch (e) {
          console.warn('Failed to replay offline action:', e);
        }
      }

      // Clear store after drain
      const clearTx = this.db.transaction('pending_actions', 'readwrite');
      clearTx.objectStore('pending_actions').clear();
      window.refreshItems();
    };
  }
};

window.offlineManager = offlineManager;

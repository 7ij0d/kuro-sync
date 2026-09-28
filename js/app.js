// ==========================================================
// KURO SYNC MAIN APPLICATION LOGIC
// ==========================================================

window.currentUser = null;
window.currentDevices = [];
window.currentItems = [];
window.currentFolders = [];
window.currentStorage = { used: 0, quota: 21474836480 };

window.currentView = 'all'; // 'all', 'text', 'images', 'files', 'links', 'clipboard', 'favorites', 'trash', 'folder'
window.currentFilterType = 'all';
window.currentFolderId = null;
window.currentFilterDevice = null;
window.currentSearchTerm = '';
window.currentSortOrder = 'newest';

document.addEventListener('DOMContentLoaded', async () => {
  // 0. SWR Instant Zero-Delay First Paint from local cache (0ms delay)
  try {
    const cachedItems = (window.KuroSupabase && window.KuroSupabase.getCachedItems) ? window.KuroSupabase.getCachedItems() : null;
    if (cachedItems && Array.isArray(cachedItems) && cachedItems.length > 0) {
      window.currentItems = cachedItems;
      renderItemsFeed(cachedItems);
      if (window.updateSidebarBadges) {
        window.updateSidebarBadges({
          all: cachedItems.length,
          text: cachedItems.filter(i => i.type === 'text' || i.type === 'note').length,
          images: cachedItems.filter(i => i.type === 'image').length,
          files: cachedItems.filter(i => i.type === 'file').length,
          links: cachedItems.filter(i => i.type === 'link').length,
          clipboard: cachedItems.filter(i => i.type === 'clipboard').length,
          favorites: cachedItems.filter(i => Boolean(i.is_favorite)).length,
          trash: 0
        });
      }
    }
  } catch (e) {}

  // 1. Initialize i18n
  if (window.i18n) window.i18n.init();

  // 2. Initialize Theme
  initTheme();

  // 3. Initialize Offline & Clipboard
  if (window.offlineManager) window.offlineManager.init();
  if (window.clipboardEngine) window.clipboardEngine.setupGlobalPaste();

  // 4. Setup Controls & Drag Drop
  if (window.setupHeaderControls) window.setupHeaderControls();
  setupDragAndDrop();

  // 5. Fire concurrent background sync immediately without blocking UI
  refreshFolders();
  refreshItems();

  // 6. Check URL parameters (e.g. ?pair=KXXXXX)
  const urlParams = new URLSearchParams(window.location.search);
  const pairCode = urlParams.get('pair');
  if (pairCode) {
    try {
      await window.api.claimPairing(pairCode);
      window.history.replaceState({}, document.title, window.location.pathname);
      if (window.utils) window.utils.showToast('Device successfully paired with Kuro Sync!');
    } catch (e) {
      if (window.utils) window.utils.showToast('Invalid or expired pairing QR code', 'warning');
    }
  }

  // 7. Check Auth Session
  bootstrapSession();

  // 8. Setup Realtime Listener
  window.addEventListener('kuro_realtime_event', (e) => {
    handleRealtimeEvent(e.detail);
  });

  window.addEventListener('language_changed', () => {
    renderAllViews();
  });
});

// Bootstrap or auto-create demo session
async function bootstrapSession() {
  try {
    const token = window.api.getToken();
    if (!token) {
      await window.api.instantDemo().catch(() => {});
    }

    const meData = await window.api.getMe().catch(() => null);
    if (meData && meData.user) {
      window.currentUser = meData.user;
      window.currentDevices = meData.devices;

      const profileName = document.getElementById('user-profile-name');
      if (profileName) profileName.textContent = meData.user.name;

      if (window.updateDeviceFilterOptions) {
        window.updateDeviceFilterOptions(meData.devices, meData.currentDeviceId);
      }
    }

    // Connect Realtime
    if (window.realtime) window.realtime.connect();
  } catch (err) {
    console.warn('Session bootstrap error:', err);
  }
}

window.currentPageLimit = 20;
window.PAGE_STEP = 20;

function loadMoreFeedItems() {
  window.currentPageLimit = (window.currentPageLimit || 20) + (window.PAGE_STEP || 20);
  renderItemsFeed(window.currentItems || []);
}
window.loadMoreFeedItems = loadMoreFeedItems;

// Refresh items list (uses in-memory metadata cache unless forceNetwork=true)
async function refreshItems(forceNetwork = false) {
  const itemsContainer = document.getElementById('items-feed-container');
  if (!itemsContainer) return;

  const isTrashView = window.currentView === 'trash';
  const isFavoritesView = window.currentView === 'favorites';

  const params = {
    sort: window.currentSortOrder,
    trash: isTrashView ? '1' : '0',
    forceRefresh: Boolean(forceNetwork)
  };

  if (window.currentFilterType && window.currentFilterType !== 'all') {
    params.type = window.currentFilterType;
  }

  if (isFavoritesView) {
    params.is_favorite = '1';
  }

  if (window.currentFolderId) {
    params.folder_id = window.currentFolderId;
  }

  if (window.currentFilterDevice) {
    params.device_id = window.currentFilterDevice;
  }

  if (window.currentSearchTerm) {
    params.search = window.currentSearchTerm;
  }

  // If no items are rendered yet, ensure loading skeleton is shown
  if ((!window.currentItems || window.currentItems.length === 0) && !itemsContainer.querySelector('.feed-sync-skeleton') && !itemsContainer.querySelector('.item-card')) {
    const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
    itemsContainer.innerHTML = `
      <div class="feed-sync-skeleton" id="initial-feed-skeleton">
        <div class="skeleton-sync-header">
          <span class="skeleton-spinner"></span>
          <span>${isAr ? 'جاري المزامنة مع سحابة Kuro Sync وتحميل العناصر...' : 'Syncing items with Kuro Cloud...'}</span>
        </div>
        <div class="skeleton-card-ghost shimmer"></div>
        <div class="skeleton-card-ghost shimmer"></div>
        <div class="skeleton-card-ghost shimmer"></div>
      </div>
    `;
  }

  try {
    const data = await window.api.getItems(params);
    window.currentItems = data.items;
    window.currentStorage = data.storage;

    // Update badges & storage meter
    if (window.updateSidebarBadges) window.updateSidebarBadges(data.counts);
    if (window.updateStorageMeter) window.updateStorageMeter(data.storage);

    renderItemsFeed(data.items);
  } catch (err) {
    console.warn('refreshItems error:', err);
    if (!window.currentItems || window.currentItems.length === 0) {
      const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
      itemsContainer.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text-muted);">${isAr ? 'تعذر جلب العناصر من السحابة. يرجى التحقق من الاتصال.' : 'Failed to sync with cloud.'}</div>`;
    }
  }
}

// Refresh folders list
async function refreshFolders() {
  try {
    const folders = await window.api.getFolders();
    window.currentFolders = folders;
    if (window.renderFoldersList) window.renderFoldersList(folders);
  } catch (err) {}
}

// Render feed of cards with pagination and lazy thumbnail observation
function renderItemsFeed(items = []) {
  const container = document.getElementById('items-feed-container');
  if (!container) return;

  const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;

  // Empty state handling
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-mascot-img">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
          </svg>
        </div>
        <div class="empty-title">${t('emptyTitle')}</div>
        <div class="empty-desc">${t('emptyDesc')}</div>
        <div class="empty-actions">
          <button class="btn-primary" onclick="openNewModal('text')">
            + ${t('newItem')}
          </button>
          <button class="btn-secondary" onclick="openDeviceModal()">
            ${t('connectDevice')}
          </button>
        </div>
      </div>
    `;
    return;
  }

  const limit = window.currentPageLimit || 20;
  const visibleItems = items.slice(0, limit);
  const remainingCount = Math.max(0, items.length - visibleItems.length);

  // Safe card renderer with error boundary
  const renderSafeCard = (item) => {
    try {
      if (!item) return '';
      return window.renderItemCard(item, window.currentView) || '';
    } catch (err) {
      console.error('Error rendering card for item:', item && item.id, err);
      return '';
    }
  };

  // Group visible items by date (Today, Yesterday, Earlier)
  const grouped = window.utils.groupItemsByDate(visibleItems);
  let html = '';

  if (grouped.today.length > 0) {
    html += `
      <div class="date-group">
        <div class="date-section-header">${t('today')}</div>
        <div class="items-list">
          ${grouped.today.map(renderSafeCard).join('')}
        </div>
      </div>
    `;
  }

  if (grouped.yesterday.length > 0) {
    html += `
      <div class="date-group" style="margin-top:24px;">
        <div class="date-section-header">${t('yesterday')}</div>
        <div class="items-list">
          ${grouped.yesterday.map(renderSafeCard).join('')}
        </div>
      </div>
    `;
  }

  if (grouped.earlier.length > 0) {
    html += `
      <div class="date-group" style="margin-top:24px;">
        <div class="date-section-header">${t('earlier')}</div>
        <div class="items-list">
          ${grouped.earlier.map(renderSafeCard).join('')}
        </div>
      </div>
    `;
  }

  // Fallback if date grouping produced empty output
  if (!html.trim()) {
    html = `<div class="items-list">${visibleItems.map(renderSafeCard).join('')}</div>`;
  }

  if (remainingCount > 0) {
    html += `
      <div id="feed-load-more-sentinel" style="display:flex; justify-content:center; padding:20px 0 8px;">
        <button type="button" class="btn-secondary" onclick="loadMoreFeedItems()" style="padding:8px 20px; font-weight:600; font-size:0.85rem;">
          ${isAr ? `عرض المزيد (${remainingCount} متبقية)` : `Load More (${remainingCount} remaining)`}
        </button>
      </div>
    `;
  }

  container.innerHTML = html;

  // Activate lazy loading of visible thumbnails from Supabase Storage
  if (window.KuroSupabase && window.KuroSupabase.observeLazyStorageImages) {
    window.KuroSupabase.observeLazyStorageImages(container);
  }
}

// Handle Realtime incoming events from WebSocket
function handleRealtimeEvent(event) {
  if (!event || !event.type) return;

  switch (event.type) {
    case 'ITEM_CREATED':
      if (window.utils) {
        window.utils.showToast(`New ${event.item.type} received from ${event.item.device_name || 'connected device'}!`);
      }
      refreshItems(true);
      break;

    case 'ITEM_UPDATED':
    case 'ITEM_DELETED':
    case 'ITEM_RESTORED':
    case 'ITEM_PURGED':
    case 'TRASH_EMPTIED':
    case 'ITEMS_REFRESH':
      refreshItems(true);
      break;

    case 'DEVICE_JOINED':
      if (window.utils) {
        window.utils.showToast(`Device "${event.device.name}" connected!`);
      }
      if (window.refreshDeviceList) window.refreshDeviceList();
      break;

    case 'DEVICE_STATUS':
      if (window.refreshDeviceList) window.refreshDeviceList();
      break;
  }
}

// Navigation View Switcher (All Items, Text, Images, Files, Links, Clipboard, Favorites, Trash)
function switchNavView(viewName) {
  window.currentView = viewName;
  window.currentFolderId = null;
  window.currentPageLimit = 20;

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewName);
  });

  // Update page header title
  const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
  const titleEl = document.getElementById('main-page-title');
  if (titleEl) {
    titleEl.textContent = t(viewName === 'all' ? 'allItems' : viewName);
  }

  // Adjust filter pills active state
  const filterPill = document.querySelector(`.filter-pill[data-type="${viewName}"]`);
  if (filterPill) {
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    filterPill.classList.add('active');
    window.currentFilterType = viewName;
  } else {
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    const allPill = document.querySelector('.filter-pill[data-type="all"]');
    if (allPill) allPill.classList.add('active');
    window.currentFilterType = 'all';
  }

  // Filters in-memory without re-downloading from Supabase
  refreshItems(false);
  if (window.closeMobileSidebar) window.closeMobileSidebar();
}

function selectFolder(folderId) {
  window.currentView = 'folder';
  window.currentFolderId = folderId;
  window.currentPageLimit = 20;

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));

  const folder = (window.currentFolders || []).find(f => f.id === folderId);
  const titleEl = document.getElementById('main-page-title');
  if (titleEl && folder) {
    titleEl.textContent = folder.name;
  }

  refreshItems(false);
  if (window.closeMobileSidebar) window.closeMobileSidebar();
}

// Quick Card Actions (Fetch full content/file from Storage on demand only when clicked!)
async function copyCardText(itemId, btn) {
  const item = (window.currentItems || []).find(i => String(i.id) === String(itemId));
  if (!item) return;

  if ((item.content_truncated || item.content_storage_url) && window.KuroSupabase && window.KuroSupabase.ensureFullItemContent) {
    await window.KuroSupabase.ensureFullItemContent(item);
  }
  if (!item.content) return;

  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  const success = await window.clipboardEngine.copyText(item.content, isAr ? 'تم نسخ النص بنجاح! 📝' : 'Text copied to clipboard!');
  if (success && btn) {
    const labelSpan = btn.querySelector('.btn-label') || btn;
    const originalLabel = labelSpan.textContent;
    btn.classList.add('btn-copied');
    labelSpan.textContent = isAr ? '✓ تم النسخ' : '✓ Copied';

    setTimeout(() => {
      btn.classList.remove('btn-copied');
      labelSpan.textContent = originalLabel;
    }, 2000);
  }
}

async function copyCardImage(itemId, btn) {
  const item = (window.currentItems || []).find(i => String(i.id) === String(itemId));
  if (!item) return;

  let imgUrl = '';
  if (window.KuroSupabase && window.KuroSupabase.ensureFullItemMedia) {
    imgUrl = await window.KuroSupabase.ensureFullItemMedia(item);
  }
  if (!imgUrl) {
    imgUrl = window.getItemFileUrl ? window.getItemFileUrl(item) : (typeof item.file_path === 'string' ? item.file_path : `/api/items/${item.id}/file`);
  }

  const success = await window.clipboardEngine.copyImage(imgUrl);
  if (success && btn) {
    const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
    const labelSpan = btn.querySelector('.btn-label') || btn;
    const originalLabel = labelSpan.textContent;
    btn.classList.add('btn-copied');
    labelSpan.textContent = isAr ? '✓ تم نسخ الصورة' : '✓ Copied';

    setTimeout(() => {
      btn.classList.remove('btn-copied');
      labelSpan.textContent = originalLabel;
    }, 2000);
  }
}

async function copyCardCombined(itemId, btn) {
  const item = (window.currentItems || []).find(i => String(i.id) === String(itemId));
  if (!item) return;

  if (window.KuroSupabase) {
    await Promise.all([
      window.KuroSupabase.ensureFullItemContent ? window.KuroSupabase.ensureFullItemContent(item) : Promise.resolve(),
      window.KuroSupabase.ensureFullItemMedia ? window.KuroSupabase.ensureFullItemMedia(item) : Promise.resolve()
    ]);
  }

  const imageArg = (item.images && Array.isArray(item.images) && item.images.length > 0)
    ? item.images
    : (window.getItemFileUrl ? window.getItemFileUrl(item) : (typeof item.file_path === 'string' ? item.file_path : `/api/items/${item.id}/file`));

  const success = await window.clipboardEngine.copyCombined(item.content || '', imageArg, item.title || '');
  if (success && btn) {
    const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
    const labelSpan = btn.querySelector('.btn-label') || btn;
    const originalLabel = labelSpan.textContent;
    btn.classList.add('btn-copied');
    labelSpan.textContent = isAr ? '✓ تم نسخ الاثنين' : '✓ Copied';

    setTimeout(() => {
      btn.classList.remove('btn-copied');
      labelSpan.textContent = originalLabel;
    }, 2000);
  }
}

async function downloadItemFile(itemId) {
  const item = (window.currentItems || []).find(i => String(i.id) === String(itemId));
  if (item) {
    let fileUrl = '';
    if (window.KuroSupabase && window.KuroSupabase.ensureFullItemMedia) {
      fileUrl = await window.KuroSupabase.ensureFullItemMedia(item);
    }
    if (!fileUrl) {
      fileUrl = window.getItemFileUrl ? window.getItemFileUrl(item) : (typeof item.file_path === 'string' ? item.file_path : '');
    }
    if (fileUrl && (fileUrl.startsWith('data:') || fileUrl.startsWith('http') || fileUrl.startsWith('blob:') || fileUrl.startsWith('./') || fileUrl.startsWith('/'))) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = item.file_name || item.title || 'file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
  }
  window.location.href = `/api/items/${itemId}/file?download=1`;
}

async function deleteItem(itemId) {
  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  const confirmMsg = isAr 
    ? 'هل أنت متأكد من حذف هذا العنصر ونقله إلى سلة المحذوفات؟' 
    : 'Are you sure you want to move this item to the trash?';

  if (!confirm(confirmMsg)) return;

  // Optimistic UI update: instantly remove from screen
  const prevItems = [...(window.currentItems || [])];
  window.currentItems = window.currentItems.filter(i => String(i.id) !== String(itemId));
  renderItemsFeed(window.currentItems);

  try {
    await window.api.deleteItem(itemId);
    if (window.utils) {
      window.utils.showToast(isAr ? 'تم نقل العنصر إلى سلة المحذوفات' : 'Moved to trash');
    }
    refreshItems();
  } catch (err) {
    window.currentItems = prevItems;
    renderItemsFeed(window.currentItems);
    if (window.utils) window.utils.showToast(err.message, 'warning');
  }
}

async function restoreItem(itemId) {
  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  // Optimistic UI update: remove from trash view
  const prevItems = [...(window.currentItems || [])];
  window.currentItems = window.currentItems.filter(i => String(i.id) !== String(itemId));
  renderItemsFeed(window.currentItems);

  try {
    await window.api.restoreItem(itemId);
    if (window.utils) {
      window.utils.showToast(isAr ? 'تم استرجاع العنصر إلى مساحتك بنجاح' : 'Item restored');
    }
    refreshItems();
  } catch (err) {
    window.currentItems = prevItems;
    renderItemsFeed(window.currentItems);
    if (window.utils) window.utils.showToast(err.message, 'warning');
  }
}

async function permanentDeleteItem(itemId) {
  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  const confirmMsg = isAr 
    ? 'هل أنت متأكد من حذف هذا العنصر نهائياً؟ لن يمكنك التراجع عن هذا الإجراء.' 
    : 'Permanently delete this item? This action cannot be undone.';

  if (!confirm(confirmMsg)) return;

  // Optimistic UI update
  const prevItems = [...(window.currentItems || [])];
  window.currentItems = window.currentItems.filter(i => String(i.id) !== String(itemId));
  renderItemsFeed(window.currentItems);

  try {
    await window.api.permanentDeleteItem(itemId);
    if (window.utils) {
      window.utils.showToast(isAr ? 'تم حذف العنصر نهائياً' : 'Item permanently deleted');
    }
    refreshItems();
  } catch (err) {
    window.currentItems = prevItems;
    renderItemsFeed(window.currentItems);
    if (window.utils) window.utils.showToast(err.message, 'warning');
  }
}

async function emptyTrash() {
  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  const confirmMsg = isAr 
    ? 'هل أنت متأكد من تفريغ سلة المحذوفات بالكامل وحذف جميع عناصرها نهائياً؟' 
    : 'Are you sure you want to empty the trash permanently?';

  if (!confirm(confirmMsg)) return;

  window.currentItems = [];
  renderItemsFeed([]);

  try {
    await window.api.emptyTrash();
    if (window.utils) {
      window.utils.showToast(isAr ? 'تم تفريغ سلة المحذوفات بنجاح' : 'Trash emptied');
    }
    refreshItems();
  } catch (err) {
    if (window.utils) window.utils.showToast(err.message, 'warning');
  }
}

// Toggle Favorite Star Directly
async function toggleItemFavorite(itemId, event) {
  if (event) event.stopPropagation();
  const item = (window.currentItems || []).find(i => String(i.id) === String(itemId));
  if (!item) return;

  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  const newFav = item.is_favorite ? 0 : 1;
  item.is_favorite = newFav;
  renderItemsFeed(window.currentItems);

  try {
    await window.api.updateItem(itemId, { is_favorite: newFav });
    if (window.utils) {
      window.utils.showToast(newFav ? (isAr ? 'تمت الإضافة للمفضلة ★' : 'Added to favorites') : (isAr ? 'تمت الإزالة من المفضلة' : 'Removed from favorites'));
    }
    refreshItems();
  } catch (err) {
    item.is_favorite = newFav ? 0 : 1;
    renderItemsFeed(window.currentItems);
    if (window.utils) window.utils.showToast(err.message, 'warning');
  }
}

// Optional Reference Sample Pack Loader
async function loadSamplePack() {
  try {
    if (window.utils) window.utils.showToast('Loading reference dental items...', 'info');
    await window.api.loadSamplePack();
    if (window.utils) window.utils.showToast('Reference items loaded!');
    refreshItems();
  } catch (err) {
    if (window.utils) window.utils.showToast(err.message, 'warning');
  }
}

// Drag & Drop File Upload on Main Container
function setupDragAndDrop() {
  const dropArea = document.getElementById('main-drop-overlay');
  if (!dropArea) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropArea.classList.add('active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropArea.classList.remove('active');
    }, false);
  });

  dropArea.addEventListener('drop', async (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (window.utils) window.utils.showToast(`Uploading ${file.name}...`, 'info');
        try {
          await window.api.uploadFile(file);
          if (window.utils) window.utils.showToast(`Uploaded ${file.name}!`);
        } catch (err) {
          if (window.utils) window.utils.showToast(err.message, 'warning');
        }
      }
      refreshItems();
    }
  });
}

// Three-dot options menu
function openItemOptionsMenu(itemId, event) {
  if (event) event.stopPropagation();
  toggleItemFavorite(itemId, event);
}

// Theme Switcher (Light / Dark)
function initTheme() {
  const savedTheme = localStorage.getItem('kuro_sync_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('kuro_sync_theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const iconEl = document.getElementById('theme-toggle-icon');
  if (!iconEl) return;
  if (theme === 'dark') {
    // Moon to Sun
    iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  } else {
    // Sun to Moon
    iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
}

// Language Switcher (AR <-> EN)
function toggleLanguage() {
  if (!window.i18n) return;
  const nextLang = window.i18n.locale === 'ar' ? 'en' : 'ar';
  window.i18n.setLocale(nextLang);

  const langBtn = document.getElementById('lang-toggle-text');
  if (langBtn) langBtn.textContent = nextLang === 'ar' ? 'English' : 'عربي';
}

function renderAllViews() {
  // Update static translated strings in DOM
  const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });

  const searchInput = document.getElementById('global-search-input');
  if (searchInput) searchInput.placeholder = t('searchPlaceholder');

  refreshItems();
}

window.refreshItems = refreshItems;
window.refreshFolders = refreshFolders;
window.switchNavView = switchNavView;
window.selectFolder = selectFolder;
window.copyCardText = copyCardText;
window.copyCardImage = copyCardImage;
window.copyCardCombined = copyCardCombined;
window.copyAllCardImages = window.copyAllCardImages;
window.downloadItemFile = downloadItemFile;
window.deleteItem = deleteItem;
window.restoreItem = restoreItem;
window.permanentDeleteItem = permanentDeleteItem;
window.emptyTrash = emptyTrash;
window.loadSamplePack = loadSamplePack;
window.openItemOptionsMenu = openItemOptionsMenu;
window.toggleTheme = toggleTheme;
window.toggleLanguage = toggleLanguage;

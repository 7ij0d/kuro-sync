// ==========================================================
// KURO SYNC SIDEBAR CONTROLLER
// ==========================================================

function updateSidebarBadges(counts = {}) {
  const badgeMap = {
    'nav-badge-all': counts.all || 0,
    'nav-badge-text': counts.text || 0,
    'nav-badge-images': counts.images || 0,
    'nav-badge-files': counts.files || 0,
    'nav-badge-links': counts.links || 0,
    'nav-badge-clipboard': counts.clipboard || 0,
    'nav-badge-favorites': counts.favorites || 0,
    'nav-badge-trash': counts.trash || 0,
    'new-btn-badge': counts.all || 0
  };

  Object.entries(badgeMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

function updateStorageMeter(storage = {}) {
  const used = storage.used || 0;
  const quota = storage.quota || 21474836480;

  const usedFormatted = window.utils.formatBytes(used);
  const quotaFormatted = window.utils.formatBytes(quota);
  const percent = Math.min(100, Math.max(1, (used / quota) * 100)).toFixed(1);

  const textEl = document.getElementById('sidebar-storage-text');
  const fillEl = document.getElementById('sidebar-storage-fill');

  if (textEl) textEl.textContent = `${usedFormatted} / ${quotaFormatted}`;
  if (fillEl) fillEl.style.width = `${percent}%`;
}

function renderFoldersList(folders = []) {
  const container = document.getElementById('sidebar-folders-container');
  if (!container) return;

  if (folders.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = folders.map(f => `
    <div class="nav-item ${window.currentFolderId === f.id ? 'active' : ''}" onclick="selectFolder('${f.id}')">
      <div class="nav-item-left">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>${escapeHtml(f.name)}</span>
      </div>
      <span class="nav-badge">${f.item_count || 0}</span>
    </div>
  `).join('');
}

async function promptCreateFolder() {
  const name = prompt(window.i18n ? window.i18n.t('folderName') : 'Enter folder name:');
  if (name && name.trim()) {
    try {
      await window.api.createFolder(name.trim());
      if (window.utils) window.utils.showToast('Folder created!');
      window.refreshFolders();
    } catch (err) {
      if (window.utils) window.utils.showToast(err.message, 'warning');
    }
  }
}

function toggleMobileSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (sidebar && backdrop) {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('active');
  }
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (sidebar && backdrop) {
    sidebar.classList.remove('open');
    backdrop.classList.remove('active');
  }
}

window.updateSidebarBadges = updateSidebarBadges;
window.updateStorageMeter = updateStorageMeter;
window.renderFoldersList = renderFoldersList;
window.promptCreateFolder = promptCreateFolder;
window.toggleMobileSidebar = toggleMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;

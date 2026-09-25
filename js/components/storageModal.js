// ==========================================================
// KURO SYNC STORAGE MANAGER MODAL
// ==========================================================

function openStorageModal() {
  const modal = document.getElementById('storage-modal');
  if (!modal) return;

  modal.classList.add('active');
  renderStorageStats();
}

function closeStorageModal() {
  const modal = document.getElementById('storage-modal');
  if (modal) modal.classList.remove('active');
}

function renderStorageStats() {
  const used = window.currentStorage ? window.currentStorage.used : 0;
  const quota = window.currentStorage ? window.currentStorage.quota : 21474836480;

  const usedFormatted = window.utils.formatBytes(used);
  const quotaFormatted = window.utils.formatBytes(quota);
  const percent = Math.min(100, Math.max(1, (used / quota) * 100)).toFixed(1);

  const statsContainer = document.getElementById('storage-modal-stats');
  if (statsContainer) {
    statsContainer.innerHTML = `
      <div style="background:var(--bg-surface-subtle); padding:18px; border-radius:var(--radius-lg); border:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; font-weight:700;">
          <span>${usedFormatted} of ${quotaFormatted} used</span>
          <span class="tnum">${percent}%</span>
        </div>
        <div class="storage-meter" style="height:8px;">
          <div class="storage-fill" style="width:${percent}%;"></div>
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted);">
          Your private workspace includes high-speed cloud sync and object storage.
        </div>
      </div>
    `;
  }

  // Populate largest files
  const listContainer = document.getElementById('storage-large-files-list');
  if (listContainer) {
    const files = (window.currentItems || [])
      .filter(i => i.file_size > 0 && i.deleted_at === null)
      .sort((a, b) => b.file_size - a.file_size)
      .slice(0, 10);

    if (files.length === 0) {
      listContainer.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted);">No large files uploaded yet</div>';
      return;
    }

    listContainer.innerHTML = files.map(f => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
        <div>
          <div style="font-weight:600; font-size:0.875rem;">${escapeHtml(f.title)}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${window.utils.formatBytes(f.file_size)} • ${f.type.toUpperCase()}</div>
        </div>
        <button class="btn-card-action" style="color:var(--danger);" onclick="deleteItem('${f.id}')">
          Delete
        </button>
      </div>
    `).join('');
  }
}

window.openStorageModal = openStorageModal;
window.closeStorageModal = closeStorageModal;
window.renderStorageStats = renderStorageStats;

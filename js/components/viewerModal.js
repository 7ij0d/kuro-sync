// ==========================================================
// KURO SYNC DETAIL & PREVIEW MODAL
// ==========================================================

let activeViewerItem = null;
let autoSaveTimer = null;

function openItemViewer(itemId) {
  const item = (window.currentItems || []).find(i => i.id === itemId);
  if (!item) return;

  activeViewerItem = item;
  const modal = document.getElementById('viewer-modal');
  const titleEl = document.getElementById('viewer-title');
  const bodyEl = document.getElementById('viewer-body-content');
  const metaDeviceEl = document.getElementById('viewer-meta-device');
  const metaTimeEl = document.getElementById('viewer-meta-time');
  const metaSizeEl = document.getElementById('viewer-meta-size');
  const favoriteBtn = document.getElementById('viewer-fav-btn');

  if (!modal || !bodyEl) return;

  titleEl.textContent = item.title;
  metaDeviceEl.textContent = `${item.device_name || 'iPad'}`;
  metaTimeEl.textContent = window.utils.formatTime(item.created_at);
  metaSizeEl.textContent = item.file_size ? window.utils.formatBytes(item.file_size) : (item.type.toUpperCase());

  if (favoriteBtn) {
    favoriteBtn.textContent = item.is_favorite ? '★ Favorited' : '☆ Favorite';
  }

  // Render content based on type
  if (item.type === 'text' || item.type === 'clipboard' || item.type === 'note') {
    bodyEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;" id="viewer-autosave-status">Auto-saved</span>
          <button class="btn-card-action" onclick="copyViewerText()">
            ${window.i18n ? window.i18n.t('copy') : 'Copy Text'}
          </button>
        </div>
        <textarea id="viewer-text-editor" style="width:100%; min-height:260px; padding:14px; font-size:0.9375rem; line-height:1.6; resize:vertical;" placeholder="Write your notes here...">${escapeHtml(item.content || '')}</textarea>
      </div>
    `;

    // Setup live auto-save
    const editor = document.getElementById('viewer-text-editor');
    if (editor) {
      editor.addEventListener('input', () => {
        const statusEl = document.getElementById('viewer-autosave-status');
        if (statusEl) statusEl.textContent = 'Saving...';

        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(async () => {
          try {
            const newContent = editor.value;
            await window.api.updateItem(item.id, { content: newContent });
            item.content = newContent;
            if (statusEl) statusEl.textContent = 'Saved ✓';
            window.refreshItems();
          } catch (e) {
            if (statusEl) statusEl.textContent = 'Error saving';
          }
        }, 800);
      });
    }
  } else if (item.type === 'image') {
    const fileUrl = item.file_path 
      ? (item.file_path.startsWith('data:') || item.file_path.startsWith('http') || item.file_path.startsWith('./') || item.file_path.startsWith('assets') ? item.file_path : `/api/items/${item.id}/file`) 
      : '';

    bodyEl.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
        <div style="max-height:420px; width:100%; overflow:hidden; border-radius:var(--radius-lg); border:1px solid var(--border-subtle); background:var(--bg-surface-subtle); display:flex; align-items:center; justify-content:center;">
          <img src="${fileUrl}" alt="${item.title}" style="max-width:100%; max-height:420px; object-fit:contain;" />
        </div>
        <div style="display:flex; gap:12px;">
          <button class="btn-card-action" onclick="copyCardImage('${item.id}', this)">
            ${window.i18n ? window.i18n.t('copyImage') : 'نسخ الصورة'}
          </button>
          <button class="btn-primary" onclick="downloadItemFile('${item.id}')">
            ${window.i18n ? window.i18n.t('download') : 'تحميل'}
          </button>
        </div>

        <!-- Notes / Description Section for Image -->
        <div style="width:100%; margin-top:6px; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <label style="font-size:0.8125rem; font-weight:700; color:var(--text-secondary);">ملاحظات وشرح الصورة / Notes:</label>
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;" id="viewer-img-notes-status"></span>
          </div>
          <textarea id="viewer-img-notes" style="width:100%; min-height:90px; padding:10px 12px; font-size:0.875rem; line-height:1.6; resize:vertical; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-surface);" placeholder="أضف أو عدّل ملاحظاتك وشرحك لهذه الصورة هنا...">${escapeHtml(item.content || '')}</textarea>
        </div>
      </div>
    `;

    // Setup live auto-save for image notes
    const imgNotesEditor = document.getElementById('viewer-img-notes');
    if (imgNotesEditor) {
      imgNotesEditor.addEventListener('input', () => {
        const statusEl = document.getElementById('viewer-img-notes-status');
        if (statusEl) statusEl.textContent = 'جارٍ الحفظ...';

        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(async () => {
          try {
            const newContent = imgNotesEditor.value;
            await window.api.updateItem(item.id, { content: newContent });
            item.content = newContent;
            if (statusEl) statusEl.textContent = 'تم الحفظ ✓';
            window.refreshItems();
          } catch (e) {
            if (statusEl) statusEl.textContent = 'خطأ في الحفظ';
          }
        }, 800);
      });
    }
  } else if (item.type === 'file') {
    const isPdf = (item.mime_type && item.mime_type.includes('pdf')) || (item.file_name && item.file_name.toLowerCase().endsWith('.pdf'));
    const fileUrl = item.file_path 
      ? (item.file_path.startsWith('data:') || item.file_path.startsWith('http') || item.file_path.startsWith('./') || item.file_path.startsWith('assets') ? item.file_path : `/api/items/${item.id}/file`) 
      : `/api/items/${item.id}/file`;

    if (isPdf) {
      bodyEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:14px;">
          <iframe src="${fileUrl}#toolbar=0" style="width:100%; height:400px; border-radius:var(--radius-md); border:1px solid var(--border-subtle);" frameborder="0"></iframe>
          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button class="btn-secondary" onclick="window.open('${fileUrl}', '_blank')">${window.i18n ? window.i18n.t('open') : 'فتح في نافذة جديدة'}</button>
            <button class="btn-primary" onclick="downloadItemFile('${item.id}')">${window.i18n ? window.i18n.t('download') : 'تحميل'}</button>
          </div>

          <!-- Notes / Summary Section for PDF -->
          <div style="width:100%; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <label style="font-size:0.8125rem; font-weight:700; color:var(--text-secondary);">ملاحظات وملخص الملف / Notes:</label>
              <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;" id="viewer-file-notes-status"></span>
            </div>
            <textarea id="viewer-file-notes" style="width:100%; min-height:85px; padding:10px 12px; font-size:0.875rem; line-height:1.6; resize:vertical; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-surface);" placeholder="أضف أو عدّل ملاحظاتك أو ملخصك لهذا الملف هنا...">${escapeHtml(item.content || '')}</textarea>
          </div>
        </div>
      `;
    } else {
      bodyEl.innerHTML = `
        <div style="padding:20px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:16px;">
          <div style="width:64px; height:64px; border-radius:var(--radius-lg); background:var(--bg-surface-subtle); display:flex; align-items:center; justify-content:center; color:var(--burgundy-700);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div>
            <h4 style="font-size:1.125rem; font-weight:700;">${escapeHtml(item.file_name || item.title)}</h4>
            <p style="font-size:0.875rem; color:var(--text-muted);">${window.utils.formatBytes(item.file_size)} • ${item.mime_type || 'Document'}</p>
          </div>
          <button class="btn-primary" onclick="downloadItemFile('${item.id}')">
            ${window.i18n ? window.i18n.t('download') : 'تحميل'}
          </button>

          <!-- Notes / Summary Section for Document -->
          <div style="width:100%; text-align:initial; margin-top:10px; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <label style="font-size:0.8125rem; font-weight:700; color:var(--text-secondary);">ملاحظات وملخص الملف / Notes:</label>
              <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;" id="viewer-file-notes-status"></span>
            </div>
            <textarea id="viewer-file-notes" style="width:100%; min-height:85px; padding:10px 12px; font-size:0.875rem; line-height:1.6; resize:vertical; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-surface);" placeholder="أضف أو عدّل ملاحظاتك أو ملخصك لهذا الملف هنا...">${escapeHtml(item.content || '')}</textarea>
          </div>
        </div>
      `;
    }

    // Setup live auto-save for file notes
    const fileNotesEditor = document.getElementById('viewer-file-notes');
    if (fileNotesEditor) {
      fileNotesEditor.addEventListener('input', () => {
        const statusEl = document.getElementById('viewer-file-notes-status');
        if (statusEl) statusEl.textContent = 'جارٍ الحفظ...';

        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(async () => {
          try {
            const newContent = fileNotesEditor.value;
            await window.api.updateItem(item.id, { content: newContent });
            item.content = newContent;
            if (statusEl) statusEl.textContent = 'تم الحفظ ✓';
            window.refreshItems();
          } catch (e) {
            if (statusEl) statusEl.textContent = 'خطأ في الحفظ';
          }
        }, 800);
      });
    }
  } else if (item.type === 'link') {
    bodyEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px; padding:12px 0;">
        <div style="background:var(--bg-surface-subtle); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div style="font-size:1rem; font-weight:700; margin-bottom:4px;">${escapeHtml(item.title)}</div>
          <div style="font-size:0.875rem; color:var(--burgundy-700); word-break:break-all;">${escapeHtml(item.content)}</div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:12px;">
          <button class="btn-secondary" onclick="window.clipboardEngine.copyText('${escapeHtml(item.content)}')">${window.i18n ? window.i18n.t('copy') : 'نسخ الرابط'}</button>
          <button class="btn-primary" onclick="window.open('${escapeHtml(item.content)}', '_blank')">${window.i18n ? window.i18n.t('openLink') : 'فتح الرابط'}</button>
        </div>
      </div>
    `;
  }

  modal.classList.add('active');
}

function closeItemViewer() {
  const modal = document.getElementById('viewer-modal');
  if (modal) modal.classList.remove('active');
  activeViewerItem = null;
}

async function copyViewerText() {
  const editor = document.getElementById('viewer-text-editor');
  if (editor) {
    await window.clipboardEngine.copyText(editor.value);
  }
}

async function toggleViewerFavorite() {
  if (!activeViewerItem) return;
  const newFav = !activeViewerItem.is_favorite;
  await window.api.updateItem(activeViewerItem.id, { is_favorite: newFav });
  activeViewerItem.is_favorite = newFav;
  const btn = document.getElementById('viewer-fav-btn');
  if (btn) btn.textContent = newFav ? '★ Favorited' : '☆ Favorite';
  window.refreshItems();
}

async function deleteViewerItem() {
  if (!activeViewerItem) return;
  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  const confirmMsg = isAr 
    ? 'هل أنت متأكد من حذف هذا العنصر ونقله إلى سلة المحذوفات؟' 
    : 'Move this item to trash?';
  if (!confirm(confirmMsg)) return;

  const id = activeViewerItem.id;
  closeItemViewer();

  // Optimistic UI update
  window.currentItems = (window.currentItems || []).filter(i => String(i.id) !== String(id));
  if (window.renderItemsFeed) window.renderItemsFeed(window.currentItems);

  try {
    await window.api.deleteItem(id);
    if (window.utils) window.utils.showToast(isAr ? 'تم نقل العنصر إلى سلة المحذوفات' : 'Item moved to trash');
    window.refreshItems();
  } catch (err) {
    if (window.utils) window.utils.showToast(err.message, 'warning');
  }
}

function openViewerShare() {
  if (!activeViewerItem) return;
  window.openShareModal(activeViewerItem.id);
}

window.openItemViewer = openItemViewer;
window.closeItemViewer = closeItemViewer;
window.copyViewerText = copyViewerText;
window.toggleViewerFavorite = toggleViewerFavorite;
window.deleteViewerItem = deleteViewerItem;
window.openViewerShare = openViewerShare;

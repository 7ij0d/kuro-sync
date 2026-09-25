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
  const titleInput = document.getElementById('viewer-title-input');
  const bodyEl = document.getElementById('viewer-body-content');
  const metaDeviceEl = document.getElementById('viewer-meta-device');
  const metaTimeEl = document.getElementById('viewer-meta-time');
  const metaSizeEl = document.getElementById('viewer-meta-size');
  const favoriteBtn = document.getElementById('viewer-fav-btn');

  if (!modal || !bodyEl) return;

  if (titleInput) {
    titleInput.value = item.title || '';
  }
  activeViewerItem._newImageFilePath = null;
  activeViewerItem._newImageFileSize = null;

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
    const fileUrl = window.getItemFileUrl ? window.getItemFileUrl(item) : (typeof item.file_path === 'string' ? item.file_path : '');

    bodyEl.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
        <div style="max-height:420px; width:100%; overflow:hidden; border-radius:var(--radius-lg); border:1px solid var(--border-subtle); background:var(--bg-surface-subtle); display:flex; align-items:center; justify-content:center;">
          <img src="${fileUrl}" alt="${item.title}" style="max-width:100%; max-height:420px; object-fit:contain;" />
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; width:100%;">
          <button class="btn-card-action" onclick="copyCardImage('${item.id}', this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span class="btn-label">${window.i18n ? window.i18n.t('copyImage') : 'نسخ الصورة'}</span>
          </button>
          <button class="btn-card-action" onclick="copyViewerNotes('${item.id}', this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span class="btn-label">${window.i18n ? (window.i18n.t('copyText') || 'نسخ النص') : 'نسخ النص'}</span>
          </button>
          <button class="btn-card-action btn-card-both" onclick="copyViewerCombined('${item.id}', this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            <span class="btn-label">${window.i18n ? (window.i18n.t('copyBoth') || 'نسخ الاثنين معاً') : 'نسخ الاثنين معاً'}</span>
          </button>
          <button class="btn-card-action" onclick="document.getElementById('viewer-replace-image-input').click()" title="استبدال أو تغيير هذه الصورة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span class="btn-label">📷 تغيير الصورة</span>
          </button>
          <input type="file" id="viewer-replace-image-input" accept="image/*" style="display:none;" onchange="handleViewerImageReplace(this)" />
          <button class="btn-primary" onclick="downloadItemFile('${item.id}')">
            ⬇️ ${window.i18n ? window.i18n.t('download') : 'تحميل'}
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
    const fileUrl = window.getItemFileUrl ? window.getItemFileUrl(item) : (typeof item.file_path === 'string' ? item.file_path : `/api/items/${item.id}/file`);

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

async function copyViewerNotes(itemId, btn) {
  const editor = document.getElementById('viewer-img-notes') || document.getElementById('viewer-file-notes') || document.getElementById('viewer-text-editor');
  const text = editor ? editor.value : (activeViewerItem ? activeViewerItem.content : '');
  if (!text) {
    if (window.utils) window.utils.showToast('لا يوجد نص لنسخه في هذا العنصر', 'warning');
    return;
  }
  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  const success = await window.clipboardEngine.copyText(text, isAr ? 'تم نسخ النص بنجاح! 📝' : 'Copied text!');
  if (success && btn) {
    const label = btn.querySelector('.btn-label') || btn;
    const old = label.textContent;
    btn.classList.add('btn-copied');
    label.textContent = isAr ? '✓ تم النسخ' : '✓ Copied';
    setTimeout(() => {
      btn.classList.remove('btn-copied');
      label.textContent = old;
    }, 2000);
  }
}

async function copyViewerCombined(itemId, btn) {
  if (!activeViewerItem) return;
  const editor = document.getElementById('viewer-img-notes');
  const text = editor ? editor.value : (activeViewerItem.content || '');
  const imgUrl = window.getItemFileUrl ? window.getItemFileUrl(activeViewerItem) : (typeof activeViewerItem.file_path === 'string' ? activeViewerItem.file_path : `/api/items/${activeViewerItem.id}/file`);

  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  const success = await window.clipboardEngine.copyCombined(text, imgUrl, activeViewerItem.title || '');
  if (success && btn) {
    const label = btn.querySelector('.btn-label') || btn;
    const old = label.textContent;
    btn.classList.add('btn-copied');
    label.textContent = isAr ? '✓ تم نسخ الاثنين' : '✓ Copied';
    setTimeout(() => {
      btn.classList.remove('btn-copied');
      label.textContent = old;
    }, 2000);
  }
}

async function saveViewerItemChanges(btn) {
  if (!activeViewerItem) return;

  const titleInput = document.getElementById('viewer-title-input');
  const newTitle = titleInput ? titleInput.value.trim() : (activeViewerItem.title || '');
  if (!newTitle) {
    if (window.utils) window.utils.showToast('يرجى كتابة عنوان للعنصر', 'warning');
    return;
  }

  // Find active content / notes editor
  const textEditor = document.getElementById('viewer-text-editor');
  const imgNotes = document.getElementById('viewer-img-notes');
  const fileNotes = document.getElementById('viewer-file-notes');
  const newContent = textEditor ? textEditor.value : (imgNotes ? imgNotes.value : (fileNotes ? fileNotes.value : (activeViewerItem.content || '')));

  const updates = {
    title: newTitle,
    content: newContent
  };

  // If image was replaced
  if (activeViewerItem._newImageFilePath) {
    updates.file_path = activeViewerItem._newImageFilePath;
    if (activeViewerItem._newImageFileSize) {
      updates.file_size = activeViewerItem._newImageFileSize;
    }
    if (activeViewerItem._newThumbnail) {
      updates.thumbnail = activeViewerItem._newThumbnail;
    }
  }

  // Visual feedback on button
  let origText = '💾 حفظ التعديلات';
  if (btn) {
    const label = btn.querySelector('.btn-label') || btn;
    origText = label.textContent;
    btn.disabled = true;
    label.textContent = '⏳ جاري الحفظ...';
  }

  try {
    await window.api.updateItem(activeViewerItem.id, updates);
    Object.assign(activeViewerItem, updates);
    activeViewerItem._newImageFilePath = null;

    // Update in window.currentItems
    const idx = (window.currentItems || []).findIndex(i => String(i.id) === String(activeViewerItem.id));
    if (idx !== -1) {
      Object.assign(window.currentItems[idx], updates);
    }

    // Refresh Feed
    if (window.renderItemsFeed) {
      window.renderItemsFeed(window.currentItems);
    }

    // Update localStorage cache immediately
    if (window.KuroSupabase && window.KuroSupabase.setCachedItems) {
      window.KuroSupabase.setCachedItems(window.currentItems);
    }

    if (btn) {
      const label = btn.querySelector('.btn-label') || btn;
      label.textContent = '✓ تم الحفظ بنجاح!';
      btn.style.background = 'var(--success)';
      btn.style.borderColor = 'var(--success)';
      setTimeout(() => {
        btn.disabled = false;
        label.textContent = origText;
        btn.style.background = '';
        btn.style.borderColor = '';
      }, 2500);
    }

    const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
    if (window.utils) {
      window.utils.showToast(isAr ? 'تم حفظ العنوان والتعديلات بنجاح! 💾' : 'Title and changes saved! 💾');
    }
  } catch (err) {
    console.error('Failed to save changes:', err);
    if (btn) {
      btn.disabled = false;
      const label = btn.querySelector('.btn-label') || btn;
      label.textContent = origText;
    }
    if (window.utils) window.utils.showToast(err.message || 'خطأ في الحفظ', 'warning');
  }
}

async function handleViewerImageReplace(input) {
  if (!input.files || input.files.length === 0 || !activeViewerItem) return;
  const file = input.files[0];

  if (window.utils) window.utils.showToast('جاري معالجة وضغط الصورة الجديدة...', 'info');

  try {
    let compressedDataUrl = '';
    let thumbDataUrl = '';

    if (window.utils && window.utils.compressImage) {
      try {
        const comp = await window.utils.compressImage(file, 1200, 0.8);
        compressedDataUrl = (comp && comp.dataUrl) ? comp.dataUrl : (typeof comp === 'string' ? comp : '');
      } catch (e) {}
      try {
        const thumbComp = await window.utils.compressImage(file, 120, 0.6);
        thumbDataUrl = (thumbComp && thumbComp.dataUrl) ? thumbComp.dataUrl : (typeof thumbComp === 'string' ? thumbComp : '');
      } catch (e) {}
    }

    if (!compressedDataUrl) {
      compressedDataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
    }

    activeViewerItem._newImageFilePath = compressedDataUrl;
    activeViewerItem._newThumbnail = thumbDataUrl || compressedDataUrl;
    activeViewerItem._newImageFileSize = Math.round(compressedDataUrl.length * 0.75);

    // Update modal preview image immediately
    const imgEl = document.querySelector('#viewer-body-content img');
    if (imgEl) {
      imgEl.src = compressedDataUrl;
    }

    // Highlight save button
    const saveBtn = document.getElementById('viewer-save-btn');
    if (saveBtn) {
      saveBtn.style.animation = 'pulse 1s infinite alternate';
    }

    if (window.utils) {
      window.utils.showToast('تم تجهيز الصورة الجديدة! اضغط على "حفظ التعديلات" لتطبيقها 💾');
    }
  } catch (e) {
    if (window.utils) window.utils.showToast('فشل تجهيز الصورة: ' + e.message, 'warning');
  }
}

function openViewerShare() {
  if (!activeViewerItem) return;
  window.openShareModal(activeViewerItem.id);
}

window.openItemViewer = openItemViewer;
window.closeItemViewer = closeItemViewer;
window.copyViewerText = copyViewerText;
window.copyViewerNotes = copyViewerNotes;
window.copyViewerCombined = copyViewerCombined;
window.saveViewerItemChanges = saveViewerItemChanges;
window.handleViewerImageReplace = handleViewerImageReplace;
window.toggleViewerFavorite = toggleViewerFavorite;
window.deleteViewerItem = deleteViewerItem;
window.openViewerShare = openViewerShare;

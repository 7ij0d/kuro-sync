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
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:0.8125rem; font-weight:700; color:var(--text-secondary);">عنوان الملاحظة / Title:</label>
          <input type="text" id="viewer-body-title-input" value="${escapeHtml(item.title || '')}" style="width:100%; height:42px; padding:0 14px; font-size:1rem; font-weight:700; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary);" placeholder="أدخل عنواناً..." />
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between;">
          <label style="font-size:0.8125rem; font-weight:700; color:var(--text-secondary);">المحتوى والملاحظات / Content:</label>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn-card-action" onclick="copyViewerText()">
              ${window.i18n ? window.i18n.t('copy') : 'نسخ النص'}
            </button>
            <button class="btn-primary" id="viewer-body-save-btn" onclick="saveViewerItemChanges()" style="height:34px; padding-inline:16px; font-size:0.8125rem; font-weight:700;">
              💾 حفظ التعديلات
            </button>
          </div>
        </div>

        <textarea id="viewer-text-editor" style="width:100%; min-height:220px; padding:14px; font-size:0.9375rem; line-height:1.6; resize:vertical; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary);" placeholder="اكتب ملاحظاتك هنا...">${escapeHtml(item.content || '')}</textarea>
      </div>
    `;
  } else if (item.type === 'image') {
    const fileUrl = item.file_path 
      ? (item.file_path.startsWith('data:') || item.file_path.startsWith('http') || item.file_path.startsWith('./') || item.file_path.startsWith('assets') ? item.file_path : `/api/items/${item.id}/file`) 
      : '';

    bodyEl.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
        <div style="max-height:420px; width:100%; overflow:hidden; border-radius:var(--radius-lg); border:1px solid var(--border-subtle); background:var(--bg-surface-subtle); display:flex; align-items:center; justify-content:center; position:relative;">
          <img id="viewer-img-element" src="${fileUrl}" alt="${escapeHtml(item.title)}" style="max-width:100%; max-height:420px; object-fit:contain;" />
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

          <label class="btn-card-action" style="cursor:pointer;" title="تغيير الصورة واختيار صورة أخرى">
            <input type="file" id="viewer-replace-image-file" accept="image/*" style="display:none;" onchange="handleViewerReplaceImage(event)" />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span class="btn-label">🔄 تغيير الصورة</span>
          </label>

          <button class="btn-primary" onclick="downloadItemFile('${item.id}')">
            ⬇️ ${window.i18n ? window.i18n.t('download') : 'تحميل'}
          </button>
        </div>

        <!-- Title & Notes Editing Section -->
        <div style="width:100%; margin-top:8px; display:flex; flex-direction:column; gap:12px; background:var(--bg-surface-subtle); padding:16px; border-radius:var(--radius-lg); border:1px solid var(--border-subtle);">
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label style="font-size:0.8125rem; font-weight:700; color:var(--text-secondary);">عنوان الصورة / Title:</label>
            <input type="text" id="viewer-body-title-input" value="${escapeHtml(item.title || '')}" style="width:100%; height:40px; padding:0 12px; font-size:0.9375rem; font-weight:600; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary);" placeholder="أدخل عنواناً لهذه الصورة..." />
          </div>

          <div style="display:flex; flex-direction:column; gap:6px;">
            <label style="font-size:0.8125rem; font-weight:700; color:var(--text-secondary);">ملاحظات وشرح الصورة / Notes:</label>
            <textarea id="viewer-img-notes" style="width:100%; min-height:100px; padding:10px 12px; font-size:0.875rem; line-height:1.6; resize:vertical; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary);" placeholder="أضف أو عدّل ملاحظاتك وشرحك لهذه الصورة هنا...">${escapeHtml(item.content || '')}</textarea>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn-primary" id="viewer-body-save-btn" onclick="saveViewerItemChanges()" style="padding-inline:18px; font-weight:700;">
              💾 حفظ التعديلات
            </button>
          </div>
        </div>
      </div>
    `;
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

          <!-- Title & Notes / Summary Section for PDF -->
          <div style="width:100%; display:flex; flex-direction:column; gap:10px; background:var(--bg-surface-subtle); padding:16px; border-radius:var(--radius-lg); border:1px solid var(--border-subtle);">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:0.8125rem; font-weight:700; color:var(--text-secondary);">عنوان الملف / Title:</label>
              <input type="text" id="viewer-body-title-input" value="${escapeHtml(item.title || '')}" style="width:100%; height:40px; padding:0 12px; font-size:0.9375rem; font-weight:600; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary);" placeholder="أدخل عنواناً لهذا الملف..." />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:0.8125rem; font-weight:700; color:var(--text-secondary);">ملاحظات وملخص الملف / Notes:</label>
              <textarea id="viewer-file-notes" style="width:100%; min-height:85px; padding:10px 12px; font-size:0.875rem; line-height:1.6; resize:vertical; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary);" placeholder="أضف أو عدّل ملاحظاتك أو ملخصك لهذا الملف هنا...">${escapeHtml(item.content || '')}</textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn-primary" id="viewer-body-save-btn" onclick="saveViewerItemChanges()" style="padding-inline:18px; font-weight:700;">
                💾 حفظ التعديلات
              </button>
            </div>
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

          <!-- Title & Notes / Summary Section for Document -->
          <div style="width:100%; text-align:initial; margin-top:10px; display:flex; flex-direction:column; gap:10px; background:var(--bg-surface-subtle); padding:16px; border-radius:var(--radius-lg); border:1px solid var(--border-subtle);">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:0.8125rem; font-weight:700; color:var(--text-secondary);">عنوان الملف / Title:</label>
              <input type="text" id="viewer-body-title-input" value="${escapeHtml(item.title || '')}" style="width:100%; height:40px; padding:0 12px; font-size:0.9375rem; font-weight:600; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary);" placeholder="أدخل عنواناً لهذا الملف..." />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:0.8125rem; font-weight:700; color:var(--text-secondary);">ملاحظات وملخص الملف / Notes:</label>
              <textarea id="viewer-file-notes" style="width:100%; min-height:85px; padding:10px 12px; font-size:0.875rem; line-height:1.6; resize:vertical; border-radius:var(--radius-md); border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary);" placeholder="أضف أو عدّل ملاحظاتك أو ملخصك لهذا الملف هنا...">${escapeHtml(item.content || '')}</textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn-primary" id="viewer-body-save-btn" onclick="saveViewerItemChanges()" style="padding-inline:18px; font-weight:700;">
                💾 حفظ التعديلات
              </button>
            </div>
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
  const imgUrl = (activeViewerItem.file_path && (activeViewerItem.file_path.startsWith('data:') || activeViewerItem.file_path.startsWith('http') || activeViewerItem.file_path.startsWith('./') || activeViewerItem.file_path.startsWith('blob:')))
    ? activeViewerItem.file_path
    : `/api/items/${activeViewerItem.id}/file`;

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

async function saveViewerItemChanges() {
  if (!activeViewerItem) return;

  const btn = document.getElementById('viewer-save-btn');
  const bodyBtn = document.getElementById('viewer-body-save-btn');
  const statusIndicator = document.getElementById('viewer-save-status-indicator');
  const titleInput = document.getElementById('viewer-body-title-input');
  const notesTextarea = document.getElementById('viewer-img-notes') || document.getElementById('viewer-file-notes') || document.getElementById('viewer-text-editor');

  const newTitle = titleInput ? titleInput.value.trim() : activeViewerItem.title;
  const newContent = notesTextarea ? notesTextarea.value : activeViewerItem.content;

  const updates = {
    title: newTitle || activeViewerItem.title || 'Untitled',
    content: newContent !== undefined ? newContent : (activeViewerItem.content || '')
  };

  if (activeViewerItem.pendingNewImage) {
    updates.file_path = activeViewerItem.pendingNewImage;
    updates.file_size = activeViewerItem.pendingNewImageSize || activeViewerItem.file_size;
    delete activeViewerItem.pendingNewImage;
  }

  // Visual feedback
  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  const originalBtnText = btn ? btn.innerHTML : '💾 حفظ التعديلات';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ ${isAr ? 'جاري الحفظ...' : 'Saving...'}</span>`;
  }
  if (bodyBtn) {
    bodyBtn.disabled = true;
    bodyBtn.innerHTML = `<span>⏳ ${isAr ? 'جاري الحفظ...' : 'Saving...'}</span>`;
  }
  if (statusIndicator) {
    statusIndicator.style.color = 'var(--text-muted)';
    statusIndicator.textContent = isAr ? 'جارٍ الحفظ والمزامنة...' : 'Saving...';
  }

  try {
    // 1. Instant local memory update
    Object.assign(activeViewerItem, updates);

    // Update header title
    const headerTitle = document.getElementById('viewer-title');
    if (headerTitle) headerTitle.textContent = activeViewerItem.title;

    // 2. Persist to API / Supabase
    await window.api.updateItem(activeViewerItem.id, updates);

    // 3. Success feedback
    if (btn) {
      btn.style.background = 'var(--success)';
      btn.innerHTML = `<span>✓ ${isAr ? 'تم الحفظ بنجاح' : 'Saved!'}</span>`;
    }
    if (bodyBtn) {
      bodyBtn.style.background = 'var(--success)';
      bodyBtn.innerHTML = `<span>✓ ${isAr ? 'تم الحفظ' : 'Saved!'}</span>`;
    }
    if (statusIndicator) {
      statusIndicator.style.color = 'var(--success)';
      statusIndicator.textContent = isAr ? 'تم الحفظ والمزامنة بالسحابة ✓' : 'Saved & Synced ✓';
    }
    if (window.utils) {
      window.utils.showToast(isAr ? 'تم حفظ وتحديث التعديلات بنجاح! 💾' : 'Changes saved successfully!');
    }

    if (typeof window.refreshItems === 'function') {
      window.refreshItems();
    }

    setTimeout(() => {
      if (btn) {
        btn.disabled = false;
        btn.style.background = '';
        btn.innerHTML = isAr ? '💾 حفظ التعديلات' : '💾 Save Changes';
      }
      if (bodyBtn) {
        bodyBtn.disabled = false;
        bodyBtn.style.background = '';
        bodyBtn.innerHTML = isAr ? '💾 حفظ التعديلات' : '💾 Save Changes';
      }
    }, 2000);
  } catch (err) {
    console.error('Error saving viewer item changes:', err);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
    }
    if (bodyBtn) {
      bodyBtn.disabled = false;
      bodyBtn.innerHTML = isAr ? '💾 حفظ التعديلات' : '💾 Save Changes';
    }
    if (statusIndicator) {
      statusIndicator.style.color = 'var(--danger)';
      statusIndicator.textContent = isAr ? 'خطأ في الحفظ' : 'Save Error';
    }
    if (window.utils) {
      window.utils.showToast((isAr ? 'خطأ في الحفظ: ' : 'Error saving: ') + err.message, 'warning');
    }
  }
}

async function handleViewerReplaceImage(event) {
  const file = event.target.files && event.target.files[0];
  if (!file || !activeViewerItem) return;

  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  if (window.utils) window.utils.showToast(isAr ? 'جاري ضغط ومعالجة الصورة الجديدة...' : 'Optimizing new image...', 'info');

  try {
    let compressedDataUrl = '';
    if (window.utils && window.utils.compressImage) {
      compressedDataUrl = await window.utils.compressImage(file, 1400, 0.82);
    } else {
      compressedDataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
    }

    const imgEl = document.getElementById('viewer-img-element');
    if (imgEl) imgEl.src = compressedDataUrl;

    activeViewerItem.pendingNewImage = compressedDataUrl;
    activeViewerItem.pendingNewImageSize = Math.round(compressedDataUrl.length * 0.75);

    const sizeEl = document.getElementById('viewer-meta-size');
    if (sizeEl) sizeEl.textContent = window.utils ? window.utils.formatBytes(activeViewerItem.pendingNewImageSize) : 'New Image';

    if (window.utils) {
      window.utils.showToast(isAr ? 'تم تحديد الصورة الجديدة! اضغط "حفظ التعديلات" لتثبيتها 💾' : 'New image chosen! Click Save Changes to apply 💾');
    }
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
window.copyViewerNotes = copyViewerNotes;
window.copyViewerCombined = copyViewerCombined;
window.saveViewerItemChanges = saveViewerItemChanges;
window.handleViewerReplaceImage = handleViewerReplaceImage;
window.toggleViewerFavorite = toggleViewerFavorite;
window.deleteViewerItem = deleteViewerItem;
window.openViewerShare = openViewerShare;

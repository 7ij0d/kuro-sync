// ==========================================================
// KURO SYNC + NEW CAPTURE MODAL (WITH MULTI-IMAGE & ZERO-DELAY OPTIMISTIC SAVE)
// ==========================================================

let currentNewTab = 'text';
let currentModalFile = null;
let currentModalImages = [];

function openNewModal(tab = 'text') {
  currentNewTab = tab;
  currentModalFile = null;
  currentModalImages = [];
  const modal = document.getElementById('new-item-modal');
  if (!modal) return;

  switchNewTab(tab);
  populateFolderSelect();
  renderImageSelectionPreview();
  modal.classList.add('active');

  setTimeout(() => {
    if (tab === 'text') {
      const titleInput = document.getElementById('new-text-title');
      if (titleInput) titleInput.focus();
    } else if (tab === 'link') {
      const linkInput = document.getElementById('new-link-url');
      if (linkInput) linkInput.focus();
    }
  }, 100);
}

function closeNewModal() {
  const modal = document.getElementById('new-item-modal');
  if (modal) modal.classList.remove('active');
  resetNewForm();
}

function switchNewTab(tab) {
  currentNewTab = tab;

  // Toggle active button
  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Toggle pane visibility explicitly with style.display and class
  document.querySelectorAll('.tab-content-pane').forEach(pane => {
    const isTarget = pane.id === `tab-pane-${tab}`;
    pane.classList.toggle('active', isTarget);
    pane.style.display = isTarget ? 'block' : 'none';
  });

  setTimeout(() => {
    if (tab === 'text') {
      const titleInput = document.getElementById('new-text-title');
      if (titleInput) titleInput.focus();
    } else if (tab === 'link') {
      const linkInput = document.getElementById('new-link-url');
      if (linkInput) linkInput.focus();
    }
  }, 50);
}

// Add multiple image files to current selection
function addImageFiles(files) {
  if (!files || files.length === 0) return;
  const newFiles = Array.from(files).filter(f => f.type && f.type.startsWith('image/'));
  if (newFiles.length === 0) return;

  currentModalImages.push(...newFiles);

  // Maximum 20 images limit per post
  if (currentModalImages.length > 20) {
    currentModalImages = currentModalImages.slice(0, 20);
    const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
    if (window.utils) window.utils.showToast(isAr ? 'الحد الأقصى 20 صورة في المجموعة الواحدة' : 'Max 20 images per item', 'info');
  }

  const titleInput = document.getElementById('new-image-title');
  if (titleInput && !titleInput.value.trim() && currentModalImages[0]) {
    titleInput.value = currentModalImages[0].name.replace(/\.[^/.]+$/, '');
  }

  renderImageSelectionPreview();
}

// Remove single image from current selection
function removeSelectedImage(index) {
  if (index >= 0 && index < currentModalImages.length) {
    currentModalImages.splice(index, 1);
    renderImageSelectionPreview();
  }
}

// Render thumbnail preview strip for selected images
function renderImageSelectionPreview() {
  const previewContainer = document.getElementById('image-selection-preview');
  const gridEl = document.getElementById('image-preview-grid');
  const infoEl = document.getElementById('image-selection-info');

  if (!previewContainer || !gridEl) return;

  if (currentModalImages.length === 0) {
    previewContainer.style.display = 'none';
    gridEl.innerHTML = '';
    if (infoEl) infoEl.innerHTML = '';
    return;
  }

  previewContainer.style.display = 'block';
  gridEl.innerHTML = '';

  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  let totalBytes = 0;

  currentModalImages.forEach((file, idx) => {
    totalBytes += file.size;
    let thumbUrl = '';
    try {
      thumbUrl = URL.createObjectURL(file);
    } catch (e) {
      thumbUrl = '';
    }

    const card = document.createElement('div');
    card.style.cssText = 'position:relative; width:84px; height:72px; border-radius:var(--radius-md); overflow:hidden; border:1px solid var(--border-subtle); flex-shrink:0; background:var(--bg-surface-subtle); box-shadow:0 2px 6px rgba(0,0,0,0.08);';
    card.innerHTML = `
      <img src="${thumbUrl}" alt="${escapeHtml(file.name)}" style="width:100%; height:100%; object-fit:cover;" />
      <span style="position:absolute; bottom:3px; inset-inline-start:3px; background:rgba(0,0,0,0.7); color:#fff; font-size:0.625rem; font-weight:700; padding:1px 5px; border-radius:var(--radius-sm); pointer-events:none;">${idx + 1}</span>
      <button type="button" onclick="removeSelectedImage(${idx})" title="${isAr ? 'إزالة' : 'Remove'}" style="position:absolute; top:3px; inset-inline-end:3px; width:20px; height:20px; border-radius:50%; background:rgba(18,18,20,0.78); color:#fff; border:1px solid rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:11px; cursor:pointer; line-height:1; transition:all 0.15s;">✕</button>
    `;
    gridEl.appendChild(card);
  });

  if (infoEl) {
    const sizeStr = window.utils ? window.utils.formatBytes(totalBytes) : totalBytes + ' B';
    const count = currentModalImages.length;
    if (isAr) {
      const word = count === 1 ? 'صورة مختارة' : (count === 2 ? 'صورتان مختارتان' : (count <= 10 ? 'صور مختارة' : 'صورة مختارة'));
      infoEl.innerHTML = `🖼️ <b>${count}</b> ${word} <span style="font-size:0.75rem; color:var(--text-muted); margin-inline-start:8px;">(${sizeStr})</span>`;
    } else {
      infoEl.innerHTML = `🖼️ <b>${count}</b> ${count === 1 ? 'image selected' : 'images selected'} <span style="font-size:0.75rem; color:var(--text-muted); margin-inline-start:8px;">(${sizeStr})</span>`;
    }
  }
}

// Set document file and render info
function setDocumentFile(file) {
  currentModalFile = file;
  const infoEl = document.getElementById('file-selection-info');
  const titleInput = document.getElementById('new-file-title');

  if (titleInput && !titleInput.value.trim()) {
    titleInput.value = file.name.replace(/\.[^/.]+$/, '');
  }

  if (infoEl) {
    infoEl.style.display = 'block';
    infoEl.innerHTML = `📄 <b>${escapeHtml(file.name)}</b> <span style="font-size:0.75rem; color:var(--text-muted); margin-inline-start:8px;">(${window.utils ? window.utils.formatBytes(file.size) : file.size + ' B'})</span>`;
  }
}

// Handle file/image selected from input picker
function handleFileSelected(input, type) {
  if (!input || !input.files || input.files.length === 0) return;

  if (type === 'file') {
    setDocumentFile(input.files[0]);
  } else if (type === 'image') {
    addImageFiles(input.files);
    input.value = ''; // Reset input so same files can be re-selected if desired
  }
}

// Paste Image from Clipboard button
async function pasteImageFromClipboard() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      if (window.utils) window.utils.showToast('اضغط Ctrl+V للصق الصورة مباشرة من الحافظة', 'info');
      return;
    }

    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const ext = type.split('/')[1] || 'png';
          const file = new File([blob], `pasted_image_${Date.now()}.${ext}`, { type });
          addImageFiles([file]);
          if (window.utils) window.utils.showToast('تم التقاط ولصق الصورة بنجاح!');
          return;
        }
      }
    }
    if (window.utils) window.utils.showToast('لا توجد صورة منسوخة في الحافظة. اضغط Ctrl+C ثم جرب ثانية', 'warning');
  } catch (err) {
    if (window.utils) window.utils.showToast('اضغط Ctrl+V داخل النافذة للصق الصورة مباشرة', 'info');
  }
}

// Paste File from Clipboard button
async function pasteFileFromClipboard() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      if (window.utils) window.utils.showToast('اضغط Ctrl+V للصق الملف من الحافظة', 'info');
      return;
    }

    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type === 'application/pdf' || type.startsWith('application/')) {
          const blob = await item.getType(type);
          const file = new File([blob], `pasted_document_${Date.now()}.pdf`, { type });
          setDocumentFile(file);
          if (window.utils) window.utils.showToast('تم التقاط ولصق الملف بنجاح!');
          return;
        }
      }
    }
    if (window.utils) window.utils.showToast('اضغط Ctrl+V داخل النافذة للصق الملف مباشرة', 'info');
  } catch (err) {
    if (window.utils) window.utils.showToast('اضغط Ctrl+V للصق الملف مباشرة', 'info');
  }
}

// Setup Paste Listener on the modal
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('new-item-modal');
  if (modal) {
    modal.addEventListener('paste', (e) => {
      // Don't intercept if user is typing text in text tab
      if (currentNewTab === 'text' && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      if (!items || items.length === 0) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            e.stopPropagation();

            if (file.type.startsWith('image/')) {
              switchNewTab('image');
              addImageFiles([file]);
              if (window.utils) window.utils.showToast('تم لصق الصورة بنجاح!');
            } else {
              switchNewTab('file');
              setDocumentFile(file);
              if (window.utils) window.utils.showToast('تم لصق الملف بنجاح!');
            }
            return;
          }
        }
      }
    });
  }
});

function populateFolderSelect() {
  const select = document.getElementById('new-item-folder');
  if (!select) return;

  select.innerHTML = '<option value="">(No Folder)</option>';
  if (window.currentFolders && window.currentFolders.length > 0) {
    window.currentFolders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      select.appendChild(opt);
    });
  }
}

function resetNewForm() {
  currentModalFile = null;
  currentModalImages = [];
  const textTitle = document.getElementById('new-text-title');
  const textContent = document.getElementById('new-text-content');
  const linkUrl = document.getElementById('new-link-url');
  const linkTitle = document.getElementById('new-link-title');
  const fileInput = document.getElementById('new-file-input');
  const fileTitle = document.getElementById('new-file-title');
  const fileNotes = document.getElementById('new-file-notes');
  const imageInput = document.getElementById('new-image-input');
  const imageTitle = document.getElementById('new-image-title');
  const imageNotes = document.getElementById('new-image-notes');
  const clipboardPreview = document.getElementById('clipboard-preview-content');
  const fileInfo = document.getElementById('file-selection-info');

  if (textTitle) textTitle.value = '';
  if (textContent) textContent.value = '';
  if (linkUrl) linkUrl.value = '';
  if (linkTitle) linkTitle.value = '';
  if (fileInput) fileInput.value = '';
  if (fileTitle) fileTitle.value = '';
  if (fileNotes) fileNotes.value = '';
  if (imageInput) imageInput.value = '';
  if (imageTitle) imageTitle.value = '';
  if (imageNotes) imageNotes.value = '';
  if (fileInfo) fileInfo.style.display = 'none';
  if (clipboardPreview) clipboardPreview.textContent = 'Click "Read Clipboard" to load content';

  renderImageSelectionPreview();
}

// Read Clipboard into modal
async function handleReadClipboardIntoModal() {
  try {
    const text = await window.clipboardEngine.readFromClipboard();
    const preview = document.getElementById('clipboard-preview-content');
    if (preview) {
      preview.textContent = text || '(Clipboard is empty)';
      preview.dataset.content = text || '';
    }
  } catch (err) {
    if (window.utils) window.utils.showToast('Please allow clipboard access or paste directly', 'warning');
  }
}

// Submit New Item with ZERO-DELAY Instant Optimistic UI
async function submitNewItem() {
  const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
  const folderId = document.getElementById('new-item-folder') ? document.getElementById('new-item-folder').value : null;
  const isFavorite = document.getElementById('new-item-favorite') ? document.getElementById('new-item-favorite').checked : false;

  try {
    // ----------------------------------------------------
    // 1. TEXT TAB
    // ----------------------------------------------------
    if (currentNewTab === 'text') {
      const title = document.getElementById('new-text-title').value.trim();
      const content = document.getElementById('new-text-content').value.trim();
      if (!title && !content) {
        if (window.utils) window.utils.showToast(isAr ? 'يرجى كتابة نص أو عنوان' : 'Please enter text content or title', 'warning');
        return;
      }

      const tempId = 'temp-text-' + Date.now();
      const optItem = {
        id: tempId,
        type: 'text',
        title: title || 'Note',
        content,
        folder_id: folderId,
        is_favorite: isFavorite ? 1 : 0,
        device_name: window.KuroSupabase ? window.KuroSupabase.detectDeviceName() : 'iPad',
        device_type: window.KuroSupabase ? window.KuroSupabase.detectDeviceType() : 'ipad',
        created_at: new Date().toISOString(),
        deleted_at: null
      };

      // Optimistic instant insertion (0ms)
      if (!window.currentItems) window.currentItems = [];
      window.currentItems.unshift(optItem);
      if (window.renderItemsFeed) window.renderItemsFeed(window.currentItems);

      // Close modal instantly
      closeNewModal();
      if (window.utils) window.utils.showToast(isAr ? 'تم حفظ ومزامنة الملاحظة بنجاح ☁️' : 'Note saved & synced!');

      // Background persistence
      (async () => {
        try {
          const res = await window.api.createTextItem({ title: optItem.title, content, folder_id: folderId, is_favorite: isFavorite, type: 'text' });
          const realItem = (res && res.item) ? res.item : res;
          if (realItem && realItem.id) {
            const idx = window.currentItems.findIndex(i => String(i.id) === String(tempId));
            if (idx !== -1) window.currentItems[idx] = realItem;
            if (window.renderItemsFeed) window.renderItemsFeed(window.currentItems);
            if (window.KuroSupabase && window.KuroSupabase.setCachedItems) window.KuroSupabase.setCachedItems(window.currentItems);
          }
        } catch (e) {
          console.warn('Text save background error:', e);
        }
      })();
    }

    // ----------------------------------------------------
    // 2. CLIPBOARD TAB
    // ----------------------------------------------------
    else if (currentNewTab === 'clipboard') {
      const preview = document.getElementById('clipboard-preview-content');
      const content = preview ? (preview.dataset.content || preview.textContent) : '';
      if (!content || content.includes('Click "Read Clipboard"')) {
        if (window.utils) window.utils.showToast(isAr ? 'يرجى قراءة أو لصق محتوى الحافظة أولاً' : 'Please read or paste clipboard content first', 'warning');
        return;
      }

      const tempId = 'temp-clip-' + Date.now();
      const firstLine = content.split('\n')[0].trim().substring(0, 45) || 'Clipboard';
      const optItem = {
        id: tempId,
        type: 'clipboard',
        title: firstLine,
        content,
        folder_id: folderId,
        is_favorite: isFavorite ? 1 : 0,
        device_name: window.KuroSupabase ? window.KuroSupabase.detectDeviceName() : 'iPad',
        device_type: window.KuroSupabase ? window.KuroSupabase.detectDeviceType() : 'ipad',
        created_at: new Date().toISOString(),
        deleted_at: null
      };

      if (!window.currentItems) window.currentItems = [];
      window.currentItems.unshift(optItem);
      if (window.renderItemsFeed) window.renderItemsFeed(window.currentItems);

      closeNewModal();
      if (window.utils) window.utils.showToast(isAr ? 'تم حفظ الحافظة ومزامنتها بنجاح ☁️' : 'Clipboard item saved & synced!');

      (async () => {
        try {
          const res = await window.api.createTextItem({ content, folder_id: folderId, is_favorite: isFavorite, type: 'clipboard' });
          const realItem = (res && res.item) ? res.item : res;
          if (realItem && realItem.id) {
            const idx = window.currentItems.findIndex(i => String(i.id) === String(tempId));
            if (idx !== -1) window.currentItems[idx] = realItem;
            if (window.renderItemsFeed) window.renderItemsFeed(window.currentItems);
            if (window.KuroSupabase && window.KuroSupabase.setCachedItems) window.KuroSupabase.setCachedItems(window.currentItems);
          }
        } catch (e) {
          console.warn('Clipboard save background error:', e);
        }
      })();
    }

    // ----------------------------------------------------
    // 3. LINK TAB
    // ----------------------------------------------------
    else if (currentNewTab === 'link') {
      const url = document.getElementById('new-link-url').value.trim();
      const title = document.getElementById('new-link-title').value.trim();
      if (!url) {
        if (window.utils) window.utils.showToast(isAr ? 'يرجى إدخال الرابط' : 'Please enter a URL', 'warning');
        return;
      }

      const tempId = 'temp-link-' + Date.now();
      const optItem = {
        id: tempId,
        type: 'link',
        title: title || url,
        content: url,
        folder_id: folderId,
        is_favorite: isFavorite ? 1 : 0,
        device_name: window.KuroSupabase ? window.KuroSupabase.detectDeviceName() : 'iPad',
        device_type: window.KuroSupabase ? window.KuroSupabase.detectDeviceType() : 'ipad',
        created_at: new Date().toISOString(),
        deleted_at: null
      };

      if (!window.currentItems) window.currentItems = [];
      window.currentItems.unshift(optItem);
      if (window.renderItemsFeed) window.renderItemsFeed(window.currentItems);

      closeNewModal();
      if (window.utils) window.utils.showToast(isAr ? 'تم حفظ الرابط ومزامنته بنجاح ☁️' : 'Link saved & synced!');

      (async () => {
        try {
          const res = await window.api.saveLink({ url, title, folder_id: folderId, is_favorite: isFavorite });
          const realItem = (res && res.item) ? res.item : res;
          if (realItem && realItem.id) {
            const idx = window.currentItems.findIndex(i => String(i.id) === String(tempId));
            if (idx !== -1) window.currentItems[idx] = realItem;
            if (window.renderItemsFeed) window.renderItemsFeed(window.currentItems);
            if (window.KuroSupabase && window.KuroSupabase.setCachedItems) window.KuroSupabase.setCachedItems(window.currentItems);
          }
        } catch (e) {
          console.warn('Link save background error:', e);
        }
      })();
    }

    // ----------------------------------------------------
    // 4. FILE TAB
    // ----------------------------------------------------
    else if (currentNewTab === 'file') {
      const fileInput = document.getElementById('new-file-input');
      const file = currentModalFile || (fileInput && fileInput.files ? fileInput.files[0] : null);
      if (!file) {
        if (window.utils) window.utils.showToast(isAr ? 'يرجى اختيار أو لصق ملف للرفع' : 'Please select or paste a file to upload', 'warning');
        return;
      }

      const fileTitleInput = document.getElementById('new-file-title');
      const fileNotesInput = document.getElementById('new-file-notes');
      const title = (fileTitleInput && fileTitleInput.value.trim()) ? fileTitleInput.value.trim() : file.name;
      const content = (fileNotesInput && fileNotesInput.value.trim()) ? fileNotesInput.value.trim() : '';

      const tempId = 'temp-file-' + Date.now();
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type.includes('pdf'));
      let localUrl = '';
      try { localUrl = URL.createObjectURL(file); } catch (e) {}

      const optItem = {
        id: tempId,
        type: 'file',
        title,
        content,
        file_name: file.name,
        file_path: localUrl,
        thumbnail: '',
        file_size: file.size,
        mime_type: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
        folder_id: folderId,
        is_favorite: isFavorite ? 1 : 0,
        device_name: window.KuroSupabase ? window.KuroSupabase.detectDeviceName() : 'iPad',
        device_type: window.KuroSupabase ? window.KuroSupabase.detectDeviceType() : 'ipad',
        created_at: new Date().toISOString(),
        deleted_at: null,
        _isOptimistic: true
      };

      if (!window.currentItems) window.currentItems = [];
      window.currentItems.unshift(optItem);
      if (window.renderItemsFeed) window.renderItemsFeed(window.currentItems);

      closeNewModal();
      if (window.utils) window.utils.showToast(isAr ? 'تمت إضافة الملف! جارٍ الرفع والمزامنة ☁️...' : `Uploading ${file.name}...`, 'info');

      (async () => {
        try {
          const res = await window.api.uploadFile(file, folderId, false, { title, content, is_favorite: isFavorite });
          const realItem = (res && res.item) ? res.item : res;
          if (realItem && realItem.id) {
            const idx = window.currentItems.findIndex(i => String(i.id) === String(tempId));
            if (idx !== -1) window.currentItems[idx] = realItem;
            if (window.renderItemsFeed) window.renderItemsFeed(window.currentItems);
            if (window.KuroSupabase && window.KuroSupabase.setCachedItems) window.KuroSupabase.setCachedItems(window.currentItems);
            if (window.utils) window.utils.showToast(isAr ? 'اكتمل رفع الملف والمزامنة بنجاح ☁️' : 'File uploaded & synced!');
          }
        } catch (e) {
          console.warn('File upload background error:', e);
          if (window.utils) window.utils.showToast(isAr ? 'تعذر رفع الملف' : 'Upload failed', 'warning');
        }
      })();
    }

    // ----------------------------------------------------
    // 5. IMAGE TAB (MULTI-IMAGE & SINGLE IMAGE WITH ZERO DELAY)
    // ----------------------------------------------------
    else if (currentNewTab === 'image') {
      const imageInput = document.getElementById('new-image-input');
      let filesToUpload = [...currentModalImages];
      if (filesToUpload.length === 0 && imageInput && imageInput.files && imageInput.files.length > 0) {
        filesToUpload = Array.from(imageInput.files).filter(f => f.type && f.type.startsWith('image/'));
      }
      if (filesToUpload.length === 0 && currentModalFile) {
        filesToUpload = [currentModalFile];
      }

      if (filesToUpload.length === 0) {
        if (window.utils) window.utils.showToast(isAr ? 'يرجى اختيار أو لصق صورة واحدة على الأقل' : 'Please select or paste at least one image', 'warning');
        return;
      }

      const imageTitleInput = document.getElementById('new-image-title');
      const imageNotesInput = document.getElementById('new-image-notes');
      const title = (imageTitleInput && imageTitleInput.value.trim()) 
        ? imageTitleInput.value.trim() 
        : filesToUpload[0].name.replace(/\.[^/.]+$/, '');
      const content = (imageNotesInput && imageNotesInput.value.trim()) ? imageNotesInput.value.trim() : '';

      // Instant optimistic item creation with local Object URLs
      const tempPreviews = filesToUpload.map((f, i) => {
        let objUrl = '';
        try { objUrl = URL.createObjectURL(f); } catch (e) {}
        return {
          id: 'temp-img-' + Date.now() + '-' + i,
          url: objUrl,
          thumbnail: objUrl,
          name: f.name,
          size: f.size
        };
      });

      const tempId = 'temp-img-item-' + Date.now();
      const totalSize = filesToUpload.reduce((sum, f) => sum + f.size, 0);

      const optItem = {
        id: tempId,
        type: 'image',
        title,
        content,
        file_name: filesToUpload.map(f => f.name).join(', '),
        file_path: tempPreviews[0].url,
        thumbnail: tempPreviews[0].thumbnail,
        images: tempPreviews,
        image_count: tempPreviews.length,
        file_size: totalSize,
        mime_type: filesToUpload[0].type || 'image/jpeg',
        folder_id: folderId,
        is_favorite: isFavorite ? 1 : 0,
        device_name: window.KuroSupabase ? window.KuroSupabase.detectDeviceName() : 'iPad',
        device_type: window.KuroSupabase ? window.KuroSupabase.detectDeviceType() : 'ipad',
        created_at: new Date().toISOString(),
        deleted_at: null,
        _isOptimistic: true
      };

      // 1. Instantly display in feed
      if (!window.currentItems) window.currentItems = [];
      window.currentItems.unshift(optItem);
      if (window.renderItemsFeed) window.renderItemsFeed(window.currentItems);

      // 2. Instantly dismiss modal (0ms UI latency!)
      closeNewModal();

      const countMsg = filesToUpload.length > 1 
        ? (isAr ? `تمت إضافة ${filesToUpload.length} صور! جارٍ الضغط والمزامنة السحابية ☁️` : `Added ${filesToUpload.length} images! Syncing...`)
        : (isAr ? 'تمت إضافة الصورة! جارٍ الضغط والمزامنة السحابية ☁️' : 'Added image! Syncing...');
      if (window.utils) window.utils.showToast(countMsg, 'info');

      // 3. Perform image compression & Supabase upload silently in the background
      (async () => {
        try {
          const res = filesToUpload.length > 1
            ? await window.api.uploadImages(filesToUpload, folderId, { title, content, is_favorite: isFavorite })
            : await window.api.uploadFile(filesToUpload[0], folderId, false, { title, content, is_favorite: isFavorite });

          const realItem = (res && res.item) ? res.item : res;
          if (realItem && realItem.id) {
            const idx = window.currentItems.findIndex(i => String(i.id) === String(tempId));
            if (idx !== -1) {
              window.currentItems[idx] = realItem;
            }
            if (window.renderItemsFeed) window.renderItemsFeed(window.currentItems);
            if (window.KuroSupabase && window.KuroSupabase.setCachedItems) {
              window.KuroSupabase.setCachedItems(window.currentItems);
            }
            if (window.utils) {
              const doneMsg = filesToUpload.length > 1
                ? (isAr ? `اكتملت مزامنة ${filesToUpload.length} صور في السحابة بنجاح ☁️` : `Synced ${filesToUpload.length} images to cloud ☁️`)
                : (isAr ? 'اكتملت المزامنة السحابية للصورة بنجاح ☁️' : 'Image synced to cloud ☁️');
              window.utils.showToast(doneMsg);
            }
          }
        } catch (err) {
          console.error('Multi-image background upload error:', err);
          if (window.utils) {
            window.utils.showToast(isAr ? 'تعذر إتمام المزامنة السحابية: ' + (err.message || '') : 'Cloud sync error: ' + err.message, 'warning');
          }
        }
      })();
    }
  } catch (err) {
    console.error('submitNewItem error:', err);
    if (window.utils) window.utils.showToast(err.message || 'Action failed', 'warning');
  }
}

window.openNewModal = openNewModal;
window.closeNewModal = closeNewModal;
window.switchNewTab = switchNewTab;
window.addImageFiles = addImageFiles;
window.removeSelectedImage = removeSelectedImage;
window.renderImageSelectionPreview = renderImageSelectionPreview;
window.handleFileSelected = handleFileSelected;
window.pasteImageFromClipboard = pasteImageFromClipboard;
window.pasteFileFromClipboard = pasteFileFromClipboard;
window.handleReadClipboardIntoModal = handleReadClipboardIntoModal;
window.submitNewItem = submitNewItem;

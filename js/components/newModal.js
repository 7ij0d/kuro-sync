// ==========================================================
// KURO SYNC + NEW CAPTURE MODAL (WITH PASTE SUPPORT)
// ==========================================================

let currentNewTab = 'text';
let currentModalFile = null;

function openNewModal(tab = 'text') {
  currentNewTab = tab;
  currentModalFile = null;
  const modal = document.getElementById('new-item-modal');
  if (!modal) return;

  switchNewTab(tab);
  populateFolderSelect();
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

// Set image file and render preview
function setImageFile(file) {
  currentModalFile = file;
  const previewContainer = document.getElementById('image-selection-preview');
  const imgEl = document.getElementById('image-preview-img');
  const infoEl = document.getElementById('image-selection-info');
  const titleInput = document.getElementById('new-image-title');

  if (titleInput && !titleInput.value.trim()) {
    titleInput.value = file.name.replace(/\.[^/.]+$/, '');
  }

  if (previewContainer && imgEl) {
    const reader = new FileReader();
    reader.onload = (e) => {
      imgEl.src = e.target.result;
      previewContainer.style.display = 'block';
      if (infoEl) {
        infoEl.innerHTML = `🖼️ <b>${escapeHtml(file.name)}</b> <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px;">(${window.utils ? window.utils.formatBytes(file.size) : file.size + ' B'})</span>`;
      }
    };
    reader.readAsDataURL(file);
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
    infoEl.innerHTML = `📄 <b>${escapeHtml(file.name)}</b> <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px;">(${window.utils ? window.utils.formatBytes(file.size) : file.size + ' B'})</span>`;
  }
}

// Handle file/image selected from input picker
function handleFileSelected(input, type) {
  const file = input && input.files ? input.files[0] : null;
  if (!file) return;

  if (type === 'file') {
    setDocumentFile(file);
  } else if (type === 'image') {
    setImageFile(file);
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
          setImageFile(file);
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
              setImageFile(file);
              if (window.utils) window.utils.showToast('تم لصق الصورة المنسوخة بنجاح!');
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
  const imgPreview = document.getElementById('image-selection-preview');

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
  if (imgPreview) imgPreview.style.display = 'none';
  if (clipboardPreview) clipboardPreview.textContent = 'Click "Read Clipboard" to load content';
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

// Submit New Item
async function submitNewItem() {
  const folderId = document.getElementById('new-item-folder') ? document.getElementById('new-item-folder').value : null;
  const isFavorite = document.getElementById('new-item-favorite') ? document.getElementById('new-item-favorite').checked : false;

  try {
    if (currentNewTab === 'text') {
      const title = document.getElementById('new-text-title').value;
      const content = document.getElementById('new-text-content').value;
      if (!title.trim() && !content.trim()) {
        if (window.utils) window.utils.showToast('Please enter text content or title', 'warning');
        return;
      }

      await window.api.createTextItem({ title, content, folder_id: folderId, is_favorite: isFavorite, type: 'text' });
      if (window.utils) window.utils.showToast('Text note saved & synced across devices!');
      closeNewModal();
      window.refreshItems();
    } else if (currentNewTab === 'clipboard') {
      const preview = document.getElementById('clipboard-preview-content');
      const content = preview ? (preview.dataset.content || preview.textContent) : '';
      if (!content || content.includes('Click "Read Clipboard"')) {
        if (window.utils) window.utils.showToast('Please read or paste clipboard content first', 'warning');
        return;
      }

      await window.api.createTextItem({ content, folder_id: folderId, is_favorite: isFavorite, type: 'clipboard' });
      if (window.utils) window.utils.showToast('Clipboard item saved & synced!');
      closeNewModal();
      window.refreshItems();
    } else if (currentNewTab === 'link') {
      const url = document.getElementById('new-link-url').value;
      const title = document.getElementById('new-link-title').value;
      if (!url.trim()) {
        if (window.utils) window.utils.showToast('Please enter a URL', 'warning');
        return;
      }

      await window.api.saveLink({ url, title, folder_id: folderId, is_favorite: isFavorite });
      if (window.utils) window.utils.showToast('Link saved & synced!');
      closeNewModal();
      window.refreshItems();
    } else if (currentNewTab === 'file') {
      const fileInput = document.getElementById('new-file-input');
      const file = currentModalFile || (fileInput && fileInput.files ? fileInput.files[0] : null);
      if (!file) {
        if (window.utils) window.utils.showToast('Please select or paste a file to upload', 'warning');
        return;
      }

      const fileTitleInput = document.getElementById('new-file-title');
      const fileNotesInput = document.getElementById('new-file-notes');
      const title = (fileTitleInput && fileTitleInput.value.trim()) ? fileTitleInput.value.trim() : file.name;
      const content = (fileNotesInput && fileNotesInput.value.trim()) ? fileNotesInput.value.trim() : '';

      if (window.utils) window.utils.showToast(`Uploading ${file.name}...`, 'info');
      await window.api.uploadFile(file, folderId, false, { title, content, is_favorite: isFavorite });
      if (window.utils) window.utils.showToast('File uploaded & synced!');
      closeNewModal();
      window.refreshItems();
    } else if (currentNewTab === 'image') {
      const imageInput = document.getElementById('new-image-input');
      const file = currentModalFile || (imageInput && imageInput.files ? imageInput.files[0] : null);
      if (!file) {
        if (window.utils) window.utils.showToast('Please select or paste an image to upload', 'warning');
        return;
      }

      const imageTitleInput = document.getElementById('new-image-title');
      const imageNotesInput = document.getElementById('new-image-notes');
      const title = (imageTitleInput && imageTitleInput.value.trim()) ? imageTitleInput.value.trim() : file.name;
      const content = (imageNotesInput && imageNotesInput.value.trim()) ? imageNotesInput.value.trim() : '';

      if (window.utils) window.utils.showToast(`Uploading ${file.name}...`, 'info');
      await window.api.uploadFile(file, folderId, false, { title, content, is_favorite: isFavorite });
      if (window.utils) window.utils.showToast('Image uploaded & synced!');
      closeNewModal();
      window.refreshItems();
    }
  } catch (err) {
    if (err.data && err.data.duplicate) {
      handleDuplicateModal(err.data.existingItem, currentNewTab);
    } else {
      if (window.utils) window.utils.showToast(err.message || 'Action failed', 'warning');
    }
  }
}

// Handle Duplicate Dialog
function handleDuplicateModal(existingItem, tab) {
  if (confirm(`This item already exists ("${existingItem.title}"). Do you want to keep both copies?`)) {
    if (tab === 'text') {
      const title = document.getElementById('new-text-title').value;
      const content = document.getElementById('new-text-content').value;
      window.api.createTextItem({ title, content, type: 'text' }, true).then(() => {
        closeNewModal();
        window.refreshItems();
      });
    } else if (tab === 'file' || tab === 'image') {
      const file = currentModalFile || (document.getElementById('new-file-input').files[0]);
      if (file) {
        window.api.uploadFile(file, null, true).then(() => {
          closeNewModal();
          window.refreshItems();
        });
      }
    }
  }
}

window.openNewModal = openNewModal;
window.closeNewModal = closeNewModal;
window.switchNewTab = switchNewTab;
window.handleFileSelected = handleFileSelected;
window.pasteImageFromClipboard = pasteImageFromClipboard;
window.pasteFileFromClipboard = pasteFileFromClipboard;
window.handleReadClipboardIntoModal = handleReadClipboardIntoModal;
window.submitNewItem = submitNewItem;

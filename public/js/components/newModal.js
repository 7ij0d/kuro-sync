// ==========================================================
// KURO SYNC + NEW CAPTURE MODAL
// ==========================================================

let currentNewTab = 'text';

function openNewModal(tab = 'text') {
  currentNewTab = tab;
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
  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  document.querySelectorAll('.tab-content-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-pane-${tab}`);
  });
}

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
  const textTitle = document.getElementById('new-text-title');
  const textContent = document.getElementById('new-text-content');
  const linkUrl = document.getElementById('new-link-url');
  const linkTitle = document.getElementById('new-link-title');
  const fileInput = document.getElementById('new-file-input');
  const clipboardPreview = document.getElementById('clipboard-preview-content');

  if (textTitle) textTitle.value = '';
  if (textContent) textContent.value = '';
  if (linkUrl) linkUrl.value = '';
  if (linkTitle) linkTitle.value = '';
  if (fileInput) fileInput.value = '';
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
    } else if (currentNewTab === 'file' || currentNewTab === 'image') {
      const fileInput = document.getElementById('new-file-input');
      const file = fileInput && fileInput.files ? fileInput.files[0] : null;
      if (!file) {
        if (window.utils) window.utils.showToast('Please select a file to upload', 'warning');
        return;
      }

      if (window.utils) window.utils.showToast(`Uploading ${file.name}...`, 'info');
      await window.api.uploadFile(file, folderId);
      if (window.utils) window.utils.showToast('File uploaded & synced to all devices!');
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
    // Retry with force
    if (tab === 'text') {
      const title = document.getElementById('new-text-title').value;
      const content = document.getElementById('new-text-content').value;
      window.api.createTextItem({ title, content, type: 'text' }, true).then(() => {
        closeNewModal();
        window.refreshItems();
      });
    } else if (tab === 'file' || tab === 'image') {
      const file = document.getElementById('new-file-input').files[0];
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
window.handleReadClipboardIntoModal = handleReadClipboardIntoModal;
window.submitNewItem = submitNewItem;

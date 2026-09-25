// ==========================================================
// KURO SYNC SHARE LINK MODAL
// ==========================================================

let activeShareItemId = null;

async function openShareModal(itemId) {
  activeShareItemId = itemId;
  const modal = document.getElementById('share-modal');
  const linkBox = document.getElementById('share-generated-url');
  if (!modal) return;

  modal.classList.add('active');
  if (linkBox) linkBox.value = 'Generating secure share link...';

  try {
    const res = await window.api.createShare(itemId, 24);
    if (linkBox) linkBox.value = res.shareUrl;
  } catch (err) {
    if (linkBox) linkBox.value = 'Error generating link';
  }
}

function closeShareModal() {
  const modal = document.getElementById('share-modal');
  if (modal) modal.classList.remove('active');
  activeShareItemId = null;
}

function copyShareUrl() {
  const linkBox = document.getElementById('share-generated-url');
  if (linkBox && linkBox.value) {
    window.clipboardEngine.copyText(linkBox.value, 'Share link copied to clipboard!');
  }
}

window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.copyShareUrl = copyShareUrl;

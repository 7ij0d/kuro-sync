// ==========================================================
// KURO SYNC CLIPBOARD ENGINE (SAFE, BROWSER COMPLIANT)
// ==========================================================

const clipboardEngine = {
  // Read system clipboard upon explicit user action
  async readFromClipboard() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error('Clipboard API not supported in this browser');
      }
      const text = await navigator.clipboard.readText();
      return text;
    } catch (err) {
      console.warn('Clipboard read error:', err);
      throw err;
    }
  },

  // Copy text to system clipboard
  async copyText(text, successMessage = null) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      const msg = successMessage || (window.i18n ? window.i18n.t('copied') : 'Copied to clipboard!');
      if (window.utils) window.utils.showToast(msg);
      return true;
    } catch (err) {
      console.warn('Clipboard write error:', err);
      return false;
    }
  },

  // Copy Image to system clipboard (where browser allows)
  async copyImage(imageUrl) {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) {
        if (window.utils) window.utils.showToast('Browser does not support direct image copying. Please use download.', 'warning');
        return false;
      }

      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);

      if (window.utils) window.utils.showToast(window.i18n ? window.i18n.t('copied') : 'Image copied to clipboard!');
      return true;
    } catch (err) {
      console.warn('Failed to copy image to clipboard:', err);
      // Fallback
      if (window.utils) window.utils.showToast('Could not copy image directly. Opening download...', 'warning');
      window.open(imageUrl, '_blank');
      return false;
    }
  },

  // Setup global paste handler on window (Option C)
  setupGlobalPaste() {
    window.addEventListener('paste', async (e) => {
      // Do not intercept if user is typing in an active input or textarea
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) {
        return;
      }

      if (!window.api || !window.api.getToken()) return;

      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      if (!items || items.length === 0) return;

      // 1. Check for files / images in clipboard
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            if (window.utils) window.utils.showToast('Uploading pasted file to Kuro Sync...', 'info');
            try {
              await window.api.uploadFile(file);
              if (window.utils) window.utils.showToast('File saved to Kuro Sync!');
            } catch (err) {
              if (window.utils) window.utils.showToast(err.message, 'warning');
            }
            return;
          }
        }
      }

      // 2. Check for text / URL
      const text = clipboardData.getData('text');
      if (text && text.trim()) {
        e.preventDefault();
        const trimmed = text.trim();

        // Check if URL
        if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
          if (window.utils) window.utils.showToast('Saving pasted link to Kuro Sync...', 'info');
          try {
            await window.api.saveLink({ url: trimmed });
            if (window.utils) window.utils.showToast('Link saved to Kuro Sync!');
          } catch (err) {
            if (window.utils) window.utils.showToast(err.message, 'warning');
          }
        } else {
          // Normal text
          if (window.utils) window.utils.showToast('Saving pasted text to Kuro Sync...', 'info');
          try {
            await window.api.createTextItem({ content: trimmed, type: 'clipboard' });
            if (window.utils) window.utils.showToast('Clipboard item saved to Kuro Sync!');
          } catch (err) {
            if (window.utils) window.utils.showToast(err.message, 'warning');
          }
        }
      }
    });
  }
};

window.clipboardEngine = clipboardEngine;

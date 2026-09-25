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

      const msg = successMessage || (window.i18n ? window.i18n.t('copied') : 'تم النسخ إلى الحافظة!');
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

      if (window.utils) window.utils.showToast(window.i18n ? window.i18n.t('copied') : 'تم نسخ الصورة إلى الحافظة!');
      return true;
    } catch (err) {
      console.warn('Failed to copy image to clipboard:', err);
      // Fallback
      if (window.utils) window.utils.showToast('تعذر نسخ الصورة مباشرة، جاري فتحها للتحميل...', 'warning');
      window.open(imageUrl, '_blank');
      return false;
    }
  },

  // Setup global paste handler on window
  setupGlobalPaste() {
    window.addEventListener('paste', async (e) => {
      // Do not intercept if user is typing in an active input or textarea
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable)) {
        return;
      }

      if (!window.api) return;

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
            if (window.utils) window.utils.showToast('جاري حفظ الملف/الصورة الملصقة ☁️...', 'info');
            try {
              await window.api.uploadFile(file);
              if (window.utils) window.utils.showToast('تم حفظ الملف الملصق بنجاح ☁️');
              if (typeof window.refreshItems === 'function') await window.refreshItems();
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
          if (window.utils) window.utils.showToast('جاري حفظ الرابط ☁️...', 'info');
          try {
            await window.api.saveLink({ url: trimmed });
            if (window.utils) window.utils.showToast('تم حفظ الرابط بنجاح ☁️');
            if (typeof window.refreshItems === 'function') await window.refreshItems();
          } catch (err) {
            if (window.utils) window.utils.showToast(err.message, 'warning');
          }
        } else {
          // Normal text
          if (window.utils) window.utils.showToast('جاري حفظ النص الملصق ☁️...', 'info');
          try {
            const firstLine = trimmed.split('\n')[0].trim().substring(0, 45) || 'ملاحظة ملصقة';
            await window.api.createTextItem({ content: trimmed, title: firstLine, type: 'clipboard' });
            if (window.utils) window.utils.showToast('تم حفظ النص بنجاح ☁️');
            if (typeof window.refreshItems === 'function') await window.refreshItems();
          } catch (err) {
            if (window.utils) window.utils.showToast(err.message, 'warning');
          }
        }
      }
    });
  }
};

window.clipboardEngine = clipboardEngine;

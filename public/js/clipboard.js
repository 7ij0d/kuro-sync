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

  // Helper to convert any image (JPEG, WebP, SVG, DataURL) to a standard PNG Blob
  async urlToPngBlob(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 300;
          canvas.height = img.naturalHeight || img.height || 300;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
          }, 'image/png');
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Image failed to load for conversion'));
      img.src = imageUrl;
    });
  },

  // Copy Image to system clipboard as universal PNG (Supported across Chrome, Safari, Edge)
  async copyImage(imageUrl) {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) {
        if (window.utils) window.utils.showToast(window.i18n ? window.i18n.t('offline') : 'المتصفح لا يدعم نسخ الصور، يرجى التنزيل.', 'warning');
        return false;
      }

      // Convert to PNG blob for guaranteed clipboard write support
      let pngBlob = null;
      try {
        pngBlob = await this.urlToPngBlob(imageUrl);
      } catch (convErr) {
        const res = await fetch(imageUrl);
        pngBlob = await res.blob();
      }

      const item = new ClipboardItem({ 'image/png': pngBlob });
      await navigator.clipboard.write([item]);

      const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;
      if (window.utils) window.utils.showToast(isAr ? 'تم نسخ الصورة إلى الحافظة! 🖼️' : 'Copied image to clipboard!');
      return true;
    } catch (err) {
      console.warn('Failed to copy image to clipboard:', err);
      if (window.utils) window.utils.showToast('تعذر نسخ الصورة مباشرة، جاري فتحها للتحميل...', 'warning');
      window.open(imageUrl, '_blank');
      return false;
    }
  },

  // Copy Both Text and Image Together (Rich HTML + Embedded Image)
  async copyCombined(text, imageUrl, title = '') {
    try {
      const cleanText = (text || '').trim();
      const isAr = window.i18n ? window.i18n.currentLang === 'ar' : true;

      if (!navigator.clipboard || !window.ClipboardItem) {
        return await this.copyText(`${cleanText}\n\n[صورة: ${title || 'مرفق'}]`);
      }

      // Rich HTML snippet: styled paragraph with embedded responsive image
      const escape = window.escapeHtml || (s => s);
      const formattedText = escape(cleanText).replace(/\n/g, '<br>');
      const htmlSnippet = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1e293b; max-width:600px;">
        ${cleanText ? `<p style="font-size:15px; margin-bottom:12px; font-weight:500;">${formattedText}</p>` : ''}
        ${imageUrl ? `<img src="${imageUrl}" alt="${escape(title || 'image')}" style="max-width:100%; height:auto; border-radius:8px; border:1px solid #e2e8f0; display:block;" />` : ''}
      </div>`;

      const plainSnippet = cleanText ? `${cleanText}\n\n[صورة: ${title || 'مرفق'}]` : `[صورة: ${title || 'مرفق'}]`;

      const clipboardData = {
        'text/html': new Blob([htmlSnippet], { type: 'text/html' }),
        'text/plain': new Blob([plainSnippet], { type: 'text/plain' })
      };

      // Try adding PNG blob representation
      try {
        const pngBlob = await this.urlToPngBlob(imageUrl);
        if (pngBlob) {
          clipboardData['image/png'] = pngBlob;
        }
      } catch (e) {}

      try {
        await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
      } catch (writeErr) {
        // Fallback: if browser prohibits image/png with text/html in the same item, write text/html + text/plain
        delete clipboardData['image/png'];
        await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
      }

      if (window.utils) {
        window.utils.showToast(isAr ? 'تم نسخ النص والصورة معاً! 📋' : 'Copied text & image together!');
      }
      return true;
    } catch (err) {
      console.warn('Failed to copy combined:', err);
      // Resilient fallback: copy text
      if (text) {
        await this.copyText(text);
        if (window.utils) window.utils.showToast('تم نسخ النص بنجاح!');
        return true;
      }
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

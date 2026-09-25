// ==========================================================
// KURO SYNC UTILITIES & ICONS
// ==========================================================

const utils = {
  // Format bytes into human readable string
  formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  // Format timestamp into sleek time string (e.g. "2:14 PM" or "Today, 12:30 PM")
  formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    
    // Check if same day
    const isToday = date.toDateString() === now.toDateString();
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    if (isToday) return timeStr;

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return (window.i18n ? window.i18n.t('yesterday') : 'Yesterday') + ', ' + timeStr;
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + timeStr;
  },

  // Group items by day
  groupItemsByDate(items) {
    const groups = {
      today: [],
      yesterday: [],
      earlier: []
    };

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    items.forEach(item => {
      const itemDate = new Date(item.created_at);
      if (itemDate.toDateString() === now.toDateString()) {
        groups.today.push(item);
      } else if (itemDate.toDateString() === yesterday.toDateString()) {
        groups.yesterday.push(item);
      } else {
        groups.earlier.push(item);
      }
    });

    return groups;
  },

  // Debounce helper
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Toast notification
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  },

  // Device SVG Icons
  getDeviceIcon(deviceType = 'laptop') {
    const type = (deviceType || '').toLowerCase();
    if (type.includes('ipad') || type.includes('tablet')) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
        <line x1="12" y1="18" x2="12.01" y2="18"></line>
      </svg>`;
    } else if (type.includes('phone') || type.includes('iphone') || type.includes('android')) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
        <line x1="12" y1="18" x2="12.01" y2="18"></line>
      </svg>`;
    } else {
      // Laptop / Desktop default
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="2" y1="20" x2="22" y2="20"></line>
      </svg>`;
    }
  },

  // Compress and resize images client-side for lightning-fast cloud sync
  compressImage(file, maxWidth = 2048, quality = 0.90) {
    return new Promise((resolve) => {
      if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
        const reader = new FileReader();
        reader.onload = () => resolve({ dataUrl: reader.result, size: file ? file.size : 0 });
        reader.onerror = () => resolve({ dataUrl: '', size: 0 });
        if (file) reader.readAsDataURL(file);
        else resolve({ dataUrl: '', size: 0 });
        return;
      }

      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl || !dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          const compressedSize = Math.round((dataUrl.length - 23) * 0.75);
          resolve({ dataUrl, size: compressedSize });
        };
        img.onerror = () => resolve({ dataUrl: e.target.result, size: file.size });
        img.src = e.target.result;
      };
      reader.onerror = () => resolve({ dataUrl: '', size: 0 });
      reader.readAsDataURL(file);
    });
  }
};

window.utils = utils;
window.compressImage = utils.compressImage;

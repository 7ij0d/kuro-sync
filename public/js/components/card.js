// ==========================================================
// KURO SYNC CARD COMPONENT (Matches Reference UI Exactly)
// ==========================================================

function renderItemCard(item, currentView = 'all') {
  const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
  const isTrash = item.deleted_at !== null;

  // Media / Icon thumbnail box
  let mediaHtml = '';
  if (item.type === 'image') {
    let imgUrl = '';
    if (item.file_path) {
      if (item.file_path.startsWith('data:') || item.file_path.startsWith('http') || item.file_path.startsWith('./') || item.file_path.startsWith('blob:')) {
        imgUrl = item.file_path;
      } else {
        imgUrl = `/api/items/${item.id}/file`;
      }
    } else {
      imgUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="50" viewBox="0 0 60 50"><rect fill="%23fbecee" width="60" height="50"/><path d="M15 35 L28 20 L40 30 L48 24 L55 35 Z" fill="%237d1d2d" opacity="0.4"/></svg>';
    }
    mediaHtml = `<img src="${imgUrl}" alt="${escapeHtml(item.title)}" loading="lazy" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='./assets/samples/histology_bell_stage.svg';" />`;
  } else if (item.type === 'file') {
    mediaHtml = `
      <div class="type-icon-pdf">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <span style="margin-top:2px;">PDF</span>
      </div>`;
  } else if (item.type === 'link') {
    mediaHtml = `
      <div class="type-icon-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
      </div>`;
  } else if (item.type === 'clipboard') {
    mediaHtml = `
      <div class="type-icon-clipboard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        </svg>
      </div>`;
  } else {
    // Text / Note
    mediaHtml = `
      <div class="type-icon-text">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
      </div>`;
  }

  // Snippet / Meta string
  let snippet = '';
  if (item.content) {
    snippet += `<div class="card-snippet" title="${escapeHtml(item.content)}">${escapeHtml(item.content.replace(/\n/g, ' '))}</div>`;
  }
  if (item.file_size || item.type === 'file' || item.type === 'image') {
    const ext = item.file_name ? item.file_name.split('.').pop().toUpperCase() : item.type.toUpperCase();
    const sizeStr = item.file_size ? window.utils.formatBytes(item.file_size) : '';
    snippet += `<div class="card-meta-line" style="${item.content ? 'margin-top:4px;' : ''}">${sizeStr ? `<span class="meta-pill">${sizeStr}</span> <span>•</span> ` : ''}<span>${ext}</span></div>`;
  }

  // Favorite Star
  const starHtml = item.is_favorite 
    ? `<svg class="card-favorite-star" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
    : '';

  // Device Info
  const deviceName = item.device_name || 'iPad';
  const deviceIcon = window.utils.getDeviceIcon(item.device_type || 'ipad');
  const timeFormatted = window.utils.formatTime(item.created_at);

  // Quick Action Buttons based on type
  let actionButtonsHtml = '';

  if (isTrash) {
    actionButtonsHtml = `
      <button class="btn-card-action btn-restore" onclick="event.stopPropagation(); restoreItem('${item.id}')">
        ${t('restore')}
      </button>
      <button class="btn-card-action" style="color:var(--danger);" onclick="event.stopPropagation(); permanentDeleteItem('${item.id}')">
        ${t('permanentDelete')}
      </button>
    `;
  } else {
    if (item.type === 'text' || item.type === 'clipboard' || item.type === 'note') {
      actionButtonsHtml = `
        <button class="btn-card-action btn-copy-card" id="btn-copy-${item.id}" onclick="event.stopPropagation(); copyCardText('${item.id}', this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span class="btn-label">${t('copy')}</span>
        </button>
      `;
    } else if (item.type === 'file') {
      actionButtonsHtml = `
        <button class="btn-card-action" onclick="event.stopPropagation(); downloadItemFile('${item.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>${t('download')}</span>
        </button>
      `;
    } else if (item.type === 'image') {
      actionButtonsHtml = `
        <button class="btn-card-action" onclick="event.stopPropagation(); copyCardImage('${item.id}', this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>${t('copyImage')}</span>
        </button>
      `;
    } else if (item.type === 'link') {
      actionButtonsHtml = `
        <button class="btn-card-action" onclick="event.stopPropagation(); window.open('${escapeHtml(item.content)}', '_blank')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          <span>${t('open')}</span>
        </button>
      `;
    }

    // Delete Button
    actionButtonsHtml += `
      <button class="btn-card-action btn-card-delete" title="${t('delete')}" onclick="event.stopPropagation(); deleteItem('${item.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span>${t('delete')}</span>
      </button>
    `;

    // Favorite Button
    actionButtonsHtml += `
      <button class="btn-icon-more" title="${item.is_favorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}" onclick="event.stopPropagation(); toggleItemFavorite('${item.id}', event)">
        <svg viewBox="0 0 24 24" fill="${item.is_favorite ? '#F59E0B' : 'none'}" stroke="${item.is_favorite ? '#F59E0B' : 'currentColor'}" stroke-width="2" width="16" height="16">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </button>
    `;
  }

  return `
    <div class="item-card" data-id="${item.id}" onclick="openItemViewer('${item.id}')">
      <div class="item-card-left">
        <div class="card-media-box">
          ${mediaHtml}
        </div>
        <div class="card-content-box">
          <div class="card-title-row">
            <span class="card-title">${escapeHtml(item.title)}</span>
            ${starHtml}
          </div>
          ${snippet}
        </div>
      </div>

      <div class="item-card-right">
        <div class="card-device-info">
          <span class="card-time tnum">${timeFormatted}</span>
          <span class="card-device-badge">
            ${deviceIcon}
            <span>${escapeHtml(deviceName)}</span>
          </span>
        </div>
        <div class="card-actions">
          ${actionButtonsHtml}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.renderItemCard = renderItemCard;
window.escapeHtml = escapeHtml;

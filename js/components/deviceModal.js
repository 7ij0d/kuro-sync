// ==========================================================
// KURO SYNC DEVICE MANAGEMENT & PAIRING MODAL
// ==========================================================

async function openDeviceModal() {
  const modal = document.getElementById('device-modal');
  if (!modal) return;

  modal.classList.add('active');
  await refreshDeviceList();
  await loadPairingDetails();
}

function closeDeviceModal() {
  const modal = document.getElementById('device-modal');
  if (modal) modal.classList.remove('active');
}

async function refreshDeviceList() {
  const container = document.getElementById('device-list-container');
  if (!container) return;

  container.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted);">Loading devices...</div>';

  try {
    const devices = await window.api.getDevices();
    const currentDeviceId = window.api.getDeviceId();

    if (!devices || devices.length === 0) {
      container.innerHTML = '<div style="padding:16px; text-align:center;">No devices connected</div>';
      return;
    }

    container.innerHTML = devices.map(d => {
      const isCurrent = d.id === currentDeviceId || d.is_current;
      const icon = window.utils.getDeviceIcon(d.type);
      const statusText = d.is_online ? 'Online' : window.utils.formatTime(d.last_active);
      const dotClass = d.is_online ? 'pulse-dot' : 'pulse-dot offline';

      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--bg-surface-subtle); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:24px; height:24px; color:var(--burgundy-700);">${icon}</div>
            <div>
              <div style="font-weight:700; font-size:0.9375rem; display:flex; align-items:center; gap:8px;">
                <span>${escapeHtml(d.name)}</span>
                ${isCurrent ? '<span style="font-size:0.6875rem; background:var(--burgundy-700); color:#fff; padding:1px 6px; border-radius:999px;">This device</span>' : ''}
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:6px; margin-top:2px;">
                <span class="${dotClass}" style="width:6px; height:6px;"></span>
                <span>${statusText}</span>
                <span>•</span>
                <span>${escapeHtml(d.browser || 'Web')}</span>
              </div>
            </div>
          </div>
          <div>
            ${!isCurrent ? `
              <button class="btn-card-action" style="color:var(--danger); border-color:var(--border-subtle);" onclick="removeDevice('${d.id}')">
                Disconnect
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:var(--danger); padding:16px;">Failed to load devices</div>`;
  }
}

async function loadPairingDetails() {
  const qrContainer = document.getElementById('pairing-qr-img');
  const codeContainer = document.getElementById('pairing-code-display');

  if (!qrContainer || !codeContainer) return;

  try {
    const data = await window.api.generatePairing();
    qrContainer.src = data.qrDataUrl;
    codeContainer.textContent = data.code;
  } catch (err) {
    console.warn('Pairing generation error:', err);
  }
}

async function submitClaimPairing() {
  const input = document.getElementById('claim-code-input');
  if (!input || !input.value.trim()) {
    if (window.utils) window.utils.showToast('Please enter a 6-digit pairing code', 'warning');
    return;
  }

  try {
    await window.api.claimPairing(input.value.trim());
    if (window.utils) window.utils.showToast('Device paired successfully!');
    closeDeviceModal();
    window.location.reload();
  } catch (err) {
    if (window.utils) window.utils.showToast(err.message || 'Invalid code', 'warning');
  }
}

async function removeDevice(id) {
  if (confirm('Disconnect this device? It will lose realtime synchronization.')) {
    try {
      await window.api.removeDevice(id);
      if (window.utils) window.utils.showToast('Device disconnected');
      refreshDeviceList();
    } catch (err) {
      if (window.utils) window.utils.showToast(err.message, 'warning');
    }
  }
}

window.openDeviceModal = openDeviceModal;
window.closeDeviceModal = closeDeviceModal;
window.refreshDeviceList = refreshDeviceList;
window.submitClaimPairing = submitClaimPairing;
window.removeDevice = removeDevice;

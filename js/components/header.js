// ==========================================================
// KURO SYNC HEADER & CONTROLS
// ==========================================================

function setupHeaderControls() {
  // 1. Search Input
  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', window.utils.debounce((e) => {
      window.currentSearchTerm = e.target.value.trim();
      window.refreshItems();
    }, 250));
  }

  // Keyboard shortcut '/' to focus search
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });

  // 2. Filter Pills
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filterType = pill.dataset.type;
      window.currentFilterType = filterType;
      window.refreshItems();
    });
  });

  // 3. Sort Select
  const sortSelect = document.getElementById('sort-order-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      window.currentSortOrder = e.target.value;
      window.refreshItems();
    });
  }

  // 4. Device Selector Dropdown
  const deviceSelect = document.getElementById('device-filter-select');
  if (deviceSelect) {
    deviceSelect.addEventListener('change', (e) => {
      window.currentFilterDevice = e.target.value || null;
      window.refreshItems();
    });
  }
}

function updateDeviceFilterOptions(devices = [], currentDeviceId = null) {
  const select = document.getElementById('device-filter-select');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">All Devices</option>';

  devices.forEach(d => {
    const isCurrent = d.id === currentDeviceId;
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.name} ${isCurrent ? '(This device)' : ''}`;
    select.appendChild(opt);
  });

  select.value = currentVal;
}

window.setupHeaderControls = setupHeaderControls;
window.updateDeviceFilterOptions = updateDeviceFilterOptions;

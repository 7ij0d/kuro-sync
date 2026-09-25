// ==========================================================
// KURO SYNC AUTH MODAL
// ==========================================================

let authMode = 'login'; // 'login' or 'register'

function openAuthModal(mode = 'login') {
  authMode = mode;
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  switchAuthMode(mode);
  modal.classList.add('active');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('active');
}

function switchAuthMode(mode) {
  authMode = mode;
  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const switchPrompt = document.getElementById('auth-switch-prompt');
  const nameField = document.getElementById('auth-name-field');

  if (mode === 'register') {
    if (title) title.textContent = 'Create Kuro Sync Account';
    if (submitBtn) submitBtn.textContent = 'Register & Connect Device';
    if (nameField) nameField.style.display = 'block';
    if (switchPrompt) {
      switchPrompt.innerHTML = 'Already have an account? <a href="#" onclick="switchAuthMode(\'login\'); return false;" style="color:var(--burgundy-700); font-weight:600;">Log in</a>';
    }
  } else {
    if (title) title.textContent = 'Log In to Kuro Sync';
    if (submitBtn) submitBtn.textContent = 'Log In';
    if (nameField) nameField.style.display = 'none';
    if (switchPrompt) {
      switchPrompt.innerHTML = 'New to Kuro Sync? <a href="#" onclick="switchAuthMode(\'register\'); return false;" style="color:var(--burgundy-700); font-weight:600;">Create Account</a>';
    }
  }
}

async function submitAuthForm() {
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const nameInput = document.getElementById('auth-name');
  const deviceNameInput = document.getElementById('auth-device-name');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';
  const name = nameInput ? nameInput.value.trim() : '';
  const deviceName = deviceNameInput ? deviceNameInput.value.trim() : '';

  if (!email || !password) {
    if (window.utils) window.utils.showToast('Please enter email and password', 'warning');
    return;
  }

  try {
    if (authMode === 'register') {
      await window.api.register({ email, password, name, deviceName });
      if (window.utils) window.utils.showToast('Account created & device registered!');
    } else {
      await window.api.login(email, password, deviceName);
      if (window.utils) window.utils.showToast('Logged in successfully!');
    }

    closeAuthModal();
    window.location.reload();
  } catch (err) {
    if (window.utils) window.utils.showToast(err.message || 'Authentication failed', 'warning');
  }
}

async function handleInstantDemoLogin() {
  try {
    await window.api.instantDemo();
    if (window.utils) window.utils.showToast('Connected to instant workspace!');
    closeAuthModal();
    window.location.reload();
  } catch (err) {
    if (window.utils) window.utils.showToast(err.message || 'Instant access failed', 'warning');
  }
}

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthMode = switchAuthMode;
window.submitAuthForm = submitAuthForm;
window.handleInstantDemoLogin = handleInstantDemoLogin;

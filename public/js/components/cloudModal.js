// ==========================================================
// KURO SYNC SUPABASE CLOUD CONFIGURATION MODAL
// ==========================================================

function openCloudModal() {
  const modal = document.getElementById('cloud-modal');
  if (!modal) return;

  const urlInput = document.getElementById('cloud-sb-url');
  const keyInput = document.getElementById('cloud-sb-key');
  const statusEl = document.getElementById('cloud-conn-status');

  if (urlInput) urlInput.value = window.KuroSupabase ? window.KuroSupabase.getUrl() : '';
  if (keyInput) keyInput.value = window.KuroSupabase ? window.KuroSupabase.getKey() : '';

  updateCloudStatusBadge();
  modal.classList.add('active');
}

function closeCloudModal() {
  const modal = document.getElementById('cloud-modal');
  if (modal) modal.classList.remove('active');
}

function updateCloudStatusBadge() {
  const statusEl = document.getElementById('cloud-conn-status');
  const isConfigured = window.KuroSupabase && window.KuroSupabase.isConfigured();

  if (statusEl) {
    if (isConfigured) {
      statusEl.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:6px; color:#16A34A; font-weight:700; font-size:0.875rem;">
          <span style="width:8px; height:8px; border-radius:50%; background:#16A34A; display:inline-block;"></span>
          قاعدة Supabase السحابية متصلة وشغالة بنجاح 🟢
        </span>
      `;
    } else {
      statusEl.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:6px; color:var(--text-muted); font-size:0.875rem;">
          <span style="width:8px; height:8px; border-radius:50%; background:#9CA3AF; display:inline-block;"></span>
          تخزين محلي مؤقت فقط (غير مرتبط بسحابة Supabase بعد)
        </span>
      `;
    }
  }

  // Update top banner/indicator if present
  const headerBtn = document.getElementById('btn-cloud-status');
  if (headerBtn) {
    headerBtn.innerHTML = isConfigured 
      ? `<span>☁️ سوبابيز متصل</span>` 
      : `<span>☁️ ربط سوبابيز</span>`;
    headerBtn.style.color = isConfigured ? '#16A34A' : '';
  }
}

async function saveCloudConfig() {
  const urlInput = document.getElementById('cloud-sb-url');
  const keyInput = document.getElementById('cloud-sb-key');
  const saveBtn = document.getElementById('cloud-save-btn');

  const url = (urlInput ? urlInput.value : '').trim();
  const key = (keyInput ? keyInput.value : '').trim();

  if (!url || !key) {
    if (confirm('هل تريد إزالة الربط السحابي والرجوع للتخزين المحلي؟')) {
      window.KuroSupabase.setConfig('', '');
      updateCloudStatusBadge();
      if (window.utils) window.utils.showToast('تم الرجوع للتخزين المحلي');
      closeCloudModal();
      window.refreshItems();
    }
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'جارٍ التحقق والاتصال...';
  }

  window.KuroSupabase.setConfig(url, key);
  const test = await window.KuroSupabase.testConnection();

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'حفظ وتفعيل السحابة';
  }

  if (!test.success) {
    alert(
      `تعذر الاتصال بـ Supabase:\n${test.error}\n\nتأكد من:\n1. صحة الرابط ومفتاح Anon Key\n2. إنشاء جدول "items" بتشغيل كود الـ SQL المرفق في نافذة SQL Editor في سوبابيز.`
    );
    updateCloudStatusBadge();
    return;
  }

  updateCloudStatusBadge();
  if (window.utils) {
    window.utils.showToast('تم الاتصال بنجاح بقاعدة Supabase! سيظهر أي عنصر لأي شخص يملك الرابط 🚀');
  }
  closeCloudModal();
  window.refreshItems();
}

function copySupabaseSql() {
  const sql = `-- ========================================================
-- KURO SYNC SUPABASE SQL SCHEMA
-- Paste this into your Supabase Dashboard -> SQL Editor -> Run
-- ========================================================

create table if not exists public.items (
  id text primary key,
  type text not null default 'text',
  title text,
  content text,
  file_name text,
  file_path text,
  file_size bigint default 0,
  mime_type text,
  device_name text default 'Web Device',
  device_type text default 'laptop',
  is_favorite integer default 0,
  created_at timestamp with time zone default now(),
  deleted_at timestamp with time zone
);

-- Enable public Row Level Security
alter table public.items enable row level security;

-- Allow anyone with anon key to read, insert, update and delete
drop policy if exists "Public access" on public.items;
create policy "Public access" on public.items for all to anon using (true) with check (true);
`;

  navigator.clipboard.writeText(sql).then(() => {
    if (window.utils) window.utils.showToast('تم نسخ كود SQL! الصقه في Supabase -> SQL Editor واضغط RUN');
  }).catch(() => {
    alert(sql);
  });
}

function copySharedLinkWithKeys() {
  const url = window.KuroSupabase ? window.KuroSupabase.getUrl() : '';
  const key = window.KuroSupabase ? window.KuroSupabase.getKey() : '';

  if (!url || !key) {
    alert('يرجى حفظ إعدادات Supabase أولاً لتتمكن من مشاركة الرابط السحابي.');
    return;
  }

  const origin = window.location.origin + window.location.pathname.replace(/\/+$/, '');
  const shareable = `${origin}/?sbUrl=${encodeURIComponent(url)}&sbKey=${encodeURIComponent(key)}`;

  navigator.clipboard.writeText(shareable).then(() => {
    if (window.utils) window.utils.showToast('تم نسخ الرابط المشترك! أي جهاز يفتحه سيرتبط تلقائياً بنفس السحابة 🔗');
  }).catch(() => {
    prompt('انسخ هذا الرابط وافتحه على أي جهاز آخر:', shareable);
  });
}

window.openCloudModal = openCloudModal;
window.closeCloudModal = closeCloudModal;
window.saveCloudConfig = saveCloudConfig;
window.copySupabaseSql = copySupabaseSql;
window.copySharedLinkWithKeys = copySharedLinkWithKeys;
window.updateCloudStatusBadge = updateCloudStatusBadge;

document.addEventListener('DOMContentLoaded', () => {
  updateCloudStatusBadge();
});

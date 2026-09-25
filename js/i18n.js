// ==========================================================
// KURO SYNC I18N (ARABIC & ENGLISH BIDIRECTIONAL ENGINE)
// ==========================================================

const translations = {
  en: {
    brandName: 'Kuro Sync',
    newItem: 'New',
    all: 'All',
    allItems: 'All Items',
    text: 'Text',
    images: 'Images',
    files: 'Files',
    links: 'Links',
    clipboard: 'Clipboard',
    favorites: 'Favorites',
    recent: 'Recent',
    folders: 'Folders',
    trash: 'Trash',
    devices: 'Devices',
    settings: 'Settings',
    storage: 'Storage',
    searchPlaceholder: 'Search your items...',
    sortNewest: 'Newest',
    sortOldest: 'Oldest',
    sortNameAsc: 'Name A-Z',
    sortNameDesc: 'Name Z-A',
    sortSizeDesc: 'Largest',
    sortSizeAsc: 'Smallest',
    copy: 'Copy',
    copied: 'Copied to clipboard!',
    copyImage: 'Copy Image',
    download: 'Download',
    open: 'Open',
    openLink: 'Open Link',
    delete: 'Delete',
    restore: 'Restore',
    permanentDelete: 'Delete Permanently',
    emptyTrash: 'Empty Trash',
    today: 'Today',
    yesterday: 'Yesterday',
    earlier: 'Earlier',
    synced: 'Synced',
    syncing: 'Syncing...',
    syncedAll: 'Synced to all devices',
    offline: 'Offline — changes will sync when connected',
    connectDevice: 'Connect Device',
    myDevices: 'My Devices',
    thisDevice: 'This device',
    online: 'Online',
    lastActive: 'Last active',
    removeDevice: 'Remove Device',
    addFolder: 'New Folder',
    folderName: 'Folder Name',
    save: 'Save',
    cancel: 'Cancel',
    sendClipboard: 'Send Clipboard',
    pasteText: 'Paste Text',
    uploadImage: 'Upload Image',
    uploadFile: 'Upload File',
    saveLink: 'Save Link',
    createNote: 'Create Note',
    title: 'Title',
    content: 'Content',
    url: 'URL',
    dropFilesHere: 'Drop files here, or browse',
    emptyTitle: 'No items yet in your workspace',
    emptyDesc: 'Send something from your iPad or phone and it will appear here automatically.',
    loadSamplePack: 'Load Dental Study Pack (Demo Preview)',
    duplicateTitle: 'File Already Exists',
    duplicateDesc: 'An identical item is already present in your workspace.',
    keepBoth: 'Keep Both',
    replace: 'Replace',
    shareItem: 'Share Item',
    copyShareLink: 'Copy Share Link',
    linkCopied: 'Share link copied!',
    logout: 'Log Out',
    login: 'Log In',
    register: 'Create Account',
    instantDemo: 'Instant Sandbox Workspace',
    devicePairing: 'Pair New Device',
    scanQrToPair: 'Scan this QR code from your other device to connect instantly without passwords:',
    orEnterCode: 'Or enter this 6-digit pairing code on your other device:',
    pairWithCode: 'Enter Pairing Code',
    pairSuccess: 'Device paired successfully!'
  },
  ar: {
    brandName: 'كورو سينك',
    newItem: 'جديد',
    all: 'الكل',
    allItems: 'كل العناصر',
    text: 'نصوص',
    images: 'صور',
    files: 'ملفات',
    links: 'روابط',
    clipboard: 'الحافظة',
    favorites: 'المفضلة',
    recent: 'الأخيرة',
    folders: 'المجلدات',
    trash: 'سلة المحذوفات',
    devices: 'الأجهزة',
    settings: 'الإعدادات',
    storage: 'التخزين',
    searchPlaceholder: 'ابحث في عناصرك ومذكراتك...',
    sortNewest: 'الأحدث',
    sortOldest: 'الأقدم',
    sortNameAsc: 'الاسم أ-ي',
    sortNameDesc: 'الاسم ي-أ',
    sortSizeDesc: 'الأكبر حجماً',
    sortSizeAsc: 'الأصغر حجماً',
    copy: 'نسخ',
    copied: 'تم النسخ للحافظة!',
    copyImage: 'نسخ الصورة',
    download: 'تنزيل',
    open: 'فتح',
    openLink: 'فتح الرابط',
    delete: 'حذف',
    restore: 'استعادة',
    permanentDelete: 'حذف نهائي',
    emptyTrash: 'تفريغ السلة',
    today: 'اليوم',
    yesterday: 'أمس',
    earlier: 'سابقاً',
    synced: 'تمت المزامنة',
    syncing: 'جارٍ المزامنة...',
    syncedAll: 'متزامن مع جميع أجهزتك',
    offline: 'وضع عدم الاتصال — ستتم المزامنة فور الاتصال',
    connectDevice: 'ربط جهاز جديد',
    myDevices: 'أجهزتي المتصلة',
    thisDevice: 'هذا الجهاز',
    online: 'متصل الآن',
    lastActive: 'آخر نشاط',
    removeDevice: 'إلغاء ربط الجهاز',
    addFolder: 'مجلد جديد',
    folderName: 'اسم المجلد',
    save: 'حفظ',
    cancel: 'إلغاء',
    sendClipboard: 'إرسال الحافظة',
    pasteText: 'لصق نص',
    uploadImage: 'رفع صورة',
    uploadFile: 'رفع ملف',
    saveLink: 'حفظ رابط',
    createNote: 'مذكرة دراسية',
    title: 'العنوان',
    content: 'المحتوى والملاحظات',
    url: 'الرابط',
    dropFilesHere: 'أسقط الملفات هنا، أو تصفح جهازك',
    emptyTitle: 'لا توجد عناصر بعد في مساحتك',
    emptyDesc: 'أرسل أي ملف، صورة، أو نص من جهاز الآيباد أو هاتفك وسيظهر هنا فوراً وبدون تحديث الصفحة.',
    loadSamplePack: 'تحميل حزمة عينات طب الأسنان (معاينة مرجعية)',
    duplicateTitle: 'الملف موجود مسبقاً',
    duplicateDesc: 'عنصر مطابق تماماً موجود بالفعل في مساحتك المتزامنة.',
    keepBoth: 'الاحتفاظ بكليهما',
    replace: 'استبدال',
    shareItem: 'مشاركة العنصر',
    copyShareLink: 'نسخ رابط المشاركة',
    linkCopied: 'تم نسخ رابط المشاركة!',
    logout: 'تسجيل الخروج',
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب جديد',
    instantDemo: 'دخول سريع تجريبي',
    devicePairing: 'ربط جهاز جديد',
    scanQrToPair: 'امسح رمز QR هذا من جهازك الآخر للاتصال الفوري بدون كتابة كلمات مرور:',
    orEnterCode: 'أو أدخل هذا الرمز المكون من 6 أرقام في جهازك الآخر:',
    pairWithCode: 'إدخال رمز الربط',
    pairSuccess: 'تم ربط الجهاز بنجاح!'
  }
};

class I18nManager {
  constructor() {
    this.locale = localStorage.getItem('kuro_sync_lang') || 'en';
  }

  init() {
    this.applyDirection();
  }

  t(key) {
    const dict = translations[this.locale] || translations.en;
    return dict[key] || translations.en[key] || key;
  }

  setLocale(newLocale) {
    if (newLocale !== 'ar' && newLocale !== 'en') return;
    this.locale = newLocale;
    localStorage.setItem('kuro_sync_lang', newLocale);
    this.applyDirection();
    window.dispatchEvent(new CustomEvent('language_changed', { detail: { locale: newLocale } }));
  }

  applyDirection() {
    const isRtl = this.locale === 'ar';
    document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', this.locale);
  }
}

const i18n = new I18nManager();
window.i18n = i18n;

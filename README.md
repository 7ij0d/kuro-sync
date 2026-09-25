# 🦷 Kuro Sync — Cross-Device Universal Workspace

> **Universal clipboard, file shelf, image vault, and notes platform designed for instant cross-device transfer.**

### 🌐 Live Published App:
👉 **[https://7ij0d.github.io/kuro-sync/](https://7ij0d.github.io/kuro-sync/)**

---

## 🌟 Overview
Kuro Sync replaces the slow, frustrating workflow of sending files and notes to yourself via Telegram or WhatsApp.

```
Save / Send on iPad / Phone ──▶ Real-time Cloud Sync ──▶ Instantly available on Laptop
```

### Key Highlights
- **Real-Time Cross-Device Synchronization:** Powered by WebSockets and SQLite with WAL mode. When content is added on one device, all connected devices update in milliseconds with zero page reload.
- **Safe & Realistic Clipboard Sync:** Complies with modern browser security standards:
  - **Explicit Click Capture:** Dedicated "Send Clipboard" button reading system clipboard via `navigator.clipboard.readText()`.
  - **Global Window Paste:** Press `Ctrl+V` / `Cmd+V` anywhere on the workspace to automatically save pasted text, screenshots, or files.
  - **1-Click Copy:** One-click `[ Copy ]` button on text items, notes, and links with instant `✓ Copied` visual feedback.
  - **Copy Image:** Direct system clipboard image insertion where supported by the browser.
- **Device Management & QR Code Pairing:**
  - Automatic device detection (iPad, MacBook, Windows PC, iPhone, Android).
  - High-res QR code and 6-character pairing code (`K-XXXX`) for password-free device connection.
  - Multi-device presence heartbeat with real-time online/offline indicators.
- **Visual Design (Linear / Apple Grade):**
  - Follows the Kuro Sync visual reference image (`#7D1D2D` royal burgundy, warm `#FAF7F2` porcelain canvas, soft `#FDF1EC` rose accents).
  - Double-border elevation, tactile spring transitions, and custom Kuro focus rings.
- **Bidirectional RTL/LTR (English & Arabic):**
  - Full Arabic and English localization with mirrored layout using CSS logical properties.
- **File Storage & Previews:**
  - PDF preview modal, image viewer, live auto-save text editor ("Saving...", "Saved ✓").
  - SHA-256 duplicate detection ("Keep both", "Replace", "Cancel").
  - Secure public share links with expiration.
- **PWA & Offline First:**
  - Installable PWA with offline shell and IndexedDB queued actions.

---

## 🚀 Getting Started

### 1. Launch Server
```bash
cd "C:\Users\Taha\.gemini\antigravity\scratch\kuro-sync"
npm start
```
The server will boot at:
- **Local:** `http://localhost:3000`
- **Network (iPad/Phone on same Wi-Fi):** `http://<YOUR_LAN_IP>:3000`
- **WebSocket:** `ws://localhost:3000/ws`

### 2. Run Verification Suite
```bash
node test-kuro-sync.js
node test-upload.js
```

---

## 📱 Workspace Recommendation
To make this your active project, set your active workspace to:
`C:\Users\Taha\.gemini\antigravity\scratch\kuro-sync`

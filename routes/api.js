const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authMiddleware } = require('../auth');
const { upload, computeFileHash, computeTextHash, UPLOADS_DIR } = require('../storage');
const realtimeHub = require('../realtime');

// 1. Get Items List & Counts
router.get('/items', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      type, 
      folder_id, 
      is_favorite, 
      search, 
      device_id, 
      sort = 'newest', 
      trash = '0' 
    } = req.query;

    let query = `
      SELECT i.*, 
             d.name as device_name, d.type as device_type,
             f.name as folder_name, f.color as folder_color
      FROM items i
      LEFT JOIN devices d ON i.source_device_id = d.id
      LEFT JOIN folders f ON i.folder_id = f.id
      WHERE i.user_id = ?
    `;
    const params = [userId];

    if (trash === '1') {
      query += ` AND i.deleted_at IS NOT NULL`;
    } else {
      query += ` AND i.deleted_at IS NULL`;
    }

    if (type && type !== 'all') {
      query += ` AND i.type = ?`;
      params.push(type);
    }

    if (folder_id) {
      query += ` AND i.folder_id = ?`;
      params.push(folder_id);
    }

    if (is_favorite === '1') {
      query += ` AND i.is_favorite = 1`;
    }

    if (device_id) {
      query += ` AND i.source_device_id = ?`;
      params.push(device_id);
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query += ` AND (i.title LIKE ? OR i.content LIKE ? OR i.file_name LIKE ?)`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Sorting
    switch (sort) {
      case 'oldest':
        query += ` ORDER BY i.created_at ASC`;
        break;
      case 'name_asc':
        query += ` ORDER BY i.title ASC`;
        break;
      case 'name_desc':
        query += ` ORDER BY i.title DESC`;
        break;
      case 'size_desc':
        query += ` ORDER BY i.file_size DESC`;
        break;
      case 'size_asc':
        query += ` ORDER BY i.file_size ASC`;
        break;
      case 'newest':
      default:
        query += ` ORDER BY i.created_at DESC`;
        break;
    }

    const items = db.prepare(query).all(...params);

    // Get item counts for sidebar badges
    const counts = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'text' AND deleted_at IS NULL THEN 1 ELSE 0 END) as text_count,
        SUM(CASE WHEN type = 'image' AND deleted_at IS NULL THEN 1 ELSE 0 END) as image_count,
        SUM(CASE WHEN type = 'file' AND deleted_at IS NULL THEN 1 ELSE 0 END) as file_count,
        SUM(CASE WHEN type = 'link' AND deleted_at IS NULL THEN 1 ELSE 0 END) as link_count,
        SUM(CASE WHEN type = 'clipboard' AND deleted_at IS NULL THEN 1 ELSE 0 END) as clipboard_count,
        SUM(CASE WHEN is_favorite = 1 AND deleted_at IS NULL THEN 1 ELSE 0 END) as favorite_count,
        SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as trash_count,
        SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active_count
      FROM items
      WHERE user_id = ?
    `).get(userId);

    // Get storage info
    const user = db.prepare('SELECT storage_used, storage_quota FROM users WHERE id = ?').get(userId);

    res.json({
      items,
      counts: {
        all: counts.active_count || 0,
        text: counts.text_count || 0,
        images: counts.image_count || 0,
        files: counts.file_count || 0,
        links: counts.link_count || 0,
        clipboard: counts.clipboard_count || 0,
        favorites: counts.favorite_count || 0,
        trash: counts.trash_count || 0
      },
      storage: {
        used: user ? user.storage_used : 0,
        quota: user ? user.storage_quota : 21474836480
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create Text / Note / Clipboard Item
router.post('/items/text', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { title, content, type = 'text', folder_id, is_favorite = 0 } = req.body;

    if (!content && !title) {
      return res.status(400).json({ error: 'Title or content is required' });
    }

    const finalTitle = (title && title.trim()) || (content ? content.trim().slice(0, 40) + '...' : 'Untitled Note');
    const contentHash = computeTextHash(content || '');

    // Duplicate check
    const existing = db.prepare(`
      SELECT id, title FROM items 
      WHERE user_id = ? AND content_hash = ? AND deleted_at IS NULL
    `).get(userId, contentHash);

    if (existing && req.query.force !== 'true') {
      return res.status(409).json({
        duplicate: true,
        message: 'Identical text item already exists',
        existingItem: existing
      });
    }

    const itemId = crypto.randomUUID();
    const sourceDeviceId = req.user.deviceId || null;

    db.prepare(`
      INSERT INTO items (id, user_id, type, title, content, content_hash, source_device_id, folder_id, is_favorite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(itemId, userId, type, finalTitle, content || '', contentHash, sourceDeviceId, folder_id || null, is_favorite ? 1 : 0);

    const newItem = db.prepare(`
      SELECT i.*, 
             d.name as device_name, d.type as device_type,
             f.name as folder_name, f.color as folder_color
      FROM items i
      LEFT JOIN devices d ON i.source_device_id = d.id
      LEFT JOIN folders f ON i.folder_id = f.id
      WHERE i.id = ?
    `).get(itemId);

    // Broadcast realtime event
    realtimeHub.broadcastToUser(userId, {
      type: 'ITEM_CREATED',
      item: newItem,
      senderDeviceId: sourceDeviceId
    });

    res.json({ success: true, item: newItem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Upload File / Image
router.post('/items/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Compute hash for duplicate detection
    const contentHash = await computeFileHash(file.path);

    const existing = db.prepare(`
      SELECT id, title, file_name, file_size FROM items 
      WHERE user_id = ? AND content_hash = ? AND deleted_at IS NULL
    `).get(userId, contentHash);

    if (existing && req.query.force !== 'true') {
      // Remove newly uploaded duplicate temp file
      try { fs.unlinkSync(file.path); } catch (e) {}
      return res.status(409).json({
        duplicate: true,
        message: 'This exact file already exists in your workspace',
        existingItem: existing
      });
    }

    const isImage = file.mimetype.startsWith('image/');
    const type = isImage ? 'image' : 'file';
    const title = req.body.title || file.originalname;
    const content = req.body.content || null;
    const isFavorite = req.body.is_favorite === '1' || req.body.is_favorite === 1 ? 1 : 0;
    const itemId = crypto.randomUUID();
    const sourceDeviceId = req.user.deviceId || null;
    const folderId = req.body.folder_id || null;

    db.prepare(`
      INSERT INTO items (
        id, user_id, type, title, content, file_path, file_name, mime_type, file_size, 
        content_hash, source_device_id, folder_id, is_favorite
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemId, userId, type, title, content, file.path, file.originalname, file.mimetype, file.size,
      contentHash, sourceDeviceId, folderId, isFavorite
    );

    // Update user storage used
    db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(file.size, userId);

    const newItem = db.prepare(`
      SELECT i.*, 
             d.name as device_name, d.type as device_type,
             f.name as folder_name, f.color as folder_color
      FROM items i
      LEFT JOIN devices d ON i.source_device_id = d.id
      LEFT JOIN folders f ON i.folder_id = f.id
      WHERE i.id = ?
    `).get(itemId);

    realtimeHub.broadcastToUser(userId, {
      type: 'ITEM_CREATED',
      item: newItem,
      senderDeviceId: sourceDeviceId
    });

    res.json({ success: true, item: newItem });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Save Link
router.post('/items/link', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    let { url, title, folder_id, is_favorite = 0 } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const domain = parsedUrl.hostname;
    const finalTitle = title && title.trim() ? title.trim() : domain;
    const itemId = crypto.randomUUID();
    const sourceDeviceId = req.user.deviceId || null;

    db.prepare(`
      INSERT INTO items (id, user_id, type, title, content, source_device_id, folder_id, is_favorite, metadata)
      VALUES (?, ?, 'link', ?, ?, ?, ?, ?, ?)
    `).run(
      itemId, userId, finalTitle, parsedUrl.href, sourceDeviceId, folder_id || null, 
      is_favorite ? 1 : 0, JSON.stringify({ domain, favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64` })
    );

    const newItem = db.prepare(`
      SELECT i.*, 
             d.name as device_name, d.type as device_type,
             f.name as folder_name, f.color as folder_color
      FROM items i
      LEFT JOIN devices d ON i.source_device_id = d.id
      LEFT JOIN folders f ON i.folder_id = f.id
      WHERE i.id = ?
    `).get(itemId);

    realtimeHub.broadcastToUser(userId, {
      type: 'ITEM_CREATED',
      item: newItem,
      senderDeviceId: sourceDeviceId
    });

    res.json({ success: true, item: newItem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update Item (Edit Text, Title, Favorite, Folder)
router.patch('/items/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { title, content, folder_id, is_favorite, is_pinned } = req.body;

    const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    let newHash = item.content_hash;
    if (content !== undefined) {
      newHash = computeTextHash(content);
    }

    db.prepare(`
      UPDATE items 
      SET title = COALESCE(?, title),
          content = COALESCE(?, content),
          folder_id = COALESCE(?, folder_id),
          is_favorite = COALESCE(?, is_favorite),
          is_pinned = COALESCE(?, is_pinned),
          content_hash = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      title !== undefined ? title : null,
      content !== undefined ? content : null,
      folder_id !== undefined ? folder_id : null,
      is_favorite !== undefined ? (is_favorite ? 1 : 0) : null,
      is_pinned !== undefined ? (is_pinned ? 1 : 0) : null,
      newHash,
      req.params.id,
      userId
    );

    const updated = db.prepare(`
      SELECT i.*, 
             d.name as device_name, d.type as device_type,
             f.name as folder_name, f.color as folder_color
      FROM items i
      LEFT JOIN devices d ON i.source_device_id = d.id
      LEFT JOIN folders f ON i.folder_id = f.id
      WHERE i.id = ?
    `).get(req.params.id);

    realtimeHub.broadcastToUser(userId, {
      type: 'ITEM_UPDATED',
      item: updated,
      senderDeviceId: req.user.deviceId
    });

    res.json({ success: true, item: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Soft Delete (Move to Trash)
router.delete('/items/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    db.prepare(`
      UPDATE items 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, userId);

    realtimeHub.broadcastToUser(userId, {
      type: 'ITEM_DELETED',
      itemId: req.params.id,
      senderDeviceId: req.user.deviceId
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Restore from Trash
router.post('/items/:id/restore', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    db.prepare(`
      UPDATE items 
      SET deleted_at = NULL 
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, userId);

    const restored = db.prepare(`
      SELECT i.*, 
             d.name as device_name, d.type as device_type,
             f.name as folder_name, f.color as folder_color
      FROM items i
      LEFT JOIN devices d ON i.source_device_id = d.id
      LEFT JOIN folders f ON i.folder_id = f.id
      WHERE i.id = ?
    `).get(req.params.id);

    realtimeHub.broadcastToUser(userId, {
      type: 'ITEM_RESTORED',
      item: restored,
      senderDeviceId: req.user.deviceId
    });

    res.json({ success: true, item: restored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Permanently Delete Item
router.delete('/items/:id/permanent', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Unlink physical file if present
    if (item.file_path && fs.existsSync(item.file_path)) {
      try {
        fs.unlinkSync(item.file_path);
        // Deduct storage
        db.prepare('UPDATE users SET storage_used = MAX(0, storage_used - ?) WHERE id = ?').run(item.file_size || 0, userId);
      } catch (e) {
        console.warn('Could not remove file on disk:', e.message);
      }
    }

    db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?').run(req.params.id, userId);

    realtimeHub.broadcastToUser(userId, {
      type: 'ITEM_PURGED',
      itemId: req.params.id,
      senderDeviceId: req.user.deviceId
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Empty Trash Permanently
router.post('/trash/empty', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const trashed = db.prepare('SELECT id, file_path, file_size FROM items WHERE user_id = ? AND deleted_at IS NOT NULL').all(userId);

    let freedBytes = 0;
    for (const item of trashed) {
      if (item.file_path && fs.existsSync(item.file_path)) {
        try {
          fs.unlinkSync(item.file_path);
          freedBytes += (item.file_size || 0);
        } catch (e) {}
      }
    }

    db.prepare('DELETE FROM items WHERE user_id = ? AND deleted_at IS NOT NULL').run(userId);
    if (freedBytes > 0) {
      db.prepare('UPDATE users SET storage_used = MAX(0, storage_used - ?) WHERE id = ?').run(freedBytes, userId);
    }

    realtimeHub.broadcastToUser(userId, {
      type: 'TRASH_EMPTIED',
      senderDeviceId: req.user.deviceId
    });

    res.json({ success: true, count: trashed.length, freedBytes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. File Download / Stream
router.get('/items/:id/file', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item || !item.file_path || !fs.existsSync(item.file_path)) {
      return res.status(404).send('File not found');
    }

    const isDownload = req.query.download === '1';
    const disposition = isDownload ? 'attachment' : 'inline';
    
    // Set headers with original filename
    res.setHeader('Content-Type', item.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(item.file_name)}`);
    res.setHeader('Content-Length', item.file_size);

    const stream = fs.createReadStream(item.file_path);
    stream.pipe(res);
  } catch (err) {
    res.status(500).send('Error streaming file');
  }
});

// 11. Folder Operations
router.get('/folders', authMiddleware, (req, res) => {
  try {
    const folders = db.prepare(`
      SELECT f.*, COUNT(i.id) as item_count
      FROM folders f
      LEFT JOIN items i ON f.id = i.folder_id AND i.deleted_at IS NULL
      WHERE f.user_id = ?
      GROUP BY f.id
      ORDER BY f.name ASC
    `).all(req.user.id);
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/folders', authMiddleware, (req, res) => {
  try {
    const { name, color = '#7D1D2D' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folderId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO folders (id, user_id, name, color)
      VALUES (?, ?, ?, ?)
    `).run(folderId, req.user.id, name.trim(), color);

    const newFolder = db.prepare('SELECT *, 0 as item_count FROM folders WHERE id = ?').get(folderId);

    realtimeHub.broadcastToUser(req.user.id, {
      type: 'FOLDER_CREATED',
      folder: newFolder
    });

    res.json({ success: true, folder: newFolder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/folders/:id', authMiddleware, (req, res) => {
  try {
    // Unlink items from this folder before deleting
    db.prepare('UPDATE items SET folder_id = NULL WHERE folder_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);

    realtimeHub.broadcastToUser(req.user.id, {
      type: 'FOLDER_DELETED',
      folderId: req.params.id
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Create Public Share Link
router.post('/shares', authMiddleware, (req, res) => {
  try {
    const { item_id, expiry_hours = 24, allow_download = 1 } = req.body;
    const item = db.prepare('SELECT id, title, type FROM items WHERE id = ? AND user_id = ?').get(item_id, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const shareId = crypto.randomUUID();
    const token = crypto.randomBytes(16).toString('hex');
    let expiresAt = null;

    if (expiry_hours > 0) {
      expiresAt = new Date(Date.now() + expiry_hours * 60 * 60 * 1000).toISOString();
    }

    db.prepare(`
      INSERT INTO shares (id, item_id, user_id, token, allow_download, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(shareId, item_id, req.user.id, token, allow_download ? 1 : 0, expiresAt);

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const shareUrl = `${protocol}://${host}/share/${token}`;

    res.json({ success: true, shareUrl, token, expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public Share View Data
router.get('/shares/:token', (req, res) => {
  try {
    const share = db.prepare(`
      SELECT s.*, i.title, i.type, i.content, i.file_name, i.mime_type, i.file_size, i.created_at as item_created,
             u.name as author_name
      FROM shares s
      JOIN items i ON s.item_id = i.id
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
    `).get(req.params.token);

    if (!share) {
      return res.status(404).json({ error: 'Shared link expired or does not exist' });
    }

    // Increment view count
    db.prepare('UPDATE shares SET view_count = view_count + 1 WHERE id = ?').run(share.id);

    res.json(share);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Optional Demo Pack Loader (For user to test the exact items in visual reference without forcing fake data)
router.post('/demo/sample-pack', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const deviceId = req.user.deviceId;

    const userUploadsDir = path.join(UPLOADS_DIR, userId);
    if (!fs.existsSync(userUploadsDir)) {
      fs.mkdirSync(userUploadsDir, { recursive: true });
    }

    const histologySrc = path.join(__dirname, '../public/assets/samples/histology_bell_stage.svg');
    const histologyDest = path.join(userUploadsDir, 'tooth_bell_stage.svg');
    if (fs.existsSync(histologySrc)) fs.copyFileSync(histologySrc, histologyDest);

    const pdfSrc = path.join(__dirname, '../public/assets/samples/Pathology.pdf');
    const pdfDest = path.join(userUploadsDir, 'Pathology.pdf');
    if (fs.existsSync(pdfSrc)) fs.copyFileSync(pdfSrc, pdfDest);

    const notesSrc = path.join(__dirname, '../public/assets/samples/notebook_notes.svg');
    const notesDest = path.join(userUploadsDir, 'IMG_3287.svg');
    if (fs.existsSync(notesSrc)) fs.copyFileSync(notesSrc, notesDest);

    const sampleItems = [
      {
        id: crypto.randomUUID(),
        type: 'image',
        title: 'Tooth development - Bell stage',
        content: 'Key points:\n- Enamel organ\n- Dental papilla\n- Dental follicle\n- Stellate reticulum',
        file_path: histologyDest,
        file_name: 'tooth_bell_stage.svg',
        mime_type: 'image/svg+xml',
        file_size: 1024 * 780
      },
      {
        id: crypto.randomUUID(),
        type: 'file',
        title: 'Pathology.pdf',
        content: null,
        file_path: pdfDest,
        file_name: 'Pathology.pdf',
        mime_type: 'application/pdf',
        file_size: 2.4 * 1024 * 1024
      },
      {
        id: crypto.randomUUID(),
        type: 'text',
        title: 'Operative Dentistry Notes',
        content: 'Cavity preparation principles:\n1. Retention form\n2. Resistance form\n3. Convenience form\n4. Removal of remaining carious dentin\n5. Finishing enamel walls\n6. Cleaning the cavity',
        file_path: null,
        file_name: null,
        mime_type: 'text/plain',
        file_size: 180
      },
      {
        id: crypto.randomUUID(),
        type: 'image',
        title: 'IMG_3287.jpg',
        content: null,
        file_path: notesDest,
        file_name: 'IMG_3287.jpg',
        mime_type: 'image/svg+xml',
        file_size: 1.8 * 1024 * 1024
      }
    ];

    const insert = db.prepare(`
      INSERT INTO items (id, user_id, type, title, content, file_path, file_name, mime_type, file_size, source_device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of sampleItems) {
      insert.run(item.id, userId, item.type, item.title, item.content || null, item.file_path, item.file_name, item.mime_type, item.file_size, deviceId);
    }

    realtimeHub.broadcastToUser(userId, { type: 'ITEMS_REFRESH' });

    res.json({ success: true, count: sampleItems.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

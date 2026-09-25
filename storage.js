const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Sanitize filename to avoid directory traversal
function sanitizeFilename(originalName) {
  const parsed = path.parse(originalName);
  const safeBase = parsed.name.replace(/[^a-zA-Z0-9_\-\.\s\u0600-\u06FF]/g, '_').trim() || 'file';
  const ext = parsed.ext.slice(0, 10);
  return `${safeBase}${ext}`;
}

// Compute SHA-256 hash of a file
function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

// Compute text content SHA-256 hash
function computeTextHash(content) {
  return crypto.createHash('sha256').update(content || '').digest('hex');
}

// Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user ? req.user.id : 'temp';
    const userDir = path.join(UPLOADS_DIR, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // Generate unique storage filename with original extension
    const safeName = sanitizeFilename(file.originalname);
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext);
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  }
});

// Max 500MB per file
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

module.exports = {
  UPLOADS_DIR,
  upload,
  sanitizeFilename,
  computeFileHash,
  computeTextHash
};

const express = require('express');
const fs = require('fs/promises');
const multer = require('multer');
const env = require('../config/env');
const adminAuth = require('../middleware/adminAuth');
const {
  indexUpload,
  listFiles,
  deleteFile,
  updateFileMetadata,
} = require('../services/knowledgeService');
const {
  SESSION_COOKIE_NAME,
  parseCookies,
  createAdminSessionToken,
  buildSessionCookieHeader,
  buildClearSessionCookieHeader,
  revokeSessionToken,
} = require('../utils/adminSession');
const {
  normalizeUploadedFilename,
  isSupportedUploadType,
} = require('../utils/uploadFilename');

const router = express.Router();

const storage = multer.diskStorage({
  destination: async (_, __, cb) => {
    try {
      await fs.mkdir(env.uploadRoot, { recursive: true });
      cb(null, env.uploadRoot);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const normalized = normalizeUploadedFilename(file);
    req.uploadFileMeta = normalized;
    cb(null, normalized.storedName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const normalized = normalizeUploadedFilename(file);
    const supported = isSupportedUploadType({
      mimetype: file.mimetype,
      extension: normalized.extension,
    });

    if (!supported) {
      const error = new Error(
        `Unsupported file type. Allowed: PDF, TXT, DOCX. Received mimetype: ${file.mimetype || 'unknown'}, Received filename: ${file.originalname || 'unknown'}`,
      );
      error.code = 'UNSUPPORTED_FILE_TYPE';
      error.status = 400;
      return cb(error);
    }

    req.uploadFileMeta = normalized;
    return cb(null, true);
  },
});

router.post('/session', (req, res) => {
  const token = req.body?.token || req.get('x-admin-token');
  if (!token || token !== env.adminToken) {
    return res.status(401).json({ ok: false, error: 'Invalid admin token' });
  }

  const session = createAdminSessionToken();
  res.setHeader('Set-Cookie', buildSessionCookieHeader(session));
  return res.json({ ok: true, authenticated: true });
});

router.get('/session', adminAuth, (_, res) => {
  return res.json({ ok: true, authenticated: true });
});

router.post('/logout', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  revokeSessionToken(token);
  res.setHeader('Set-Cookie', buildClearSessionCookieHeader());
  return res.json({ ok: true });
});

router.use(adminAuth);

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'file field is required' });
    }

    const meta = req.uploadFileMeta || normalizeUploadedFilename(req.file);

    const saved = await indexUpload({
      file: {
        originalname: meta.displayName,
        originalNameRaw: meta.originalNameRaw,
        originalNameNormalized: meta.originalNameNormalized,
        filename: req.file.filename,
        path: req.file.path,
        mimetype: req.file.mimetype,
        size: req.file.size,
        deck: req.body.deck,
        topic: req.body.topic,
        priority: req.body.priority,
        type: req.body.type,
      },
    });

    return res.status(201).json({ ok: true, file: saved });
  } catch (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        ok: false,
        error: `Upload exceeds limit (${env.maxUploadSizeMb}MB).`,
      });
    }
    if (error.code === 'UNSUPPORTED_FILE_TYPE') {
      return res.status(error.status || 400).json({ ok: false, error: error.message });
    }
    return next(error);
  }
});

router.get('/files', async (_, res, next) => {
  try {
    const files = await listFiles();
    return res.json({ ok: true, files });
  } catch (error) {
    return next(error);
  }
});

router.patch('/files/:id', async (req, res, next) => {
  try {
    const updated = await updateFileMetadata(req.params.id, {
      deck: req.body.deck,
      topic: req.body.topic,
      priority: req.body.priority,
      type: req.body.type,
    });

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'File not found' });
    }
    return res.json({ ok: true, file: updated });
  } catch (error) {
    return next(error);
  }
});

router.delete('/files/:id', async (req, res, next) => {
  try {
    const removed = await deleteFile(req.params.id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: 'File not found' });
    }
    return res.json({ ok: true, file: removed });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

const express = require('express');
const path = require('path');
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
  createAdminSessionToken,
} = require('../utils/adminSession');

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
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadSizeMb * 1024 * 1024 },
});

router.post('/session', (req, res) => {
  const token = req.body?.token || req.get('x-admin-token');
  if (!token || token !== env.adminToken) {
    return res.status(401).json({ ok: false, error: 'Invalid admin token' });
  }

  const session = createAdminSessionToken();
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(session)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    'Max-Age=43200',
  ];
  if (env.secureCookie) cookieParts.push('Secure');

  res.setHeader('Set-Cookie', cookieParts.join('; '));
  return res.json({ ok: true });
});

router.post('/logout', (_, res) => {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`,
  );
  return res.json({ ok: true });
});

router.use(adminAuth);

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'file field is required' });
    }

    const saved = await indexUpload({
      file: {
        originalname: req.file.originalname,
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

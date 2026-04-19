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
const { listConsultations, updateConsultationById } = require('../services/consultationService');
const {
  SESSION_COOKIE_NAME,
  parseCookies,
  createAdminSessionToken,
  buildSessionCookieHeader,
  buildClearSessionCookieHeader,
  revokeSessionToken,
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

router.get('/consultations', async (_, res, next) => {
  try {
    const consultations = await listConsultations();
    return res.json({ ok: true, consultations });
  } catch (error) {
    return next(error);
  }
});

router.patch('/consultations/:id', async (req, res, next) => {
  try {
    const updated = await updateConsultationById(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Consultation not found' });
    }
    return res.json({ ok: true, consultation: updated });
  } catch (error) {
    return next(error);
  }
});

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

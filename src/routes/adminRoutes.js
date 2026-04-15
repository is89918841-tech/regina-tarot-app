const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const env = require('../config/env');
const adminAuth = require('../middleware/adminAuth');
const {
  indexUpload,
  listFiles,
  deleteFile,
  updateFileMetadata,
} = require('../services/knowledgeService');
const { extractBoundary, parseMultipartBuffer } = require('../utils/multipart');

const router = express.Router();

router.use(adminAuth);

const rawMultipart = express.raw({
  type: (req) => (req.headers['content-type'] || '').includes('multipart/form-data'),
  limit: `${env.maxUploadSizeMb}mb`,
});

router.post('/upload', rawMultipart, async (req, res, next) => {
  try {
    const boundary = extractBoundary(req.headers['content-type'] || '');
    if (!boundary) {
      return res.status(400).json({ ok: false, error: 'Invalid multipart boundary' });
    }

    const { fields, file } = parseMultipartBuffer(req.body, boundary);
    if (!file) {
      return res.status(400).json({ ok: false, error: 'file field is required' });
    }

    const safe = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${Date.now()}_${safe}`;
    const localPath = path.join(env.uploadRoot, storedName);

    await fs.mkdir(env.uploadRoot, { recursive: true });
    await fs.writeFile(localPath, file.buffer);

    const saved = await indexUpload({
      file: {
        originalname: file.filename,
        filename: storedName,
        path: localPath,
        mimetype: file.mimetype,
        size: file.buffer.length,
        deck: fields.deck,
        topic: fields.topic,
        priority: fields.priority,
        type: fields.type,
      },
    });

    return res.status(201).json({ ok: true, file: saved });
  } catch (error) {
    if (error.type === 'entity.too.large') {
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

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

const router = express.Router();

router.use(adminAuth);

router.post('/upload', async (req, res, next) => {
  try {
    const { filename, contentBase64, mimeType, deck, topic, priority, type } = req.body || {};

    if (!filename || !contentBase64) {
      return res.status(400).json({
        ok: false,
        error: 'filename and contentBase64 are required',
      });
    }

    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${Date.now()}_${safe}`;
    const localPath = path.join(env.uploadRoot, storedName);

    const buffer = Buffer.from(contentBase64, 'base64');
    await fs.mkdir(env.uploadRoot, { recursive: true });
    await fs.writeFile(localPath, buffer);

    const saved = await indexUpload({
      file: {
        originalname: filename,
        filename: storedName,
        path: localPath,
        mimetype: mimeType || 'application/octet-stream',
        size: buffer.length,
        deck,
        topic,
        priority,
        type,
      },
    });

    return res.status(201).json({ ok: true, file: saved });
  } catch (error) {
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

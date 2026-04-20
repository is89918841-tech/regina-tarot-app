const express = require('express');
const fs = require('fs/promises');
const path = require('path');
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
const {
  readJson,
  writeJson,
  ensureDir,
} = require('../utils/fileStore');

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

async function listConsultations() {
  const items = await readJson(env.consultationStorePath, []);
  return Array.isArray(items) ? items : [];
}

async function getConsultationById(id) {
  const items = await listConsultations();
  return items.find((item) => item.id === id) || null;
}

async function updateConsultationById(id, patch) {
  const items = await listConsultations();
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) return null;

  items[idx] = {
    ...items[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await ensureDir(path.dirname(env.consultationStorePath));
  await writeJson(env.consultationStorePath, items);
  return items[idx];
}

router.post('/session', (req, res) => {
  const token = req.body?.token || req.body?.password || req.get('x-admin-token');
  if (!token || token !== env.adminToken) {
    return res.status(401).json({ ok: false, error: 'Invalid admin token' });
  }

  const session = createAdminSessionToken();
  res.setHeader('Set-Cookie', buildSessionCookieHeader(session));
  return res.json({ ok: true, authenticated: true });
});

router.get('/session', adminAuth, (_req, res) => {
  return res.json({ ok: true, authenticated: true });
});

router.post('/login', (req, res) => {
  const token = req.body?.password || req.body?.token || req.get('x-admin-token');
  if (!token || token !== env.adminToken) {
    return res.status(401).json({ ok: false, error: 'Invalid admin token' });
  }

  const session = createAdminSessionToken();
  res.setHeader('Set-Cookie', buildSessionCookieHeader(session));
  return res.json({ ok: true, authenticated: true });
});

router.get('/me', adminAuth, (_req, res) => {
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

router.get('/consultations', async (_req, res, next) => {
  try {
    const consultations = await listConsultations();
    return res.json({ ok: true, consultations });
  } catch (error) {
    return next(error);
  }
});

router.get('/consultations/:id', async (req, res, next) => {
  try {
    const consultation = await getConsultationById(req.params.id);

    if (!consultation) {
      return res.status(404).json({ ok: false, error: 'Consultation not found' });
    }

    return res.json({ ok: true, consultation });
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

router.post('/consultations/:id/recommendation/generate', async (req, res, next) => {
  try {
    const consultation = await getConsultationById(req.params.id);

    if (!consultation) {
      return res.status(404).json({ ok: false, error: 'Consultation not found' });
    }

    const recommendation =
      `질문 요약: ${consultation.question || '-'}\n` +
      `추천 덱: 로제딕 타로\n` +
      `스프레드: 3카드 (현재/흐름/조언)\n` +
      `보조도구: 레노먼드`;

    return res.json({ ok: true, recommendation });
  } catch (error) {
    return next(error);
  }
});

router.post('/consultations/:id/recommendation', async (req, res, next) => {
  try {
    const updated = await updateConsultationById(req.params.id, {
      recommendation: req.body?.recommendation || '',
      status: 'recommended',
    });

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Consultation not found' });
    }

    return res.json({ ok: true, consultation: updated });
  } catch (error) {
    return next(error);
  }
});

router.post('/consultations/:id/draw/generate', async (req, res, next) => {
  try {
    const consultation = await getConsultationById(req.params.id);

    if (!consultation) {
      return res.status(404).json({ ok: false, error: 'Consultation not found' });
    }

    const drawResult = `현재: The Magician\n흐름: The Lovers\n조언: Strength`;
    return res.json({ ok: true, drawResult });
  } catch (error) {
    return next(error);
  }
});

router.post('/consultations/:id/draw', async (req, res, next) => {
  try {
    const updated = await updateConsultationById(req.params.id, {
      drawResult: req.body?.drawResult || '',
      status: 'drawn',
    });

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Consultation not found' });
    }

    return res.json({ ok: true, consultation: updated });
  } catch (error) {
    return next(error);
  }
});

router.post('/consultations/:id/reading/generate', async (req, res, next) => {
  try {
    const consultation = await getConsultationById(req.params.id);

    if (!consultation) {
      return res.status(404).json({ ok: false, error: 'Consultation not found' });
    }

    const reading =
      `${consultation.name || '내담자님'} 안녕하세요.\n` +
      `현재 흐름은 정리와 선택이 동시에 필요한 시기예요.\n` +
      `조급함보다 우선순위를 세우고 한 단계씩 실행해보세요.`;

    return res.json({ ok: true, reading });
  } catch (error) {
    return next(error);
  }
});

router.post('/consultations/:id/reading', async (req, res, next) => {
  try {
    const updated = await updateConsultationById(req.params.id, {
      finalReading: req.body?.finalReading || '',
      status: 'finalized',
    });

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

router.get('/files', async (_req, res, next) => {
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

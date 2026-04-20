const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const OpenAI = require('openai');
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
const openai = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;

const UNIVERSAL_78 = [
  '0 The Fool','I The Magician','II The High Priestess','III The Empress','IV The Emperor','V The Hierophant','VI The Lovers','VII The Chariot','VIII Strength','IX The Hermit','X Wheel of Fortune','XI Justice','XII The Hanged Man','XIII Death','XIV Temperance','XV The Devil','XVI The Tower','XVII The Star','XVIII The Moon','XIX The Sun','XX Judgement','XXI The World',
  'Ace of Cups','Two of Cups','Three of Cups','Four of Cups','Five of Cups','Six of Cups','Seven of Cups','Eight of Cups','Nine of Cups','Ten of Cups','Page of Cups','Knight of Cups','Queen of Cups','King of Cups',
  'Ace of Pentacles','Two of Pentacles','Three of Pentacles','Four of Pentacles','Five of Pentacles','Six of Pentacles','Seven of Pentacles','Eight of Pentacles','Nine of Pentacles','Ten of Pentacles','Page of Pentacles','Knight of Pentacles','Queen of Pentacles','King of Pentacles',
  'Ace of Swords','Two of Swords','Three of Swords','Four of Swords','Five of Swords','Six of Swords','Seven of Swords','Eight of Swords','Nine of Swords','Ten of Swords','Page of Swords','Knight of Swords','Queen of Swords','King of Swords',
  'Ace of Wands','Two of Wands','Three of Wands','Four of Wands','Five of Wands','Six of Wands','Seven of Wands','Eight of Wands','Nine of Wands','Ten of Wands','Page of Wands','Knight of Wands','Queen of Wands','King of Wands',
];

function shuffle(arr) {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function maybeReversed(card) {
  return Math.random() < 0.38 ? `${card} (역방향)` : card;
}

async function callOpenAI({ system, user, temperature = 0.9 }) {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await openai.responses.create({
    model: env.model || 'gpt-4.1-mini',
    temperature,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: system }] },
      { role: 'user', content: [{ type: 'input_text', text: user }] },
    ],
  });

  return (response.output_text || '').trim();
}

async function callOpenAIJson({ system, user, temperature = 0.7 }) {
  const raw = await callOpenAI({
    system: `${system}\n반드시 JSON만 출력하세요. 설명 금지. 코드펜스 금지.`,
    user,
    temperature,
  });

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`AI JSON parse failed: ${raw}`);
  }
}

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

    const system = `당신은 한국어로 답하는 타로 상담 운영 보조 시스템이다.
질문을 보고 추천 덱, 장수, 스프레드, 보조도구를 정한다.
레지나 스타일은 결정 중심, 흐름 해석 중심, 감정선은 정제되지만 현실적이다.
연애/관계면 로제딕 타로, 감정선은 로맨틱 타로/너에게 다이브, 현실/결정은 세피로트/화이트 세이지/하모니 등을 우선 고려한다.
출력 JSON 형식:
{
  "summary": "짧은 질문 요약",
  "deck": "추천 덱명",
  "spread": "스프레드 설명",
  "support": ["보조도구1", "보조도구2"],
  "cardCount": 숫자,
  "note": "짧은 추천 이유"
}`;

    const user = `이름: ${consultation.name || '-'}
메뉴: ${consultation.menuTitle || consultation.menu || '-'}
질문: ${consultation.question || '-'}
추가 메모: ${consultation.memo || '-'}`;

    const ai = await callOpenAIJson({ system, user, temperature: 0.6 });

    const recommendation =
      `질문 요약: ${ai.summary || consultation.question || '-'}\n` +
      `추천 덱: ${ai.deck || '로제딕 타로'}\n` +
      `스프레드: ${ai.spread || `${Number(ai.cardCount || 3)}카드 스프레드`}\n` +
      `보조도구: ${Array.isArray(ai.support) && ai.support.length ? ai.support.join(', ') : '없음'}\n` +
      `추천 이유: ${ai.note || '질문 성격에 맞춰 흐름과 조언이 함께 보이는 구성입니다.'}`;

    return res.json({ ok: true, recommendation, meta: ai });
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

    const recommendationText = req.body?.recommendation || consultation.recommendation || '';
    const countMatch = recommendationText.match(/(\d+)카드/);
    const cardCount = Math.min(10, Math.max(3, Number(countMatch?.[1] || 3)));
    const spreadLabels = ['현재', '흐름', '조언', '숨은 변수', '상대 측', '결과', '행동 포인트', '주의점', '반전 포인트', '최종 정리'];

    const picks = shuffle(UNIVERSAL_78).slice(0, cardCount).map(maybeReversed);
    const lines = picks.map((card, index) => `${spreadLabels[index] || `카드 ${index + 1}`}: ${card}`);
    const drawResult = lines.join('\n');

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

    const recommendation = req.body?.recommendation || consultation.recommendation || '';
    const drawResult = req.body?.drawResult || consultation.drawResult || '';

    const system = `당신은 레지나 스타일의 한국어 타로 리더다.
말투 규칙:
- 반드시 존댓말(~요)
- 상대를 '내담자님'이라고 부를 수 있음
- 카드 이름을 그대로 나열하지 말고 흐름 해석 중심으로 쓴다
- 짧은 2~3문장이 아니라, 밀도 있는 한 문단 이상으로 쓴다
- 위로만 하지 말고 현실적인 판단과 흐름을 함께 말한다
- 과장된 단정은 피하고, 가능성과 현실선 사이를 정리해준다
- 결과는 자연스러운 한국어 문단으로 작성한다
- 마지막에는 한 줄 정도의 현실적 총평을 붙인다`;

    const user = `이름: ${consultation.name || '-'}
메뉴: ${consultation.menuTitle || consultation.menu || '-'}
질문: ${consultation.question || '-'}
추가 메모: ${consultation.memo || '-'}
추천: ${recommendation || '-'}
드로우 결과:
${drawResult || '-'}`;

    const reading = await callOpenAI({ system, user, temperature: 0.9 });
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

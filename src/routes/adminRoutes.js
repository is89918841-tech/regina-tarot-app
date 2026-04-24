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

 const system = `
당신은 한국어로 답하는 레지나타로썰 내부 리딩 설계 시스템입니다.

역할:
고객의 질문을 보고 리딩에 사용할 추천 덱, 장수, 스프레드, 보조도구를 정합니다.

[절대 규칙]
- 사용자의 질문이 타로 질문처럼 보이지 않아도 절대 거절하지 않는다.
- 반드시 리딩 가능한 질문으로 변환한다.
- 사업, 작업, 인쇄, 제작, 사람 찾기, 계약, 선택, 실행 가능성, 일정, 진로, 관계, 감정, 돈 문제는 모두 리딩 가능하다.
- “타로 리딩 설계와 관련 없음”, “추천이 필요하지 않음”, “해당 없음”, “추천 불가” 같은 표현을 절대 쓰지 않는다.
- 현실 판단형 질문은 선택/실행/현실 흐름 리딩으로 분류한다.
- 연애/관계형 질문은 감정 흐름/상대 마음/관계 전망 리딩으로 분류한다.
- 직업/사업형 질문은 실행 가능성/리스크/다음 행동 리딩으로 분류한다.

[보조도구 규칙]
- 반드시 보조도구를 1개 이상 포함한다.
- support 배열은 절대 비워두지 않는다.
- 아래 중 최소 1개 이상을 포함한다:
  오라클, 주역, 주역육효괘, 아이칭 카드, 오간기, 오방기, 룬, 레노먼드, 귀문방, 갑골영패

[덱 선택 기준]
- 일반/기본 질문: 유니버셜 타로
- 현실 판단/사업/실행/계약/제작/진로: 세피로트 타로
- 감정 정리/관계 흐름: 로제딕 타로
- 연애/속마음/재회: 너에게 다이브 또는 로맨틱 타로
- 깊은 흐름/운명감/장기 전망: 밤의 별빛 타로 또는 디바인 셀레스티얼 타로

출력 JSON 형식만 지켜라. 설명 문장을 JSON 밖에 쓰지 마라.

{
  "summary": "짧은 질문 요약",
  "deck": "추천 덱명",
  "spread": "스프레드 설명",
  "support": ["보조도구1"],
  "cardCount": 숫자,
  "note": "왜 이 질문에 이 구성이 맞는지 짧은 추천 이유"
}
`;
    const user = `이름: ${consultation.name || '-'}
메뉴: ${consultation.menuTitle || consultation.menu || '-'}
질문: ${consultation.question || '-'}
추가 메모: ${consultation.memo || '-'}`;

    const ai = await callOpenAIJson({ system, user, temperature: 0.6 });

    // 🔥 안전장치 (핵심)
    let support = Array.isArray(ai.support) && ai.support.length
      ? ai.support
      : ["오라클 카드 1장"];

   // 🔥 안전 장수 계산
const cardCount = Math.min(13, Math.max(1, Number(ai.cardCount || 3)));

// 🔥 추천 문장 생성 (완성본)
const recommendation =
  `질문 요약: ${ai.summary || consultation.question || '-'}\n` +
  `추천 덱: ${ai.deck || '로제딕 타로'}\n` +
  `스프레드: ${ai.spread || `${cardCount}카드 스프레드`}\n` +
  `장수: ${cardCount}\n` +
  `보조도구: ${support.join(', ')}\n` +
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

    const system = `
당신은 레지나 스타일의 타로 리더입니다.

[말투 규칙]
- 반드시 ~요 존댓말 사용
- “요청주신”, “살펴보니”, “확인해보니” 같은 불필요한 인사 금지
- 쓸데없이 과하게 정중한 표현 금지
- 문장은 자연스럽게 끊어서 리듬감 있게 작성
- “~일 수 있어요” 남용 금지, 가능/불가능을 명확하게 표현

[리딩 스타일]
- 카드 이름을 그대로 나열하지 말고 흐름 중심으로 해석
- 감정 해석 + 현실 흐름을 함께 설명
- 상황을 애매하게 흐리지 말고 방향을 정리해줄 것
- 위로만 하지 말고 현실적인 판단을 같이 제시할 것

[문장 구조]
1. 현재 상태를 짧고 명확하게 정리
2. 흐름이 어떻게 흘러가는지 설명
3. 결과 가능성 (된다 / 어렵다 / 조건부 가능) 선 긋기
4. 현실적으로 어떻게 행동하는 게 맞는지 제시

[출력 규칙]
- 한 문단 이상으로 밀도 있게 작성
- 읽었을 때 “정리됐다”는 느낌이 들게 작성
- 마지막에 한 줄로 현실적인 결론을 정리

[결론 규칙 - 필수]
- 반드시 아래 3개 중 하나로 명확하게 끝낼 것:
  → “계속 가는 것이 맞아요”
  → “지금은 멈추는 게 맞아요”
  → “조건이 맞으면 가능해요”

절대 상담센터 문장처럼 쓰지 말고,
“결정 내릴 수 있게 정리해주는 리딩”을 작성하세요.
`;

    const user = `
이름: ${consultation.name || '-'}
메뉴: ${consultation.menuTitle || consultation.menu || '-'}
질문: ${consultation.question || '-'}
추가 메모: ${consultation.memo || '-'}

추천:
${recommendation || '-'}

드로우 결과:
${drawResult || '-'}
`;

    const reading = await callOpenAI({
      system,
      user,
      temperature: 0.9,
    });

    return res.json({ ok: true, reading });
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

const express = require('express');
const cors = require('cors');
const path = require('path');
const fsp = require('fs/promises');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const OpenAI = require('openai');
const fetch = require('node-fetch');
const { generateReadingPlan } = require('./services/readingService');

const {
  buildBirthProfile,
  buildReadingContext,
  buildLotteryContext
} = require('./lib/birthCalculator');

const app = express();

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PRIVATE_DIR = path.join(ROOT_DIR, 'private');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DATA_DIR = path.join(PUBLIC_DIR, 'data');

const CONSULTATION_FILE = path.join(DATA_DIR, 'consultations.json');
const FILES_FILE = path.join(DATA_DIR, 'files.json');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'regina-secret';
const SESSION_COOKIE = 'regina_admin_session';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

function makeSessionToken() {
  return crypto
    .createHash('sha256')
    .update(`${ADMIN_PASSWORD}:${SESSION_SECRET}`)
    .digest('hex');
}

function isAdmin(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  return !!ADMIN_PASSWORD && token === makeSessionToken();
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(401).json({ ok: false, error: '관리자 인증이 필요해요.' });
  }
  next();
}

async function ensureDataFiles() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });

  try {
    await fsp.access(CONSULTATION_FILE);
  } catch {
    await fsp.writeFile(CONSULTATION_FILE, '[]', 'utf8');
  }

  try {
    await fsp.access(FILES_FILE);
  } catch {
    await fsp.writeFile(FILES_FILE, '[]', 'utf8');
  }
}

async function readJsonArray(filePath) {
  await ensureDataFiles();
  const raw = await fsp.readFile(filePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJsonArray(filePath, items) {
  await ensureDataFiles();
  await fsp.writeFile(filePath, JSON.stringify(items, null, 2), 'utf8');
}

function makeConsultationId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const t = Date.now().toString().slice(-6);
  return `CONS-${y}${m}${d}-${t}`;
}

function makeFileId() {
  return `FILE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toAdminConsultationShape(item) {
  return {
    ...item,
    menuTitle: item.product_name || item.menuTitle || '',
    menu: item.product_name || item.menu || '',
    createdAt: item.created_at || item.createdAt || '',
    finalReading: item.finalReading || item.final_reading || '',
    final_reading: item.finalReading || item.final_reading || '',
    kakaoText: item.kakaoText || item.kakao_text || '',
    kakao_text: item.kakaoText || item.kakao_text || '',
    drawResult: item.drawResult || item.draw_result || '',
    draw_result: item.drawResult || item.draw_result || '',
  };
}

function universalTarot78() {
  return [
    'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor',
    'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit',
    'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance',
    'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun', 'Judgement',
    'The World',

    'Ace of Wands', 'Two of Wands', 'Three of Wands', 'Four of Wands', 'Five of Wands',
    'Six of Wands', 'Seven of Wands', 'Eight of Wands', 'Nine of Wands', 'Ten of Wands',
    'Page of Wands', 'Knight of Wands', 'Queen of Wands', 'King of Wands',

    'Ace of Cups', 'Two of Cups', 'Three of Cups', 'Four of Cups', 'Five of Cups',
    'Six of Cups', 'Seven of Cups', 'Eight of Cups', 'Nine of Cups', 'Ten of Cups',
    'Page of Cups', 'Knight of Cups', 'Queen of Cups', 'King of Cups',

    'Ace of Swords', 'Two of Swords', 'Three of Swords', 'Four of Swords', 'Five of Swords',
    'Six of Swords', 'Seven of Swords', 'Eight of Swords', 'Nine of Swords', 'Ten of Swords',
    'Page of Swords', 'Knight of Swords', 'Queen of Swords', 'King of Swords',

    'Ace of Pentacles', 'Two of Pentacles', 'Three of Pentacles', 'Four of Pentacles',
    'Five of Pentacles', 'Six of Pentacles', 'Seven of Pentacles', 'Eight of Pentacles',
    'Nine of Pentacles', 'Ten of Pentacles',
    'Page of Pentacles', 'Knight of Pentacles', 'Queen of Pentacles', 'King of Pentacles'
  ];
}

function pickUnique(list, count) {
  const arr = Array.isArray(list) ? [...list] : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

function maybeReverse(card) {
  return Math.random() < 0.3 ? `${card} (역방향)` : card;
}

function loadJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadManifest() {
  return loadJsonSafe(path.join(PUBLIC_DATA_DIR, 'manifest.json')) || {
    tarot: {},
    oracle: {},
    aux: {},
    iching: 'iching.json',
    yukyo: '주역육효_simple.json',
  };
}

function loadDeckFromPublic(fileName) {
  if (!fileName) return [];
  const filePath = path.join(PUBLIC_DATA_DIR, fileName);
  const parsed = loadJsonSafe(filePath);
  return Array.isArray(parsed) ? parsed : [];
}

function loadLenormandDeck() {
  const publicFile = loadJsonSafe(path.join(PUBLIC_DATA_DIR, 'lenormand36.json'));
  if (Array.isArray(publicFile)) return publicFile;

  const rootFile = loadJsonSafe(path.join(DATA_DIR, 'lenormand36.json'));
  if (Array.isArray(rootFile)) return rootFile;

  return [];
}

function normalizeCardValue(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  return (
    value.name ||
    value.title ||
    value.card ||
    value.label ||
    value.korean ||
    value.keyword ||
    JSON.stringify(value)
  );
}

function drawCardsFromArray(arr, count = 1, useReverse = false) {
  const normalized = arr
    .map(normalizeCardValue)
    .filter(Boolean);

  if (!normalized.length) return [];

  const picked = pickUnique(normalized, Math.min(count, normalized.length));
  return useReverse ? picked.map(maybeReverse) : picked;
}

function planToSetup(plan) {
  const positions = Array.from(
    { length: Math.max(1, Number(plan?.card_count) || 3) },
    (_, idx) => `카드 ${idx + 1}`
  );

  const auxTools = [
    ...(plan?.use_oracle && plan?.oracle_deck ? [plan.oracle_deck] : []),
    ...(plan?.use_lenormand ? ['레노먼드 카드'] : []),
    ...(plan?.use_runes ? ['룬스톤'] : []),
    ...(plan?.use_iching ? ['아이칭 카드'] : []),
    ...(plan?.use_yukyo ? ['주역육효괘'] : []),
    ...(plan?.use_ogangi ? ['오간기'] : []),
    ...(plan?.use_obanggi ? ['오방기'] : []),
    ...(Array.isArray(plan?.selected_aux_decks) ? plan.selected_aux_decks : []),
  ];

  return {
    deck: plan?.deck || '유니버셜 타로',
    spread: plan?.spread_name || '기본 3카드',
    positions,
    auxTools,
  };
}

function buildRecommendationTextFromPlan(plan) {
  return [
    `추천 덱: ${plan.deck || '유니버셜 타로'}`,
    `스프레드: ${plan.spread_name || '기본 3카드'}`,
    `장수: ${plan.card_count || 3}`,
    `이유: ${plan.reason || '질문 성격에 맞는 구조로 설계됨'}`
  ].join('\n');
}

function buildRealDraw(plan) {
  const manifest = loadManifest();
  const setup = planToSetup(plan);

  const tarotFile = manifest.tarot?.[setup.deck] || 'universal.json';
  let tarotDeck = loadDeckFromPublic(tarotFile);

  if (!Array.isArray(tarotDeck) || tarotDeck.length < setup.positions.length) {
    tarotDeck = universalTarot78();
  }

  const tarotCards = drawCardsFromArray(tarotDeck, setup.positions.length, true);

  const lines = [];
  lines.push(`**덱**: ${setup.deck}`);
  lines.push(`**장수**: ${tarotCards.length}`);
  lines.push('');
  lines.push('**포지션별 드로우**');

  setup.positions.forEach((position, idx) => {
    lines.push(`- 카드 ${idx + 1} (${position}): ${tarotCards[idx] || '-'}`);
  });

  if (plan?.use_oracle && plan?.oracle_deck) {
    const oracleFile = manifest.oracle?.[plan.oracle_deck];
    const oracleDeck = loadDeckFromPublic(oracleFile);
    const oracleCards = drawCardsFromArray(oracleDeck, Math.max(1, Number(plan.oracle_count) || 1), false);
    if (oracleCards.length) {
      lines.push(`**오라클**: ${oracleCards.join(', ')}`);
    }
  }

  if (plan?.use_lenormand) {
    const lenormandDeck = loadLenormandDeck();
    const lenormandCards = drawCardsFromArray(
      lenormandDeck,
      Math.max(1, Number(plan.lenormand_count) || 1),
      false
    );
    if (lenormandCards.length) {
      lines.push(`**레노먼드**: ${lenormandCards.join(', ')}`);
    }
  }

  if (plan?.use_iching) {
    const ichingDeck = loadDeckFromPublic(manifest.iching);
    const ichingCards = drawCardsFromArray(
      ichingDeck,
      Math.max(1, Number(plan.iching_count) || 1),
      false
    );
    if (ichingCards.length) {
      lines.push(`**주역**: ${ichingCards.join(', ')}`);
    }
  }

  if (plan?.use_yukyo) {
    const yukyoDeck = loadDeckFromPublic(manifest.yukyo);
    const yukyoCards = drawCardsFromArray(
      yukyoDeck,
      Math.max(1, Number(plan.yukyo_count) || 1),
      false
    );
    if (yukyoCards.length) {
      lines.push(`**주역육효괘**: ${yukyoCards.join(', ')}`);
    }
  }

  const auxDraws = [];

  if (Array.isArray(plan?.selected_aux_decks)) {
    for (const auxName of plan.selected_aux_decks) {
      const auxFile = manifest.aux?.[auxName];
      const auxDeck = loadDeckFromPublic(auxFile);
      const auxCards = drawCardsFromArray(
        auxDeck,
        Math.max(1, Number(plan.aux_counts?.[auxName]) || 1),
        false
      );
      if (auxCards.length) {
        auxDraws.push(`${auxName}: ${auxCards.join(', ')}`);
      } else {
        auxDraws.push(auxName);
      }
    }
  }

  if (plan?.use_ogangi) auxDraws.push('오간기');
  if (plan?.use_obanggi) auxDraws.push('오방기');
  if (plan?.use_runes) auxDraws.push('룬스톤');

  if (auxDraws.length) {
    lines.push(`**보조**: ${auxDraws.join(' / ')}`);
  }

  return lines.join('\n');
}

async function callOpenAI(messages, temperature = 0.9) {
  if (!openai) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았어요.');
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    temperature,
    messages,
  });

  return completion.choices?.[0]?.message?.content?.trim() || '';
}

async function generateRecommendationText(item) {
  const plan = await generateReadingPlan({
    question: item.question || '',
  });

  const recommendation = buildRecommendationTextFromPlan(plan);
  const setup = planToSetup(plan);

  return { recommendation, setup, plan };
}

async function generateFinalReadingText(item, recommendation, drawResult) {
  const compact = item.product_kind === 'simple';

  const messages = [
    {
      role: 'system',
      content: `
당신은 레지나타로썰 스타일의 타로 리딩 작성자입니다.

반드시 지킬 것:
- 내담자님이라고 부르기
- 한국어 존댓말(~요)
- 자연스럽고 사람 말투 (기계 느낌 금지)
- 감정과 현실 흐름을 같이 보기
- 카드 이름은 본문에서 반복 나열하지 말고 흐름 중심으로 해석
- 공포 조장 금지
- 불필요한 면책 문구 금지

크몽 채팅용 최적화:
- 너무 길게 늘어지지 않게 작성
- 읽기 편하게 문단 구분
- 말투는 부드럽고 자연스럽게
- 상담 느낌으로 이어지게 작성

출력 방식:
- ${compact ? '1문단으로 핵심만 정리' : '2~3문단으로 상황 → 흐름 → 정리 구조'}
- 처음 보는 사람도 이해할 수 있게 쓰기
- 위로보다 정리와 결정을 돕는 방향으로 쓰기
- 마지막에 이어서 할 수 있는 질문 1~2개 제안
      `.trim(),
    },
    {
      role: 'user',
      content: `
내담자님 질문:
${item.question || ''}

추천 내용:
${recommendation || '없음'}

드로우 결과:
${drawResult || '없음'}

이 정보를 바탕으로 최종 리딩을 작성해주세요.
      `.trim(),
    },
  ];

  return callOpenAI(messages, 0.9);
}

const storage = multer.diskStorage({
  destination: async (_, __, cb) => {
    try {
      await ensureDataFiles();
      cb(null, UPLOAD_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_, file, cb) => {
    const safe = `${Date.now()}-${file.originalname.replace(/[^\w.\-가-힣]/g, '_')}`;
    cb(null, safe);
  },
});

const upload = multer({ storage });

// public routes
app.get('/healthz', (_, res) => {
  res.status(200).json({ ok: true, status: 'healthy' });
});

// 외부 연결용 추천 API (GPT 자동 판단 버전)
app.post('/api/recommend', async (req, res) => {
  try {
    const { question = '' } = req.body || {};

    if (!String(question).trim()) {
      return res.status(400).json({
        ok: false,
        error: '질문이 필요해요.',
      });
    }

    const plan = await generateReadingPlan({
      question: String(question).trim(),
    });

    return res.status(200).json({
      ok: true,
      plan,
      config: {
        deck: plan.deck,
        spread: plan.spread_name,
        count: plan.card_count,
        extras: planToSetup(plan).auxTools,
      },
    });
  } catch (error) {
    console.error('POST /api/recommend error:', error);
    return res.status(500).json({
      ok: false,
      error: '추천 생성에 실패했어요.',
    });
  }
});

// 외부 연결용 드로우 API (GPT 추천 plan 기준)
app.post('/api/draw', async (req, res) => {
  try {
    const { question = '', plan = null } = req.body || {};

    let finalPlan = plan;

    if (!finalPlan) {
      if (!String(question).trim()) {
        return res.status(400).json({
          ok: false,
          error: '질문 또는 plan이 필요해요.',
        });
      }

      finalPlan = await generateReadingPlan({
        question: String(question).trim(),
      });
    }

    const setup = planToSetup(finalPlan);
    const drawResult = buildRealDraw(finalPlan);

    return res.status(200).json({
      ok: true,
      plan: finalPlan,
      setup,
      drawResult,
    });
  } catch (error) {
    console.error('POST /api/draw error:', error);
    return res.status(500).json({
      ok: false,
      error: '자동 드로우에 실패했어요.',
    });
  }
});

// 외부 연결용 최종 리딩 API
app.post('/api/reading', async (req, res) => {
  try {
    const { question = '', cards = '', productKind = 'standard' } = req.body || {};

    if (!String(question).trim()) {
      return res.status(400).json({ ok: false, error: '질문이 필요해요.' });
    }

    const fakeItem = {
      question,
      product_kind: productKind,
    };

    const reading = await generateFinalReadingText(
      fakeItem,
      '',
      typeof cards === 'string' ? cards : JSON.stringify(cards, null, 2)
    );

    return res.status(200).json({
      ok: true,
      reading,
      finalReading: reading,
    });
  } catch (error) {
    console.error('POST /api/reading error:', error);
    return res.status(500).json({ ok: false, error: '최종 리딩 생성에 실패했어요.' });
  }
});

app.post('/api/consultations', async (req, res) => {
  try {
    const {
      name = '',
      contact = '',
      question = '',
      product_name = '',
      product_price = 0,
      product_kind = '',
      payment_status = 'pending_manual_check'
    } = req.body || {};

    if (!name.trim()) {
      return res.status(400).json({ ok: false, error: '성함을 입력해주세요.' });
    }
    if (!contact.trim()) {
      return res.status(400).json({ ok: false, error: '연락처를 입력해주세요.' });
    }
    if (!/^010-\d{4}-\d{4}$/.test(contact.trim())) {
      return res.status(400).json({ ok: false, error: '연락처 형식이 올바르지 않아요.' });
    }
    if (!question.trim()) {
      return res.status(400).json({ ok: false, error: '질문을 입력해주세요.' });
    }
    if (!product_name.trim()) {
      return res.status(400).json({ ok: false, error: '상품 선택이 필요해요.' });
    }

    const items = await readJsonArray(CONSULTATION_FILE);

    const consultation = {
      id: makeConsultationId(),
      name: name.trim(),
      contact: contact.trim(),
      question: question.trim(),
      product_name: product_name.trim(),
      product_price: Number(product_price || 0),
      product_kind: product_kind || '',
      payment_status,
      status: product_kind === 'booking' ? 'waiting_booking' : 'waiting_payment_check',
      created_at: new Date().toISOString(),

      recommendation: '',
      drawResult: '',
      finalReading: '',
      kakaoText: '',
      readingPlan: null,
    };

    let autoReading = null;
    let recommended = null;

    if (product_kind === 'simple' || product_kind === 'standard') {
      const plan = await generateReadingPlan({
        question: consultation.question,
      });

      const setup = planToSetup(plan);
      const recommendation = buildRecommendationTextFromPlan(plan);
      const drawResult = buildRealDraw(plan);
      const finalReading = await generateFinalReadingText(
        consultation,
        recommendation,
        drawResult
      );

      consultation.readingPlan = plan;
      consultation.recommendation = recommendation;
      consultation.drawResult = drawResult;
      consultation.finalReading = finalReading;
      consultation.kakaoText = [
        `${consultation.name}님 안녕하세요.`,
        '',
        '요청주신 리딩 결과 전달드려요.',
        '',
        finalReading,
        '',
        '추가 질문이 있으시면 이어서 남겨주세요.'
      ].join('\n');

      consultation.status = 'ready_to_send';
      consultation.reading_completed_at = new Date().toISOString();

      autoReading = finalReading;
      recommended = { plan, setup };
    }

    items.unshift(consultation);
await writeJsonArray(CONSULTATION_FILE, items);

return res.status(201).json({
  ok: true,
  consultation,
  recommended,
  autoReading
});
  } catch (error) {
    console.error('POST /api/consultations error:', error);
    return res.status(500).json({
      ok: false,
      error: '리딩 생성 또는 접수 저장 중 문제가 생겼어요.'
    });
  }
});

// admin auth
app.post('/api/admin/login', async (req, res) => {
  const { password = '' } = req.body || {};

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD가 설정되지 않았어요.' });
  }

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: '비밀번호가 올바르지 않아요.' });
  }

  res.cookie(SESSION_COOKIE, makeSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 12,
    path: '/',
  });

  return res.status(200).json({ ok: true });
});

app.post('/api/admin/logout', async (_, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  return res.status(200).json({ ok: true });
});

app.get('/api/admin/me', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(401).json({ ok: false, error: '로그인이 필요해요.' });
  }
  return res.status(200).json({ ok: true, admin: true });
});

// 관리자 보조앱 추천 API
app.post('/api/admin/recommend', requireAdmin, async (req, res) => {
  try {
    const { question = '' } = req.body || {};

    if (!String(question).trim()) {
      return res.status(400).json({ ok: false, error: '질문이 필요해요.' });
    }

    const plan = await generateReadingPlan({
      question: String(question).trim(),
    });

    return res.status(200).json({
      ok: true,
      recommendation: {
        deck: plan.deck,
        count: plan.card_count,
        aux: planToSetup(plan).auxTools,
      },
      plan,
      setup: planToSetup(plan),
    });
  } catch (error) {
    console.error('POST /api/admin/recommend error:', error);
    return res.status(500).json({ ok: false, error: '관리자 추천 생성에 실패했어요.' });
  }
});

// admin consultations
app.get('/api/admin/consultations', requireAdmin, async (_, res) => {
  try {
    const items = await readJsonArray(CONSULTATION_FILE);
    return res.status(200).json({
      ok: true,
      consultations: items.map(toAdminConsultationShape),
    });
  } catch (error) {
    console.error('GET /api/admin/consultations error:', error);
    return res.status(500).json({ ok: false, error: '접수 목록을 불러오지 못했어요.' });
  }
});

app.get('/api/admin/consultations/:id', requireAdmin, async (req, res) => {
  try {
    const items = await readJsonArray(CONSULTATION_FILE);
    const item = items.find((x) => x.id === req.params.id);
    if (!item) {
      return res.status(404).json({ ok: false, error: '해당 접수를 찾지 못했어요.' });
    }
    return res.status(200).json({
      ok: true,
      consultation: toAdminConsultationShape(item),
    });
  } catch (error) {
    console.error('GET /api/admin/consultations/:id error:', error);
    return res.status(500).json({ ok: false, error: '상세 접수를 불러오지 못했어요.' });
  }
});

app.post('/api/admin/consultations/:id/paid', requireAdmin, async (req, res) => {
  try {
    const items = await readJsonArray(CONSULTATION_FILE);
    const idx = items.findIndex((x) => x.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ ok: false, error: '해당 접수를 찾지 못했어요.' });
    }

    const item = items[idx];

    item.payment_status = 'paid';
    item.status = item.finalReading ? 'sent_ready' : 'paid_waiting_reading';
    item.paid_at = new Date().toISOString();
    item.updated_at = new Date().toISOString();

    await writeJsonArray(CONSULTATION_FILE, items);

   if (item.finalReading) {
  fetch('https://regina-tarot-app.onrender.com/api/send-kakao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: item.contact,
      name: item.name,
      id: item.id
    })
  }).catch((error) => {
    console.error('PAID KAKAO SEND ERROR:', error);
  });

  item.status = 'sent'; // 🔥 이 한 줄 추가
}

    return res.json({ ok: true, consultation: item });
  } catch (error) {
    console.error('paid confirm error:', error);
    return res.status(500).json({ ok: false, error: '입금 확인 처리 실패' });
  }
});

app.post('/api/admin/consultations/:id/recommendation', requireAdmin, async (req, res) => {
  try {
    const { recommendation = '' } = req.body || {};
    const items = await readJsonArray(CONSULTATION_FILE);
    const idx = items.findIndex((x) => x.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ ok: false, error: '해당 접수를 찾지 못했어요.' });
    }

    items[idx].recommendation = recommendation;
    items[idx].updated_at = new Date().toISOString();

    await writeJsonArray(CONSULTATION_FILE, items);

    return res.status(200).json({ ok: true, recommendation });
  } catch (error) {
    console.error('recommendation save error:', error);
    return res.status(500).json({ ok: false, error: '추천 저장에 실패했어요.' });
  }
});

app.post('/api/admin/consultations/:id/draw/generate', requireAdmin, async (req, res) => {
  try {
    const items = await readJsonArray(CONSULTATION_FILE);
    const idx = items.findIndex((x) => x.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ ok: false, error: '해당 접수를 찾지 못했어요.' });
    }

    const plan = items[idx].readingPlan || await generateReadingPlan({
      question: items[idx].question || '',
    });

    const drawResult = buildRealDraw(plan);

    items[idx].readingPlan = plan;
    items[idx].drawResult = drawResult;
    items[idx].updated_at = new Date().toISOString();

    await writeJsonArray(CONSULTATION_FILE, items);

    return res.status(200).json({ ok: true, drawResult, plan });
  } catch (error) {
    console.error('draw generate error:', error);
    return res.status(500).json({ ok: false, error: '자동 드로우에 실패했어요.' });
  }
});

app.post('/api/admin/consultations/:id/draw', requireAdmin, async (req, res) => {
  try {
    const { drawResult = '' } = req.body || {};
    const items = await readJsonArray(CONSULTATION_FILE);
    const idx = items.findIndex((x) => x.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ ok: false, error: '해당 접수를 찾지 못했어요.' });
    }

    items[idx].drawResult = drawResult;
    items[idx].updated_at = new Date().toISOString();

    await writeJsonArray(CONSULTATION_FILE, items);

    return res.status(200).json({ ok: true, drawResult });
  } catch (error) {
    console.error('draw save error:', error);
    return res.status(500).json({ ok: false, error: '드로우 저장에 실패했어요.' });
  }
});

app.post('/api/admin/consultations/:id/reading/generate', requireAdmin, async (req, res) => {
  try {
    const items = await readJsonArray(CONSULTATION_FILE);
    const idx = items.findIndex((x) => x.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ ok: false, error: '해당 접수를 찾지 못했어요.' });
    }

    const body = req.body || {};
    const recommendation = body.recommendation || items[idx].recommendation || '';
    const drawResult = body.drawResult || items[idx].drawResult || '';

    const reading = await generateFinalReadingText(items[idx], recommendation, drawResult);

    items[idx].finalReading = reading;
    items[idx].updated_at = new Date().toISOString();

    await writeJsonArray(CONSULTATION_FILE, items);

    return res.status(200).json({ ok: true, reading, finalReading: reading });
  } catch (error) {
    console.error('reading generate error:', error);
    return res.status(500).json({ ok: false, error: '최종 리딩 생성에 실패했어요.' });
  }
});

app.post('/api/admin/consultations/:id/reading', requireAdmin, async (req, res) => {
  try {
    const { finalReading = '' } = req.body || {};
    const items = await readJsonArray(CONSULTATION_FILE);
    const idx = items.findIndex((x) => x.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ ok: false, error: '해당 접수를 찾지 못했어요.' });
    }

    items[idx].finalReading = finalReading;
    items[idx].updated_at = new Date().toISOString();

    await writeJsonArray(CONSULTATION_FILE, items);

    return res.status(200).json({ ok: true, finalReading });
  } catch (error) {
    console.error('reading save error:', error);
    return res.status(500).json({ ok: false, error: '최종 리딩 저장에 실패했어요.' });
  }
});

app.post('/api/admin/consultations/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status = '' } = req.body || {};
    const items = await readJsonArray(CONSULTATION_FILE);
    const idx = items.findIndex((x) => x.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ ok: false, error: '해당 접수를 찾지 못했어요.' });
    }

    items[idx].status = status;
    items[idx].updated_at = new Date().toISOString();

    await writeJsonArray(CONSULTATION_FILE, items);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('status save error:', error);
    return res.status(500).json({ ok: false, error: '상태 저장 실패' });
  }
});

// files
app.get('/api/admin/files', requireAdmin, async (_, res) => {
  try {
    const files = await readJsonArray(FILES_FILE);
    return res.status(200).json({ ok: true, files });
  } catch (error) {
    console.error('GET /api/admin/files error:', error);
    return res.status(500).json({ ok: false, error: '파일 목록을 불러오지 못했어요.' });
  }
});

app.post('/api/admin/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: '업로드할 파일이 없어요.' });
    }

    const files = await readJsonArray(FILES_FILE);

    const item = {
      id: makeFileId(),
      originalName: req.file.originalname,
      storedName: req.file.filename,
      filename: req.file.filename,
      localPath: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      deck: req.body.deck || '',
      topic: req.body.topic || '',
      priority: req.body.priority || 'core',
      type: req.body.type || 'guidebook',
      status: 'saved',
      created_at: new Date().toISOString(),
    };

    files.unshift(item);
    await writeJsonArray(FILES_FILE, files);

    return res.status(201).json({ ok: true, file: item });
  } catch (error) {
    console.error('POST /api/admin/upload error:', error);
    return res.status(500).json({ ok: false, error: '파일 업로드에 실패했어요.' });
  }
});

// private tool pages
app.get('/admin/helper', requireAdmin, async (_, res) => {
  return res.sendFile(path.join(PRIVATE_DIR, 'admin-helper.html'));
});

app.get('/admin/grand-tableau', requireAdmin, async (_, res) => {
  return res.sendFile(path.join(PRIVATE_DIR, 'admin-grand-tableau.html'));
});

app.get('/consultation', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'consultation.html'));
});

app.get('/admin', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.post('/api/send-kakao', async (req, res) => {
  try {
    const { phone, name, id } = req.body;

    const items = await readJsonArray(CONSULTATION_FILE);
    const consultation = items.find((x) => x.id === id);

    if (!consultation) {
      return res.status(404).json({
        ok: false,
        error: '상담 정보를 찾지 못했어요.'
      });
    }

    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    const isLottery = consultation.product_kind === 'lottery';

    const templateId = isLottery
      ? process.env.BIZM_LOTTERY_TEMPLATE_ID
      : process.env.BIZM_TEMPLATE_ID;

    const resultUrl =
  consultation.product_kind === 'lottery'
    ? `https://regina-tarot-app.onrender.com/lottery-result.html?id=${id}`
    : consultation.product_kind === 'personality'
      ? `https://regina-tarot-app.onrender.com/personality-result.html?id=${id}`
      : `https://regina-tarot-app.onrender.com/result.html?id=${id}`;

    const lotterySource = [
      consultation.drawResult || '',
      consultation.finalReading || ''
    ].join('\n');

    function extractLotteryDays(text) {
      const match = String(text).match(/추천일[\s\S]*?(\d{1,2}일[\s\S]*?\d{1,2}일[\s\S]*?\d{1,2}일)/);
      if (match) {
        return match[1]
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      const days = [...String(text).matchAll(/(\d{1,2})일/g)]
        .map((m) => `${m[1]}일`)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 3);

      return days.length ? days.join(' / ') : '상세 페이지에서 확인해주세요';
    }

    function extractLotterySummary(text) {
      const match =
        String(text).match(/흐름 요약[\s\S]*?\n([\s\S]*?)(\n\*\*|$)/) ||
        String(text).match(/재물 흐름 요약[\s\S]*?\n([\s\S]*?)(\n\*\*|$)/);

      if (match && match[1]) {
        return match[1]
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 80);
      }

      return '이번 달은 무리한 기대보다 소액으로 가볍게 시도하는 흐름이 더 안정적입니다.';
    }

    const lotteryDays = extractLotteryDays(lotterySource);
    const lotterySummary = extractLotterySummary(lotterySource);

    const messageText = isLottery
      ? `[레지나타로썰]

내담자님의 복권 구매 추천일 분석이 완료되었어요 🍀

이번 달 추천일
${lotteryDays}

재물 흐름 요약
${lotterySummary}

상세 리딩 확인
${resultUrl}

※ 본 분석은 개인 흐름을 바탕으로 한 참고용 리딩이며, 과도한 구매보다는 가벼운 재미와 흐름 확인용으로 활용하시길 추천드립니다.`
      : `[레지나타로썰]

안녕하세요, ${name || '고객'}님.

요청하신 타로 리딩 결과가 준비되었습니다.
아래 버튼을 눌러 결과를 확인해주세요.

감사합니다.`;

    const buttonName = isLottery
      ? '복권 리딩 확인하기'
      : '리딩 보기';

    const result = await fetch('https://alimtalk-api.bizmsg.kr/v2/sender/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        userid: process.env.BIZM_USER_ID
      },
      body: JSON.stringify([
        {
          message_type: 'AT',
          phn: cleanPhone,
          profile: process.env.BIZM_PROFILE_KEY,
          tmplId: templateId,
          msg: messageText,
          reserveDt: '00000000000000',
          button1: {
            type: 'WL',
            name: buttonName,
            url_mobile: resultUrl,
            url_pc: resultUrl
          }
        }
      ])
    });

    const data = await result.json();
    return res.json({ ok: true, data });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// 🔮 리딩 결과 조회 API (고객용)
app.get('/api/consultations/:id', async (req, res) => {
  try {
    const items = await readJsonArray(CONSULTATION_FILE);
    const item = items.find((x) => x.id === req.params.id);

    if (!item) {
      return res.status(404).json({
        ok: false,
        error: '리딩 결과를 찾지 못했어요.'
      });
    }

    return res.status(200).json({
      ok: true,
      consultation: {
        id: item.id,
        name: item.name,
        finalReading: item.finalReading || '',
        status: item.status || ''
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      error: '리딩 결과 불러오기 실패'
    });
  }
});

// static pages
app.use(express.static(PUBLIC_DIR));
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

ensureDataFiles()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Regina server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize data files:', error);
    process.exit(1);
  });


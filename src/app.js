const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PRIVATE_DIR = path.join(ROOT_DIR, 'private');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const CONSULTATION_FILE = path.join(DATA_DIR, 'consultations.json');
const FILES_FILE = path.join(DATA_DIR, 'files.json');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'regina-secret';
const SESSION_COOKIE = 'regina_admin_session';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  try {
    await fs.access(CONSULTATION_FILE);
  } catch {
    await fs.writeFile(CONSULTATION_FILE, '[]', 'utf8');
  }

  try {
    await fs.access(FILES_FILE);
  } catch {
    await fs.writeFile(FILES_FILE, '[]', 'utf8');
  }
}

async function readJsonArray(filePath) {
  await ensureDataFiles();
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJsonArray(filePath, items) {
  await ensureDataFiles();
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), 'utf8');
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
    '0 바보', 'I 마법사', 'II 여사제', 'III 여제', 'IV 황제', 'V 교황', 'VI 연인',
    'VII 전차', 'VIII 힘', 'IX 은둔자', 'X 운명의 수레바퀴', 'XI 정의', 'XII 매달린 남자',
    'XIII 죽음', 'XIV 절제', 'XV 악마', 'XVI 탑', 'XVII 별', 'XVIII 달', 'XIX 태양',
    'XX 심판', 'XXI 세계',
    '컵 에이스', '컵 2', '컵 3', '컵 4', '컵 5', '컵 6', '컵 7', '컵 8', '컵 9', '컵 10',
    '컵 시종', '컵 기사', '컵 여왕', '컵 왕',
    '완드 에이스', '완드 2', '완드 3', '완드 4', '완드 5', '완드 6', '완드 7', '완드 8',
    '완드 9', '완드 10', '완드 시종', '완드 기사', '완드 여왕', '완드 왕',
    '소드 에이스', '소드 2', '소드 3', '소드 4', '소드 5', '소드 6', '소드 7', '소드 8',
    '소드 9', '소드 10', '소드 시종', '소드 기사', '소드 여왕', '소드 왕',
    '펜타클 에이스', '펜타클 2', '펜타클 3', '펜타클 4', '펜타클 5', '펜타클 6',
    '펜타클 7', '펜타클 8', '펜타클 9', '펜타클 10',
    '펜타클 시종', '펜타클 기사', '펜타클 여왕', '펜타클 왕'
  ];
}

function pickUnique(list, count) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

function maybeReverse(card) {
  return Math.random() < 0.3 ? `${card} (역방향)` : card;
}

function recommendReadingSetup(question, productKind) {
  const q = String(question || '').toLowerCase();

  const isLove =
    /연애|재회|속마음|관계|썸|전남친|전여친|남친|여친|좋아하|연락|호감|짝사랑/.test(q);
  const isCareer =
    /직장|이직|퇴사|합격|면접|커리어|회사|승진|업무|프로젝트|사업/.test(q);
  const isMoney =
    /금전|돈|재물|수입|매출|투자|계약|정산|매매/.test(q);
  const isDecision =
    /선택|결정|둘 중|어느 쪽|해야 할까|맞을까|가야 할까/.test(q);
  const isPersonality =
    /성격|어떤 사람|나를 어떻게|주변에서|왜 이럴까/.test(q);

  let deck = '하모니 타로';
  let spread = '핵심 흐름 스프레드';
  let positions = ['현재 상태', '흐름', '조언'];

  if (productKind === 'simple') {
    spread = '간단 방향 스프레드';
    positions = ['현재 상태', '조언'];
  }

  if (isLove) {
    deck = '너에게로 다이브';
    spread = productKind === 'simple' ? '연애 핵심 스프레드' : '관계 흐름 스프레드';
    positions = productKind === 'simple'
      ? ['상대 흐름', '조언']
      : ['현재 관계 상태', '상대 흐름', '조언'];
  } else if (isCareer) {
    deck = '세피로트 타로';
    spread = productKind === 'simple' ? '직장 방향 스프레드' : '현실 정리 스프레드';
    positions = productKind === 'simple'
      ? ['현재 흐름', '조언']
      : ['현재 업무 상태', '방해 요소', '조언'];
  } else if (isMoney) {
    deck = '리치 타로카드';
    spread = productKind === 'simple' ? '재물 핵심 스프레드' : '재물 흐름 스프레드';
    positions = productKind === 'simple'
      ? ['재물 흐름', '조언']
      : ['현재 재정 상태', '흐름', '조언'];
  } else if (isDecision) {
    deck = '나전의 빛 타로';
    spread = productKind === 'simple' ? '결정 포인트 스프레드' : '결정 정리 스프레드';
    positions = productKind === 'simple'
      ? ['핵심 포인트', '조언']
      : ['현재 조건', '선택의 포인트', '조언'];
  } else if (isPersonality) {
    deck = '로제딕 타로';
    spread = productKind === 'simple' ? '인상 포인트 스프레드' : '성향 분석 스프레드';
    positions = productKind === 'simple'
      ? ['겉으로 보이는 면', '조언']
      : ['겉으로 보이는 면', '내부 흐름', '조언'];
  }

  const auxTools = [];
  if (isLove) auxTools.push('하트 로맨틱 오라클');
  if (isDecision) auxTools.push('주역육효괘');
  if (isCareer || isMoney) auxTools.push('오간기');
  if (!auxTools.length && productKind !== 'simple') auxTools.push('오방기');

  return { deck, spread, positions, auxTools };
}

function buildDrawResultFromSetup(setup) {
  const tarot = universalTarot78();
  const picked = pickUnique(tarot, setup.positions.length).map(maybeReverse);

  const lines = [];
  lines.push(`**덱**: ${setup.deck}`);
  lines.push(`**장수**: ${setup.positions.length}`);
  lines.push('');
  lines.push('**포지션별 드로우**');
  setup.positions.forEach((position, idx) => {
    lines.push(`- 카드 ${idx + 1} (${position}): ${picked[idx]}`);
  });
  if (setup.auxTools?.length) {
    lines.push(`**보조**: ${setup.auxTools.join(', ')}`);
  }
  return lines.join('\n');
}

async function callOpenAI(messages, temperature = 0.9) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    temperature,
    messages,
  });
  return completion.choices?.[0]?.message?.content?.trim() || '';
}

async function generateRecommendationText(item) {
  const setup = recommendReadingSetup(item.question || '', item.product_kind || 'standard');

  const messages = [
    {
      role: 'system',
      content: `
당신은 레지나타로썰 운영 보조자입니다.
질문을 보고 가장 어울리는 덱, 스프레드, 보조도구를 추천해주세요.

규칙:
- 한국어 존댓말
- 내담자님이라고 부르지 말고, 내부 관리자용 추천문처럼 작성
- 짧고 명확하게
- 아래 형식 그대로

추천 덱: ...
추천 스프레드: ...
포지션: ...
보조도구: ...
추천 이유: ...
      `.trim(),
    },
    {
      role: 'user',
      content: `
질문: ${item.question || ''}
상품: ${item.product_name || ''}
기본 추천 세팅:
- 덱: ${setup.deck}
- 스프레드: ${setup.spread}
- 포지션: ${setup.positions.join(', ')}
- 보조도구: ${setup.auxTools.join(', ') || '없음'}
      `.trim(),
    },
  ];

  const recommendation = await callOpenAI(messages, 0.7);
  return { recommendation, setup };
}

async function generateFinalReadingText(item, recommendation, drawResult) {
  const compact = item.product_kind === 'simple';

  const messages = [
    {
      role: 'system',
      content: `
당신은 레지나타로썰 스타일의 리딩 작성자입니다.

반드시 지킬 것:
- 내담자님이라고 부르기
- 한국어 존댓말(~요)
- 감정과 현실 흐름을 같이 보기
- 카드 이름은 본문에서 반복 나열하지 말고 흐름 중심으로 해석
- 공포 조장 금지
- 불필요한 면책 문구 금지
- 마지막에 이어서 할 수 있는 질문 2개 제안

출력 방식:
- ${compact ? '한 문단으로 밀도 있게 정리' : '3~4문단으로 풍성하게 정리'}
- 처음 보는 사람도 이해할 수 있게 쓰기
- 위로보다 정리와 결정을 돕는 방향으로 쓰기
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

// 외부 연결용 추천 API
app.post('/api/recommend', async (req, res) => {
  try {
    const { question = '', productKind = 'standard' } = req.body || {};
    const setup = recommendReadingSetup(question, productKind);

    return res.status(200).json({
      ok: true,
      config: {
        deck: setup.deck,
        spread: setup.spread,
        count: setup.positions.length,
        extras: setup.auxTools,
        positions: setup.positions,
      },
    });
  } catch (error) {
    console.error('POST /api/recommend error:', error);
    return res.status(500).json({ ok: false, error: '추천 생성에 실패했어요.' });
  }
});

// 외부 연결용 드로우 API
app.post('/api/draw', async (req, res) => {
  try {
    const { question = '', productKind = 'standard' } = req.body || {};
    const setup = recommendReadingSetup(question, productKind);
    const drawResult = buildDrawResultFromSetup(setup);

    return res.status(200).json({
      ok: true,
      setup,
      drawResult,
    });
  } catch (error) {
    console.error('POST /api/draw error:', error);
    return res.status(500).json({ ok: false, error: '자동 드로우에 실패했어요.' });
  }
});

// 외부 연결용 최종 리딩 API
app.post('/api/reading', async (req, res) => {
  try {
    const { question = '', cards = '' } = req.body || {};

    if (!String(question).trim()) {
      return res.status(400).json({ ok: false, error: '질문이 필요해요.' });
    }

    const fakeItem = {
      question,
      product_kind: 'standard',
    };

    const reading = await generateFinalReadingText(fakeItem, '', typeof cards === 'string' ? cards : JSON.stringify(cards, null, 2));

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
    };

    let autoReading = null;
    let recommended = null;

    if (product_kind === 'simple' || product_kind === 'standard') {
      const { recommendation, setup } = await generateRecommendationText(consultation);
      const drawResult = buildDrawResultFromSetup(setup);
      const finalReading = await generateFinalReadingText(consultation, recommendation, drawResult);

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

      consultation.status = 'reading_completed';
      consultation.reading_completed_at = new Date().toISOString();

      autoReading = finalReading;
      recommended = setup;
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
    const { question = '', productKind = 'standard' } = req.body || {};
    const setup = recommendReadingSetup(question, productKind);

    return res.status(200).json({
      ok: true,
      recommendation: {
        deck: setup.deck,
        count: setup.positions.length,
        aux: setup.auxTools,
      },
      setup,
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

app.post('/api/admin/consultations/:id/recommendation/generate', requireAdmin, async (req, res) => {
  try {
    const items = await readJsonArray(CONSULTATION_FILE);
    const idx = items.findIndex((x) => x.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ ok: false, error: '해당 접수를 찾지 못했어요.' });
    }

    const { recommendation } = await generateRecommendationText(items[idx]);
    items[idx].recommendation = recommendation;
    items[idx].updated_at = new Date().toISOString();

    await writeJsonArray(CONSULTATION_FILE, items);

    return res.status(200).json({ ok: true, recommendation });
  } catch (error) {
    console.error('recommendation generate error:', error);
    return res.status(500).json({ ok: false, error: '추천 생성에 실패했어요.' });
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

    const setup = recommendReadingSetup(items[idx].question || '', items[idx].product_kind || 'standard');
    const drawResult = buildDrawResultFromSetup(setup);

    items[idx].drawResult = drawResult;
    items[idx].updated_at = new Date().toISOString();
    await writeJsonArray(CONSULTATION_FILE, items);

    return res.status(200).json({ ok: true, drawResult });
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

// static pages
app.use(express.static(PUBLIC_DIR));

app.get('/', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'consultation.html'));
});

app.get('/admin', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
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

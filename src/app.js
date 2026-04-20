const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');
const OpenAI = require('openai');

const app = express();

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CONSULTATION_FILE = path.join(DATA_DIR, 'consultations.json');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(CONSULTATION_FILE);
  } catch {
    await fs.writeFile(CONSULTATION_FILE, '[]', 'utf8');
  }
}

async function readConsultations() {
  await ensureDataFile();
  const raw = await fs.readFile(CONSULTATION_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeConsultations(items) {
  await ensureDataFile();
  await fs.writeFile(CONSULTATION_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function makeConsultationId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const t = Date.now().toString().slice(-6);
  return `CONS-${y}${m}${d}-${t}`;
}

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!ADMIN_TOKEN) {
    return res.status(500).json({ ok: false, error: 'ADMIN_TOKEN이 설정되지 않았어요.' });
  }
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: '관리자 인증에 실패했어요.' });
  }
  next();
}

// 질문 분석 → 덱/스프레드 추천
function recommendReadingSetup(question, productKind) {
  const q = String(question || '').toLowerCase();

  const isLove =
    /연애|재회|속마음|관계|썸|전남친|전여친|남친|여친|좋아하|연락|호감|짝사랑/.test(q);
  const isCareer =
    /직장|이직|퇴사|합격|면접|커리어|회사|승진|업무|프로젝트|사업/.test(q);
  const isMoney =
    /금전|돈|재물|수입|매출|매매|투자|계약|정산/.test(q);
  const isDecision =
    /선택|어느 쪽|둘 중|결정|가야 할까|해야 할까|맞을까/.test(q);
  const isPersonality =
    /어떤 사람|성격|왜 이럴까|나를 어떻게|주변에서/.test(q);

  let deck = '하모니 타로';
  let spread = '핵심 흐름 스프레드';
  let positions = ['현재 상태', '흐름', '조언'];

  if (productKind === 'simple') {
    positions = ['현재 상태', '핵심 조언'];
    spread = '간단 방향 스프레드';
  }

  if (isLove) {
    deck = '너에게로 다이브';
    spread = productKind === 'simple' ? '연애 핵심 스프레드' : '관계 흐름 스프레드';
    positions =
      productKind === 'simple'
        ? ['상대 흐름', '조언']
        : ['현재 관계 상태', '상대 흐름', '조언'];
  } else if (isCareer) {
    deck = '세피로트 타로';
    spread = productKind === 'simple' ? '직장 방향 스프레드' : '현실 정리 스프레드';
    positions =
      productKind === 'simple'
        ? ['현재 흐름', '조언']
        : ['현재 업무 상태', '방해 요소', '조언'];
  } else if (isMoney) {
    deck = '리치 타로카드';
    spread = productKind === 'simple' ? '재물 핵심 스프레드' : '재물 흐름 스프레드';
    positions =
      productKind === 'simple'
        ? ['재물 흐름', '조언']
        : ['현재 재정 상태', '흐름', '조언'];
  } else if (isDecision) {
    deck = '나전의 빛 타로';
    spread = productKind === 'simple' ? '결정 포인트 스프레드' : '결정 정리 스프레드';
    positions =
      productKind === 'simple'
        ? ['핵심 포인트', '조언']
        : ['현재 조건', '선택의 포인트', '조언'];
  } else if (isPersonality) {
    deck = '로제딕 타로';
    spread = productKind === 'simple' ? '인상 포인트 스프레드' : '성향 분석 스프레드';
    positions =
      productKind === 'simple'
        ? ['겉으로 보이는 면', '핵심 조언']
        : ['겉으로 보이는 면', '내부 흐름', '조언'];
  }

  const auxTools = [];
  if (isLove) auxTools.push('하트 로맨틱 오라클');
  if (isDecision) auxTools.push('주역육효괘');
  if (isCareer || isMoney) auxTools.push('오간기');
  if (!auxTools.length && productKind !== 'simple') auxTools.push('오방기');

  return { deck, spread, positions, auxTools };
}

function formatCardStructure(setup) {
  const lines = [];
  lines.push(`**덱**: ${setup.deck}`);
  lines.push(`**스프레드**: ${setup.spread}`);
  lines.push('');
  lines.push('**포지션 구조**');
  setup.positions.forEach((position, idx) => {
    lines.push(`- 카드 ${idx + 1}: ${position}`);
  });
  if (setup.auxTools?.length) {
    lines.push(`**보조도구**: ${setup.auxTools.join(', ')}`);
  }
  return lines.join('\n');
}

// 레지나 스타일 실전 프롬프트
function buildReginaMessages({ question, productKind, setup }) {
  const compact = productKind === 'simple';

  const systemPrompt = `
당신은 레지나타로썰 스타일의 리딩 작성자입니다.

반드시 지킬 것:
- 내담자님이라고 부르기
- 한국어 존댓말(~요) 사용
- 카드 이름은 해석 본문에 직접 나열하지 말고, 감정과 흐름 위주로 풀기
- 위로만 하지 말고 정리와 결정에 초점을 두기
- 초보자도 이해할 수 있게 쉽게 풀기
- 공포 조장 금지
- 불필요한 면책 문구 금지
- 마무리에는 이어서 할 수 있는 질문 2개를 제안하기

리딩 분위기:
- 정제된 감정선
- 편안하지만 단정한 말투
- 현재 상태 → 흐름 → 조언 순서가 자연스럽게 드러나야 함

출력 규칙:
- 맨 처음에 아래 구조를 그대로 먼저 출력
${formatCardStructure(setup)}

- 그 다음 해석 본문 작성
- ${
    compact
      ? '해석 본문은 한 문단으로 정리하되 너무 짧지 않게 핵심을 밀도 있게 작성'
      : '해석 본문은 3~4문단 정도로 나누어 현재 상태, 흐름, 조언을 풍성하게 작성'
  }
`;

  const userPrompt = `
내담자님 질문:
${question}

추천 세팅:
- 덱: ${setup.deck}
- 스프레드: ${setup.spread}
- 포지션: ${setup.positions.join(', ')}
- 보조도구: ${setup.auxTools.length ? setup.auxTools.join(', ') : '없음'}

이 세팅이 질문에 잘 맞는 이유가 자연스럽게 드러나도록, 실제 상담 결과처럼 작성해주세요.
`;

  return [
    { role: 'system', content: systemPrompt.trim() },
    { role: 'user', content: userPrompt.trim() },
  ];
}

async function generateReading(question, productKind) {
  const setup = recommendReadingSetup(question, productKind);
  const messages = buildReginaMessages({ question, productKind, setup });

  // 공식 레퍼런스에 Chat Completions API가 계속 제공되어 있어,
  // 지금 구조에서는 기존 코드 변경 폭이 적은 방식으로 유지합니다. :contentReference[oaicite:1]{index=1}
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    temperature: 0.9,
    messages,
  });

  return {
    setup,
    text: completion.choices?.[0]?.message?.content?.trim() || '리딩 생성에 실패했어요.',
  };
}

app.get('/healthz', (_, res) => {
  res.status(200).json({ ok: true, status: 'healthy' });
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

    const items = await readConsultations();

    const consultation = {
      id: makeConsultationId(),
      name: name.trim(),
      contact: contact.trim(),
      question: question.trim(),
      product_name: product_name.trim(),
      product_price: Number(product_price || 0),
      product_kind: product_kind || '',
      payment_status,
      status: product_kind === 'booking'
        ? 'waiting_booking'
        : 'waiting_payment_check',
      created_at: new Date().toISOString()
    };

    let autoReading = null;
    let recommended = null;

    if (product_kind === 'simple' || product_kind === 'standard') {
      const result = await generateReading(question.trim(), product_kind);
      autoReading = result.text;
      recommended = result.setup;
      consultation.status = 'reading_completed';
      consultation.recommended_deck = result.setup.deck;
      consultation.recommended_spread = result.setup.spread;
      consultation.recommended_positions = result.setup.positions;
      consultation.recommended_aux_tools = result.setup.auxTools;
      consultation.reading_result = result.text;
      consultation.reading_completed_at = new Date().toISOString();
    }

    items.unshift(consultation);
    await writeConsultations(items);

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

// 관리자용 목록 조회
app.get('/api/admin/consultations', requireAdmin, async (_, res) => {
  try {
    const items = await readConsultations();
    return res.status(200).json({ ok: true, items });
  } catch (error) {
    console.error('GET /api/admin/consultations error:', error);
    return res.status(500).json({ ok: false, error: '접수 목록을 불러오지 못했어요.' });
  }
});

// 관리자용 상태 변경
app.patch('/api/admin/consultations/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status = '' } = req.body || {};

    const items = await readConsultations();
    const idx = items.findIndex(item => item.id === id);

    if (idx === -1) {
      return res.status(404).json({ ok: false, error: '해당 접수를 찾지 못했어요.' });
    }

    items[idx] = {
      ...items[idx],
      status: status || items[idx].status,
      updated_at: new Date().toISOString(),
    };

    await writeConsultations(items);

    return res.status(200).json({ ok: true, consultation: items[idx] });
  } catch (error) {
    console.error('PATCH /api/admin/consultations/:id error:', error);
    return res.status(500).json({ ok: false, error: '상태 변경 중 문제가 생겼어요.' });
  }
});

app.use(express.static(PUBLIC_DIR));

app.get('/', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'consultation.html'));
});

const PORT = process.env.PORT || 3000;

ensureDataFile()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Regina server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize data file:', error);
    process.exit(1);
  });

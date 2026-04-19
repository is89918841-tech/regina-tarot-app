const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');

const { ensureDir } = require('./utils/fileStore');
const env = require('./config/env');
const adminRoutes = require('./routes/adminRoutes');
const readingRoutes = require('./routes/readingRoutes');
const adminAuth = require('./middleware/adminAuth');

const app = express();
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PRIVATE_DIR = path.join(ROOT_DIR, 'private');

ensureDir(env.uploadRoot).catch((error) => {
  console.error('Failed to ensure upload directory:', error);
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || env.openaiApiKey,
});

const MODE_GUIDE = {
  short: '한 문단으로 짧고 핵심적으로 작성',
  standard: '여러 문단으로 상황, 감정, 현실 흐름을 균형 있게 작성',
  deep: '질문을 세부 포인트로 나눠 깊이 있게 여러 문단으로 답하고 마지막에 총평 작성',
};

function buildReadingPrompt({ question, mode = 'standard', cards = [], spread = '', extra = '' }) {
  const guide = MODE_GUIDE[mode] || MODE_GUIDE.standard;

  const cardsText = Array.isArray(cards) && cards.length
    ? cards.map((card, index) => {
        if (typeof card === 'string') {
          return `- 카드 ${index + 1}: ${card}`;
        }
        return `- 카드 ${index + 1}: ${card.name || card.card || '-'}${card.position ? ` / 포지션: ${card.position}` : ''}`;
      }).join('\n')
    : '- 카드 정보 없음';

  return `
당신은 "레지나타로썰" 스타일의 타로 리더입니다.

[말투 규칙]
- 내담자님이라고 불러주세요.
- 한국어 존댓말 "~요" 체
- 위로보다 정리 중심

[출력 규칙]
- ${guide}
- 마지막에 🔮 질문 2~3개 제안

[질문]
${question || '-'}

[카드]
${cardsText}

[스프레드]
${spread || '-'}

[추가 정보]
${extra || '-'}
  `.trim();
}

/* =========================
   Health
========================= */
app.get('/healthz', (_, res) => {
  res.json({ ok: true });
});

/* =========================
   API
========================= */
app.use('/api/reading', readingRoutes);
app.use('/api/admin', adminRoutes);

/* =========================
   Static
========================= */
app.use(express.static(PUBLIC_DIR));

app.get('/', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/consultation.html', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'consultation.html'));
});

app.get('/admin', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/admin2.html', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin2.html'));
});

/* =========================
   보조앱 / 그랑따블로
   일단 열리는지 확인용으로 인증 없이 열기
========================= */
app.get('/admin/helper', (_, res) => {
  res.sendFile(path.join(PRIVATE_DIR, 'admin-helper.html'));
});

app.get('/admin/grand-tableau', (_, res) => {
  res.sendFile(path.join(PRIVATE_DIR, 'admin-grand-tableau.html'));
});

/*
나중에 로그인 보호 다시 붙일 때는 아래처럼 바꾸면 됨:

app.get('/admin/helper', adminAuth, (_, res) => {
  res.sendFile(path.join(PRIVATE_DIR, 'admin-helper.html'));
});

app.get('/admin/grand-tableau', adminAuth, (_, res) => {
  res.sendFile(path.join(PRIVATE_DIR, 'admin-grand-tableau.html'));
});
*/

/* =========================
   직접 리딩 API
========================= */
app.post('/reading', async (req, res) => {
  try {
    const { question, mode, cards, spread, extra } = req.body || {};

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: buildReadingPrompt({ question, mode, cards, spread, extra }),
    });

    res.json({
      ok: true,
      reading: response.output_text || '',
    });
  } catch (e) {
    console.error('POST /reading error:', e);
    res.status(500).json({
      ok: false,
      error: e.message || 'reading failed',
    });
  }
});

/* =========================
   Error handler
========================= */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || 'Internal Server Error',
  });
});

module.exports = app;

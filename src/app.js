const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');

const { ensureDir } = require('./utils/fileStore');
const env = require('./config/env');
const adminRoutes = require('./routes/adminRoutes');
const readingRoutes = require('./routes/readingRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
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

반드시 아래 규칙을 지켜 답변하세요.

[말투 규칙]
- 내담자님이라고 불러주세요.
- 한국어 존댓말 "~요" 체로 작성하세요.
- 문장은 부드럽지만 흐름 판단은 분명하게 해주세요.
- 위로만 하지 말고 정리와 결정에 도움이 되도록 써주세요.
- 카드 이름을 해석문 안에 반복해서 길게 늘어놓지 말고, 의미를 자연스럽게 풀어주세요.

[출력 규칙]
- 줄글 중심으로 작성하세요.
- ${guide}
- 마지막에는 "🔮 이어서 볼 수 있는 질문" 2~3개를 제안하세요.
- 필요하면 현재 흐름 / 상대 흐름 / 조언 식으로 자연스럽게 나눠도 됩니다.

[질문]
${question || '질문 없음'}

[스프레드]
${spread || '미지정'}

[드로우 카드]
${cardsText}

[추가 정보]
${extra || '없음'}
  `.trim();
}

app.get('/healthz', (_, res) => {
  res.status(200).json({ ok: true, status: 'healthy' });
});

app.use('/api/reading', readingRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/admin', adminRoutes);

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

app.get(['/admin/helper', '/admin/helper.html'], adminAuth, (_, res) => {
  res.sendFile(path.join(PRIVATE_DIR, 'admin-helper.html'));
});

app.get(['/admin/grand-tableau', '/admin/grand-tableau.html'], adminAuth, (_, res) => {
  res.sendFile(path.join(PRIVATE_DIR, 'admin-grand-tableau.html'));
});

app.get(['/private/admin-helper.html', '/private/admin-grand-tableau.html'], (_req, res) => {
  res.redirect('/admin?auth=required');
});

app.post('/reading', async (req, res) => {
  try {
    const {
      question,
      mode = 'standard',
      cards = [],
      spread = '',
      extra = '',
    } = req.body || {};

    if (!question || !String(question).trim()) {
      return res.status(400).json({
        ok: false,
        error: 'question is required',
      });
    }

    if (!process.env.OPENAI_API_KEY && !env.openaiApiKey) {
      return res.status(500).json({
        ok: false,
        error: 'OPENAI_API_KEY is missing',
      });
    }

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || env.model || 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: '당신은 레지나타로썰 스타일의 구조화된 타로 리딩 작성자입니다.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: buildReadingPrompt({
                question: String(question).trim(),
                mode,
                cards,
                spread,
                extra,
              }),
            },
          ],
        },
      ],
    });

    return res.json({
      ok: true,
      reading: (response.output_text || '').trim(),
      meta: {
        model: process.env.OPENAI_MODEL || env.model || 'gpt-4.1-mini',
        mode,
      },
    });
  } catch (error) {
    console.error('POST /reading failed:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'reading generation failed',
    });
  }
});

app.use((error, _req, res, _next) => {
  res.status(error.status || 500).json({
    ok: false,
    error: error.message || 'Internal server error',
  });
});

module.exports = app;

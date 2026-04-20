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
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeConsultations(items) {
  await ensureDataFile();
  await fs.writeFile(CONSULTATION_FILE, JSON.stringify(items, null, 2));
}

function makeConsultationId() {
  const t = Date.now().toString().slice(-6);
  return `CONS-${t}`;
}

// 🔥 리딩 생성 함수
async function generateReading(question, mode) {
  const prompt = `
내담자님의 질문:
"${question}"

레지나 스타일로 타로 리딩을 작성하세요.

조건:
- 존댓말 (~요)
- 감정 + 현실 흐름 같이 설명
- 불필요한 위로 금지
- 판단과 방향 제시 중심

${mode === 'simple'
  ? '한 문단으로 핵심만 정리'
  : '여러 문단으로 흐름과 조언 상세히 작성'}
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
  });

  return completion.choices[0].message.content;
}

app.post('/api/consultations', async (req, res) => {
  try {
    const {
      name = '',
      contact = '',
      question = '',
      product_name = '',
      product_price = 0,
      product_kind = ''
    } = req.body || {};

    if (!name.trim()) return res.status(400).json({ ok: false, error: '성함 입력' });
    if (!contact.trim()) return res.status(400).json({ ok: false, error: '연락처 입력' });
    if (!question.trim()) return res.status(400).json({ ok: false, error: '질문 입력' });

    const consultation = {
      id: makeConsultationId(),
      name,
      contact,
      question,
      product_name,
      product_price,
      product_kind,
      created_at: new Date().toISOString()
    };

    const items = await readConsultations();
    items.unshift(consultation);
    await writeConsultations(items);

    let autoReading = null;

    // 🔥 핵심: 자동 리딩
    if (product_kind === 'simple' || product_kind === 'standard') {
      autoReading = await generateReading(question, product_kind);
    }

    return res.json({
      ok: true,
      consultation,
      autoReading
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: '리딩 생성 실패' });
  }
});

app.use(express.static(PUBLIC_DIR));

app.get('/', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'consultation.html'));
});

const PORT = process.env.PORT || 3000;

ensureDataFile().then(() => {
  app.listen(PORT, () => {
    console.log('Server running:', PORT);
  });
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');

const app = express();

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CONSULTATION_FILE = path.join(DATA_DIR, 'consultations.json');

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
      return res.status(400).json({ ok: false, error: '성함 / 닉네임이 비어 있어요.' });
    }
    if (!contact.trim()) {
      return res.status(400).json({ ok: false, error: '연락처가 비어 있어요.' });
    }
    if (!/^010-\d{4}-\d{4}$/.test(contact.trim())) {
      return res.status(400).json({ ok: false, error: '연락처 형식이 올바르지 않아요.' });
    }
    if (!question.trim()) {
      return res.status(400).json({ ok: false, error: '질문 내용이 비어 있어요.' });
    }
    if (!product_name.trim()) {
      return res.status(400).json({ ok: false, error: '상품명이 비어 있어요.' });
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
      status: product_kind === 'booking' ? 'waiting_booking' : 'waiting_payment_check',
      created_at: new Date().toISOString()
    };

    items.unshift(consultation);
    await writeConsultations(items);

    return res.status(201).json({
      ok: true,
      consultation
    });
  } catch (error) {
    console.error('POST /api/consultations error:', error);
    return res.status(500).json({
      ok: false,
      error: '서버에서 접수를 저장하는 중 문제가 생겼어요.'
    });
  }
});

app.get('/api/consultations', async (_, res) => {
  try {
    const items = await readConsultations();
    return res.status(200).json({ ok: true, items });
  } catch (error) {
    console.error('GET /api/consultations error:', error);
    return res.status(500).json({ ok: false, error: '접수 목록을 불러오지 못했어요.' });
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
      console.log(`Regina server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize data file:', error);
    process.exit(1);
  });

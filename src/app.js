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

// 데이터 파일 생성
async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(CONSULTATION_FILE);
  } catch {
    await fs.writeFile(CONSULTATION_FILE, '[]', 'utf8');
  }
}

// 데이터 읽기
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

// 데이터 저장
async function writeConsultations(items) {
  await ensureDataFile();
  await fs.writeFile(CONSULTATION_FILE, JSON.stringify(items, null, 2), 'utf8');
}

// 접수번호 생성
function makeConsultationId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const t = Date.now().toString().slice(-6);
  return `CONS-${y}${m}${d}-${t}`;
}

// 상태 확인
app.get('/healthz', (_, res) => {
  res.status(200).json({ ok: true, status: 'healthy' });
});

// 🔥 핵심: 상담 접수
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

    // 유효성 체크
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

    // 접수 데이터 생성
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

    // 🔥 자동 리딩 분기
    let autoReading = null;

    if (product_kind === 'simple' || product_kind === 'standard') {
      autoReading = '리딩이 생성중입니다. 잠시 후 결과가 전달됩니다.';
    }

    items.unshift(consultation);
    await writeConsultations(items);

    // 응답
    return res.status(201).json({
      ok: true,
      consultation,
      autoReading
    });

  } catch (error) {
    console.error('ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: '서버 오류가 발생했습니다.'
    });
  }
});

// 목록 조회 (관리자용)
app.get('/api/consultations', async (_, res) => {
  try {
    const items = await readConsultations();
    return res.json({ ok: true, items });
  } catch (error) {
    return res.status(500).json({ ok: false });
  }
});

// 정적 파일
app.use(express.static(PUBLIC_DIR));

// 메인 페이지
app.get('/', (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'consultation.html'));
});

// 서버 실행
const PORT = process.env.PORT || 3000;

ensureDataFile().then(() => {
  app.listen(PORT, () => {
    console.log('Regina server running on port ' + PORT);
  });
});

const crypto = require('crypto');
const env = require('../config/env');
const { readJson, writeJson } = require('../utils/fileStore');
const { generateReading } = require('./readingService');

function generateId() {
  return `cst_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function normalizePrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toProductType(price) {
  return price === 3000 ? 'auto' : 'reserve';
}

const WORKFLOW_STATUSES = new Set(['submitted', 'paid', 'recommended', 'drawn', 'finalized', 'sent']);

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDailySlots(date) {
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  if (!isWeekend) return ['20:00', '21:00', '22:00'];

  const out = [];
  for (let hour = 10; hour <= 22; hour += 1) {
    out.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return out;
}

function calculateReservationSlots(days = 14, now = new Date()) {
  const slots = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dateText = formatDate(d);
    for (const time of buildDailySlots(d)) {
      slots.push(`${dateText} ${time}`);
    }
  }
  return slots;
}

async function listConsultations() {
  const records = await readJson(env.consultationStorePath, []);
  return Array.isArray(records) ? records : [];
}

async function saveConsultations(records) {
  await writeJson(env.consultationStorePath, records);
}

async function findConsultationById(id) {
  const records = await listConsultations();
  const index = records.findIndex((item) => item.id === id);
  if (index < 0) return { records, index: -1, consultation: null };
  return { records, index, consultation: records[index] };
}

async function createConsultation(payload) {
  const records = await listConsultations();
  const price = normalizePrice(payload.price);
  const productType = toProductType(price);

  const item = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    status: 'submitted',
    menuId: payload.menuId,
    menuTitle: payload.menuTitle,
    price,
    productType,
    paymentConfirmed: false,
    paymentStatus: 'unpaid',
    reservationSlots: [],
    reservationNote: null,
    reading: null,
    recommendation: null,
    drawResult: null,
    finalReading: '',
    kakaoDraft: '',
    name: payload.name,
    contactChannel: payload.contactChannel,
    question: payload.question,
    memo: payload.memo || '',
    serviceType: payload.serviceType || 'consultation',
  };

  records.unshift(item);
  await saveConsultations(records);
  return item;
}

async function confirmPayment(id) {
  const { records, index, consultation } = await findConsultationById(id);
  if (!consultation) return null;

  consultation.paymentConfirmed = true;
  consultation.paymentStatus = 'paid';
  consultation.status = 'paid';
  consultation.reservationSlots = consultation.productType === 'reserve' ? calculateReservationSlots(14) : [];

  records[index] = consultation;
  await saveConsultations(records);
  return consultation;
}

async function runAutoReading(id) {
  const { records, index, consultation } = await findConsultationById(id);
  if (!consultation) return { error: 'not_found' };
  if (consultation.productType !== 'auto') return { error: 'not_auto_product' };
  if (consultation.status !== 'paid') return { error: 'invalid_status' };

  const result = await generateReading({
    question: consultation.question,
    spread: ['현재 상황', '핵심 흐름', '조언'],
    deck: consultation.menuTitle || '레지나 자동 리딩',
    topic: consultation.menuTitle || '자동 리딩',
  });

  consultation.reading = result.reading;
  consultation.status = 'finalized';
  consultation.finalReading = result.reading;

  records[index] = consultation;
  await saveConsultations(records);
  return { consultation, result };
}

async function getReservationSlots(id) {
  const { consultation } = await findConsultationById(id);
  if (!consultation) return { error: 'not_found' };
  if (consultation.productType !== 'reserve') return { error: 'not_reserve_product' };

  const slots = calculateReservationSlots(14);
  return { consultation, slots };
}

async function scheduleReservation(id, selectedDate, selectedTime) {
  const { records, index, consultation } = await findConsultationById(id);
  if (!consultation) return { error: 'not_found' };
  if (consultation.productType !== 'reserve') return { error: 'not_reserve_product' };
  if (consultation.status !== 'paid') return { error: 'invalid_status' };

  const selected = `${selectedDate} ${selectedTime}`;
  const availableSlots = calculateReservationSlots(14);
  if (!availableSlots.includes(selected)) return { error: 'invalid_slot' };

  consultation.reservationNote = selected;
  consultation.status = 'paid';
  consultation.reservationSlots = availableSlots;

  records[index] = consultation;
  await saveConsultations(records);
  return { consultation };
}

function normalizeStringArray(input) {
  if (Array.isArray(input)) {
    return input
      .map((value) => (value == null ? '' : String(value).trim()))
      .filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

function sanitizeRecommendation(input) {
  if (!input || typeof input !== 'object') return null;
  const cardCount = Number.parseInt(input.cardCount, 10);
  return {
    deck: input.deck ? String(input.deck).trim() : '',
    spreadName: input.spreadName ? String(input.spreadName).trim() : '',
    cardCount: Number.isFinite(cardCount) && cardCount > 0 ? cardCount : 3,
    spreadPositions: normalizeStringArray(input.spreadPositions),
    supportTools: normalizeStringArray(input.supportTools),
    reason: input.reason ? String(input.reason).trim() : '',
  };
}

function sanitizeDrawResult(input) {
  if (!input || typeof input !== 'object') return null;
  return {
    tarotDeck: input.tarotDeck ? String(input.tarotDeck).trim() : '',
    cardCount: Number.isFinite(Number(input.cardCount)) ? Number(input.cardCount) : 0,
    tarot: Array.isArray(input.tarot) ? input.tarot : [],
    runes: Array.isArray(input.runes) ? input.runes : [],
    lenormand: Array.isArray(input.lenormand) ? input.lenormand : [],
    iching: Array.isArray(input.iching) ? input.iching : [],
    oracles: Array.isArray(input.oracles) ? input.oracles : [],
    aux: Array.isArray(input.aux) ? input.aux : [],
    locked: Boolean(input.locked),
  };
}

async function updateConsultationById(id, updates = {}) {
  const { records, index, consultation } = await findConsultationById(id);
  if (!consultation) return null;

  if (Object.prototype.hasOwnProperty.call(updates, 'paymentStatus')) {
    consultation.paymentStatus = updates.paymentStatus === 'paid' ? 'paid' : 'unpaid';
    consultation.paymentConfirmed = consultation.paymentStatus === 'paid';
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    if (!WORKFLOW_STATUSES.has(updates.status)) {
      const error = new Error('Invalid status');
      error.status = 400;
      throw error;
    }
    consultation.status = updates.status;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'recommendation')) {
    consultation.recommendation = sanitizeRecommendation(updates.recommendation);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'drawResult')) {
    consultation.drawResult = sanitizeDrawResult(updates.drawResult);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'finalReading')) {
    consultation.finalReading = updates.finalReading ? String(updates.finalReading) : '';
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'kakaoDraft')) {
    consultation.kakaoDraft = updates.kakaoDraft ? String(updates.kakaoDraft) : '';
  }

  consultation.updatedAt = new Date().toISOString();
  records[index] = consultation;
  await saveConsultations(records);
  return consultation;
}

module.exports = {
  listConsultations,
  createConsultation,
  confirmPayment,
  runAutoReading,
  getReservationSlots,
  scheduleReservation,
  calculateReservationSlots,
  updateConsultationById,
};

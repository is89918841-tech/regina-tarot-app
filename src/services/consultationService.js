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
    status: 'pending',
    menuId: payload.menuId,
    menuTitle: payload.menuTitle,
    price,
    productType,
    paymentConfirmed: false,
    reservationSlots: [],
    reservationNote: null,
    reading: null,
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
  if (consultation.productType === 'auto') {
    consultation.status = 'paid_auto_ready';
    consultation.reservationSlots = [];
  } else {
    consultation.status = 'paid_reservation_waiting';
    consultation.reservationSlots = calculateReservationSlots(14);
  }

  records[index] = consultation;
  await saveConsultations(records);
  return consultation;
}

async function runAutoReading(id) {
  const { records, index, consultation } = await findConsultationById(id);
  if (!consultation) return { error: 'not_found' };
  if (consultation.productType !== 'auto') return { error: 'not_auto_product' };
  if (consultation.status !== 'paid_auto_ready') return { error: 'invalid_status' };

  const result = await generateReading({
    question: consultation.question,
    spread: ['현재 상황', '핵심 흐름', '조언'],
    deck: consultation.menuTitle || '레지나 자동 리딩',
    topic: consultation.menuTitle || '자동 리딩',
  });

  consultation.reading = result.reading;
  consultation.status = 'completed';

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
  if (consultation.status !== 'paid_reservation_waiting') return { error: 'invalid_status' };

  const selected = `${selectedDate} ${selectedTime}`;
  const availableSlots = calculateReservationSlots(14);
  if (!availableSlots.includes(selected)) return { error: 'invalid_slot' };

  consultation.reservationNote = selected;
  consultation.status = 'reservation_scheduled';
  consultation.reservationSlots = availableSlots;

  records[index] = consultation;
  await saveConsultations(records);
  return { consultation };
}

module.exports = {
  listConsultations,
  createConsultation,
  confirmPayment,
  runAutoReading,
  getReservationSlots,
  scheduleReservation,
  calculateReservationSlots,
};

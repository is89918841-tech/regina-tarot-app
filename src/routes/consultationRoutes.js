const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const {
  createConsultation,
  confirmPayment,
  runAutoReading,
  getReservationSlots,
  scheduleReservation,
} = require('../services/consultationService');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { menuId, menuTitle, price, name, contactChannel, question, memo, serviceType } = req.body || {};

    if (!menuId || typeof menuId !== 'string') {
      return res.status(400).json({ ok: false, error: 'menuId is required string' });
    }
    if (!menuTitle || typeof menuTitle !== 'string') {
      return res.status(400).json({ ok: false, error: 'menuTitle is required string' });
    }
    if (!Number.isFinite(Number(price))) {
      return res.status(400).json({ ok: false, error: 'price is required number' });
    }
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, error: 'name is required string' });
    }
    if (!contactChannel || typeof contactChannel !== 'string') {
      return res.status(400).json({ ok: false, error: 'contactChannel is required string' });
    }
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ ok: false, error: 'question is required string' });
    }

    const created = await createConsultation({ menuId, menuTitle, price, name, contactChannel, question, memo, serviceType });
    return res.status(201).json({
      ok: true,
      consultation: {
        id: created.id,
        createdAt: created.createdAt,
        status: created.status,
        productType: created.productType,
      },
      message: '접수 완료 후 확인 순서대로 채팅으로 안내드립니다.',
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/confirm-payment', adminAuth, async (req, res, next) => {
  try {
    const updated = await confirmPayment(req.params.id);
    if (!updated) return res.status(404).json({ ok: false, error: 'Consultation not found' });
    return res.json({ ok: true, consultation: updated });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/run-auto-reading', adminAuth, async (req, res, next) => {
  try {
    const out = await runAutoReading(req.params.id);
    if (out.error === 'not_found') return res.status(404).json({ ok: false, error: 'Consultation not found' });
    if (out.error === 'not_auto_product') return res.status(400).json({ ok: false, error: 'Not an auto product' });
    if (out.error === 'invalid_status') return res.status(400).json({ ok: false, error: 'Invalid consultation status' });
    return res.json({ ok: true, consultation: out.consultation, reading: out.result.reading });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/reservation-slots', async (req, res, next) => {
  try {
    const out = await getReservationSlots(req.params.id);
    if (out.error === 'not_found') return res.status(404).json({ ok: false, error: 'Consultation not found' });
    if (out.error === 'not_reserve_product') return res.status(400).json({ ok: false, error: 'Not a reserve product' });
    return res.json({ ok: true, slots: out.slots });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/schedule-reservation', adminAuth, async (req, res, next) => {
  try {
    const { selectedDate, selectedTime } = req.body || {};
    if (!selectedDate || !selectedTime) {
      return res.status(400).json({ ok: false, error: 'selectedDate and selectedTime are required' });
    }

    const out = await scheduleReservation(req.params.id, selectedDate, selectedTime);
    if (out.error === 'not_found') return res.status(404).json({ ok: false, error: 'Consultation not found' });
    if (out.error === 'not_reserve_product') return res.status(400).json({ ok: false, error: 'Not a reserve product' });
    if (out.error === 'invalid_status') return res.status(400).json({ ok: false, error: 'Invalid consultation status' });
    if (out.error === 'invalid_slot') return res.status(400).json({ ok: false, error: 'Invalid reservation slot' });
    return res.json({ ok: true, consultation: out.consultation });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

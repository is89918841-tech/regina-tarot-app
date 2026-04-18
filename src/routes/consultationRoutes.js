const express = require('express');
const { createConsultation } = require('../services/consultationService');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { menuId, menuTitle, name, contactChannel, question } = req.body || {};

    if (!menuId || typeof menuId !== 'string') {
      return res.status(400).json({ ok: false, error: 'menuId is required string' });
    }
    if (!menuTitle || typeof menuTitle !== 'string') {
      return res.status(400).json({ ok: false, error: 'menuTitle is required string' });
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

    const created = await createConsultation({ menuId, menuTitle, name, contactChannel, question });
    return res.status(201).json({
      ok: true,
      consultation: {
        id: created.id,
        createdAt: created.createdAt,
        status: created.status,
      },
      message: '접수 완료 후 확인 순서대로 채팅으로 안내드립니다.',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

const express = require('express');
const { generateReading } = require('../services/readingService');

const router = express.Router();

router.post('/generate', async (req, res, next) => {
  try {
    const { question, spread, deck, topic } = req.body || {};

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ ok: false, error: 'question is required string' });
    }
    if (!Array.isArray(spread) || spread.length === 0) {
      return res.status(400).json({ ok: false, error: 'spread is required array' });
    }
    if (!deck || typeof deck !== 'string') {
      return res.status(400).json({ ok: false, error: 'deck is required string' });
    }

    const result = await generateReading({ question, spread, deck, topic });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

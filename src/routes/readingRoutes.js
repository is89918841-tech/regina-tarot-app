const express = require('express');
const router = express.Router();
const { generateReading } = require('../services/readingService');

router.post('/', async (req, res) => {
  try {
    const {
      question = '',
      cards = [],
      deck = '',
      spread = '',
      topic = '',
    } = req.body || {};

    if (!String(question).trim()) {
      return res.status(400).json({
        ok: false,
        error: 'question is required',
      });
    }

    const normalizedCards = Array.isArray(cards)
      ? cards
      : typeof cards === 'string' && cards.trim()
        ? [cards.trim()]
        : [];

    const result = await generateReading({
      question: String(question).trim(),
      spread: String(spread || '').trim(),
      deck: String(deck || '').trim(),
      topic: String(topic || '').trim(),
      cards: normalizedCards,
    });

    return res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error('POST /api/reading error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'failed to generate reading',
    });
  }
});

module.exports = router;

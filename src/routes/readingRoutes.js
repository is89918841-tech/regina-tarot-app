const express = require('express');
const router = express.Router();
const { generateReading } = require('../services/readingService');

router.post('/', async (req, res) => {
  try {
    const { question, cards, deck, spread } = req.body;

    const result = await generateReading({
      question,
      spread,
      deck,
      cards
    });

    res.json({
      ok: true,
      ...result
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const { generateReadingPlan } = require('../services/readingService');

const router = express.Router();

router.post('/plan', async (req, res) => {
  try {
    const { question } = req.body || {};

    if (!question || !String(question).trim()) {
      return res.status(400).json({
        ok: false,
        error: 'question is required',
      });
    }

    const plan = await generateReadingPlan({
      question: String(question).trim(),
    });

    return res.json({
      ok: true,
      plan,
    });
  } catch (error) {
    console.error('recommendRoutes /plan error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'failed to generate reading plan',
    });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();

function drawTarot(count) {
  const cards = [];
  for (let i = 1; i <= 78; i++) cards.push(i);

  return cards.sort(() => Math.random() - 0.5).slice(0, count);
}

router.post('/', (req, res) => {
  const { count = 3, extras = [] } = req.body;

  const tarot = drawTarot(count);

  res.json({
    ok: true,
    result: {
      tarot,
      extras,
    }
  });
});

module.exports = router;

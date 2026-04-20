const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post('/', async (req, res) => {
  try {
    const { question } = req.body;

    const prompt = `
질문을 분석해서 아래 JSON만 출력해:

{
  "deck": "타로 덱 이름",
  "spread": "스프레드 이름",
  "count": 숫자,
  "extras": ["오간기", "오방기"]
}

질문:
${question}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    const text = completion.choices[0].message.content;

    const json = JSON.parse(text);

    res.json({ ok: true, config: json });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;

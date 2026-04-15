const OpenAI = require('openai');
const env = require('../config/env');
const { retrieveKnowledge } = require('./knowledgeService');
const {
  buildSystemPrompt,
  buildUserPrompt,
  fallbackReading,
  normalizeReading,
} = require('./reginaPromptBuilder');

const openai = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;

function detectIntent(question = '') {
  const q = question.toLowerCase();
  if (q.includes('연애') || q.includes('사랑')) return '연애';
  if (q.includes('이직') || q.includes('취업') || q.includes('커리어')) return '이직';
  if (q.includes('돈') || q.includes('재물') || q.includes('금전')) return '재물';
  if (q.includes('건강')) return '건강';
  if (q.includes('언제') || q.includes('시기')) return '시기';
  if (q.includes('장소') || q.includes('어디')) return '장소';
  return '일반';
}

async function generateReading({ question, spread, deck, topic }) {
  const intent = detectIntent(question);
  const knowledge = await retrieveKnowledge({
    question,
    deck,
    topic,
    intent: topic || intent,
  });

  if (!openai) {
    return {
      intent,
      knowledge,
      reading: normalizeReading(fallbackReading()),
    };
  }

  const completion = await openai.chat.completions.create({
    model: env.model,
    temperature: 0.65,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: buildUserPrompt({
          question,
          spread,
          deck,
          topic,
          intent,
          knowledge,
        }),
      },
    ],
  });

  const rawReading = completion.choices?.[0]?.message?.content?.trim() || '';

  return {
    intent,
    knowledge,
    reading: normalizeReading(rawReading),
  };
}

module.exports = { generateReading };

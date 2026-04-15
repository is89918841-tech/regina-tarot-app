const OpenAI = require('openai');
const env = require('../config/env');
const { retrieveKnowledge } = require('./knowledgeService');

const openai = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;

function detectIntent(question = '') {
  const q = question.toLowerCase();
  if (q.includes('연애') || q.includes('사랑')) return '연애';
  if (q.includes('이직') || q.includes('취업') || q.includes('커리어')) return '이직/커리어';
  if (q.includes('돈') || q.includes('재물') || q.includes('금전')) return '재물';
  if (q.includes('건강')) return '건강';
  if (q.includes('언제') || q.includes('시기')) return '시기';
  return '일반';
}

function buildSystemPrompt() {
  return [
    '당신은 Regina Divination Platform의 리딩 엔진입니다.',
    '반드시 내담자님 호칭을 쓰고, 공손한 한국어(~요)로 작성하세요.',
    '카드 이름은 꼭 필요할 때만 최소한으로 언급하세요.',
    '리딩은 반드시 구조화하세요: 상황 설명, 감정/에너지 흐름, 해석, 조언.',
    '마지막에는 후속 질문 2~3개를 제시하세요.',
    '원문 모델 출력처럼 보이지 않도록 자연스럽게 정리해서 출력하세요.',
  ].join(' ');
}

function buildUserPrompt({ question, spread, deck, topic, intent, knowledge }) {
  const spreadText = spread.map((card, i) => `${i + 1}. ${card}`).join('\n');
  const snippets = knowledge
    .map((k, i) => `- [${i + 1}] ${k.source}: ${k.excerpt}`)
    .join('\n');

  return [
    `질문: ${question}`,
    `덱: ${deck}`,
    `주제: ${topic || intent}`,
    `의도 분석: ${intent}`,
    `스프레드:\n${spreadText}`,
    `검색된 지식(우선순위 반영):\n${snippets || '- 없음'}`,
    '위 정보만 활용해 Regina 스타일로 리딩을 생성하세요.',
  ].join('\n\n');
}

async function generateReading({ question, spread, deck, topic }) {
  const intent = detectIntent(question);
  const knowledge = await retrieveKnowledge({ deck, topic: topic || intent });

  if (!openai) {
    return {
      intent,
      knowledge,
      reading: [
        '내담자님, 현재 질문의 흐름에서는 마음이 먼저 앞서고 현실 점검이 뒤따르는 모습이 보여요.',
        '감정적으로는 기대와 불안이 같이 움직이고 있어 선택의 타이밍을 신중하게 잡는 것이 중요해요.',
        '해석상으로는 지금 당장 결론을 내리기보다 기준을 정리하고 작은 행동부터 실행하는 쪽이 유리해요.',
        '조언으로는 1) 우선순위 3가지를 적기, 2) 이번 주 행동 1개 확정하기, 3) 주변 조언은 참고만 하고 최종 결정은 스스로 내리기예요.',
        '후속 질문: ① 지금 가장 큰 장애물은 무엇인가요? ② 다음 2주 안에 확인할 신호는 무엇인가요? ③ 제가 놓치고 있는 선택지는 무엇인가요?',
      ].join('\n\n'),
    };
  }

  const completion = await openai.chat.completions.create({
    model: env.model,
    temperature: 0.7,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: buildUserPrompt({ question, spread, deck, topic, intent, knowledge }),
      },
    ],
  });

  return {
    intent,
    knowledge,
    reading: completion.choices?.[0]?.message?.content?.trim() || '',
  };
}

module.exports = { generateReading };

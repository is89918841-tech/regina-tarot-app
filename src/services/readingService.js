const OpenAI = require('openai');
const env = require('../config/env');
const { retrieveKnowledge } = require('./knowledgeService');

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

function buildSystemPrompt() {
  return [
    '당신은 Regina Divination Platform의 구조화된 타로 리딩 엔진입니다.',
    '반드시 내담자님 호칭을 사용하세요.',
    '항상 정중한 한국어(~요) 문체를 유지하세요.',
    '아래 4개 섹션 제목을 반드시 포함하세요: [상황], [감정/에너지 흐름], [해석], [조언].',
    '카드 이름은 필요한 경우에만 최소한으로 언급하고, 나열하지 마세요.',
    '막연한 공포 조장, 단정적 예언, 운명 확정 표현은 금지하세요.',
    '조언은 실행 가능한 2~4개 행동으로 제시하세요.',
    '마무리에는 "후속 질문" 제목으로 2~3개 질문을 제시하세요.',
    '출력은 사람이 바로 읽는 상담문 형태여야 하며, 모델 내부 사고를 노출하지 마세요.',
  ].join(' ');
}

function buildUserPrompt({ question, spread, deck, topic, intent, knowledge }) {
  const spreadText = spread.map((card, i) => `${i + 1}. ${card}`).join('\n');
  const snippets = knowledge
    .map((k, i) => `- [${i + 1}] 출처:${k.source} / 내용:${k.excerpt}`)
    .join('\n');

  return [
    `질문: ${question}`,
    `덱: ${deck}`,
    `요청 토픽: ${topic || '(미지정)'}`,
    `추정 의도: ${intent}`,
    `스프레드:\n${spreadText}`,
    `검색 지식:\n${snippets || '- 없음'}`,
    '요구사항: Regina 스타일로 감정과 현실을 균형 있게 연결한 리딩을 작성하세요.',
  ].join('\n\n');
}

function fallbackReading() {
  return [
    '[상황] 내담자님, 지금은 기대와 불안이 동시에 움직이며 선택 기준이 흔들리기 쉬운 국면이에요.',
    '[감정/에너지 흐름] 초반에는 감정이 앞서지만, 중반부터는 현실 점검이 강화되며 방향이 점차 선명해져요.',
    '[해석] 성급히 결론을 내리기보다 우선순위를 재정렬할수록 결과의 안정성이 높아져요.',
    '[조언] 1) 이번 주 핵심 목표 1개를 고르세요. 2) 목표를 방해하는 요소 1개를 제거하세요. 3) 진행 상황을 3일 단위로 점검하세요.',
    '[후속 질문] ① 지금 가장 큰 불확실성은 무엇인가요? ② 다음 2주 안에 확인할 신호는 무엇인가요? ③ 제가 놓치고 있는 대안은 무엇인가요?',
  ].join('\n\n');
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
      reading: fallbackReading(),
    };
  }

  const completion = await openai.chat.completions.create({
    model: env.model,
    temperature: 0.65,
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
    reading: completion.choices?.[0]?.message?.content?.trim() || fallbackReading(),
  };
}

module.exports = { generateReading };

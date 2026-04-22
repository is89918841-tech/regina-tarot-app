const OpenAI = require('openai');
const env = require('../config/env');
const { retrieveKnowledge } = require('./knowledgeService');
const {
  buildSystemPrompt,
  buildUserPrompt,
  fallbackReading,
} = require('./reginaPromptBuilder');

const openai = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;

function detectIntent(question = '') {
  const q = String(question).toLowerCase();

  if (
    q.includes('연애') ||
    q.includes('사랑') ||
    q.includes('재회') ||
    q.includes('썸') ||
    q.includes('속마음') ||
    q.includes('마음') ||
    q.includes('관계')
  ) {
    return '연애';
  }

  if (
    q.includes('이직') ||
    q.includes('취업') ||
    q.includes('커리어') ||
    q.includes('직업') ||
    q.includes('회사') ||
    q.includes('일')
  ) {
    return '이직';
  }

  if (
    q.includes('돈') ||
    q.includes('재물') ||
    q.includes('금전') ||
    q.includes('재정') ||
    q.includes('수입') ||
    q.includes('투자')
  ) {
    return '재물';
  }

  if (q.includes('건강') || q.includes('몸') || q.includes('병원')) {
    return '건강';
  }

  if (q.includes('언제') || q.includes('시기') || q.includes('타이밍')) {
    return '시기';
  }

  if (q.includes('장소') || q.includes('어디') || q.includes('방향')) {
    return '장소';
  }

  if (
    q.includes('결정') ||
    q.includes('선택') ||
    q.includes('해야 할까') ||
    q.includes('해도 될까') ||
    q.includes('말아야') ||
    q.includes('괜찮을까')
  ) {
    return '결정';
  }

  return '일반';
}

function getPlannerPrompt() {
  return `
당신은 레지나타로썰의 리딩 설계자입니다.

당신의 역할은 사용자의 질문을 읽고
가장 적절한 덱, 스프레드, 장수, 보조도구를 설계하는 것입니다.

중요:
- 절대 최종 리딩 해석문을 쓰지 마세요.
- 반드시 JSON만 출력하세요.
- 카드 해석, 조언 문장, 인삿말을 쓰지 마세요.
- 질문의 핵심이 하나면 과도하게 많은 도구를 붙이지 마세요.
- 질문이 단순하면 3장 이하, 복합적이면 5~9장까지 고려할 수 있습니다.
- 연애 질문에는 "너에게 다이브", "로맨틱 타로", "로제딕 타로"를 우선 고려하세요.
- 선택/결정 질문에는 "세피로트 타로", "로제딕 타로", "하모니 타로"를 우선 고려하세요.
- 감정 확인, 속마음, 관계 반응은 연애 특화 덱을 우선 고려하세요.
- 방향성, 결단, 시기, 타이밍이 중요하면 주역육효괘, 오간기, 오방기, 아이칭 카드 계열을 고려하세요.
- 깊은 내면, 상처, 감정 해소, 숨겨진 분위기는 귀문방, 오라클 보조를 고려할 수 있습니다.
- 너무 많은 보조도구를 동시에 붙이지 마세요.

사용 가능한 타로 덱:
- 나전의 빛 타로
- 로제딕 타로
- 하모니 타로
- 화이트 세이지 타로
- 하모니어스 타로카드
- 드리밍 캣 타로
- 스테인드글라스 타로
- 고래의 꿈 타로 (유니버셜 기반)
- 무하 타로
- 세피로트 타로
- 밤의 별빛 타로
- Spheres of Heaven Tarot
- 디바인 셀레스티얼 타로
- 로맨틱 타로
- Legacy of the Divine Tarot
- Everyday Witch Tarot
- Tattoo Tarot: Ink & Intuition
- Luna Somnia Tarot
- Holographic Universal Tarot
- 인어공주 타로카드
- 라스트 유니콘 타로
- 원더링 스피릿 타로
- 더 차일드 오브 리타 타로
- 라이드 비전스 타로
- 판타스티컬 타로
- 유니버셜 타로
- 더 뱀파이어 타로
- 바나 일러스트 한국풍 타로
- 텀블벅 앤티크 타로
- 망가 타로
- 섀도스케이프 타로
- 일본 신화 타로
- 한국을 담은 환상 타로카드
- 너에게로 다이브
- 운명의 앨리스 타로카드
- 리치 타로카드

사용 가능한 오라클 덱:
- 스타시드 오라클
- 힐링 워터 오라클
- 세이크리드 크리에이터즈 오라클
- 보이스 오브 더 소울스 오라클
- 샤먼 위즈덤 오라클 카드
- 더 엔젤 가이드 오라클
- BUDDHA WISDOM SHAKTI POWER Oracle
- 엔젤릭 라이트워크 힐링 오라클
- 러브 플라워 오라클 카드
- 하트 로맨틱 오라클
- 네이키드 트루
- 오션 오브 위즈덤 오라클
- 로맨스 엔젤 오라클

사용 가능한 보조도구:
- 오간기
- 오방기
- 레노먼드 카드
- 아이칭 카드
- Pixie’s Astounding Lenormand
- 갑골영패
- 룬스톤
- 주역육효괘
- 귀문방
- 문올로지 오라클
- 오리엔탈 판타지 타로 색채 카드

반드시 아래 스키마의 JSON만 출력하세요:
{
  "topic": "",
  "intent": "",
  "deck": "",
  "spread_name": "",
  "card_count": 0,
  "use_oracle": false,
  "oracle_deck": "",
  "oracle_count": 0,
  "use_lenormand": false,
  "lenormand_count": 0,
  "use_runes": false,
  "rune_count": 0,
  "use_iching": false,
  "iching_count": 0,
  "use_yukyo": false,
  "yukyo_count": 0,
  "use_ogangi": false,
  "use_obanggi": false,
  "selected_aux_decks": [],
  "aux_counts": {},
  "reason": ""
}
`.trim();
}

function normalizePlan(plan = {}, question = '') {
  const fallbackIntent = detectIntent(question);

  const normalized = {
    topic: typeof plan.topic === 'string' ? plan.topic : fallbackIntent,
    intent: typeof plan.intent === 'string' ? plan.intent : fallbackIntent,
    deck: typeof plan.deck === 'string' && plan.deck.trim() ? plan.deck.trim() : '유니버셜 타로',
    spread_name:
      typeof plan.spread_name === 'string' && plan.spread_name.trim()
        ? plan.spread_name.trim()
        : '기본 3카드',
    card_count: Number.isFinite(Number(plan.card_count))
      ? Math.min(13, Math.max(1, Number(plan.card_count)))
      : 3,

    use_oracle: Boolean(plan.use_oracle),
    oracle_deck:
      typeof plan.oracle_deck === 'string' ? plan.oracle_deck.trim() : '',
    oracle_count: Number.isFinite(Number(plan.oracle_count))
      ? Math.min(13, Math.max(0, Number(plan.oracle_count)))
      : 0,

    use_lenormand: Boolean(plan.use_lenormand),
    lenormand_count: Number.isFinite(Number(plan.lenormand_count))
      ? Math.min(13, Math.max(0, Number(plan.lenormand_count)))
      : 0,

    use_runes: Boolean(plan.use_runes),
    rune_count: Number.isFinite(Number(plan.rune_count))
      ? Math.min(13, Math.max(0, Number(plan.rune_count)))
      : 0,

    use_iching: Boolean(plan.use_iching),
    iching_count: Number.isFinite(Number(plan.iching_count))
      ? Math.min(13, Math.max(0, Number(plan.iching_count)))
      : 0,

    use_yukyo: Boolean(plan.use_yukyo),
    yukyo_count: Number.isFinite(Number(plan.yukyo_count))
      ? Math.min(13, Math.max(0, Number(plan.yukyo_count)))
      : 0,

    use_ogangi: Boolean(plan.use_ogangi),
    use_obanggi: Boolean(plan.use_obanggi),

    selected_aux_decks: Array.isArray(plan.selected_aux_decks)
      ? plan.selected_aux_decks.filter((item) => typeof item === 'string' && item.trim())
      : [],

    aux_counts:
      plan.aux_counts && typeof plan.aux_counts === 'object' && !Array.isArray(plan.aux_counts)
        ? Object.fromEntries(
            Object.entries(plan.aux_counts).map(([key, value]) => [
              key,
              Math.min(13, Math.max(1, Number(value) || 1)),
            ]),
          )
        : {},

    reason: typeof plan.reason === 'string' ? plan.reason.trim() : '',
  };

  if (normalized.use_oracle && !normalized.oracle_deck) {
    normalized.oracle_deck = '하트 로맨틱 오라클';
  }
  if (normalized.use_oracle && normalized.oracle_count === 0) {
    normalized.oracle_count = 1;
  }

  if (normalized.use_lenormand && normalized.lenormand_count === 0) {
    normalized.lenormand_count = 2;
  }

  if (normalized.use_runes && normalized.rune_count === 0) {
    normalized.rune_count = 1;
  }

  if (normalized.use_iching && normalized.iching_count === 0) {
    normalized.iching_count = 1;
  }

  if (normalized.use_yukyo && normalized.yukyo_count === 0) {
    normalized.yukyo_count = 1;
  }

  return normalized;
}

async function generateReadingPlan({ question }) {
  const trimmedQuestion = String(question || '').trim();
  const fallbackIntent = detectIntent(trimmedQuestion);

  if (!trimmedQuestion) {
    return normalizePlan(
      {
        topic: '일반',
        intent: '일반',
        deck: '유니버셜 타로',
        spread_name: '기본 3카드',
        card_count: 3,
        use_oracle: false,
        oracle_deck: '',
        oracle_count: 0,
        use_lenormand: false,
        lenormand_count: 0,
        use_runes: false,
        rune_count: 0,
        use_iching: false,
        iching_count: 0,
        use_yukyo: false,
        yukyo_count: 0,
        use_ogangi: false,
        use_obanggi: false,
        selected_aux_decks: [],
        aux_counts: {},
        reason: '질문이 비어 있어 기본 3카드 리딩으로 설정함',
      },
      trimmedQuestion,
    );
  }

  if (!openai) {
    return normalizePlan(
      {
        topic: fallbackIntent,
        intent: fallbackIntent,
        deck:
          fallbackIntent === '연애'
            ? '너에게 다이브'
            : fallbackIntent === '결정'
              ? '세피로트 타로'
              : '유니버셜 타로',
        spread_name:
          fallbackIntent === '연애'
            ? '속마음 3카드'
            : fallbackIntent === '결정'
              ? '선택 조언 3카드'
              : '기본 3카드',
        card_count: 3,
        use_oracle: false,
        oracle_deck: '',
        oracle_count: 0,
        use_lenormand: false,
        lenormand_count: 0,
        use_runes: false,
        rune_count: 0,
        use_iching: false,
        iching_count: 0,
        use_yukyo: fallbackIntent === '결정',
        yukyo_count: fallbackIntent === '결정' ? 1 : 0,
        use_ogangi: fallbackIntent === '결정',
        use_obanggi: false,
        selected_aux_decks: fallbackIntent === '연애' ? ['귀문방'] : [],
        aux_counts: fallbackIntent === '연애' ? { 귀문방: 1 } : {},
        reason: 'OpenAI 키가 없어 기본 규칙 기반 추천으로 대체함',
      },
      trimmedQuestion,
    );
  }

  const completion = await openai.chat.completions.create({
    model: env.model || 'gpt-4.1-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: getPlannerPrompt() },
      { role: 'user', content: trimmedQuestion },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || '{}';
  let parsed = {};

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      topic: fallbackIntent,
      intent: fallbackIntent,
      deck: '유니버셜 타로',
      spread_name: '기본 3카드',
      card_count: 3,
      use_oracle: false,
      oracle_deck: '',
      oracle_count: 0,
      use_lenormand: false,
      lenormand_count: 0,
      use_runes: false,
      rune_count: 0,
      use_iching: false,
      iching_count: 0,
      use_yukyo: false,
      yukyo_count: 0,
      use_ogangi: false,
      use_obanggi: false,
      selected_aux_decks: [],
      aux_counts: {},
      reason: 'JSON 파싱 실패로 기본 3카드 리딩으로 대체함',
    };
  }

  return normalizePlan(parsed, trimmedQuestion);
}

async function generateReading({ question, spread, deck, topic, cards = [] }) {
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

  const cardsText = Array.isArray(cards) && cards.length
    ? `\n\n[카드]\n${cards.join(', ')}`
    : '';

  const completion = await openai.chat.completions.create({
    model: env.model || 'gpt-4.1-mini',
    temperature: 0.65,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content:
          buildUserPrompt({
            question,
            spread,
            deck,
            topic,
            intent,
            knowledge,
          }) + cardsText,
      },
    ],
  });

  const rawReading = completion.choices?.[0]?.message?.content?.trim() || '';

  const cleanedReading = rawReading
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');

  return {
    intent,
    knowledge,
    reading: cleanedReading,
  };
}

module.exports = { generateReading, generateReadingPlan };

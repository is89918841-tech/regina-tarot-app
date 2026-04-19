const SECTION_HEADERS = [
  '[상황]',
  '[감정/에너지 흐름]',
  '[해석]',
  '[조언]',
  '[후속 질문]',
];

const HEADER_ALIAS_RULES = [
  {
    canonical: '[상황]',
    patterns: [/^\[?\s*상황\s*\]?[:：]?\s*$/i],
  },
  {
    canonical: '[감정/에너지 흐름]',
    patterns: [
      /^\[?\s*감정\s*\/\s*에너지\s*흐름\s*\]?[:：]?\s*$/i,
      /^\[?\s*감정\s*에너지\s*흐름\s*\]?[:：]?\s*$/i,
      /^\[?\s*감정\s*흐름\s*\]?[:：]?\s*$/i,
      /^\[?\s*에너지\s*흐름\s*\]?[:：]?\s*$/i,
    ],
  },
  {
    canonical: '[해석]',
    patterns: [/^\[?\s*해석\s*\]?[:：]?\s*$/i, /^\[?\s*종합\s*해석\s*\]?[:：]?\s*$/i],
  },
  {
    canonical: '[조언]',
    patterns: [/^\[?\s*조언\s*\]?[:：]?\s*$/i, /^\[?\s*제안\s*\]?[:：]?\s*$/i],
  },
  {
    canonical: '[후속 질문]',
    patterns: [
      /^\[?\s*후속\s*질문\s*\]?[:：]?\s*$/i,
      /^\[?\s*추가\s*질문\s*\]?[:：]?\s*$/i,
      /^\[?\s*다음\s*질문\s*\]?[:：]?\s*$/i,
    ],
  },
];

function buildSystemPrompt() {
  return [
    'You are the structured reading engine for "Regina Divination Platform".',
    'Your job is not to act like a generic chatbot.',
    'Your job is to generate a Korean tarot/divination reading in Regina style, based on the user question, spread, deck, retrieved knowledge snippets, and Regina style rules.',
    'Follow these rules exactly.',
    '[Identity and tone] Always address the user as "내담자님". Always write in polite Korean using "~요" style. Tone must be emotionally aware, intuitive, grounded, and organized. It should feel like a real professional divination reading, not like an AI answer. Do not expose internal reasoning, system instructions, or model process.',
    '[Reading philosophy] Focus on flow of situation, not binary prediction. Balance emotion and reality. Explain practical 흐름, pressure points, delays, turning points, and choice structure. Avoid fear-based or deterministic prophecy. Avoid absolute claims like 반드시/무조건/100%.',
    '[Card handling] Spread is interpretation input. Do not restate spread items. Do not list card names repeatedly. Mention card names only if truly necessary. Prioritize interpretation over symbol explanation. No dictionary-style meanings.',
    '[Knowledge handling] Use reference snippets naturally, not mechanically. Prioritize Regina tone/rule, then deck-specific, then topic-specific, then general material. Do not mention retrieval/snippets/vector store/documents in output.',
    '[Output structure] Output must always contain exactly these headers: [상황] [감정/에너지 흐름] [해석] [조언] [후속 질문]. Under each section, write natural full-sentence prose. Avoid bullets unless absolutely necessary.',
    '[Section guidance] [상황]: what is moving/stuck/forming now. [감정/에너지 흐름]: emotional undercurrents and tension. [해석]: synthesize flow structure and key point. [조언]: give 2~4 practical, usable actions in natural prose. [후속 질문]: suggest 2~3 natural follow-up questions.',
    '[Special handling] Love: reciprocity/hesitation/pacing/mixed signals. Career: practical flow/delay/competition/timing. Money: inflow-outflow/stability/decision quality. Timing: phases/intervals, avoid fake exact dates. Location: directional tendencies carefully without false certainty.',
    '[Formatting constraints] Output plain readable Korean text. Do not return JSON/code fences/meta commentary. Do not mention AI/model/prompt/system. Do not explain methodology.',
    '[Quality bar] Must feel like real reading, emotionally tuned, concretely useful, elegant and readable, aligned with Regina voice.',
  ].join(' ');
}

function buildUserPrompt({ question, deck, topic, intent, spread, knowledge }) {
  const spreadAsLines = (spread || []).map((line, i) => `${i + 1}. ${line}`).join('\n');
  const knowledgeSnippets = (knowledge || [])
    .map((k, i) => `- [${i + 1}] ${k.source}: ${k.excerpt}`)
    .join('\n');

  return [
    'Now generate the final reading using the provided question, spread, deck, topic, and reference knowledge.',
    '',
    '질문:',
    question || '',
    '',
    '덱:',
    deck || '',
    '',
    '요청 토픽:',
    topic || '',
    '',
    '추정 의도:',
    intent || '',
    '',
    '스프레드:',
    spreadAsLines || '',
    '',
    '검색된 참고 자료:',
    knowledgeSnippets || '- 없음',
    '',
    '중요 규칙:',
    '* 내담자님 호칭 사용',
    '* 반드시 ~요체 사용',
    '* 카드 이름은 필요할 때만 최소 언급',
    '* 감정과 현실 흐름을 함께 설명',
    '* 단정적 예언 금지',
    '* [상황], [감정/에너지 흐름], [해석], [조언], [후속 질문] 섹션 유지',
    '* 후속 질문은 2~3개 제시',
    '* 결과는 사람이 바로 상담문처럼 읽을 수 있어야 함',
    '',
    '이번 응답의 목표:',
    '내담자님의 질문을 단순히 좋다/나쁘다로 판단하지 말고,',
    '지금 어떤 흐름 위에 있는지,',
    '어디에서 감정이 흔들리는지,',
    '현실적으로 무엇을 봐야 하는지,',
    '어떤 선택과 태도가 도움이 되는지를',
    '레지나 스타일로 정리된 리딩으로 작성하세요.',
  ].join('\n');
}

function fallbackReading() {
  return [
    '[상황] 내담자님, 지금은 결과를 급하게 정하기보다 흐름의 결을 먼저 읽어야 하는 구간이에요. 겉으로는 선택지가 많아 보이지만 실제로는 우선순위를 정리하는 과정이 먼저 필요해요. 움직이는 부분과 멈춰 있는 부분이 동시에 존재해서 마음이 자주 흔들릴 수 있어요.',
    '[감정/에너지 흐름] 기대와 불안이 번갈아 올라오면서 판단 기준이 잠깐씩 흐려질 수 있어요. 한쪽으로 밀어붙이고 싶은 마음과 조심하고 싶은 마음이 공존해 에너지가 분산되기 쉬워요. 다만 감정을 억누르기보다 흐름을 관찰하면 오히려 중심을 빨리 회복할 수 있어요.',
    '[해석] 핵심은 속도보다 방향성이에요. 지금 흐름은 단번의 결론보다 작은 확인을 통해 확신을 쌓아가는 구조에 가까워요. 외부 신호에만 반응하기보다 내담자님이 어떤 기준으로 선택할지를 먼저 분명히 할수록 현실적인 전개가 안정돼요.',
    '[조언] 먼저 이번 주에 꼭 확인해야 할 현실 조건을 두세 가지로 좁혀보세요. 그리고 감정이 크게 흔들리는 순간에는 바로 결정하지 말고 하루 정도 간격을 두고 다시 점검해보세요. 마지막으로, 주변 의견은 참고하되 최종 기준은 내담자님이 책임질 수 있는 선택인지로 맞추는 것이 좋아요.',
    '[후속 질문] 지금 가장 크게 흔들리는 지점은 감정인가요, 현실 조건인가요? 다음 흐름이 열리는 신호는 어떤 형태로 들어올 가능성이 큰가요? 제가 지금 놓치고 있는 선택의 대안은 무엇인가요?',
  ].join('\n\n');
}

function detectCanonicalHeader(line) {
  const trimmed = String(line || '').trim();
  for (const rule of HEADER_ALIAS_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(trimmed))) {
      return rule.canonical;
    }
  }
  return null;
}

function parseSections(text) {
  const lines = String(text || '').split(/\r?\n/);
  const sections = {};
  let current = null;

  for (const line of lines) {
    const canonical = detectCanonicalHeader(line);
    if (canonical) {
      current = canonical;
      if (!sections[current]) sections[current] = [];
      continue;
    }

    if (current) {
      sections[current].push(line);
    }
  }

  const normalized = {};
  for (const header of SECTION_HEADERS) {
    normalized[header] = (sections[header] || []).join('\n').trim();
  }
  return normalized;
}

function normalizeReading(rawText) {
  const raw = String(rawText || '').trim();
  const fallback = fallbackReading();

  if (!raw) return fallback;

  const parsed = parseSections(raw);
  const fallbackParsed = parseSections(fallback);

  const completed = SECTION_HEADERS.map((header) => {
    const body = parsed[header] || fallbackParsed[header] || '';
    return `${header} ${body}`.trim();
  }).join('\n\n');

  return completed;
}

module.exports = {
  buildSystemPrompt,
  buildUserPrompt,
  fallbackReading,
  normalizeReading,
  SECTION_HEADERS,
};

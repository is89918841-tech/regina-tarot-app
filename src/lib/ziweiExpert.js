'use strict';

const STAR_TAGS = {
  자미: { type: 'main', tags: ['권위', '관리', '중심성'], nature: 'leadership', level: 5 },
  천기: { type: 'main', tags: ['기획', '변화', '전략'], nature: 'strategy', level: 4 },
  태양: { type: 'main', tags: ['명예', '공개성', '보호'], nature: 'public', level: 4 },
  무곡: { type: 'main', tags: ['재물', '실무', '결단'], nature: 'wealth', level: 4 },
  천동: { type: 'main', tags: ['복', '정서', '완충'], nature: 'comfort', level: 3 },
  염정: { type: 'main', tags: ['매력', '규범', '선택'], nature: 'desire', level: 4 },
  천부: { type: 'main', tags: ['저장', '관리', '자원'], nature: 'storehouse', level: 5 },
  태음: { type: 'main', tags: ['저축', '감정', '내면'], nature: 'inner', level: 4 },
  탐랑: { type: 'main', tags: ['욕망', '인기', '확장'], nature: 'expansion', level: 4 },
  거문: { type: 'main', tags: ['말', '논쟁', '정보'], nature: 'speech', level: 3 },
  천상: { type: 'main', tags: ['조율', '균형', '보좌'], nature: 'balance', level: 4 },
  천량: { type: 'main', tags: ['보호', '원칙', '공익'], nature: 'protection', level: 4 },
  칠살: { type: 'main', tags: ['돌파', '위기관리', '독립'], nature: 'breakthrough', level: 4 },
  파군: { type: 'main', tags: ['해체', '개혁', '재구성'], nature: 'reform', level: 4 },

  좌보: { type: 'support', tags: ['협력', '보좌'], nature: 'helper', level: 3, category: '길성' },
  우필: { type: 'support', tags: ['조력', '후원'], nature: 'helper', level: 3, category: '길성' },
  문창: { type: 'support', tags: ['문서', '학습', '표현'], nature: 'literary', level: 3, category: '문성' },
  문곡: { type: 'support', tags: ['예술', '감수성', '문장'], nature: 'artistic', level: 3, category: '문성' },
  천괴: { type: 'support', tags: ['귀인', '기회', '끌어올림'], nature: 'noble', level: 4, category: '귀인' },
  천월: { type: 'support', tags: ['귀인', '보호', '상승'], nature: 'noble', level: 4, category: '귀인' },
  천魁: { type: 'support', tags: ['귀인', '기회', '끌어올림'], nature: 'noble', level: 4, category: '귀인', alias: '천괴' },
  천鉞: { type: 'support', tags: ['귀인', '보호', '상승'], nature: 'noble', level: 4, category: '귀인', alias: '천월' },
  록존: { type: 'support', tags: ['재물', '축적', '보존'], nature: 'wealth', level: 4, category: '재성' },
  천마: { type: 'support', tags: ['이동', '변화', '활동'], nature: 'movement', level: 3, category: '동성' },
  홍란: { type: 'support', tags: ['연애', '인연', '호감'], nature: 'relationship', level: 3, category: '인연성' },
  천희: { type: 'support', tags: ['기쁨', '축하', '인연'], nature: 'joy', level: 3, category: '인연성' },
  천요: { type: 'support', tags: ['매력', '유혹', '관능'], nature: 'attraction', level: 3, category: '도화성' },
  고진: { type: 'support', tags: ['고독', '거리감', '독립'], nature: 'solitude', level: 2, category: '고독성' },
  과숙: { type: 'support', tags: ['고립', '지연', '내향'], nature: 'solitude', level: 2, category: '고독성' },
  화록: { type: 'transform', tags: ['수익', '호감', '성과'], nature: 'gain', level: 5, category: '사화' },
  화권: { type: 'transform', tags: ['권한', '주도권', '압력'], nature: 'power', level: 5, category: '사화' },
  화과: { type: 'transform', tags: ['명예', '정리', '인정'], nature: 'recognition', level: 4, category: '사화' },
  화기: { type: 'transform', tags: ['막힘', '집착', '손실주의'], nature: 'block', level: 5, category: '사화' },
};

const PALACE_WEIGHT = {
  명궁: 5,
  관록궁: 5,
  재백궁: 5,
  부부궁: 4,
  복덕궁: 4,
  질액궁: 4,
  천이궁: 3,
  전택궁: 3,
  노복궁: 3,
  부모궁: 2,
  형제궁: 2,
  자녀궁: 2,
};

const PALACE_DOMAIN = {
  명궁: '자기 운영과 삶의 기본 방향',
  관록궁: '직업·책임·사회적 역할',
  재백궁: '돈·수입원·거래 감각',
  부부궁: '연애·계약·파트너십',
  복덕궁: '정신적 만족과 회복력',
  질액궁: '컨디션·생활 습관·취약부위',
  천이궁: '외부 환경·이동·사회 반경',
  전택궁: '집·기반·부동산·가족 자산',
  노복궁: '인맥·고객·협력자',
  부모궁: '윗사람·문서·배경',
  형제궁: '동료·수평 관계',
  자녀궁: '창작물·후속 결과·즐거움',
};

function normalizeStarName(name = '') {
  return String(name)
    .replace(/천魁/g, '천괴')
    .replace(/천鉞/g, '천월')
    .replace(/\s+/g, '')
    .trim();
}

function starInfo(name) {
  const raw = String(name || '').trim();
  const normalized = normalizeStarName(raw);
  return STAR_TAGS[normalized] || STAR_TAGS[raw] || { tags: [], nature: 'neutral', level: 1, category: '기타' };
}

function palaceStars(palace = {}) {
  const main = palace.mainStar || palace.star;
  const aux = palace.auxiliaryStars || palace.auxStars || [];
  const four = palace.fourTransform || [];
  return [main, ...aux, ...four].filter(Boolean).map(normalizeStarName);
}

function classifyPalace(palace = {}) {
  const stars = palaceStars(palace);
  const tags = [];
  const positives = [];
  const cautions = [];
  const transforms = [];
  let score = PALACE_WEIGHT[palace.name] || 1;

  for (const star of stars) {
    const info = starInfo(star);
    tags.push(...(info.tags || []));
    if (['귀인', '길성', '문성', '재성', '인연성'].includes(info.category)) positives.push(star);
    if (['고독성'].includes(info.category) || info.nature === 'block') cautions.push(star);
    if (info.category === '사화') transforms.push(star);
    if (info.nature === 'gain' || info.nature === 'noble') score += 2;
    if (info.nature === 'block' || info.nature === 'solitude') score -= 1;
    if (info.nature === 'power') score += 1;
  }

  const uniqueTags = [...new Set(tags)].slice(0, 8);
  const tone = score >= 7 ? '강하게 열리는 궁' : score >= 4 ? '활용 가능한 궁' : score >= 2 ? '관리형 궁' : '주의가 필요한 궁';
  return {
    palace: palace.name,
    mainStar: normalizeStarName(palace.mainStar || palace.star || ''),
    branch: palace.branch || '',
    domain: PALACE_DOMAIN[palace.name] || palace.meaning || palace.theme || '',
    tags: uniqueTags,
    positives: [...new Set(positives)],
    cautions: [...new Set(cautions)],
    transforms: [...new Set(transforms)],
    score,
    tone,
    sentence: `${palace.name}은 ${normalizeStarName(palace.mainStar || palace.star || '')} 중심이라 ${PALACE_DOMAIN[palace.name] || palace.theme || palace.meaning || '해당 영역'}에서 ${uniqueTags.slice(0, 3).join('·') || '기본 흐름'}이 강조됩니다.`,
  };
}

function summarizeByCategory(palaceInsights = []) {
  const noble = [];
  const literary = [];
  const relationship = [];
  const wealth = [];
  const caution = [];
  const transforms = { 화록: [], 화권: [], 화과: [], 화기: [] };

  for (const p of palaceInsights) {
    const stars = palaceStars(p.raw || {});
    for (const star of stars) {
      const info = starInfo(star);
      const label = `${p.palace} ${star}`;
      if (info.category === '귀인' || info.nature === 'noble') noble.push(label);
      if (info.category === '문성' || info.nature === 'literary' || info.nature === 'artistic') literary.push(label);
      if (info.category === '인연성' || info.category === '도화성' || info.nature === 'relationship' || info.nature === 'attraction') relationship.push(label);
      if (info.category === '재성' || info.nature === 'wealth' || info.nature === 'gain') wealth.push(label);
      if (info.category === '고독성' || info.nature === 'block') caution.push(label);
      if (transforms[star]) transforms[star].push(p.palace);
    }
  }

  const uniq = (arr) => [...new Set(arr)].slice(0, 12);
  return {
    noble: uniq(noble),
    literary: uniq(literary),
    relationship: uniq(relationship),
    wealth: uniq(wealth),
    caution: uniq(caution),
    transforms,
  };
}

function buildInteractions(byName = {}) {
  const pairs = [
    ['명궁', '관록궁', '자기 운영과 커리어가 어떻게 연결되는지 봅니다.'],
    ['명궁', '재백궁', '성향과 돈 버는 방식의 연결을 봅니다.'],
    ['관록궁', '재백궁', '직업 구조가 실제 수입으로 이어지는 방식을 봅니다.'],
    ['부부궁', '복덕궁', '관계 만족감과 내면 안정의 연결을 봅니다.'],
    ['질액궁', '복덕궁', '컨디션과 정신적 회복력의 균형을 봅니다.'],
    ['천이궁', '노복궁', '외부 활동과 인맥·고객 흐름의 연결을 봅니다.'],
  ];

  return pairs.map(([a, b, meaning]) => {
    const pa = byName[a];
    const pb = byName[b];
    if (!pa || !pb) return null;
    const aStars = palaceStars(pa).slice(0, 4).join(', ');
    const bStars = palaceStars(pb).slice(0, 4).join(', ');
    return {
      pair: `${a} ↔ ${b}`,
      stars: `${aStars || '없음'} / ${bStars || '없음'}`,
      meaning,
      sentence: `${a}의 ${normalizeStarName(pa.mainStar || pa.star)} 흐름과 ${b}의 ${normalizeStarName(pb.mainStar || pb.star)} 흐름이 연결되어, ${meaning}`,
    };
  }).filter(Boolean);
}

function enrichAnnual(annual = [], palaceInsightByName = {}) {
  return annual.map((item) => {
    const insight = palaceInsightByName[item.palace] || {};
    const transforms = insight.transforms && insight.transforms.length ? ` / 사화 ${insight.transforms.join(', ')}` : '';
    const caution = insight.cautions && insight.cautions.length ? ` / 주의 ${insight.cautions.join(', ')}` : '';
    return {
      ...item,
      expertFocus: `${item.year}년은 ${item.palace} 중심으로 ${insight.domain || item.focus || '해당 영역'}이 부각됩니다${transforms}${caution}.`,
      eventKeywords: insight.tags || [],
      tone: insight.tone || '',
    };
  });
}

function enrichCycles(cycles = [], palaceInsightByName = {}) {
  return cycles.map((item) => {
    const insight = palaceInsightByName[item.palace] || {};
    return {
      ...item,
      expertFocus: `${item.ageRange}는 ${item.palace}의 ${insight.mainStar || item.star || ''} 흐름을 통해 ${insight.domain || item.theme || '인생 영역'}이 강조됩니다.`,
      eventKeywords: insight.tags || [],
      tone: insight.tone || '',
    };
  });
}

function buildExpertSummary(ziwei = {}, palaceInsights = [], categorySummary = {}) {
  const top = [...palaceInsights].sort((a, b) => b.score - a.score).slice(0, 4);
  const caution = categorySummary.caution || [];
  const noble = categorySummary.noble || [];
  const wealth = categorySummary.wealth || [];
  const relations = categorySummary.relationship || [];
  return {
    topPalaces: top.map((p) => `${p.palace}(${p.mainStar}/${p.tone})`),
    nobleSummary: noble.length ? noble.join(', ') : '강한 귀인성 없음',
    wealthSummary: wealth.length ? wealth.join(', ') : '재성 보조 약함',
    relationshipSummary: relations.length ? relations.join(', ') : '인연성 보조 약함',
    cautionSummary: caution.length ? caution.join(', ') : '강한 고독·막힘성 없음',
    oneLine: top.length ? `자미 Expert 기준 핵심은 ${top.map((p) => p.palace).join('·')} 축입니다.` : '자미 Expert 요약 자료 없음',
  };
}

function enrichZiweiExpert(ziwei = {}, options = {}) {
  const mode = options.mode || 'EXPERT';
  const palaces = Array.isArray(ziwei.palaces) ? ziwei.palaces : [];
  const palaceInsights = palaces.map((p) => ({ ...classifyPalace(p), raw: p }));
  const palaceInsightByName = Object.fromEntries(palaceInsights.map((p) => [p.palace, p]));
  const categorySummary = summarizeByCategory(palaceInsights);
  const interactions = buildInteractions(Object.fromEntries(palaces.map((p) => [p.name, p])));
  const annualExpert = enrichAnnual(ziwei.annual || [], palaceInsightByName);
  const cycleExpert = enrichCycles(ziwei.cycles || [], palaceInsightByName);
  const expertSummary = buildExpertSummary(ziwei, palaceInsights, categorySummary);

  return {
    ...ziwei,
    expertMode: mode,
    expert: {
      mode,
      palaceInsights,
      categorySummary,
      interactions,
      annualExpert,
      cycleExpert,
      summary: expertSummary,
      note: '자미두수 Expert 모드는 백업 계산기의 구조형 산출값에 보조성·사화·궁간 상호작용 해석층을 얹은 것입니다.',
    },
  };
}

module.exports = {
  enrichZiweiExpert,
  normalizeStarName,
};

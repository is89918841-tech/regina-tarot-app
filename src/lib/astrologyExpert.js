// Regina Birth Calculator v13 Phase B-2 - Astrology Expert Layer (Netlify/CommonJS safe)

const SIGN_ORDER = ['양자리','황소자리','쌍둥이자리','게자리','사자자리','처녀자리','천칭자리','전갈자리','사수자리','염소자리','물병자리','물고기자리'];
const ELEMENT_BY_SIGN = {
  양자리:'불', 사자자리:'불', 사수자리:'불',
  황소자리:'흙', 처녀자리:'흙', 염소자리:'흙',
  쌍둥이자리:'공기', 천칭자리:'공기', 물병자리:'공기',
  게자리:'물', 전갈자리:'물', 물고기자리:'물'
};
const MODE_BY_SIGN = {
  양자리:'활동', 게자리:'활동', 천칭자리:'활동', 염소자리:'활동',
  황소자리:'고정', 사자자리:'고정', 전갈자리:'고정', 물병자리:'고정',
  쌍둥이자리:'변동', 처녀자리:'변동', 사수자리:'변동', 물고기자리:'변동'
};

function mod(n, m) { return ((n % m) + m) % m; }
function signFromLon(lon) { return SIGN_ORDER[Math.floor(mod(lon, 360) / 30)] || '미상'; }
function degreeInSign(lon) { return mod(lon, 30); }
function degreeText(lon) {
  if (lon == null || Number.isNaN(lon)) return '';
  const d = degreeInSign(lon);
  const g = Math.floor(d);
  const m = Math.floor((d - g) * 60);
  return `${g}°${String(m).padStart(2, '0')}′`;
}

const EXTRA_POINTS = {
  chiron: { name: 'Chiron', ko: '키론', base: 250.0, daily: 360 / (50.7 * 365.2422), meaning: '상처와 치유, 반복되는 취약점의 회복 방식' },
  lilith: { name: 'Lilith', ko: '릴리스', base: 118.0, daily: 360 / (8.85 * 365.2422), meaning: '억압된 욕망, 그림자, 관계에서 드러나는 본능성' },
  fortune: { name: 'Part of Fortune', ko: '포춘', base: 0, daily: 0, meaning: '삶에서 비교적 자연스럽게 열리는 만족과 성취 포인트' },
  vertex: { name: 'Vertex', ko: '버텍스', base: 0, daily: 0, meaning: '예상 밖의 만남, 운명적 접점, 외부 사건성' }
};

function makeExtraBody(key, lon) {
  const cfg = EXTRA_POINTS[key] || {};
  const sign = signFromLon(lon);
  return {
    key,
    name: cfg.ko || key,
    englishName: cfg.name || key,
    sign,
    degree: +degreeInSign(lon).toFixed(2),
    degreeText: degreeText(lon),
    absoluteDegree: +mod(lon, 360).toFixed(4),
    element: ELEMENT_BY_SIGN[sign] || '',
    mode: MODE_BY_SIGN[sign] || '',
    meaning: cfg.meaning || ''
  };
}

function estimateExtraPoints(astrology = {}) {
  const jd = astrology.calculationMeta?.julianDay || 2451545;
  const days = jd - 2451545;
  const p = astrology.planets || {};
  const asc = p.asc?.absoluteDegree ?? 0;
  const moon = p.moon?.absoluteDegree ?? 0;
  const sun = p.sun?.absoluteDegree ?? 0;

  const chironLon = mod(EXTRA_POINTS.chiron.base + EXTRA_POINTS.chiron.daily * days + 2.5 * Math.sin(days / 690), 360);
  const lilithLon = mod(EXTRA_POINTS.lilith.base + EXTRA_POINTS.lilith.daily * days + 4.0 * Math.sin(days / 420), 360);
  // 낮/밤 구분 없이 백업용 단순 Pars Fortunae: ASC + Moon - Sun
  const fortuneLon = mod(asc + moon - sun, 360);
  // 백업용 Vertex 근사: DESC와 MC 중간 축
  const mc = astrology.angles?.mc?.absoluteDegree ?? ((asc + 90) % 360);
  const vertexLon = mod((asc + 180 + mc) / 2, 360);

  return {
    chiron: makeExtraBody('chiron', chironLon),
    lilith: makeExtraBody('lilith', lilithLon),
    fortune: makeExtraBody('fortune', fortuneLon),
    vertex: makeExtraBody('vertex', vertexLon)
  };
}

function countBy(list, fn) {
  return list.reduce((acc, item) => {
    const key = fn(item);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(obj, limit = 3) {
  return Object.entries(obj || {}).sort((a,b) => b[1] - a[1]).slice(0, limit);
}

function detectDominants(astrology = {}, extra = {}) {
  const bodies = Object.values(astrology.planets || {}).filter(x => x && x.sign && x.key !== 'asc');
  const all = [...bodies, ...Object.values(extra || {})];
  const signCounts = countBy(all, x => x.sign);
  const elementCounts = countBy(all, x => x.element);
  const modeCounts = countBy(all, x => x.mode);

  const planetWeights = {};
  bodies.forEach((b) => {
    if (!b.key) return;
    let weight = 1;
    if (['sun','moon','asc'].includes(b.key)) weight += 2;
    if (['mercury','venus','mars'].includes(b.key)) weight += 1;
    if (b.retrograde) weight += 0.5;
    planetWeights[b.name || b.key] = (planetWeights[b.name || b.key] || 0) + weight;
  });

  return {
    dominantSigns: topEntries(signCounts).map(([name,count]) => `${name} ${count}`),
    dominantElements: topEntries(elementCounts).map(([name,count]) => `${name} ${count}`),
    dominantModes: topEntries(modeCounts).map(([name,count]) => `${name} ${count}`),
    dominantPlanets: topEntries(planetWeights).map(([name,score]) => `${name} ${score}`)
  };
}

function detectStelliums(astrology = {}) {
  const bodies = Object.values(astrology.planets || {}).filter(x => x && x.sign && !['asc'].includes(x.key));
  const bySign = {};
  bodies.forEach((b) => {
    bySign[b.sign] = bySign[b.sign] || [];
    bySign[b.sign].push(b.name || b.key);
  });
  return Object.entries(bySign)
    .filter(([, arr]) => arr.length >= 3)
    .map(([sign, arr]) => ({ sign, planets: arr, summary: `${sign} 스텔리움: ${arr.join(', ')}` }));
}

function retrogradeSummary(astrology = {}) {
  const bodies = Object.values(astrology.planets || {}).filter(x => x && x.retrograde && !['northNode','southNode'].includes(x.key));
  if (!bodies.length) return '뚜렷한 역행 행성 강조는 약합니다.';
  return bodies.map(x => `${x.name} ${x.sign}`).join(', ');
}

function aspectDomain(a = {}) {
  const pair = `${a.from || ''}-${a.to || ''}`;
  if (/금성|화성|달/.test(pair)) return '관계·감정';
  if (/태양|토성|목성|MC/.test(pair)) return '진로·사회성';
  if (/수성/.test(pair)) return '사고·소통';
  if (/해왕성|명왕성|북노드|남노드/.test(pair)) return '심층·카르마';
  return '기본성향';
}

function enrichAspectMeaning(a = {}) {
  const pair = `${a.from || ''}-${a.to || ''}`;
  const aspect = a.aspect || '';
  let detail = '';
  if (/태양-명왕성|명왕성-태양/.test(pair)) detail = '자기변형·권력감각·극단적 몰입을 다루는 축입니다.';
  else if (/금성-화성|화성-금성/.test(pair)) detail = '애정 표현과 행동 욕구가 연결되어 매력·창조성·관계 추진력을 만듭니다.';
  else if (/달-수성|수성-달/.test(pair)) detail = '감정과 사고가 강하게 연결되거나 충돌해 말과 마음의 온도차를 만들 수 있습니다.';
  else if (/수성-북노드|북노드-수성/.test(pair)) detail = '말·글·정보 처리 능력이 성장 방향과 직접 연결됩니다.';
  else if (/토성-천왕성|천왕성-토성/.test(pair)) detail = '질서와 변화 욕구가 동시에 강해 기존 구조를 새 방식으로 재편하려는 힘입니다.';
  else if (/목성-토성|토성-목성/.test(pair)) detail = '확장과 절제가 균형을 이루면 안정적인 성취 구조가 됩니다.';
  else if (/태양-해왕성|해왕성-태양/.test(pair)) detail = '이상과 현실감 사이의 긴장이 생겨 방향성이 흐려지거나 영감이 커질 수 있습니다.';
  else if (/달-북노드|북노드-달/.test(pair)) detail = '익숙한 감정 반응과 성장 방향 사이의 조율이 중요합니다.';
  else detail = a.meaning || '두 행성이 이루는 관계를 통해 성향과 사건성이 드러납니다.';

  const aspectTone = {
    '합': '집중과 융합',
    '대립': '균형 요구와 관계성',
    '사각': '긴장·압박·성장 과제',
    '삼각': '재능·순환·자연스러운 흐름',
    '육각': '협력·기회·활용 가능성',
    '퀸컨스': '조정·재배치·생활방식 수정'
  }[aspect] || '상호작용';

  return { ...a, domain: aspectDomain(a), expertMeaning: `${aspectTone}: ${detail}` };
}

function buildDispositorSummary(astrology = {}) {
  const p = astrology.planets || {};
  const signRulers = {
    양자리:'화성', 황소자리:'금성', 쌍둥이자리:'수성', 게자리:'달',
    사자자리:'태양', 처녀자리:'수성', 천칭자리:'금성', 전갈자리:'명왕성/화성',
    사수자리:'목성', 염소자리:'토성', 물병자리:'천왕성/토성', 물고기자리:'해왕성/목성'
  };
  const core = ['sun','moon','asc','mercury','venus','mars','saturn'].filter(k => p[k]);
  return core.map(k => `${p[k].name}(${p[k].sign})→${signRulers[p[k].sign] || '미상'}`);
}

function buildExpertPatterns(astrology = {}, extra = {}, dominants = {}) {
  const p = astrology.planets || {};
  const houses = astrology.houses || [];
  const seventh = houses[6]?.sign || '미상';
  const tenth = houses[9]?.sign || astrology.mc || '미상';
  const second = houses[1]?.sign || '미상';
  const eighth = houses[7]?.sign || '미상';
  return {
    love: `금성 ${p.venus?.sign || '미상'}·화성 ${p.mars?.sign || '미상'}·7하우스 ${seventh}·릴리스 ${extra.lilith?.sign || '미상'} 조합으로 애정 표현, 욕망, 관계의 그림자까지 함께 봅니다.`,
    career: `태양 ${p.sun?.sign || '미상'}·토성 ${p.saturn?.sign || '미상'}·MC ${astrology.mc || '미상'}·10하우스 ${tenth} 흐름으로 사회적 역할과 책임 구조를 봅니다.`,
    wealth: `2하우스 ${second}·8하우스 ${eighth}·금성 ${p.venus?.sign || '미상'}·목성 ${p.jupiter?.sign || '미상'} 조합으로 수입원, 자산 감각, 공유재정의 흐름을 봅니다.`,
    psyche: `달 ${p.moon?.sign || '미상'}·해왕성 ${p.neptune?.sign || '미상'}·명왕성 ${p.pluto?.sign || '미상'}·키론 ${extra.chiron?.sign || '미상'} 흐름으로 감정 반응, 무의식, 치유 과제를 봅니다.`,
    spirituality: `노드축 ${p.northNode?.sign || '미상'}-${p.southNode?.sign || '미상'}·포춘 ${extra.fortune?.sign || '미상'}·버텍스 ${extra.vertex?.sign || '미상'} 흐름으로 성장 방향과 우연한 전환점을 봅니다.`,
    dominant: `강조 원소 ${dominants.dominantElements?.join(', ') || '자료 없음'} / 강조 별자리 ${dominants.dominantSigns?.join(', ') || '자료 없음'}`
  };
}

function enrichAstrologyExpert(astrology = {}) {
  const extraPoints = estimateExtraPoints(astrology);
  const dominants = detectDominants(astrology, extraPoints);
  const stelliums = detectStelliums(astrology);
  const aspectExpert = (astrology.aspects || []).map(enrichAspectMeaning);
  const retrograde = retrogradeSummary(astrology);
  const dispositorChain = buildDispositorSummary(astrology);
  const expertPatterns = buildExpertPatterns(astrology, extraPoints, dominants);

  return {
    ...astrology,
    expert: {
      mode: 'EXPERT',
      extraPoints,
      dominants,
      stelliums,
      retrograde,
      dispositorChain,
      aspectExpert,
      patterns: expertPatterns,
      note: '점성술 Expert 모드는 v13 천문 근사 계산값 위에 심층 해석층을 얹은 백업용 전문가 모드입니다. Chiron/Lilith/Vertex/Fortune은 외부 천문력 없이 계산한 근사 포인트입니다.'
    }
  };
}

module.exports = { enrichAstrologyExpert };
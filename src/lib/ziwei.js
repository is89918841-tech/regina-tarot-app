const { enrichZiweiExpert, normalizeStarName } = require('./ziweiExpert');

const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

const PALACE_ORDER = [
  ['ming', '명궁', '자기 이미지, 기본 성격, 인생 운영 방식'],
  ['siblings', '형제궁', '형제·동료·가까운 수평 관계'],
  ['spouse', '부부궁', '연애, 결혼, 파트너십, 계약 관계'],
  ['children', '자녀궁', '자녀, 창작물, 후속 결과, 즐거움'],
  ['wealth', '재백궁', '돈, 수입원, 거래 감각, 재물 운용'],
  ['health', '질액궁', '건강, 컨디션, 취약 부위, 관리 방식'],
  ['travel', '천이궁', '이동, 외부 환경, 사회적 활동 반경'],
  ['friends', '노복궁', '친구, 협력자, 고객, 인맥 구조'],
  ['career', '관록궁', '직업, 커리어, 책임, 사회적 역할'],
  ['property', '전택궁', '집, 부동산, 기반, 가족 자산'],
  ['virtue', '복덕궁', '정신적 만족, 휴식, 취향, 내면의 여유'],
  ['parents', '부모궁', '부모, 윗사람, 문서, 보호와 배경'],
];

const MAIN_STARS = [
  '자미','천기','태양','무곡','천동','염정',
  '천부','태음','탐랑','거문','천상','천량','칠살','파군'
];

const AUX_STARS = [
  '좌보','우필','문창','문곡','천괴','천월','록존','천마',
  '화록','화권','화과','화기','홍란','천희','천요','고진','과숙'
];

const FOUR_TRANSFORM = {
  甲: { hualu:'염정', huaquan:'파군', huake:'무곡', huaji:'태양' },
  乙: { hualu:'천기', huaquan:'천량', huake:'자미', huaji:'태음' },
  丙: { hualu:'천동', huaquan:'천기', huake:'문창', huaji:'염정' },
  丁: { hualu:'태음', huaquan:'천동', huake:'천기', huaji:'거문' },
  戊: { hualu:'탐랑', huaquan:'태음', huake:'우필', huaji:'천기' },
  己: { hualu:'무곡', huaquan:'탐랑', huake:'천량', huaji:'문곡' },
  庚: { hualu:'태양', huaquan:'무곡', huake:'태음', huaji:'천동' },
  辛: { hualu:'거문', huaquan:'태양', huake:'문곡', huaji:'문창' },
  壬: { hualu:'천량', huaquan:'자미', huake:'좌보', huaji:'무곡' },
  癸: { hualu:'파군', huaquan:'거문', huake:'태음', huaji:'탐랑' },
};

const STAR_KEYWORDS = {
  자미: ['중심성','관리','권위','품격'],
  천기: ['전략','변화','기획','두뇌'],
  태양: ['공개성','명예','활동','보호'],
  무곡: ['재물','실무','결단','성과'],
  천동: ['정서','복','편안함','순응'],
  염정: ['매력','규범','관계 긴장','선택'],
  천부: ['저장','관리','안정','자원'],
  태음: ['감정','섬세함','저축','내면'],
  탐랑: ['욕망','인기','확장','즐거움'],
  거문: ['말','논쟁','정보','의심'],
  천상: ['조율','균형','보좌','품위'],
  천량: ['보호','원칙','연장자','공익'],
  칠살: ['결단','돌파','위기관리','독립'],
  파군: ['개혁','해체','재구성','승부'],
};

function parseDate(input = {}) {
  const raw = input.birthDate || input.birth || input.birth_date || '';
  const [year, month, day] = String(raw).split('-').map(Number);
  const timeRaw = input.birthTime || input.time || input.birth_time || '';
  const m = String(timeRaw).match(/(\d{1,2})/);
  const hour = m ? Number(m[1]) : 12;
  return {
    year: year || 2000,
    month: month || 1,
    day: day || 1,
    hour: Number.isFinite(hour) ? hour : 12,
  };
}

function getTimeBranchIndex(hour) {
  return Math.floor(((hour + 1) % 24) / 2);
}

function getYearStem(input = {}) {
  const sajuYear = input?.saju?.year?.stem || input?.yearStem;
  if (sajuYear) return sajuYear;
  const parsed = parseDate(input);
  const stems = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  return stems[((parsed.year - 4) % 10 + 10) % 10];
}

function palaceType(index) {
  const types = ['관계형','개척형','안정형','변화형','리더형','관찰형'];
  return types[index % types.length];
}

function rotate(arr, start) {
  return arr.map((_, i) => arr[(i + start) % arr.length]);
}

function buildPalaces(input = {}) {
  const parsed = parseDate(input);
  const timeIndex = getTimeBranchIndex(parsed.hour);
  // 구조형 보정: 생월 + 생시 기반 명궁 위치. 실제 자미두수 정밀식 전까지 내부 백업용으로 사용.
  const mingIndex = ((parsed.month + timeIndex + parsed.day) % 12 + 12) % 12;
  const stars = rotate(MAIN_STARS, (parsed.month + timeIndex) % MAIN_STARS.length);
  const yearStem = getYearStem(input);
  const transforms = FOUR_TRANSFORM[yearStem] || FOUR_TRANSFORM.戊;

  return PALACE_ORDER.map(([key, name, meaning], i) => {
    const branchIndex = (mingIndex + i) % 12;
    const mainStar = stars[i % stars.length];
    const secondaryMainStars = [];
    if (i === 0 && stars[12]) secondaryMainStars.push(stars[12]);
    if (i === 6 && stars[13]) secondaryMainStars.push(stars[13]);
    const auxStart = (parsed.day + parsed.month + i * 2) % AUX_STARS.length;
    const aux = [AUX_STARS[auxStart], AUX_STARS[(auxStart + timeIndex + 3) % AUX_STARS.length]];

    const four = [];
    if (transforms.hualu === mainStar || aux.includes(transforms.hualu)) four.push('화록');
    if (transforms.huaquan === mainStar || aux.includes(transforms.huaquan)) four.push('화권');
    if (transforms.huake === mainStar || aux.includes(transforms.huake)) four.push('화과');
    if (transforms.huaji === mainStar || aux.includes(transforms.huaji)) four.push('화기');

    return {
      key,
      name,
      type: palaceType(i + mingIndex),
      branch: BRANCHES[branchIndex],
      branchIndex,
      mainStar,
      secondaryMainStars,
      allMainStars: [mainStar, ...secondaryMainStars].filter(Boolean),
      auxiliaryStars: aux,
      fourTransform: four,
      meaning,
      keywords: STAR_KEYWORDS[mainStar] || [],
      summary: `${palaceType(i + mingIndex)} ${name}에서 ${mainStar} 중심의 ${meaning} 흐름`,
    };
  });
}

function makeLuckCycles(palaces, input = {}) {
  const parsed = parseDate(input);
  const startAge = Math.max(4, Math.min(8, (parsed.month % 5) + 4));
  return palaces.slice(0, 8).map((p, i) => ({
    ageRange: `${startAge + i * 10}-${startAge + i * 10 + 9}세`,
    palace: p.name,
    mainStar: p.mainStar,
    auxiliaryStars: p.auxiliaryStars,
    fourTransform: p.fourTransform,
    meaning: p.meaning,
    summary: `${startAge + i * 10}-${startAge + i * 10 + 9}세는 ${p.name}/${p.mainStar} 흐름이 강조됩니다.`,
  }));
}

function makeYearFlow(palaces, input = {}) {
  const now = new Date();
  const baseYear = now.getFullYear();
  const parsed = parseDate(input);
  return Array.from({ length: 5 }, (_, i) => {
    const year = baseYear + i;
    const palace = palaces[(year + parsed.month + parsed.day) % palaces.length];
    return {
      year,
      palace: palace.name,
      mainStar: palace.mainStar,
      auxiliaryStars: palace.auxiliaryStars,
      fourTransform: palace.fourTransform,
      summary: `${year}년은 ${palace.name}/${palace.mainStar} 흐름이 강조됩니다.`,
    };
  });
}

function calculateZiweiCore(input = {}) {
  const palaces = buildPalaces(input);
  const byKey = Object.fromEntries(palaces.map(p => [p.key, p]));
  const deepFocus = {
    mingKeywords: byKey.ming?.keywords || [],
    wealthKeywords: byKey.wealth?.keywords || [],
    careerKeywords: byKey.career?.keywords || [],
    spouseKeywords: byKey.spouse?.keywords || [],
    focusSummary: [
      byKey.ming?.summary,
      byKey.wealth?.summary,
      byKey.career?.summary,
      byKey.spouse?.summary,
    ].filter(Boolean).join(' / '),
  };

  return {
    minggong: `${byKey.ming?.type || ''} / ${byKey.ming?.mainStar || ''}`,
    wealthPalace: `${byKey.wealth?.type || ''} / ${byKey.wealth?.mainStar || ''}`,
    careerPalace: `${byKey.career?.type || ''} / ${byKey.career?.mainStar || ''}`,
    spousePalace: `${byKey.spouse?.type || ''} / ${byKey.spouse?.mainStar || ''}`,
    summary: `${byKey.ming?.type} 명궁 / ${byKey.career?.mainStar} 관록 흐름 / ${byKey.wealth?.mainStar} 재백 흐름 / ${byKey.spouse?.mainStar} 부부 흐름`,
    palaces,
    deepFocus,
    luckCycles: makeLuckCycles(palaces, input),
    annualFlow: makeYearFlow(palaces, input),
    transforms: FOUR_TRANSFORM[getYearStem(input)] || FOUR_TRANSFORM.戊,
  };
}


function normalizePalace(p) {
  if (!p) return null;
  return {
    ...p,
    star: normalizeStarName(p.star || p.mainStar),
    mainStar: normalizeStarName(p.mainStar || p.star),
    secondaryMainStars: (p.secondaryMainStars || []).map(normalizeStarName),
    allMainStars: (p.allMainStars || [p.mainStar || p.star]).filter(Boolean).map(normalizeStarName),
    auxStars: (p.auxStars || p.auxiliaryStars || []).map(normalizeStarName),
    auxiliaryStars: (p.auxiliaryStars || p.auxStars || []).map(normalizeStarName),
    theme: p.theme || p.meaning || '',
  };
}

function calculateZiwei(input = {}) {
  const core = calculateZiweiCore(input);
  const palaces = Array.isArray(core.palaces) ? core.palaces.map(normalizePalace) : [];

  const byKey = Object.fromEntries(palaces.map((p) => [p.key, p]));
  const byName = Object.fromEntries(palaces.map((p) => [p.name, p]));
  const presentMainStars = [...new Set(palaces.flatMap(p => p.allMainStars || [p.mainStar]).filter(Boolean))];
  const missingMainStars = MAIN_STARS.filter(st => !presentMainStars.includes(st));
  const starIntegrity = {
    requiredCount: MAIN_STARS.length,
    presentCount: presentMainStars.length,
    presentMainStars,
    missingMainStars,
    hasQisha: presentMainStars.includes('칠살'),
    hasTanlang: presentMainStars.includes('탐랑'),
    ok: missingMainStars.length === 0
  };

  const lifePalace = byKey.ming || byName['명궁'] || palaces[0] || null;
  const wealthPalaceObj = byKey.wealth || byName['재백궁'] || palaces[4] || null;
  const careerPalaceObj = byKey.career || byName['관록궁'] || palaces[8] || null;
  const relationshipPalace = byKey.spouse || byName['부부궁'] || palaces[2] || null;
  const virtuePalace = byKey.virtue || byName['복덕궁'] || palaces[10] || null;
  const healthPalace = byKey.health || byName['질액궁'] || palaces[5] || null;
  const propertyPalace = byKey.property || byName['전택궁'] || palaces[9] || null;
  const travelPalace = byKey.travel || byName['천이궁'] || palaces[6] || null;

  const cycles = (core.luckCycles || core.cycles || []).map((x) => ({
    ...x,
    star: x.star || x.mainStar,
    auxStars: x.auxStars || x.auxiliaryStars || [],
    theme: x.theme || x.meaning || x.summary || '',
  }));

  const annual = (core.annualFlow || core.annual || []).map((x) => ({
    ...x,
    star: x.star || x.mainStar,
    auxStars: x.auxStars || x.auxiliaryStars || [],
    focus: x.focus || x.summary || '',
  }));

  const base = {
    ...core,
    palaces,
    starIntegrity,
    lifePalace,
    wealthPalace: wealthPalaceObj,
    careerPalace: careerPalaceObj,
    relationshipPalace,
    virtuePalace,
    healthPalace,
    propertyPalace,
    travelPalace,
    cycles,
    annual,
    domainSummary: {
      self: lifePalace?.summary || '',
      wealth: wealthPalaceObj?.summary || '',
      career: careerPalaceObj?.summary || '',
      relationship: relationshipPalace?.summary || '',
    },
    summary: core.summary || `${lifePalace?.type || ''} 명궁 / ${careerPalaceObj?.star || ''} 관록 흐름 / ${wealthPalaceObj?.star || ''} 재백 흐름 / ${relationshipPalace?.star || ''} 부부 흐름`,
  };

  return enrichZiweiExpert(base, { mode: input.ziweiMode || input.mode || 'EXPERT' });
}


module.exports = {
  calculateZiwei,
  analyzeZiwei: calculateZiwei,
  buildZiweiProfile: calculateZiwei,
};

// src/lib/birthCalculator.js
// 레지나타로썰 출생정보 기반 통합 분석기 v2
// 사주 + 확장 점성술 + 자미두수 성향 구조형 분석

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const STEM_KO = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계'
};

const ELEMENT = {
  甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토',
  庚: '금', 辛: '금', 壬: '수', 癸: '수',
  寅: '목', 卯: '목', 巳: '화', 午: '화',
  辰: '토', 戌: '토', 丑: '토', 未: '토',
  申: '금', 酉: '금', 子: '수', 亥: '수'
};

const YINYANG = {
  甲: '양', 丙: '양', 戊: '양', 庚: '양', 壬: '양',
  乙: '음', 丁: '음', 己: '음', 辛: '음', 癸: '음'
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseBirthDate(input = {}) {
  const rawDate = input.birthDate || input.birth_date || input.birth || '';
  if (!rawDate) throw new Error('birthDate가 필요합니다.');

  const [y, m, d] = String(rawDate).split('-').map(Number);
  if (!y || !m || !d) throw new Error('birthDate 형식은 YYYY-MM-DD 여야 합니다.');

  const rawTime = input.birthTime || input.birth_time || input.time || '';

  let hour = 12;
  let minute = 0;
  let timeKnown = false;

  const match = String(rawTime).match(/(\d{1,2})(?::(\d{1,2}))?/);
  if (match) {
    hour = Number(match[1]);
    minute = Number(match[2] || 0);
    timeKnown = true;
  }

  return { year: y, month: m, day: d, hour, minute, timeKnown };
}

function getGanZhi(index) {
  const i = ((index % 60) + 60) % 60;
  return {
    stem: STEMS[i % 10],
    branch: BRANCHES[i % 12],
    text: `${STEMS[i % 10]}${BRANCHES[i % 12]}`
  };
}

function getYearPillar(year) {
  return getGanZhi(year - 4);
}

function getMonthPillar(yearStem, month) {
  const branchIndex = (month + 1) % 12;
  const stemIndex = (STEMS.indexOf(yearStem) * 2 + month) % 10;
  return {
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex],
    text: `${STEMS[stemIndex]}${BRANCHES[branchIndex]}`
  };
}

function getDayPillar(year, month, day) {
  const base = new Date(Date.UTC(1984, 1, 2));
  const target = new Date(Date.UTC(year, month - 1, day));
  const diff = Math.floor((target - base) / 86400000);
  return getGanZhi(diff);
}

function getHourPillar(dayStem, hour, timeKnown) {
  if (!timeKnown) {
    return { stem: null, branch: null, text: '시각모름' };
  }

  const branchIndex = Math.floor(((hour + 1) % 24) / 2);
  const stemIndex = (STEMS.indexOf(dayStem) * 2 + branchIndex) % 10;

  return {
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex],
    text: `${STEMS[stemIndex]}${BRANCHES[branchIndex]}`
  };
}

function countElements(pillars) {
  const count = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };

  pillars.forEach(p => {
    if (!p) return;
    if (p.stem && ELEMENT[p.stem]) count[ELEMENT[p.stem]] += 1.2;
    if (p.branch && ELEMENT[p.branch]) count[ELEMENT[p.branch]] += 1;
  });

  return count;
}

function getStrongWeak(count) {
  const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]);
  return {
    strongest: sorted[0][0],
    weakest: sorted[sorted.length - 1][0]
  };
}

function getSolarSign(month, day) {
  const md = month * 100 + day;
  if (md >= 321 && md <= 419) return '양자리';
  if (md <= 520) return '황소자리';
  if (md <= 621) return '쌍둥이자리';
  if (md <= 722) return '게자리';
  if (md <= 822) return '사자자리';
  if (md <= 922) return '처녀자리';
  if (md <= 1023) return '천칭자리';
  if (md <= 1122) return '전갈자리';
  if (md <= 1221) return '사수자리';
  if (md >= 1222 || md <= 119) return '염소자리';
  if (md <= 218) return '물병자리';
  return '물고기자리';
}

function getMoonEstimate(day) {
  const types = ['감정기복형', '직관몰입형', '안정추구형', '표현강화형'];
  return types[day % types.length];
}

function getRisingEstimate(hour) {
  if (hour < 6) return '내면중심형';
  if (hour < 12) return '현실주도형';
  if (hour < 18) return '관계확장형';
  return '전략관찰형';
}

function buildAstrologyProfile(parsed) {
  return {
    sunSign: getSolarSign(parsed.month, parsed.day),
    moonEstimate: getMoonEstimate(parsed.day),
    risingEstimate: getRisingEstimate(parsed.hour),
    personalityFocus: '자아 표현 방식 / 감정 흐름 / 사회적 인상 구조 분석'
  };
}

function buildZiweiProfile(parsed) {
  const palaceTypes = ['개척형 명궁', '안정형 명궁', '변화형 명궁', '리더형 명궁'];
  const temperament = ['현실 전략형', '관계 순환형', '직감 돌파형', '축적 성장형'];

  return {
    lifePalaceEstimate: palaceTypes[(parsed.month + parsed.day) % palaceTypes.length],
    temperamentFocus: temperament[parsed.year % temperament.length],
    corePattern: '인생 운영 방식 / 사회적 포지션 / 장기 흐름 참고값'
  };
}

function getPersonalityKeywords(strongest) {
  const map = {
    목: ['성장성', '확장성', '기획력'],
    화: ['표현력', '직감', '행동성'],
    토: ['안정성', '현실감각', '지속성'],
    금: ['판단력', '기준', '통제력'],
    수: ['정보력', '유연성', '분석력']
  };

  return map[strongest] || [];
}

function buildBirthProfile(input = {}) {
  const parsed = parseBirthDate(input);

  const year = getYearPillar(parsed.year);
  const month = getMonthPillar(year.stem, parsed.month);
  const day = getDayPillar(parsed.year, parsed.month, parsed.day);
  const hour = getHourPillar(day.stem, parsed.hour, parsed.timeKnown);

  const saju = { year, month, day, hour };
  const elementBalance = countElements([year, month, day, hour]);
  const balance = getStrongWeak(elementBalance);

  const sajuSummary = {
    dayMaster: `${day.stem}${STEM_KO[day.stem]} / ${ELEMENT[day.stem]} / ${YINYANG[day.stem]}`,
    elementBalance,
    strongestElement: balance.strongest,
    weakestElement: balance.weakest
  };

  const astrology = buildAstrologyProfile(parsed);
  const ziwei = buildZiweiProfile(parsed);

  return {
    input: {
      birthDate: `${parsed.year}-${pad(parsed.month)}-${pad(parsed.day)}`,
      birthTime: parsed.timeKnown ? `${pad(parsed.hour)}:${pad(parsed.minute)}` : '시각모름',
      calendarType: input.calendarType || 'solar',
      gender: input.gender || '',
      birthPlace: input.birthPlace || ''
    },
    saju,
    sajuSummary,
    astrology,
    ziwei,
    personalityKeywords: getPersonalityKeywords(balance.strongest)
  };
}

function buildReadingContext(input = {}) {
  const p = buildBirthProfile(input);

  return `
[통합 명식 분석]

기본 정보:
- 생년월일: ${p.input.birthDate}
- 출생시간: ${p.input.birthTime}
- 성별: ${p.input.gender || '미입력'}
- 출생지: ${p.input.birthPlace || '미입력'}

사주:
- 년주: ${p.saju.year.text}
- 월주: ${p.saju.month.text}
- 일주: ${p.saju.day.text}
- 시주: ${p.saju.hour.text}
- 일간: ${p.sajuSummary.dayMaster}

오행:
- 목 ${p.sajuSummary.elementBalance.목}
- 화 ${p.sajuSummary.elementBalance.화}
- 토 ${p.sajuSummary.elementBalance.토}
- 금 ${p.sajuSummary.elementBalance.금}
- 수 ${p.sajuSummary.elementBalance.수}
- 강한 오행: ${p.sajuSummary.strongestElement}
- 약한 오행: ${p.sajuSummary.weakestElement}

자미두수:
- 명궁 추정: ${p.ziwei.lifePalaceEstimate}
- 기질 구조: ${p.ziwei.temperamentFocus}
- 핵심 흐름: ${p.ziwei.corePattern}

점성술:
- 태양 별자리: ${p.astrology.sunSign}
- 감정 구조: ${p.astrology.moonEstimate}
- 사회적 인상: ${p.astrology.risingEstimate}
- 해석 포인트: ${p.astrology.personalityFocus}

핵심 성향 키워드:
- ${p.personalityKeywords.join(', ')}
`.trim();
}

function buildLotteryContext(input = {}) {
  const p = buildBirthProfile(input);

  return `
[복권/재물운 통합 분석]

사주 재물 구조:
- 강한 오행: ${p.sajuSummary.strongestElement}
- 약한 오행: ${p.sajuSummary.weakestElement}

자미두수 흐름:
- ${p.ziwei.lifePalaceEstimate}
- ${p.ziwei.temperamentFocus}

점성술 흐름:
- 태양 별자리: ${p.astrology.sunSign}
- 행동 패턴: ${p.astrology.risingEstimate}

출력 지침:
- 이번 달 복권 구매 추천일 3개
- 소액 기준
- 과소비 금지
- 재물 흐름 참고형
`.trim();
}

module.exports = {
  buildBirthProfile,
  buildReadingContext,
  buildLotteryContext
};

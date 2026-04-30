// src/lib/birthCalculator.js
// 레지나타로썰 출생정보 기반 자동 분석 보조 계산기
// 1차 버전: 사주 기본 계산 + 성향/복권 프롬프트용 요약 생성
// 자미두수/점성술은 이후 정밀 계산 모듈로 확장 가능

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const STEM_KO = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계'
};

const BRANCH_KO = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해'
};

const ELEMENT = {
  甲: '목', 乙: '목',
  丙: '화', 丁: '화',
  戊: '토', 己: '토',
  庚: '금', 辛: '금',
  壬: '수', 癸: '수',

  寅: '목', 卯: '목',
  巳: '화', 午: '화',
  辰: '토', 戌: '토', 丑: '토', 未: '토',
  申: '금', 酉: '금',
  子: '수', 亥: '수'
};

const YINYANG = {
  甲: '양', 丙: '양', 戊: '양', 庚: '양', 壬: '양',
  乙: '음', 丁: '음', 己: '음', 辛: '음', 癸: '음'
};

const HIDDEN_STEMS = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '戊', '庚'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲']
};

const ELEMENT_RELATION = {
  목: { generates: '화', controls: '토', controlledBy: '금', generatedBy: '수' },
  화: { generates: '토', controls: '금', controlledBy: '수', generatedBy: '목' },
  토: { generates: '금', controls: '수', controlledBy: '목', generatedBy: '화' },
  금: { generates: '수', controls: '목', controlledBy: '화', generatedBy: '토' },
  수: { generates: '목', controls: '화', controlledBy: '토', generatedBy: '금' }
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseBirthDate(input = {}) {
  const rawDate =
    input.birthDate ||
    input.birth_date ||
    input.date ||
    input.birthday ||
    '';

  if (!rawDate) throw new Error('birthDate가 필요합니다.');

  const [y, m, d] = String(rawDate).split('-').map(Number);
  if (!y || !m || !d) throw new Error('birthDate 형식은 YYYY-MM-DD 여야 합니다.');

  const rawTime =
    input.birthTime ||
    input.birth_time ||
    input.time ||
    '';

  let hour = 12;
  let minute = 0;
  let timeKnown = false;

  if (rawTime && rawTime !== 'unknown' && rawTime !== '모름') {
    const [hh, mm] = String(rawTime).split(':').map(Number);
    if (Number.isFinite(hh)) {
      hour = hh;
      minute = Number.isFinite(mm) ? mm : 0;
      timeKnown = true;
    }
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

function getYearPillar(year, month, day) {
  // 간이 입춘 기준: 2월 4일 전이면 전년도 간지 적용
  const adjustedYear = month < 2 || (month === 2 && day < 4) ? year - 1 : year;
  return getGanZhi(adjustedYear - 4);
}

function getMonthBranchIndex(month, day) {
  // 절기 기준 간이값
  // 寅월 약 2/4 시작
  const starts = [
    { m: 2, d: 4, b: 2 },
    { m: 3, d: 6, b: 3 },
    { m: 4, d: 5, b: 4 },
    { m: 5, d: 6, b: 5 },
    { m: 6, d: 6, b: 6 },
    { m: 7, d: 7, b: 7 },
    { m: 8, d: 8, b: 8 },
    { m: 9, d: 8, b: 9 },
    { m: 10, d: 8, b: 10 },
    { m: 11, d: 7, b: 11 },
    { m: 12, d: 7, b: 0 },
    { m: 1, d: 6, b: 1 }
  ];

  let branch = 1; // 기본 丑월
  for (const s of starts) {
    if (month > s.m || (month === s.m && day >= s.d)) {
      branch = s.b;
    }
  }

  if (month === 1 && day < 6) branch = 0; // 전년도 子월
  return branch;
}

function getMonthPillar(yearStem, month, day) {
  const branchIndex = getMonthBranchIndex(month, day);

  const firstMonthStemByYearStem = {
    甲: 2, 己: 2,
    乙: 4, 庚: 4,
    丙: 6, 辛: 6,
    丁: 8, 壬: 8,
    戊: 0, 癸: 0
  };

  const startStemIndex = firstMonthStemByYearStem[yearStem] ?? 2;
  const monthOffsetFromIn = ((branchIndex - 2) + 12) % 12;
  const stemIndex = (startStemIndex + monthOffsetFromIn) % 10;

  return {
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex],
    text: `${STEMS[stemIndex]}${BRANCHES[branchIndex]}`
  };
}

function daysBetweenUTC(y1, m1, d1, y2, m2, d2) {
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((b - a) / 86400000);
}

function getDayPillar(year, month, day) {
  // 기준일: 1984-02-02 = 甲子일로 두는 간이 계산
  const diff = daysBetweenUTC(1984, 2, 2, year, month, day);
  return getGanZhi(diff);
}

function getHourBranchIndex(hour) {
  if (hour === 23 || hour === 0) return 0;
  if (hour >= 1 && hour < 3) return 1;
  if (hour >= 3 && hour < 5) return 2;
  if (hour >= 5 && hour < 7) return 3;
  if (hour >= 7 && hour < 9) return 4;
  if (hour >= 9 && hour < 11) return 5;
  if (hour >= 11 && hour < 13) return 6;
  if (hour >= 13 && hour < 15) return 7;
  if (hour >= 15 && hour < 17) return 8;
  if (hour >= 17 && hour < 19) return 9;
  if (hour >= 19 && hour < 21) return 10;
  return 11;
}

function getHourPillar(dayStem, hour, timeKnown) {
  if (!timeKnown) {
    return {
      stem: null,
      branch: null,
      text: '시각모름'
    };
  }

  const branchIndex = getHourBranchIndex(hour);

  const firstHourStemByDayStem = {
    甲: 0, 己: 0,
    乙: 2, 庚: 2,
    丙: 4, 辛: 4,
    丁: 6, 壬: 6,
    戊: 8, 癸: 8
  };

  const startStemIndex = firstHourStemByDayStem[dayStem] ?? 0;
  const stemIndex = (startStemIndex + branchIndex) % 10;

  return {
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex],
    text: `${STEMS[stemIndex]}${BRANCHES[branchIndex]}`
  };
}

function getTenGod(dayStem, targetStem) {
  if (!dayStem || !targetStem) return '';

  const dayElement = ELEMENT[dayStem];
  const targetElement = ELEMENT[targetStem];
  const samePolarity = YINYANG[dayStem] === YINYANG[targetStem];

  if (targetElement === dayElement) return samePolarity ? '비견' : '겁재';
  if (ELEMENT_RELATION[dayElement].generates === targetElement) return samePolarity ? '식신' : '상관';
  if (ELEMENT_RELATION[dayElement].controls === targetElement) return samePolarity ? '편재' : '정재';
  if (ELEMENT_RELATION[dayElement].controlledBy === targetElement) return samePolarity ? '편관' : '정관';
  if (ELEMENT_RELATION[dayElement].generatedBy === targetElement) return samePolarity ? '편인' : '정인';

  return '';
}

function countElements(pillars) {
  const count = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };

  for (const p of pillars) {
    if (!p) continue;

    if (p.stem && ELEMENT[p.stem]) count[ELEMENT[p.stem]] += 1.2;
    if (p.branch && ELEMENT[p.branch]) count[ELEMENT[p.branch]] += 1;

    if (p.branch && HIDDEN_STEMS[p.branch]) {
      for (const hs of HIDDEN_STEMS[p.branch]) {
        count[ELEMENT[hs]] += 0.25;
      }
    }
  }

  return Object.fromEntries(
    Object.entries(count).map(([k, v]) => [k, Number(v.toFixed(2))])
  );
}

function getStrongWeak(count) {
  const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]);
  return {
    strongest: sorted[0]?.[0] || '',
    weakest: sorted[sorted.length - 1]?.[0] || '',
    sorted
  };
}

function getSolarSign(month, day) {
  const md = month * 100 + day;
  if (md >= 321 && md <= 419) return '양자리';
  if (md >= 420 && md <= 520) return '황소자리';
  if (md >= 521 && md <= 621) return '쌍둥이자리';
  if (md >= 622 && md <= 722) return '게자리';
  if (md >= 723 && md <= 822) return '사자자리';
  if (md >= 823 && md <= 922) return '처녀자리';
  if (md >= 923 && md <= 1023) return '천칭자리';
  if (md >= 1024 && md <= 1122) return '전갈자리';
  if (md >= 1123 && md <= 1221) return '사수자리';
  if (md >= 1222 || md <= 119) return '염소자리';
  if (md >= 120 && md <= 218) return '물병자리';
  return '물고기자리';
}

function makeSajuSummary(saju) {
  const dayStem = saju.day.stem;
  const dayElement = ELEMENT[dayStem];
  const dayPolarity = YINYANG[dayStem];

  const tenGods = {
    yearStem: getTenGod(dayStem, saju.year.stem),
    monthStem: getTenGod(dayStem, saju.month.stem),
    dayStem: '본원',
    hourStem: saju.hour.stem ? getTenGod(dayStem, saju.hour.stem) : '시각모름'
  };

  const elementBalance = countElements([saju.year, saju.month, saju.day, saju.hour]);
  const balance = getStrongWeak(elementBalance);

  return {
    dayMaster: `${dayStem}${STEM_KO[dayStem]} / ${dayElement} / ${dayPolarity}`,
    tenGods,
    elementBalance,
    strongestElement: balance.strongest,
    weakestElement: balance.weakest,
    balanceSorted: balance.sorted
  };
}

function getPersonalityKeywords(summary) {
  const dayElement = summary.dayMaster.includes('목') ? '목'
    : summary.dayMaster.includes('화') ? '화'
    : summary.dayMaster.includes('토') ? '토'
    : summary.dayMaster.includes('금') ? '금'
    : '수';

  const base = {
    목: ['성장성', '기획력', '확장 욕구', '관계 속 발전'],
    화: ['표현력', '직감', '주목성', '빠른 반응'],
    토: ['현실감각', '안정성', '책임감', '축적형 성향'],
    금: ['판단력', '기준', '정리력', '결과 중심'],
    수: ['관찰력', '정보력', '유연성', '깊은 사고']
  };

  return base[dayElement] || [];
}

function buildBirthProfile(input = {}) {
  const parsed = parseBirthDate(input);

  const calendarType =
    input.calendarType ||
    input.calendar_type ||
    input.calendar ||
    'solar';

  const gender = input.gender || input.sex || '';
  const birthPlace = input.birthPlace || input.birth_place || input.city || '';

  const year = getYearPillar(parsed.year, parsed.month, parsed.day);
  const month = getMonthPillar(year.stem, parsed.month, parsed.day);
  const day = getDayPillar(parsed.year, parsed.month, parsed.day);
  const hour = getHourPillar(day.stem, parsed.hour, parsed.timeKnown);

  const saju = { year, month, day, hour };
  const summary = makeSajuSummary(saju);

  const astrology = {
    sunSign: getSolarSign(parsed.month, parsed.day),
    note: '현재 1차 버전은 태양 별자리 중심 간이값입니다. 정밀 점성술 차트는 추후 확장 대상입니다.'
  };

  const ziwei = {
    mode: '준비중',
    note: '자미두수 명반 자동 계산은 2차 확장 대상입니다. 현재는 사주 기반 성향 분석을 우선 자동화합니다.'
  };

  return {
    input: {
      birthDate: `${parsed.year}-${pad(parsed.month)}-${pad(parsed.day)}`,
      birthTime: parsed.timeKnown ? `${pad(parsed.hour)}:${pad(parsed.minute)}` : '시각모름',
      calendarType,
      gender,
      birthPlace
    },
    saju,
    sajuSummary: summary,
    astrology,
    ziwei,
    personalityKeywords: getPersonalityKeywords(summary),
    warning:
      calendarType === 'lunar'
        ? '음력 입력값은 현재 1차 버전에서 양력 변환 없이 그대로 계산됩니다. 정밀 자동화를 위해 음양력 변환 모듈을 추가해야 합니다.'
        : ''
  };
}

function buildReadingContext(input = {}) {
  const profile = buildBirthProfile(input);
  const p = profile;

  return `
[출생정보 자동 계산 결과]

입력 정보:
- 생년월일: ${p.input.birthDate}
- 출생시간: ${p.input.birthTime}
- 달력: ${p.input.calendarType}
- 성별: ${p.input.gender || '미입력'}
- 출생지: ${p.input.birthPlace || '미입력'}

사주팔자:
- 년주: ${p.saju.year.text}
- 월주: ${p.saju.month.text}
- 일주: ${p.saju.day.text}
- 시주: ${p.saju.hour.text}

일간:
- ${p.sajuSummary.dayMaster}

십성 참고:
- 년간: ${p.sajuSummary.tenGods.yearStem}
- 월간: ${p.sajuSummary.tenGods.monthStem}
- 일간: 본원
- 시간: ${p.sajuSummary.tenGods.hourStem}

오행 분포:
- 목: ${p.sajuSummary.elementBalance.목}
- 화: ${p.sajuSummary.elementBalance.화}
- 토: ${p.sajuSummary.elementBalance.토}
- 금: ${p.sajuSummary.elementBalance.금}
- 수: ${p.sajuSummary.elementBalance.수}

강한 오행:
- ${p.sajuSummary.strongestElement}

약한 오행:
- ${p.sajuSummary.weakestElement}

성향 키워드:
- ${p.personalityKeywords.join(', ')}

점성술 참고:
- 태양 별자리: ${p.astrology.sunSign}

자미두수 참고:
- ${p.ziwei.note}

주의:
- 이 계산값은 1차 자동화용 기초값입니다.
${p.warning ? `- ${p.warning}` : ''}
`.trim();
}

function buildLotteryContext(input = {}) {
  const profile = buildBirthProfile(input);
  const strongest = profile.sajuSummary.strongestElement;
  const weakest = profile.sajuSummary.weakestElement;

  return `
[복권 구매 추천일 자동 분석 참고값]

입력 정보:
- 생년월일: ${profile.input.birthDate}
- 출생시간: ${profile.input.birthTime}
- 성별: ${profile.input.gender || '미입력'}
- 출생지: ${profile.input.birthPlace || '미입력'}

사주팔자:
- 년주: ${profile.saju.year.text}
- 월주: ${profile.saju.month.text}
- 일주: ${profile.saju.day.text}
- 시주: ${profile.saju.hour.text}

일간:
- ${profile.sajuSummary.dayMaster}

재물 흐름 참고:
- 강한 오행: ${strongest}
- 약한 오행: ${weakest}
- 오행 분포: 목 ${profile.sajuSummary.elementBalance.목}, 화 ${profile.sajuSummary.elementBalance.화}, 토 ${profile.sajuSummary.elementBalance.토}, 금 ${profile.sajuSummary.elementBalance.금}, 수 ${profile.sajuSummary.elementBalance.수}

출력 지침:
- 이번 달 기준 복권 구매 추천일 3개를 제안합니다.
- 당첨 보장 표현은 금지합니다.
- 소액 구매, 재미, 흐름 확인용으로 안내합니다.
- 과도한 구매를 조심하라는 문장을 반드시 포함합니다.
`.trim();
}

module.exports = {
  buildBirthProfile,
  buildReadingContext,
  buildLotteryContext
};

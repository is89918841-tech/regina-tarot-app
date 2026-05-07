const { analyzeSaju } = require('./saju');
const { analyzeZiwei } = require('./ziwei');
const { analyzeAstrology } = require('./astrology');
const { buildTimeCorrection, applyTimeCorrection } = require('./timeCorrection');
const { postProcessText, normalizeTerms } = require('./textPostProcessor');

function joinList(value) {
  return Array.isArray(value) && value.length ? value.join(', ') : '없음';
}

function normalizeZiweiStars(stars = []) {
  return (stars || []).map((x) => normalizeTerms(String(x))).join(', ') || '없음';
}

function formatDaewoon(daewoon) {
  const cycles = Array.isArray(daewoon) ? daewoon : daewoon?.cycles;
  if (!Array.isArray(cycles) || !cycles.length) return '- 자료 없음';
  const head = daewoon?.direction ? `- 방향: ${daewoon.direction} / 시작나이: ${daewoon.startAge}세 전후 / 현재나이: ${daewoon.currentAge}세` : '';
  const current = daewoon?.current ? `- 현재 대운: ${daewoon.current.ageStart}-${daewoon.current.ageEnd}세 ${daewoon.current.pillar}: ${daewoon.current.tenGod} / ${daewoon.current.theme}` : '';
  const body = cycles.slice(0, 8).map((item) => `- ${item.ageStart}-${item.ageEnd}세 ${item.pillar}: ${item.tenGod} / ${item.theme}`).join('\n');
  return [head, current, body].filter(Boolean).join('\n');
}

function formatAnnualLuck(list = []) {
  if (!Array.isArray(list) || !list.length) return '- 자료 없음';
  return list
    .slice(0, 5)
    .map((item) => `- ${item.year}년 ${item.pillar}: ${item.tenGod} / ${item.theme}`)
    .join('\n');
}


function formatZiweiPalaces(palaces = []) {
  if (!Array.isArray(palaces) || !palaces.length) return '- 자료 없음';
  return palaces
    .map((p) => `- ${p.name}: ${p.type} / ${p.mainStar || p.star} / 보조성 ${normalizeZiweiStars(p.auxStars)} / ${p.branch || '지지미상'} / ${p.theme || ''}`)
    .join('\n');
}

function formatZiweiCycles(cycles = []) {
  if (!Array.isArray(cycles) || !cycles.length) return '- 자료 없음';
  return cycles
    .map((x) => `- ${x.ageRange}: ${x.palace} / ${x.star} / 보조성 ${normalizeZiweiStars(x.auxStars)} / ${x.theme}`)
    .join('\n');
}

function formatZiweiAnnual(annual = []) {
  if (!Array.isArray(annual) || !annual.length) return '- 자료 없음';
  return annual
    .map((x) => `- ${x.year}년: ${x.palace} / ${x.star} / 보조성 ${normalizeZiweiStars(x.auxStars)} / ${x.focus || ''}`)
    .join('\n');
}

function formatZiweiExpert(expert = {}) {
  if (!expert || !expert.summary) return '- 자료 없음';
  const lines = [];
  lines.push(`- 출력모드: ${expert.mode || 'EXPERT'}`);
  lines.push(`- 핵심축: ${(expert.summary.topPalaces || []).join(', ') || '자료 없음'}`);
  lines.push(`- 귀인/보호: ${expert.summary.nobleSummary || '자료 없음'}`);
  lines.push(`- 재물/성과: ${expert.summary.wealthSummary || '자료 없음'}`);
  lines.push(`- 인연/관계: ${expert.summary.relationshipSummary || '자료 없음'}`);
  lines.push(`- 주의 포인트: ${expert.summary.cautionSummary || '자료 없음'}`);
  if (Array.isArray(expert.palaceInsights) && expert.palaceInsights.length) {
    lines.push('- 궁별 Expert 포인트:');
    expert.palaceInsights.slice(0, 12).forEach((p) => {
      const tf = p.transforms && p.transforms.length ? ` / 사화 ${p.transforms.join(', ')}` : '';
      const cautions = p.cautions && p.cautions.length ? ` / 주의 ${p.cautions.join(', ')}` : '';
      lines.push(`  · ${p.palace}: ${p.mainStar} / ${p.tone} / ${p.tags.join('·') || '기본흐름'}${tf}${cautions}`);
    });
  }
  if (Array.isArray(expert.interactions) && expert.interactions.length) {
    lines.push('- 궁간 상호작용:');
    expert.interactions.forEach((x) => lines.push(`  · ${x.pair}: ${x.meaning}`));
  }
  if (expert.note) lines.push(`- 참고: ${expert.note}`);
  return lines.join('\n');
}

function formatZiweiAnnualExpert(annual = []) {
  if (!Array.isArray(annual) || !annual.length) return '- 자료 없음';
  return annual
    .map((x) => `- ${x.year}년: ${x.palace} / ${x.star || x.mainStar || ''} / ${x.expertFocus || x.focus || ''}`)
    .join('\n');
}

function formatAstroHouses(houses = []) {
  if (!Array.isArray(houses) || !houses.length) return '- 자료 없음';
  return houses
    .map((h) => `- ${h.house}하우스: ${h.sign} / ${h.theme}`)
    .join('\n');
}

function formatAstroAspects(aspects = []) {
  if (!Array.isArray(aspects) || !aspects.length) return '- 주요 각도 없음';
  return aspects
    .map((x) => `- ${x.from}-${x.to}: ${x.aspect} (${x.degree}도)${x.meaning ? ' / ' + x.meaning : ''}`)
    .join('\n');
}


function formatAstroExpertPointMap(points = {}) {
  const keys = ['chiron','lilith','fortune','vertex'];
  const label = { chiron: '키론', lilith: '릴리스', fortune: '포춘', vertex: '버텍스' };
  const lines = keys
    .filter((k) => points[k])
    .map((k) => {
      const p = points[k];
      return `- ${label[k] || p.name}: ${p.sign} ${p.degreeText || ''} / ${p.meaning || ''}`.trim();
    });
  return lines.length ? lines.join('\n') : '- 자료 없음';
}

function formatAstroExpertAspects(aspects = []) {
  if (!Array.isArray(aspects) || !aspects.length) return '- 자료 없음';
  return aspects
    .slice(0, 15)
    .map((x) => `- ${x.from}-${x.to}: ${x.aspect} (${x.degree}도) / ${x.domain || '기본성향'} / ${x.expertMeaning || x.meaning || ''}`)
    .join('\n');
}

function formatAstroExpert(expert = {}) {
  if (!expert || !expert.mode) return '- 자료 없음';
  const lines = [];
  lines.push(`- 출력모드: ${expert.mode}`);
  lines.push(`- 강조 별자리: ${(expert.dominants?.dominantSigns || []).join(', ') || '자료 없음'}`);
  lines.push(`- 강조 원소: ${(expert.dominants?.dominantElements || []).join(', ') || '자료 없음'}`);
  lines.push(`- 강조 양식: ${(expert.dominants?.dominantModes || []).join(', ') || '자료 없음'}`);
  lines.push(`- 강조 행성: ${(expert.dominants?.dominantPlanets || []).join(', ') || '자료 없음'}`);
  lines.push(`- 역행 요약: ${expert.retrograde || '자료 없음'}`);
  if (Array.isArray(expert.stelliums) && expert.stelliums.length) {
    lines.push(`- 스텔리움: ${expert.stelliums.map((x) => x.summary).join(' / ')}`);
  } else {
    lines.push('- 스텔리움: 뚜렷한 3행성 이상 집중은 약합니다.');
  }
  lines.push('- 추가 포인트:');
  lines.push(formatAstroExpertPointMap(expert.extraPoints));
  lines.push('- Dispositor 흐름:');
  lines.push((expert.dispositorChain || []).map((x) => `  · ${x}`).join('\n') || '  · 자료 없음');
  if (expert.patterns) {
    lines.push('- 분야별 Expert 패턴:');
    lines.push(`  · 연애/관계: ${expert.patterns.love || '자료 없음'}`);
    lines.push(`  · 커리어: ${expert.patterns.career || '자료 없음'}`);
    lines.push(`  · 재물: ${expert.patterns.wealth || '자료 없음'}`);
    lines.push(`  · 심리/치유: ${expert.patterns.psyche || '자료 없음'}`);
    lines.push(`  · 영성/전환: ${expert.patterns.spirituality || '자료 없음'}`);
    lines.push(`  · 지배 구조: ${expert.patterns.dominant || '자료 없음'}`);
  }
  if (expert.note) lines.push(`- 참고: ${expert.note}`);
  return lines.join('\n');
}


function formatAstroPlanetDetail(planets = {}) {
  const keys = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northNode','southNode'];
  return keys
    .filter((key) => planets[key])
    .map((key) => {
      const p = planets[key];
      return `- ${p.name}: ${p.sign}${p.degree !== null && p.degree !== undefined ? ' ' + p.degree + '도' : ''} / ${p.element || ''} / ${p.mode || ''} / ${p.meaning || ''}`;
    })
    .join('\n');
}

function formatHiddenStems(hidden = {}, detailed = {}) {
  const label = { year: '년지', month: '월지', day: '일지', hour: '시지' };
  return ['year','month','day','hour']
    .map((key) => {
      const d = detailed?.[key];
      if (d?.branch) return `- ${label[key]}(${d.branch}): ${d.stems.map((x, i) => `${x}(${['본기','중기','여기'][i] || `${i+1}기`})`).join(', ') || '없음'}`;
      if (key === 'hour' && (!hidden[key] || !hidden[key].length)) return `- ${label[key]}: 시각모름`;
      return `- ${label[key]}: ${(hidden[key] || []).join(', ') || '없음'}`;
    })
    .join('\n');
}


function cleanShinsalName(name = '') {
  return String(name).replace(/\/년살/g, '').replace(/\((년지|일지|월지|시지)기준\)/g, '').trim();
}

function formatShinsal(shinsal = {}) {
  const list = Array.isArray(shinsal.list) ? shinsal.list : [];
  if (!list.length) return '- 주요 신살 없음';

  const categoryOrder = ['길신/귀인', '핵심신살', '주의신살', '12신살', '보조신살'];
  const lines = [];
  lines.push(`- 출력모드: ${shinsal.mode || 'EXPERT'}`);
  lines.push(`- 핵심 요약: ${shinsal.basicSummary || shinsal.coreSummary || '핵심 신살 없음'}`);
  lines.push(`- 전문가 요약: ${shinsal.summary || '주요 신살 없음'}`);
  for (const category of categoryOrder) {
    const items = list.filter((x) => x.category === category);
    if (!items.length) continue;
    lines.push(`- ${category}: ${[...new Set(items.map((x) => cleanShinsalName(x.name)))].join(', ')}`);
    for (const x of items) {
      const basis = x.basis ? ` / 기준 ${x.basis}` : '';
      const rule = x.backupRule ? ` / 룰 ${x.backupRule}` : '';
      lines.push(`  · ${String(x.name).replace('/년살', '')}: ${x.position || ''} ${x.pillar || ''}${basis}${rule} / ${x.meaning || ''}`.trimEnd());
    }
  }
  if (shinsal.note) lines.push(`- 참고: ${shinsal.note}`);
  return lines.join('\n');
}

function formatBranchRelations(relations = []) {
  if (!Array.isArray(relations) || !relations.length) return '- 특이 형충합해 구조 없음';
  return relations.map((r) => `- ${r.pair}: ${r.branches} ${r.type} / ${r.meaning}`).join('\n');
}

function buildContext(result) {
  const s = result.saju;
  const z = result.ziwei;
  const a = result.astrology;

  return `
[레지나 통합 명식 계산 결과]

기본 정보:
- 생년월일: ${result.timeCorrection?.original?.date || s.input.birthDate}
- 출생시간: ${result.timeCorrection?.original?.time || s.input.birthTime}
- 성별: ${s.input.gender || '미입력'}
- 출생지: ${s.input.birthPlace || '미입력'}
- 달력: ${s.input.calendarType}

시간 보정:
- 적용 옵션: 경도보정 ${result.timeCorrection?.options?.longitudeCorrection ? 'ON' : 'OFF'}, 진태양시 ${result.timeCorrection?.options?.trueSolarTime ? 'ON' : 'OFF'}, DST자동 ${result.timeCorrection?.options?.autoDST ? 'ON' : 'OFF'}, 자미두수시주재보정 ${result.timeCorrection?.options?.ziweiTimeCorrection ? 'ON' : 'OFF'}, ASC/MC정밀화 ${result.timeCorrection?.options?.astrologyPrecision ? 'ON' : 'OFF'}, 야자시 ${result.timeCorrection?.options?.yajasi ? 'ON' : 'OFF'}
- 출생지 좌표: ${result.timeCorrection?.location?.place || '미입력'} / 위도 ${result.timeCorrection?.location?.lat ?? '미상'} / 경도 ${result.timeCorrection?.location?.lon ?? '미상'} / 표준시 UTC+${result.timeCorrection?.location?.timezone ?? 9}
- 보정 후 계산시각: ${result.timeCorrection?.corrected?.date || s.input.birthDate} ${result.timeCorrection?.corrected?.time || s.input.birthTime}
- 사주 적용시각: ${result.timeCorrection?.saju?.date || s.input.birthDate} ${result.timeCorrection?.saju?.time || s.input.birthTime}${result.timeCorrection?.adjustments?.yajasiApplied ? ' / 야자시로 다음 일주 적용' : ''}
- 보정값: 경도 ${result.timeCorrection?.adjustments?.longitudeMinutes ?? 0}분, 균시차 ${result.timeCorrection?.adjustments?.equationOfTimeMinutes ?? 0}분, DST ${result.timeCorrection?.adjustments?.dstMinutes ?? 0}분, 총 ${result.timeCorrection?.adjustments?.totalMinutes ?? 0}분

사주:
- 년주: ${s.pillars.year.text}
- 월주: ${s.pillars.month.text}
- 일주: ${s.pillars.day.text}
- 시주: ${s.pillars.hour.text}
- 일간: ${s.dayMaster}
- 십성: 년간 ${s.tenGods.yearStem}, 월간 ${s.tenGods.monthStem}, 시간 ${s.tenGods.hourStem}
- 오행: 목 ${s.elementBalance.목}, 화 ${s.elementBalance.화}, 토 ${s.elementBalance.토}, 금 ${s.elementBalance.금}, 수 ${s.elementBalance.수}
- 강한 오행: ${s.strongestElement}
- 약한 오행: ${s.weakestElement}

지장간:
${formatHiddenStems(s.hiddenStems, s.hiddenStemsDetailed)}

사주 심화:
- 신강/신약: ${s.strength?.level || '미계산'} (점수 ${s.strength?.score ?? '미계산'})
- 신강/신약 근거: ${s.strength?.comment || '자료 없음'}
- 용신 후보: ${joinList(s.useful?.yongshin)}
- 희신 후보: ${joinList(s.useful?.heeshin)}
- 기신 후보: ${joinList(s.useful?.gishin)}
- 용신 전략: ${s.useful?.comment || '자료 없음'}
- 십성 그룹: 자기주도 ${s.tenGodGroups?.self ?? 0}, 표현 ${s.tenGodGroups?.output ?? 0}, 재물 ${s.tenGodGroups?.wealth ?? 0}, 관성 ${s.tenGodGroups?.authority ?? 0}, 인성 ${s.tenGodGroups?.resource ?? 0}
- 오행 흐름: ${s.elementFlow?.summary || '자료 없음'}
- 재물 흐름: ${s.lifeDomains?.wealth || '자료 없음'}
- 직업 흐름: ${s.lifeDomains?.career || '자료 없음'}
- 관계 흐름: ${s.lifeDomains?.relationship || '자료 없음'}
- 실행 전략: ${s.lifeDomains?.usefulStrategy || '자료 없음'}

격국 추정:
- 격국: ${s.geokguk?.estimated || '자료 없음'}
- 기준: 월지 본기 ${s.geokguk?.basisStem || '미상'} / ${s.geokguk?.monthTenGod || '미상'}
- 비고: ${s.geokguk?.note || '자료 없음'}

공망:
- ${s.gongmang?.summary || '자료 없음'}

신살:
- 핵심 요약: ${s.shinsal?.coreSummary || '자료 없음'}
- 전체 요약: ${s.shinsal?.summary || '자료 없음'}
${formatShinsal(s.shinsal)}

형충합해:
${formatBranchRelations(s.branchRelations)}

대운 추정:
${formatDaewoon(s.daewoon)}

세운 추정:
${formatAnnualLuck(s.annualLuck)}

자미두수:
- 명궁: ${z.lifePalace.type} / ${z.lifePalace.star}
- 재백궁: ${z.wealthPalace?.type || ''} / ${z.wealthPalace?.star || ''}
- 관록궁: ${z.careerPalace?.type || ''} / ${z.careerPalace?.star || ''}
- 부부궁: ${z.relationshipPalace?.type || ''} / ${z.relationshipPalace?.star || ''}
- 요약: ${z.summary}

자미두수 12궁:
${formatZiweiPalaces(z.palaces)}

자미두수 검증:
- 14주성 검증: ${z.starIntegrity?.ok ? '정상' : '누락 있음'} / 칠살 ${z.starIntegrity?.hasQisha ? '있음' : '없음'} / 탐랑 ${z.starIntegrity?.hasTanlang ? '있음' : '없음'}
- 14주성 목록: ${joinList(z.starIntegrity?.presentMainStars)}
- 누락 주성: ${joinList(z.starIntegrity?.missingMainStars)}

자미두수 심화:
- 명궁 키워드: ${joinList(z.lifePalace?.keywords)}
- 재백궁 키워드: ${joinList(z.wealthPalace?.keywords)}
- 관록궁 키워드: ${joinList(z.careerPalace?.keywords)}
- 부부궁 키워드: ${joinList(z.relationshipPalace?.keywords)}
- 복덕궁: ${z.virtuePalace?.type || ''} / ${z.virtuePalace?.mainStar || z.virtuePalace?.star || ''} / ${z.virtuePalace?.theme || ''}
- 질액궁: ${z.healthPalace?.type || ''} / ${z.healthPalace?.mainStar || z.healthPalace?.star || ''} / ${z.healthPalace?.theme || ''}
- 전택궁: ${z.propertyPalace?.type || ''} / ${z.propertyPalace?.mainStar || z.propertyPalace?.star || ''} / ${z.propertyPalace?.theme || ''}
- 천이궁: ${z.travelPalace?.type || ''} / ${z.travelPalace?.mainStar || z.travelPalace?.star || ''} / ${z.travelPalace?.theme || ''}
- 영역 요약: 명궁 ${z.domainSummary?.self || '자료 없음'} / 재백 ${z.domainSummary?.wealth || '자료 없음'} / 관록 ${z.domainSummary?.career || '자료 없음'} / 부부 ${z.domainSummary?.relationship || '자료 없음'}

자미두수 대운형 흐름:
${formatZiweiCycles(z.cycles)}

자미두수 세운형 흐름:
${formatZiweiAnnual(z.annual)}

자미두수 Expert:
${formatZiweiExpert(z.expert)}

자미두수 Expert 세운:
${formatZiweiAnnualExpert(z.expert?.annualExpert)}

점성술:
- 태양: ${a.planets.sun.sign}
- 달: ${a.planets.moon.sign}
- 상승궁: ${a.planets.asc.sign}
- MC: ${a.mc || '미상'}
- IC: ${a.ic || '미상'}
- DESC: ${a.desc || '미상'}
- 수성: ${a.planets.mercury.sign}
- 금성: ${a.planets.venus.sign}
- 화성: ${a.planets.mars.sign}
- 목성: ${a.planets.jupiter.sign}
- 토성: ${a.planets.saturn.sign}
- 천왕성: ${a.planets.uranus?.sign || '미상'}
- 해왕성: ${a.planets.neptune?.sign || '미상'}
- 명왕성: ${a.planets.pluto?.sign || '미상'}
- 북노드: ${a.planets.northNode?.sign || '미상'}
- 남노드: ${a.planets.southNode?.sign || '미상'}
- 원소 밸런스: 불 ${a.elementBalance.불}, 흙 ${a.elementBalance.흙}, 공기 ${a.elementBalance.공기}, 물 ${a.elementBalance.물}
- 양식 밸런스: 활동 ${a.modeBalance?.활동 ?? 0}, 고정 ${a.modeBalance?.고정 ?? 0}, 변동 ${a.modeBalance?.변동 ?? 0}
- 주요 흐름: ${a.houseTheme}
- 축 요약: ${a.axisSummary || '자료 없음'}
- 노드축: ${a.nodeSummary || '자료 없음'}
- 연애 패턴: ${a.lovePattern}
- 커리어 패턴: ${a.careerPattern}
- 사회성 패턴: ${a.socialPattern || '자료 없음'}
- 심층 패턴: ${a.deepPattern || '자료 없음'}

점성술 행성 상세:
${formatAstroPlanetDetail(a.planets)}

점성술 12하우스:
${formatAstroHouses(a.houses)}

점성술 주요 각도:
${formatAstroAspects(a.aspects)}

점성술 Expert:
${formatAstroExpert(a.expert)}

점성술 Expert 주요 각도:
${formatAstroExpertAspects(a.expert?.aspectExpert)}

주의:
- 사주 심화, 자미두수, 점성술은 외부 서비스 중단 대비용 백업 계산이며, 구조형 추정값입니다.
- 절기, 대운 시작 시점, 하우스/행성 각도는 정밀 천문 엔진이 아닌 내부 추정식이므로 최종 상담에서는 참고값으로 사용하세요.
`.trim();
}

function calculate(input = {}) {
  const timeCorrection = buildTimeCorrection(input);
  const sajuInput = applyTimeCorrection(input, 'saju');
  const chartInput = applyTimeCorrection(input, 'chart');
  const saju = analyzeSaju(sajuInput);
  saju.timeCorrection = timeCorrection;
  const ziwei = analyzeZiwei(timeCorrection.options.ziweiTimeCorrection ? chartInput : input, saju.parsed);
  ziwei.timeCorrection = timeCorrection;
  const astrology = analyzeAstrology(timeCorrection.options.astrologyPrecision ? chartInput : input, saju.parsed);
  astrology.timeCorrection = timeCorrection;
  const result = { timeCorrection, saju, ziwei, astrology };
  return { ...result, context: postProcessText(buildContext(result)) };
}

module.exports = { calculate };

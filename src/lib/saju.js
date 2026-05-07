const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const STEM_KO = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계'};
const ELEMENT = {甲:'목',乙:'목',丙:'화',丁:'화',戊:'토',己:'토',庚:'금',辛:'금',壬:'수',癸:'수',寅:'목',卯:'목',巳:'화',午:'화',辰:'토',戌:'토',丑:'토',未:'토',申:'금',酉:'금',子:'수',亥:'수'};
const YINYANG = {甲:'양',丙:'양',戊:'양',庚:'양',壬:'양',乙:'음',丁:'음',己:'음',辛:'음',癸:'음'};
const REL = {
  목:{generates:'화',controls:'토',controlledBy:'금',generatedBy:'수'},
  화:{generates:'토',controls:'금',controlledBy:'수',generatedBy:'목'},
  토:{generates:'금',controls:'수',controlledBy:'목',generatedBy:'화'},
  금:{generates:'수',controls:'목',controlledBy:'화',generatedBy:'토'},
  수:{generates:'목',controls:'화',controlledBy:'토',generatedBy:'금'}
};
const HIDDEN = {子:['癸'],丑:['己','癸','辛'],寅:['甲','丙','戊'],卯:['乙'],辰:['戊','乙','癸'],巳:['丙','戊','庚'],午:['丁','己'],未:['己','丁','乙'],申:['庚','壬','戊'],酉:['辛'],戌:['戊','辛','丁'],亥:['壬','甲']};
const ELEMENT_LABEL = {목:'성장·기획·확장',화:'표현·직감·활동',토:'안정·축적·현실',금:'판단·기준·정리',수:'정보·유연·지혜'};
const PALACE_LABELS = {year:'년주',month:'월주',day:'일주',hour:'시주'};
const CLASH = {子:'午',丑:'未',寅:'申',卯:'酉',辰:'戌',巳:'亥',午:'子',未:'丑',申:'寅',酉:'卯',戌:'辰',亥:'巳'};
const SIX_COMBINE = {子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午'};
const HARM = {子:'未',未:'子',丑:'午',午:'丑',寅:'巳',巳:'寅',卯:'辰',辰:'卯',申:'亥',亥:'申',酉:'戌',戌:'酉'};
const BREAK = {子:'酉',酉:'子',丑:'辰',辰:'丑',寅:'亥',亥:'寅',卯:'午',午:'卯',巳:'申',申:'巳',未:'戌',戌:'未'};
const PUNISH_GROUPS = [['寅','巳','申'], ['丑','戌','未'], ['子','卯']];
const VOID_BY_DECADE = [['戌','亥'], ['申','酉'], ['午','未'], ['辰','巳'], ['寅','卯'], ['子','丑']];
const { calculateShinsal } = require('./sajuShinsal');

function pad(n){return String(n).padStart(2,'0');}
function mod(n,m){return ((n%m)+m)%m;}

function parseBirth(input={}){
  const raw = input.birthDate || input.birth_date || input.date || '';
  const [year,month,day] = String(raw).split('-').map(Number);
  if(!year||!month||!day) throw new Error('birthDate는 YYYY-MM-DD 형식이어야 합니다.');
  const t = input.birthTime || input.birth_time || input.time || '';
  let hour = 12, minute = 0, timeKnown = false;
  if(t && !['unknown','모름','시각모름'].includes(String(t))){
    const m = String(t).match(/(\d{1,2})(?::(\d{1,2}))?/);
    if(m){ hour = Number(m[1]); minute = Number(m[2]||0); timeKnown = true; }
  }
  return {year,month,day,hour,minute,timeKnown};
}

function gz(index){ const i=((index%60)+60)%60; return {stem:STEMS[i%10],branch:BRANCHES[i%12],text:`${STEMS[i%10]}${BRANCHES[i%12]}`,index:i}; }
function gzIndex(stem, branch){ for(let i=0;i<60;i++){ if(STEMS[i%10]===stem && BRANCHES[i%12]===branch) return i; } return 0; }
function yearPillar(y,m,d){ const ay = m<2 || (m===2 && d<4) ? y-1 : y; return gz(ay-4); }
function monthBranchIndex(m,d){
  // 절기 기준 월지 백업 계산
  // 인월: 입춘(2/4)부터, 묘월: 경칩(3/6)부터 ... 축월: 소한(1/6)부터
  const md = m * 100 + d;
  if (md >= 1207) return 0; // 子
  if (md >= 1107) return 11; // 亥
  if (md >= 1008) return 10; // 戌
  if (md >= 908) return 9; // 酉
  if (md >= 808) return 8; // 申
  if (md >= 707) return 7; // 未
  if (md >= 606) return 6; // 午
  if (md >= 506) return 5; // 巳
  if (md >= 405) return 4; // 辰
  if (md >= 306) return 3; // 卯
  if (md >= 204) return 2; // 寅
  if (md >= 106) return 1; // 丑
  return 0;
}
function monthPillar(yearStem,m,d){
  const start={甲:2,己:2,乙:4,庚:4,丙:6,辛:6,丁:8,壬:8,戊:0,癸:0}[yearStem] ?? 2;
  const bi=monthBranchIndex(m,d);
  const off=((bi-2)+12)%12;
  const si=(start+off)%10;
  const obj = {stem:STEMS[si],branch:BRANCHES[bi],text:`${STEMS[si]}${BRANCHES[bi]}`}; obj.index = gzIndex(obj.stem, obj.branch); return obj;
}
function dayPillar(y,m,d){ const diff=Math.floor((Date.UTC(y,m-1,d)-Date.UTC(1984,1,2))/86400000); return gz(diff + 2); }
function hourBranch(hour){ if(hour===23||hour===0)return 0; return Math.min(11, Math.floor((hour+1)/2)); }
function hourPillar(dayStem,h,timeKnown){
  if(!timeKnown) return {stem:null,branch:null,text:'시각모름',index:null};
  const start={甲:0,己:0,乙:2,庚:2,丙:4,辛:4,丁:6,壬:6,戊:8,癸:8}[dayStem]??0;
  const bi=hourBranch(h);
  const si=(start+bi)%10;
  const obj = {stem:STEMS[si],branch:BRANCHES[bi],text:`${STEMS[si]}${BRANCHES[bi]}`}; obj.index = gzIndex(obj.stem, obj.branch); return obj;
}

function tenGod(dayStem,targetStem){
  if(!dayStem||!targetStem)return '';
  const de=ELEMENT[dayStem], te=ELEMENT[targetStem], same=YINYANG[dayStem]===YINYANG[targetStem];
  if(te===de)return same?'비견':'겁재';
  if(REL[de].generates===te)return same?'식신':'상관';
  if(REL[de].controls===te)return same?'편재':'정재';
  if(REL[de].controlledBy===te)return same?'편관':'정관';
  if(REL[de].generatedBy===te)return same?'편인':'정인';
  return '';
}

function countElements(pillars){
  const c={목:0,화:0,토:0,금:0,수:0};
  for(const p of pillars){
    if(!p)continue;
    if(p.stem&&ELEMENT[p.stem])c[ELEMENT[p.stem]]+=1.2;
    if(p.branch&&ELEMENT[p.branch])c[ELEMENT[p.branch]]+=1;
    if(p.branch&&HIDDEN[p.branch]) for(const hs of HIDDEN[p.branch]) c[ELEMENT[hs]]+=0.25;
  }
  return Object.fromEntries(Object.entries(c).map(([k,v])=>[k,Number(v.toFixed(2))]));
}

function collectTenGods(dayStem, pillars){
  const count={비견:0,겁재:0,식신:0,상관:0,편재:0,정재:0,편관:0,정관:0,편인:0,정인:0};
  for(const p of pillars){
    if(!p) continue;
    if(p.stem){ const tg=tenGod(dayStem,p.stem); if(count[tg]!==undefined) count[tg]+=1.2; }
    if(p.branch && HIDDEN[p.branch]){
      HIDDEN[p.branch].forEach((hs,idx)=>{ const tg=tenGod(dayStem,hs); if(count[tg]!==undefined) count[tg]+=idx===0?0.55:0.25; });
    }
  }
  return Object.fromEntries(Object.entries(count).map(([k,v])=>[k,Number(v.toFixed(2))]));
}

function groupTenGods(tenGodBalance){
  const groups={self:0,output:0,wealth:0,authority:0,resource:0};
  groups.self = (tenGodBalance.비견||0)+(tenGodBalance.겁재||0);
  groups.output = (tenGodBalance.식신||0)+(tenGodBalance.상관||0);
  groups.wealth = (tenGodBalance.편재||0)+(tenGodBalance.정재||0);
  groups.authority = (tenGodBalance.편관||0)+(tenGodBalance.정관||0);
  groups.resource = (tenGodBalance.편인||0)+(tenGodBalance.정인||0);
  return Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,Number(v.toFixed(2))]));
}

function branchStrengthEffect(dayElement, branch, extraWeight){
  const be = ELEMENT[branch];
  if(!be || !REL[dayElement] || !extraWeight) return 0;
  if(be === dayElement) return 1.0 * extraWeight;
  if(be === REL[dayElement].generatedBy) return 0.85 * extraWeight;
  if(be === REL[dayElement].generates) return -0.8 * extraWeight;
  if(be === REL[dayElement].controls) return -0.9 * extraWeight;
  if(be === REL[dayElement].controlledBy) return -1.0 * extraWeight;
  return 0;
}

function hiddenRootScore(dayElement, branch, branchWeight){
  if(!branch || !HIDDEN[branch]) return {score:0, details:[]};
  const resourceElement = REL[dayElement].generatedBy;
  const weights = [0.55, 0.28, 0.17];
  let score = 0;
  const details = [];
  HIDDEN[branch].forEach((stem, idx) => {
    const element = ELEMENT[stem];
    const base = (weights[idx] || 0.12) * branchWeight;
    if(element === dayElement){
      const v = base;
      score += v;
      details.push(`${stem}${branch} 비겁근 +${v.toFixed(2)}`);
    } else if(element === resourceElement){
      const v = base * 0.65;
      score += v;
      details.push(`${stem}${branch} 인성근 +${v.toFixed(2)}`);
    }
  });
  return {score, details};
}

function analyzeRootAndStemSupport(dayStem, pillars){
  const dayElement = ELEMENT[dayStem];
  const resourceElement = REL[dayElement].generatedBy;
  // v13.6.2 Month Root Priority: 월지는 최중요, 일지는 보조 핵심, 시지/년지는 보조로 낮춤
  const branchWeights = {month:1.0, day:0.7, hour:0.4, year:0.25};
  const pillarLabels = {year:'년지', month:'월지', day:'일지', hour:'시지'};
  const rootDetails = [];
  let rootScore = 0;
  for(const key of ['month','day','hour','year']){
    const p = pillars?.[key];
    if(!p?.branch) continue;
    const r = hiddenRootScore(dayElement, p.branch, branchWeights[key] || 0.25);
    if(r.score){
      rootScore += r.score;
      rootDetails.push(`${pillarLabels[key]} ${p.branch} 통근 ${r.score.toFixed(2)} (${r.details.join(', ')})`);
    }
  }

  const stemWeights = {month:0.35, hour:0.28, year:0.22};
  const stemLabels = {year:'년간', month:'월간', hour:'시간'};
  const stemDetails = [];
  let stemScore = 0;
  for(const key of ['month','hour','year']){
    const p = pillars?.[key];
    if(!p?.stem) continue;
    const element = ELEMENT[p.stem];
    if(element === dayElement){
      const v = stemWeights[key] || 0.2;
      stemScore += v;
      stemDetails.push(`${stemLabels[key]} ${p.stem} 비겁 투간 +${v.toFixed(2)}`);
    } else if(element === resourceElement){
      const v = (stemWeights[key] || 0.2) * 0.75;
      stemScore += v;
      stemDetails.push(`${stemLabels[key]} ${p.stem} 인성 투간 +${v.toFixed(2)}`);
    }
  }

  // 월령이 일간을 생하거나 같은 계절일 때는 실제 세력으로 보강하고,
  // 일간을 심하게 소모/극하는 계절은 과대 보정을 막기 위해 약하게 감산합니다.
  const monthBranch = pillars?.month?.branch;
  let seasonReality = 0;
  if(ELEMENT[monthBranch] === dayElement) seasonReality = 0.35;
  else if(ELEMENT[monthBranch] === resourceElement) seasonReality = 0.25;
  else if(ELEMENT[monthBranch] === REL[dayElement].controlledBy) seasonReality = -0.18;
  else if(ELEMENT[monthBranch] === REL[dayElement].generates) seasonReality = -0.12;

  // 조후 보정은 백업용 보수값입니다. 극단적 한난조습만 살짝 보정합니다.
  let climate = 0;
  if(['巳','午','未'].includes(monthBranch) && dayElement === '수') climate -= 0.12;
  if(['亥','子','丑'].includes(monthBranch) && dayElement === '화') climate -= 0.12;
  if(['寅','卯','辰'].includes(monthBranch) && ['화','목'].includes(dayElement)) climate += 0.08;
  if(['申','酉','戌'].includes(monthBranch) && ['금','수'].includes(dayElement)) climate += 0.08;

  // v13.6.2 Month Root Priority + Fine Tune:
  // 통근·투간을 그대로 더하면 중복 인성/비겁이 과하게 신강 쪽으로 밀릴 수 있어 감쇠율을 적용합니다.
  // 통근은 월지 중심으로 두고, 일지/시지/년지는 단계적으로 낮춰 반영합니다.
  const rootDamping = 0.40;
  const stemDamping = 0.45;
  const seasonDamping = 0.50;
  const climateDamping = 0.50;

  const adjustedRootScore = rootScore * rootDamping;
  const adjustedStemScore = stemScore * stemDamping;
  const adjustedSeasonReality = seasonReality * seasonDamping;
  const adjustedClimate = climate * climateDamping;

  const total = Number((adjustedRootScore + adjustedStemScore + adjustedSeasonReality + adjustedClimate).toFixed(2));
  const details = [];
  if(rootDetails.length) details.push(`통근 ${adjustedRootScore.toFixed(2)}(원점수 ${rootScore.toFixed(2)}×${rootDamping}): ${rootDetails.join(' / ')}`);
  if(stemDetails.length) details.push(`투간 ${adjustedStemScore.toFixed(2)}(원점수 ${stemScore.toFixed(2)}×${stemDamping}): ${stemDetails.join(' / ')}`);
  if(seasonReality) details.push(`월령 실세력 ${adjustedSeasonReality.toFixed(2)}(원점수 ${seasonReality.toFixed(2)}×${seasonDamping})`);
  if(climate) details.push(`조후 보정 ${adjustedClimate.toFixed(2)}(원점수 ${climate.toFixed(2)}×${climateDamping})`);
  return {
    rootScore:Number(adjustedRootScore.toFixed(2)),
    stemScore:Number(adjustedStemScore.toFixed(2)),
    rawRootScore:Number(rootScore.toFixed(2)),
    rawStemScore:Number(stemScore.toFixed(2)),
    seasonReality:Number(adjustedSeasonReality.toFixed(2)),
    rawSeasonReality:Number(seasonReality.toFixed(2)),
    climate:Number(adjustedClimate.toFixed(2)),
    rawClimate:Number(climate.toFixed(2)),
    total,
    details,
    damping:{ root:rootDamping, stem:stemDamping, season:seasonDamping, climate:climateDamping }
  };
}

function analyzeDayStrength(dayElement, elementBalance, monthBranch, dayBranch, pillarMap){
  const support = (elementBalance[dayElement]||0) + (elementBalance[REL[dayElement].generatedBy]||0) * 0.85;
  const drain = (elementBalance[REL[dayElement].generates]||0) * 0.8 + (elementBalance[REL[dayElement].controls]||0) * 0.9 + (elementBalance[REL[dayElement].controlledBy]||0) * 1.0;

  // v13.5 Strength Balance Patch
  const monthWeight = 1.4;
  const dayWeight = 1.2;
  const monthBranchBoost = branchStrengthEffect(dayElement, monthBranch, monthWeight - 1);
  const dayBranchBoost = branchStrengthEffect(dayElement, dayBranch, dayWeight - 1);

  const seasonalBoost = ELEMENT[monthBranch]===dayElement ? 1.2 : ELEMENT[monthBranch]===REL[dayElement].generatedBy ? 0.8 : 0;

  // v13.6 Expert Strength Patch: 통근·투간·월령 실세력·조후 보정
  const expert = analyzeRootAndStemSupport(pillarMap?.day?.stem || '', pillarMap || {});

  const strengthBoost = Number((seasonalBoost + monthBranchBoost + dayBranchBoost + expert.total).toFixed(2));
  const score = Number((support + strengthBoost - drain).toFixed(2));
  let level='중화';
  if(score>=2.2) level='신강';
  else if(score<=-2.2) level='신약';
  else if(score>=1.6) level='중화신강';
  else if(score>=0.8) level='약간 신강';
  else if(score<=-0.8) level='약간 신약';
  const expertText = expert.details.length ? `, 통근·투간 감쇠 보정 ${expert.total.toFixed(2)} (${expert.details.join('; ')})` : ', 통근·투간 보정 0.00';
  return {
    score,
    level,
    support:Number(support.toFixed(2)),
    drain:Number(drain.toFixed(2)),
    seasonalBoost,
    monthBranchBoost:Number(monthBranchBoost.toFixed(2)),
    dayBranchBoost:Number(dayBranchBoost.toFixed(2)),
    expertStrength:expert,
    strengthBoost,
    weightNote:'v13.6.2: 월지 1.4배, 일지 1.2배 + 월지 중심 통근 재가중 + 통근·투간 감쇠 보정 적용',
    comment:`일간 보조 기운 ${support.toFixed(2)}, 소모/극 기운 ${drain.toFixed(2)}, 월지 계절 보정 ${seasonalBoost}, 월지 추가 보정 ${monthBranchBoost.toFixed(2)}, 일지 추가 보정 ${dayBranchBoost.toFixed(2)}${expertText}을 합산한 실전형 구조 점수입니다.`
  };
}

function chooseUsefulElements(dayElement, strength, elementBalance){
  const genBy=REL[dayElement].generatedBy;
  const output=REL[dayElement].generates;
  const wealth=REL[dayElement].controls;
  const officer=REL[dayElement].controlledBy;
  let yong=[], hui=[], avoid=[];
  if(strength.level.includes('신강')){
    yong=[output,wealth,officer];
    hui=[elementBalance[output] < elementBalance[wealth] ? output : wealth];
    avoid=[dayElement,genBy];
  } else if(strength.level.includes('신약')){
    yong=[genBy,dayElement];
    hui=[genBy];
    avoid=[wealth,officer,output];
  } else {
    const sorted=Object.entries(elementBalance).sort((a,b)=>a[1]-b[1]);
    yong=[sorted[0][0], sorted[1][0]];
    hui=[output,wealth].filter(Boolean).slice(0,1);
    avoid=[Object.entries(elementBalance).sort((a,b)=>b[1]-a[1])[0][0]];
  }
  const uniq = arr => [...new Set(arr)].filter(Boolean);
  return {
    yongshin: uniq(yong),
    heeshin: uniq(hui),
    gishin: uniq(avoid),
    comment: strength.level.includes('신강')
      ? '기운이 강한 편이라 표현·재성·관성으로 흐르게 할수록 현실 성과가 좋아집니다.'
      : strength.level.includes('신약')
        ? '기운을 먼저 보강한 뒤 움직여야 하므로 인성·비겁의 지지와 루틴이 중요합니다.'
        : '중화권 구조라 부족한 오행을 보완하고 과한 오행을 조절하는 균형형 운용이 좋습니다.'
  };
}

function analyzeFiveElementFlow(dayElement, elementBalance){
  const sorted=Object.entries(elementBalance).sort((a,b)=>b[1]-a[1]);
  const strongest=sorted[0]?.[0]||'';
  const weakest=sorted[sorted.length-1]?.[0]||'';
  const missing=Object.entries(elementBalance).filter(([,v])=>v<=0.3).map(([k])=>k);
  return {
    strongest, weakest, missing,
    strongestMeaning: ELEMENT_LABEL[strongest] || '',
    weakestMeaning: ELEMENT_LABEL[weakest] || '',
    flowSummary:`${strongest} 기운이 앞서고 ${weakest} 기운이 약해, ${ELEMENT_LABEL[strongest]||'강한 영역'}은 잘 드러나지만 ${ELEMENT_LABEL[weakest]||'약한 영역'}은 의식적으로 보완하는 편이 좋습니다.`,
    summary:`${strongest} 기운이 앞서고 ${weakest} 기운이 약해, ${ELEMENT_LABEL[strongest]||'강한 영역'}은 잘 드러나지만 ${ELEMENT_LABEL[weakest]||'약한 영역'}은 의식적으로 보완하는 편이 좋습니다.`
  };
}

function analyzeLifeDomains(dayElement, groups, useful){
  const topGroup=Object.entries(groups).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  const domainMap={self:'자기주도/독립성',output:'표현/콘텐츠/기술',wealth:'돈/성과/현실감각',authority:'직책/규칙/책임',resource:'공부/자격/보호'};
  const wealthPower=groups.wealth;
  const careerPower=groups.authority + groups.output*0.45;
  const studyPower=groups.resource;
  const relationshipPower=groups.authority + groups.wealth*0.35;
  return {
    dominant:`${domainMap[topGroup]||'균형형'} 기운이 두드러집니다.`,
    wealth: wealthPower>=2.2 ? '재성 흐름이 살아 있어 돈·성과·거래 감각을 현실적으로 쓰기 좋습니다.' : wealthPower>=1 ? '재성은 보통 이상이라 작은 성과를 꾸준히 쌓는 방식이 유리합니다.' : '재성은 약한 편이라 큰 한방보다 구조와 관리가 중요합니다.',
    career: careerPower>=2.5 ? '관성/식상 흐름이 있어 직업적으로 책임과 실무 성과를 함께 만드는 쪽이 좋습니다.' : '커리어는 무리한 확장보다 역할 정리와 지속성이 중요합니다.',
    study: studyPower>=2 ? '인성 흐름이 있어 공부·문서·자격·전문성 축적이 도움이 됩니다.' : '공부운은 필요할 때 집중형으로 쓰는 편이며, 실전 경험과 함께 배울수록 좋습니다.',
    relationship: relationshipPower>=2 ? '관계에서는 책임감과 현실 조건을 함께 보는 경향이 강합니다.' : '관계에서는 감정 표현과 안정감을 의식적으로 보완하는 편이 좋습니다.',
    usefulStrategy:`용신 후보 ${useful.yongshin.join(', ')}을 살리는 선택이 좋고, 기신 후보 ${useful.gishin.join(', ')}이 과해질 때는 속도와 욕심을 줄이는 편이 안전합니다.`
  };
}

const SOLAR_TERMS_FOR_DAEWOON = [
  { name:'소한', month:1, day:6 },
  { name:'입춘', month:2, day:4 },
  { name:'경칩', month:3, day:6 },
  { name:'청명', month:4, day:5 },
  { name:'입하', month:5, day:6 },
  { name:'망종', month:6, day:6 },
  { name:'소서', month:7, day:7 },
  { name:'입추', month:8, day:8 },
  { name:'백로', month:9, day:8 },
  { name:'한로', month:10, day:8 },
  { name:'입동', month:11, day:7 },
  { name:'대설', month:12, day:7 }
];

function termDate(year, term){
  return new Date(Date.UTC(year, term.month - 1, term.day, 12, 0, 0));
}
function birthDateUTC(parsed){
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour || 12, parsed.minute || 0, 0));
}
function nearestSolarTermForDaewoon(parsed, forward){
  const birth = birthDateUTC(parsed);
  const candidates = [];
  for(const y of [parsed.year - 1, parsed.year, parsed.year + 1]){
    for(const term of SOLAR_TERMS_FOR_DAEWOON){
      candidates.push({ ...term, date: termDate(y, term), year: y });
    }
  }
  candidates.sort((a,b)=>a.date-b.date);
  if(forward) return candidates.find(t => t.date > birth) || candidates[candidates.length-1];
  for(let i=candidates.length-1;i>=0;i--){
    if(candidates[i].date < birth) return candidates[i];
  }
  return candidates[0];
}
function calculateDaewoonStartAge(parsed, forward){
  const birth = birthDateUTC(parsed);
  const term = nearestSolarTermForDaewoon(parsed, forward);
  const diffDays = Math.abs(term.date - birth) / 86400000;
  const startAge = Math.max(1, Math.round(diffDays / 3));
  return { startAge, basisTerm: term.name, basisDays: Number(diffDays.toFixed(2)) };
}
function currentFullAge(parsed, refDate = new Date()){
  const y = refDate.getFullYear();
  const m = refDate.getMonth() + 1;
  const d = refDate.getDate();
  let age = y - parsed.year;
  if(m < parsed.month || (m === parsed.month && d < parsed.day)) age -= 1;
  return Math.max(0, age);
}
function buildDaewoon(parsed, month, yearStem, gender, dayStem){
  const isYangYear = YINYANG[yearStem] === '양';
  const isFemale = String(gender||'').toLowerCase().includes('female') || String(gender||'').includes('여');
  const forward = (isYangYear && !isFemale) || (!isYangYear && isFemale);
  const startInfo = calculateDaewoonStartAge(parsed, forward);
  const startAge = startInfo.startAge;
  const age = currentFullAge(parsed);
  const baseIndex = month.index ?? gzIndex(month.stem, month.branch);
  const cycles=[];
  for(let i=0;i<8;i++){
    const ageStart=startAge+i*10;
    const idx = forward ? baseIndex+i+1 : baseIndex-i-1;
    const pillar = gz(idx);
    const tg = tenGod(dayStem, pillar.stem);
    cycles.push({order:i+1,ageStart,ageEnd:ageStart+9,pillar: pillar.text,stem:pillar.stem,branch:pillar.branch,tenGod:tg,element:ELEMENT[pillar.stem]||ELEMENT[pillar.branch],theme:annualTheme(tg)});
  }
  const current = cycles.find(c=>age>=c.ageStart && age<=c.ageEnd) || cycles[0];
  return {mode:'solar-term-estimate',direction:forward?'순행':'역행',startAge,startBasis:startInfo,currentAge:age,current,cycles,note:'절기 일수÷3 방식의 근사 대운입니다. 실제 절입 시각까지 반영하면 시작 개월 수는 달라질 수 있습니다.'};
}

function buildAnnualLuck(parsed, dayStem){
  const currentYear = new Date().getFullYear();
  const years=[];
  for(let y=currentYear; y<currentYear+5; y++){
    const p=yearPillar(y,7,1);
    const tg=tenGod(dayStem,p.stem);
    years.push({year:y,pillar:p.text,tenGod:tg,element:ELEMENT[p.stem],theme:annualTheme(tg)});
  }
  return years;
}
function annualTheme(tg){
  if(['편재','정재'].includes(tg)) return '돈·거래·성과·현실 선택';
  if(['식신','상관'].includes(tg)) return '표현·기술·콘텐츠·활동성';
  if(['편관','정관'].includes(tg)) return '직업·책임·압박·제도권';
  if(['편인','정인'].includes(tg)) return '공부·자격·문서·보호';
  if(['비견','겁재'].includes(tg)) return '자기주도·경쟁·독립성';
  return '일반 흐름';
}


function analyzeGongmang(day){
  const decade = Math.floor(((day.index ?? gzIndex(day.stem, day.branch)) || 0) / 10);
  const branches = VOID_BY_DECADE[decade] || [];
  return {decadeIndex:decade,branches,summary:`${day.text} 기준 공망은 ${branches.join('·')}입니다.`};
}


function buildHiddenStemsDetailed(pillarMap){
  const labels = {year:'년지', month:'월지', day:'일지', hour:'시지'};
  const roleByLength = {
    1:['본기'],
    2:['본기','중기'],
    3:['본기','중기','여기']
  };
  const out = {};
  for(const key of ['year','month','day','hour']){
    const branch = pillarMap?.[key]?.branch || null;
    const stems = branch ? (HIDDEN[branch] || []) : [];
    const roles = roleByLength[stems.length] || ['본기','중기','여기'];
    out[key] = {
      label: labels[key],
      branch,
      stems,
      formatted: branch ? `${labels[key]}(${branch}): ${stems.map((x,i)=>`${x}(${roles[i] || `${i+1}기`})`).join(', ') || '없음'}` : `${labels[key]}: 시각모름`,
      note: branch ? `${branch} 지장간 ${stems.join(', ') || '없음'}` : '출생시간 미입력으로 시지 지장간 없음'
    };
  }
  return out;
}
function analyzeBranchRelations(pillarMap){
  const keys=['year','month','day','hour'];
  const out=[];
  for(let i=0;i<keys.length;i++) for(let j=i+1;j<keys.length;j++){
    const a=pillarMap[keys[i]], b=pillarMap[keys[j]];
    if(!a?.branch || !b?.branch) continue;
    const pair=`${PALACE_LABELS[keys[i]]}-${PALACE_LABELS[keys[j]]}`;
    if(CLASH[a.branch]===b.branch) out.push({type:'충',pair,branches:`${a.branch}${b.branch}`,meaning:'변동·충돌·이동성'});
    if(SIX_COMBINE[a.branch]===b.branch) out.push({type:'합',pair,branches:`${a.branch}${b.branch}`,meaning:'결합·타협·관계성'});
    if(HARM[a.branch]===b.branch) out.push({type:'해',pair,branches:`${a.branch}${b.branch}`,meaning:'은근한 불편·마찰'});
    if(BREAK[a.branch]===b.branch) out.push({type:'파',pair,branches:`${a.branch}${b.branch}`,meaning:'깨짐·분리·재조정'});
    for(const g of PUNISH_GROUPS){ if(g.includes(a.branch)&&g.includes(b.branch)) out.push({type:'형',pair,branches:`${a.branch}${b.branch}`,meaning:'압박·긴장·반복 패턴'}); }
  }
  return out;
}
function estimateGeokguk(dayStem, month){
  const basisStem = HIDDEN[month.branch]?.[0] || month.stem;
  const monthTenGod = tenGod(dayStem, basisStem);
  const map={비견:'건록/비겁격 계열',겁재:'양인/겁재격 계열',식신:'식신격',상관:'상관격',편재:'편재격',정재:'정재격',편관:'칠살격',정관:'정관격',편인:'편인격',정인:'정인격'};
  return {basisStem,monthTenGod,estimated:map[monthTenGod] || '잡격/혼합격',note:'월지 본기 기준의 구조형 격국 추정입니다.'};
}

function analyzeSaju(input={}){
  const parsed=parseBirth(input);
  const year=yearPillar(parsed.year,parsed.month,parsed.day);
  const month=monthPillar(year.stem,parsed.month,parsed.day);
  const day=dayPillar(parsed.year,parsed.month,parsed.day);
  const hour=hourPillar(day.stem,parsed.hour,parsed.timeKnown);
  const pillars=[year,month,day,hour];
  const pillarMap={year,month,day,hour};
  const elementBalance=countElements(pillars);
  const sorted=Object.entries(elementBalance).sort((a,b)=>b[1]-a[1]);
  const dayElement=ELEMENT[day.stem];
  const strength=analyzeDayStrength(dayElement, elementBalance, month.branch, day.branch, pillarMap);
  const useful=chooseUsefulElements(dayElement, strength, elementBalance);
  const tenGodBalance=collectTenGods(day.stem,pillars);
  const tenGodGroups=groupTenGods(tenGodBalance);
  const elementFlow=analyzeFiveElementFlow(dayElement, elementBalance);
  const lifeDomains=analyzeLifeDomains(dayElement, tenGodGroups, useful);
  const daewoon=buildDaewoon(parsed, month, year.stem, input.gender||'', day.stem);
  const annualLuck=buildAnnualLuck(parsed, day.stem);
  const gongmang=analyzeGongmang(day);
  const branchRelations=analyzeBranchRelations(pillarMap);
  const geokguk=estimateGeokguk(day.stem, month);
  const shinsal=calculateShinsal(pillarMap);
  const hiddenStems={year:HIDDEN[year.branch]||[],month:HIDDEN[month.branch]||[],day:HIDDEN[day.branch]||[],hour:hour.branch?HIDDEN[hour.branch]||[]:[]};
  const hiddenStemsDetailed = buildHiddenStemsDetailed(pillarMap);
  return {
    input:{birthDate:`${parsed.year}-${pad(parsed.month)}-${pad(parsed.day)}`,birthTime:parsed.timeKnown?`${pad(parsed.hour)}:${pad(parsed.minute)}`:'시각모름',calendarType:input.calendarType||input.calendar_type||'solar',gender:input.gender||'',birthPlace:input.birthPlace||input.birth_place||input.city||''},
    parsed,
    pillars:{year,month,day,hour},
    hiddenStems,
    hiddenStemsDetailed,
    dayMaster:`${day.stem}${STEM_KO[day.stem]} / ${dayElement} / ${YINYANG[day.stem]}`,
    tenGods:{yearStem:tenGod(day.stem,year.stem),monthStem:tenGod(day.stem,month.stem),dayStem:'본원',hourStem:hour.stem?tenGod(day.stem,hour.stem):'시각모름'},
    tenGodBalance,
    tenGodGroups,
    elementBalance,
    strongestElement:sorted[0]?.[0]||'',
    weakestElement:sorted[sorted.length-1]?.[0]||'',
    strength,
    useful,
    elementFlow,
    lifeDomains,
    daewoon,
    annualLuck,
    gongmang,
    branchRelations,
    geokguk,
    shinsal,
    note:'사주 심화 항목은 외부 만세력 중단 대비용 백업 계산입니다. 절기·대운 시작일은 추정값이므로 최종 리딩에서는 참고값으로 사용하세요.'
  };
}
module.exports={analyzeSaju,parseBirth,ELEMENT,tenGod};

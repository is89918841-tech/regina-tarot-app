// 레지나 백업 명식 계산기 v13 Phase A+ Expert - 신살 확장 모듈
// 목적: 메인 만세력 장애 시 상담용으로 충분한 신살 후보를 안정적으로 산출
// 주의: 신살은 유파별 기준표가 갈리므로 backupRule을 함께 남깁니다.

const PILLAR_LABEL = { year: '년주', month: '월주', day: '일주', hour: '시주' };
const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');

function uniqBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function baseName(name = '') {
  return String(name)
    .replace(/\/년살/g, '')
    .replace(/\((년지|일지|월지|시지)기준\)/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function getBranchPositions(pillars = {}) {
  return Object.entries(pillars)
    .filter(([, p]) => p && p.branch)
    .map(([key, p]) => ({ key, label: PILLAR_LABEL[key] || key, stem: p.stem, branch: p.branch, pillar: p.text }));
}

function getStemPositions(pillars = {}) {
  return Object.entries(pillars)
    .filter(([, p]) => p && p.stem)
    .map(([key, p]) => ({ key, label: PILLAR_LABEL[key] || key, stem: p.stem, branch: p.branch, pillar: p.text }));
}

function getPairPositions(pillars = {}) {
  const entries = Object.entries(pillars)
    .filter(([, p]) => p && p.branch)
    .map(([key, p]) => ({ key, label: PILLAR_LABEL[key] || key, stem: p.stem, branch: p.branch, pillar: p.text }));
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      out.push({ a: entries[i], b: entries[j], label: `${entries[i].label}-${entries[j].label}`, branches: `${entries[i].branch}${entries[j].branch}` });
    }
  }
  return out;
}

function add(out, item) {
  if (!item || !item.name) return;
  out.push({
    category: '보조신살',
    priority: 50,
    meaning: '신살 작용',
    backupRule: '',
    ...item,
  });
}

function addBranchMatches(out, name, basis, targetBranches, branchPositions, meaning, category = '보조신살', backupRule = '', priority = 50) {
  const targets = Array.isArray(targetBranches) ? targetBranches.filter(Boolean) : [targetBranches].filter(Boolean);
  for (const pos of branchPositions) {
    if (targets.includes(pos.branch)) {
      add(out, { name, category, priority, basis, position: pos.label, pillar: pos.pillar, target: pos.branch, meaning, backupRule });
    }
  }
}

function addStemMatches(out, name, basis, targetStems, stemPositions, meaning, category = '보조신살', backupRule = '', priority = 50) {
  const targets = Array.isArray(targetStems) ? targetStems.filter(Boolean) : [targetStems].filter(Boolean);
  for (const pos of stemPositions) {
    if (targets.includes(pos.stem)) {
      add(out, { name, category, priority, basis, position: pos.label, pillar: pos.pillar, target: pos.stem, meaning, backupRule });
    }
  }
}

function sameBranchGroup(branch) {
  if (['申', '子', '辰'].includes(branch)) return '申子辰';
  if (['寅', '午', '戌'].includes(branch)) return '寅午戌';
  if (['巳', '酉', '丑'].includes(branch)) return '巳酉丑';
  if (['亥', '卯', '未'].includes(branch)) return '亥卯未';
  return '';
}

function seasonGroup(branch) {
  if (['亥','子','丑'].includes(branch)) return '亥子丑';
  if (['寅','卯','辰'].includes(branch)) return '寅卯辰';
  if (['巳','午','未'].includes(branch)) return '巳午未';
  if (['申','酉','戌'].includes(branch)) return '申酉戌';
  return '';
}

const CHEONEUL = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  辛: ['寅', '午'],
  壬: ['卯', '巳'], 癸: ['卯', '巳']
};
const TAEGEUK = {
  甲: ['子', '午'], 乙: ['子', '午'], 丙: ['卯', '酉'], 丁: ['卯', '酉'],
  戊: ['辰', '戌', '丑', '未'], 己: ['辰', '戌', '丑', '未'],
  庚: ['寅', '亥'], 辛: ['寅', '亥'], 壬: ['巳', '申'], 癸: ['巳', '申']
};
const MUNCHANG = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
const HAKDANG = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };
const GEONROK = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const YANGIN = { 甲: '卯', 乙: '寅', 丙: '午', 丁: '巳', 戊: '午', 己: '巳', 庚: '酉', 辛: '申', 壬: '子', 癸: '亥' };
const HONGYEOM = { 甲: '午', 乙: '申', 丙: '寅', 丁: '未', 戊: '辰', 己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申' };
const GEUMYEO = { 甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' };
const AMROK = { 甲: '亥', 乙: '戌', 丙: '申', 丁: '未', 戊: '申', 己: '未', 庚: '巳', 辛: '辰', 壬: '寅', 癸: '丑' };
const MUNGOK = { 甲: '亥', 乙: '子', 丙: '寅', 丁: '卯', 戊: '寅', 己: '卯', 庚: '巳', 辛: '午', 壬: '申', 癸: '酉' };
const GUKIN = { 甲: '戌', 乙: '亥', 丙: '丑', 丁: '寅', 戊: '丑', 己: '寅', 庚: '辰', 辛: '巳', 壬: '未', 癸: '申' };
const CHEONJU = { 甲: '巳', 乙: '午', 丙: '巳', 丁: '午', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
const HYEOLIN = { 甲: '卯', 乙: '辰', 丙: '午', 丁: '未', 戊: '午', 己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑' };
const CHEONBOK = { 甲: '酉', 乙: '申', 丙: '子', 丁: '亥', 戊: '卯', 己: '寅', 庚: '午', 辛: '巳', 壬: '午', 癸: '巳' };
const BOKSEONG = { 甲: '寅', 乙: '丑', 丙: '子', 丁: '亥', 戊: '申', 己: '未', 庚: '午', 辛: '巳', 壬: '辰', 癸: '卯' };
const CHEONGWAN = { 甲: '未', 乙: '辰', 丙: '巳', 丁: '寅', 戊: '卯', 己: '酉', 庚: '亥', 辛: '申', 壬: '酉', 癸: '午' };

const CHEONDEOK_BY_MONTH = { 寅:'丁', 卯:'申', 辰:'壬', 巳:'辛', 午:'亥', 未:'甲', 申:'癸', 酉:'寅', 戌:'丙', 亥:'乙', 子:'巳', 丑:'庚' };
const WOLDEOK_BY_GROUP = { 寅午戌:'丙', 申子辰:'壬', 亥卯未:'甲', 巳酉丑:'庚' };

const TWELVE_SINSAL = {
  '申子辰': { 지살:'申', 년살:'酉', 월살:'戌', 망신살:'亥', 장성살:'子', 반안살:'丑', 역마살:'寅', 육해살:'卯', 화개살:'辰', 겁살:'巳', 재살:'午', 천살:'未' },
  '寅午戌': { 지살:'寅', 년살:'卯', 월살:'辰', 망신살:'巳', 장성살:'午', 반안살:'未', 역마살:'申', 육해살:'酉', 화개살:'戌', 겁살:'亥', 재살:'子', 천살:'丑' },
  '巳酉丑': { 지살:'巳', 년살:'午', 월살:'未', 망신살:'申', 장성살:'酉', 반안살:'戌', 역마살:'亥', 육해살:'子', 화개살:'丑', 겁살:'寅', 재살:'卯', 천살:'辰' },
  '亥卯未': { 지살:'亥', 년살:'子', 월살:'丑', 망신살:'寅', 장성살:'卯', 반안살:'辰', 역마살:'巳', 육해살:'午', 화개살:'未', 겁살:'申', 재살:'酉', 천살:'戌' }
};

const HONGRAN_BY_YEAR = { 子:'卯', 丑:'寅', 寅:'丑', 卯:'子', 辰:'亥', 巳:'戌', 午:'酉', 未:'申', 申:'未', 酉:'午', 戌:'巳', 亥:'辰' };
const CHEONHUI_BY_YEAR = { 子:'酉', 丑:'申', 寅:'未', 卯:'午', 辰:'巳', 巳:'辰', 午:'卯', 未:'寅', 申:'丑', 酉:'子', 戌:'亥', 亥:'戌' };
const GOSIN_GWASUK_BY_SEASON = {
  亥子丑: { 고신살:'寅', 과숙살:'戌' },
  寅卯辰: { 고신살:'巳', 과숙살:'丑' },
  巳午未: { 고신살:'申', 과숙살:'辰' },
  申酉戌: { 고신살:'亥', 과숙살:'未' },
};
const SANGMUN_JOGAEK_BY_YEAR = {
  子:{ 상문살:'寅', 조객살:'戌' }, 丑:{ 상문살:'卯', 조객살:'亥' }, 寅:{ 상문살:'辰', 조객살:'子' }, 卯:{ 상문살:'巳', 조객살:'丑' },
  辰:{ 상문살:'午', 조객살:'寅' }, 巳:{ 상문살:'未', 조객살:'卯' }, 午:{ 상문살:'申', 조객살:'辰' }, 未:{ 상문살:'酉', 조객살:'巳' },
  申:{ 상문살:'戌', 조객살:'午' }, 酉:{ 상문살:'亥', 조객살:'未' }, 戌:{ 상문살:'子', 조객살:'申' }, 亥:{ 상문살:'丑', 조객살:'酉' },
};

const GUIMUN_PAIRS = ['子酉','酉子','丑午','午丑','寅未','未寅','卯申','申卯','辰亥','亥辰','巳戌','戌巳'];
const WONJIN_PAIRS = ['子未','未子','丑午','午丑','寅酉','酉寅','卯申','申卯','辰亥','亥辰','巳戌','戌巳'];
const GOEGANG_DAY = ['庚辰', '庚戌', '壬辰', '戊戌', '戊辰', '壬戌'];
const BAEKHO_DAY = ['甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑'];
const EUMYANG_ERROR_DAY = ['丙子','丁丑','戊寅','辛巳','壬午','癸未'];

const MEANING = {
  천을귀인:'귀인·도움·보호·위기 완충', 태극귀인:'선천적 복덕·정신적 보호·회복력', 문창귀인:'글·학습·기획·문서·표현 재능', 학당귀인:'배움·자격·교육·연구 운',
  문곡귀인:'예술성·문장력·감수성·기획력', 국인귀인:'권한·인장·책임·공적 신뢰', 천주귀인:'먹을 복·생활 안정·돌봄 자원', 천복귀인:'복덕·보호·삶의 완충재', 복성귀인:'복성·도움·명예 회복', 천관귀인:'관록·직책·제도권 도움',
  천덕귀인:'하늘의 덕·위기 완화·평판 보호', 월덕귀인:'월령의 덕·사회적 도움·관계 완충', 건록:'자립력·직업 기반·생활력', 양인살:'강한 추진력·승부성·날카로운 결단',
  홍염살:'매력·주목성·감정 흡인력', 금여록:'품위·귀한 인연·안정적 혜택', 암록:'숨은 도움·비공개 지원·막후 자원', 혈인살:'피·수술·상처·날카로운 사고 주의',
  홍란살:'연애·인연·호감·좋은 소식', 천희성:'기쁨·축하·인연의 활기', 고신살:'고독·독립성·정서적 거리감', 과숙살:'외로움·관계 단절감·내면 몰입',
  상문살:'상실감·문상·가라앉는 기운 주의', 조객살:'외부 슬픔·방문객·심리 소모 주의', 귀문관살:'예민함·집착·직감·심리적 문', 원진살:'서운함·오해·관계 피로',
  천라지망:'막힘·그물·제약·빠져나오기 어려운 구조', 괴강살:'강한 자존·기세·극단적 돌파력·전문성', 백호살:'충격성·응급성·날 선 결단, 안전관리 필요', 음양착살:'엇갈림·타이밍 불일치·관계 착오',
  지살:'움직임·현장성·활동 시작', 도화살:'매력·인기·노출·관계 주목성', 월살:'정체감·감정 소모·흐림', 망신살:'노출·체면 손상 주의·말조심', 장성살:'주도권·리더십·버티는 힘', 반안살:'상승·체면·지위 보완', 역마살:'이동·변화·외부활동·환경 전환', 육해살:'은근한 방해·관계 피로·소모', 화개살:'고독·예술성·종교성·깊은 몰입', 겁살:'갑작스러운 변수·빼앗김·긴장', 재살:'압박·통제·관재성 주의', 천살:'큰 환경압·하늘 변수·외부 조건'
};

function sinsalCategory(name) {
  const n = baseName(name);
  if (['천을귀인','천덕귀인','월덕귀인','태극귀인','문창귀인','학당귀인','문곡귀인','국인귀인','천주귀인','천복귀인','복성귀인','천관귀인','금여록','암록'].includes(n)) return '길신/귀인';
  if (['도화살','홍염살','홍란살','천희성','역마살','화개살','장성살','반안살','건록','양인살'].includes(n)) return '핵심신살';
  if (['괴강살','백호살','귀문관살','원진살','천라지망','혈인살','음양착살','상문살','조객살','고신살','과숙살'].includes(n)) return '주의신살';
  if (['지살','월살','망신살','육해살','겁살','재살','천살'].includes(n)) return '12신살';
  return '보조신살';
}

function priorityOf(name) {
  const n = baseName(name);
  const order = ['천을귀인','천덕귀인','월덕귀인','문창귀인','학당귀인','태극귀인','도화살','홍염살','홍란살','천희성','역마살','화개살','귀문관살','원진살','괴강살','백호살','양인살','건록','금여록','암록','고신살','과숙살','상문살','조객살','혈인살','천라지망'];
  const idx = order.indexOf(n);
  return idx >= 0 ? idx + 1 : 80;
}

function addStemBranchTables(out, dayStem, branchPositions) {
  const tables = [
    ['천을귀인', CHEONEUL, '일간 기준'], ['태극귀인', TAEGEUK, '일간 기준'], ['문창귀인', MUNCHANG, '일간 기준'], ['학당귀인', HAKDANG, '일간 기준 백업표'],
    ['문곡귀인', MUNGOK, '일간 기준 백업표'], ['국인귀인', GUKIN, '일간 기준 백업표'], ['천주귀인', CHEONJU, '일간 기준 백업표'], ['천복귀인', CHEONBOK, '일간 기준 백업표'],
    ['복성귀인', BOKSEONG, '일간 기준 백업표'], ['천관귀인', CHEONGWAN, '일간 기준 백업표'], ['건록', GEONROK, '일간 기준'], ['양인살', YANGIN, '일간 기준'],
    ['홍염살', HONGYEOM, '일간 기준'], ['금여록', GEUMYEO, '일간 기준'], ['암록', AMROK, '일간 기준 백업표'], ['혈인살', HYEOLIN, '일간 기준 백업표'],
  ];
  for (const [name, table, rule] of tables) {
    const target = table[dayStem];
    addBranchMatches(out, name, `일간 ${dayStem}`, target, branchPositions, MEANING[name], sinsalCategory(name), rule, priorityOf(name));
  }
}

function addMonthlyVirtues(out, monthBranch, branchPositions, stemPositions) {
  if (!monthBranch) return;
  const cheondeok = CHEONDEOK_BY_MONTH[monthBranch];
  if (cheondeok) {
    if (STEMS.includes(cheondeok)) addStemMatches(out, '천덕귀인', `월지 ${monthBranch}`, cheondeok, stemPositions, MEANING.천덕귀인, '길신/귀인', '월지 기준', priorityOf('천덕귀인'));
    else addBranchMatches(out, '천덕귀인', `월지 ${monthBranch}`, cheondeok, branchPositions, MEANING.천덕귀인, '길신/귀인', '월지 기준', priorityOf('천덕귀인'));
  }
  const group = sameBranchGroup(monthBranch);
  const woldeokStem = WOLDEOK_BY_GROUP[group];
  if (woldeokStem) addStemMatches(out, '월덕귀인', `월지 삼합 ${group}`, woldeokStem, stemPositions, MEANING.월덕귀인, '길신/귀인', '월지 삼합 기준', priorityOf('월덕귀인'));
}

function addTwelveSinsal(out, basisBranch, basisName, branchPositions, includeAll = true) {
  const group = sameBranchGroup(basisBranch);
  const table = TWELVE_SINSAL[group] || {};
  const names = includeAll ? Object.keys(table) : ['년살','역마살','화개살'];
  for (const raw of names) {
    const target = table[raw];
    if (!target) continue;
    const display = raw === '년살' ? '도화살' : raw;
    addBranchMatches(out, basisName === '년지' ? display : `${display}(${basisName}기준)`, `${basisName} 삼합 ${group}`, target, branchPositions, MEANING[display] || MEANING[raw], sinsalCategory(display), `${basisName} 삼합 기준`, priorityOf(display));
  }
}

function addYearBasedMinor(out, yearBranch, branchPositions) {
  if (!yearBranch) return;
  addBranchMatches(out, '홍란살', `년지 ${yearBranch}`, HONGRAN_BY_YEAR[yearBranch], branchPositions, MEANING.홍란살, '핵심신살', '년지 기준', priorityOf('홍란살'));
  addBranchMatches(out, '천희성', `년지 ${yearBranch}`, CHEONHUI_BY_YEAR[yearBranch], branchPositions, MEANING.천희성, '핵심신살', '년지 기준', priorityOf('천희성'));
  const sg = seasonGroup(yearBranch);
  const loneliness = GOSIN_GWASUK_BY_SEASON[sg] || {};
  addBranchMatches(out, '고신살', `년지 계절권 ${sg}`, loneliness.고신살, branchPositions, MEANING.고신살, '주의신살', '년지 계절권 기준', priorityOf('고신살'));
  addBranchMatches(out, '과숙살', `년지 계절권 ${sg}`, loneliness.과숙살, branchPositions, MEANING.과숙살, '주의신살', '년지 계절권 기준', priorityOf('과숙살'));
  const sj = SANGMUN_JOGAEK_BY_YEAR[yearBranch] || {};
  addBranchMatches(out, '상문살', `년지 ${yearBranch}`, sj.상문살, branchPositions, MEANING.상문살, '주의신살', '년지 기준 백업표', priorityOf('상문살'));
  addBranchMatches(out, '조객살', `년지 ${yearBranch}`, sj.조객살, branchPositions, MEANING.조객살, '주의신살', '년지 기준 백업표', priorityOf('조객살'));
}

function addPairSinsal(out, pillarMap) {
  const pairs = getPairPositions(pillarMap);
  for (const pair of pairs) {
    if (GUIMUN_PAIRS.includes(pair.branches)) add(out, { name:'귀문관살', category:'주의신살', priority:priorityOf('귀문관살'), basis:pair.branches, position:pair.label, pillar:`${pair.a.pillar}-${pair.b.pillar}`, target:pair.branches, meaning:MEANING.귀문관살, backupRule:'지지 쌍 기준' });
    if (WONJIN_PAIRS.includes(pair.branches)) add(out, { name:'원진살', category:'주의신살', priority:priorityOf('원진살'), basis:pair.branches, position:pair.label, pillar:`${pair.a.pillar}-${pair.b.pillar}`, target:pair.branches, meaning:MEANING.원진살, backupRule:'지지 쌍 기준' });
  }
  const branches = getBranchPositions(pillarMap).map(x => x.branch);
  const hasCheonra = branches.includes('辰') && branches.includes('巳');
  const hasJimang = branches.includes('戌') && branches.includes('亥');
  if (hasCheonra) add(out, { name:'천라지망', category:'주의신살', priority:priorityOf('천라지망'), basis:'辰巳', position:'명식 전체', pillar:'辰巳', target:'천라', meaning:MEANING.천라지망, backupRule:'辰巳 천라 기준' });
  if (hasJimang) add(out, { name:'천라지망', category:'주의신살', priority:priorityOf('천라지망'), basis:'戌亥', position:'명식 전체', pillar:'戌亥', target:'지망', meaning:MEANING.천라지망, backupRule:'戌亥 지망 기준' });
}

function cleanAndSort(list) {
  const normalized = list.map(x => ({ ...x, category: sinsalCategory(x.name), priority: x.priority ?? priorityOf(x.name) }));
  const deduped = uniqBy(normalized, x => `${baseName(x.name)}|${x.position}|${x.target}`);
  deduped.sort((a,b) => (a.priority - b.priority) || String(a.position).localeCompare(String(b.position), 'ko'));
  return deduped;
}

function calculateShinsal(pillarMap = {}) {
  const out = [];
  const branchPositions = getBranchPositions(pillarMap);
  const stemPositions = getStemPositions(pillarMap);
  const dayStem = pillarMap.day?.stem;
  const dayBranch = pillarMap.day?.branch;
  const dayText = pillarMap.day?.text;
  const yearBranch = pillarMap.year?.branch;
  const monthBranch = pillarMap.month?.branch;

  if (dayStem) addStemBranchTables(out, dayStem, branchPositions);
  addMonthlyVirtues(out, monthBranch, branchPositions, stemPositions);
  addTwelveSinsal(out, yearBranch, '년지', branchPositions, true);
  addTwelveSinsal(out, dayBranch, '일지', branchPositions, false);
  addYearBasedMinor(out, yearBranch, branchPositions);
  addPairSinsal(out, pillarMap);

  if (dayText && GOEGANG_DAY.includes(dayText)) add(out, { name:'괴강살', category:'주의신살', priority:priorityOf('괴강살'), basis:`일주 ${dayText}`, position:'일주', pillar:dayText, target:dayText, meaning:MEANING.괴강살, backupRule:'일주 기준' });
  if (dayText && BAEKHO_DAY.includes(dayText)) add(out, { name:'백호살', category:'주의신살', priority:priorityOf('백호살'), basis:`일주 ${dayText}`, position:'일주', pillar:dayText, target:dayText, meaning:MEANING.백호살, backupRule:'일주 기준 백업표' });
  if (dayText && EUMYANG_ERROR_DAY.includes(dayText)) add(out, { name:'음양착살', category:'주의신살', priority:priorityOf('음양착살'), basis:`일주 ${dayText}`, position:'일주', pillar:dayText, target:dayText, meaning:MEANING.음양착살, backupRule:'일주 기준 백업표' });

  const list = cleanAndSort(out);
  const names = [...new Set(list.map(x => baseName(x.name)))];
  const coreNames = names.filter(n => ['천을귀인','천덕귀인','월덕귀인','도화살','홍염살','홍란살','천희성','역마살','화개살','귀문관살','원진살','괴강살','백호살','문창귀인','학당귀인','금여록','암록','양인살','건록'].includes(n));
  const byCategory = list.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    const label = `${baseName(item.name)}${item.position ? `(${item.position})` : ''}`;
    if (!acc[item.category].includes(label)) acc[item.category].push(label);
    return acc;
  }, {});

  const proNames = names.filter(n => !['지살','월살','망신살','육해살','겁살','재살','천살'].includes(n));
  return {
    mode: 'EXPERT',
    list,
    names,
    coreNames,
    proNames,
    byCategory,
    basicSummary: coreNames.length ? coreNames.join(', ') : '핵심 신살 없음',
    proSummary: proNames.length ? proNames.join(', ') : '주요 신살 없음',
    summary: names.length ? names.join(', ') : '주요 신살 없음',
    coreSummary: coreNames.length ? coreNames.join(', ') : '핵심 신살 없음',
    note: '신살은 유파별 산출표가 다를 수 있어 v13 백업 계산기에서는 EXPERT 확장표 기준으로 산출합니다. 같은 신살이라도 기준축이 다르면 유지합니다.'
  };
}

module.exports = { calculateShinsal, baseName };

import React, { useState, useRef, useEffect } from 'react'

/** =====================================
 *  Deck data & helpers (with self-tests)
 *  ===================================== */
// --- Universal (fallback) ---
export const TAROT_MAJOR = [
  "0 바보 (The Fool)","I 마법사 (The Magician)","II 여사제 (The High Priestess)","III 여제 (The Empress)",
  "IV 황제 (The Emperor)","V 교황 (The Hierophant)","VI 연인 (The Lovers)","VII 전차 (The Chariot)",
  "VIII 힘 (Strength)","IX 은둔자 (The Hermit)","X 운명의 수레바퀴 (Wheel of Fortune)","XI 정의 (Justice)",
  "XII 매달린 남자 (The Hanged Man)","XIII 죽음 (Death)","XIV 절제 (Temperance)","XV 악마 (The Devil)",
  "XVI 탑 (The Tower)","XVII 별 (The Star)","XVIII 달 (The Moon)","XIX 태양 (The Sun)","XX 심판 (Judgement)","XXI 세계 (The World)"
];
const suitKR = s => ({W:"완드",C:"컵",S:"소드",P:"펜타클"})[s];
const minorKR = (suit, rank) => `${suitKR(suit)} ${rank===1?"에이스":rank<=10?rank:{11:"시종",12:"기사",13:"여왕",14:"왕"}[rank]}`;
export const TAROT_MINOR = (()=>{ const suits=["W","C","S","P"]; const out=[]; for(const s of suits){ for(let r=1;r<=14;r++) out.push(minorKR(s,r)); } return out; })();
export const TAROT_78 = [...TAROT_MAJOR, ...TAROT_MINOR];

// --- 나전의 빛 (이름만) ---
export const NAJEON_MAJOR = [
  "나그네","마법사","여사제","여제","황제","교황","연인","전차","힘","은둔자","운명의 수레바퀴","정의","매달린 학","죽음","절제","악마","탑","별","달","태양","심판","세계"
];
export const NAJEON_P = ["천성 별전","태극 별전","연화 별전","쌍벌 별전","오화형 별전","박쥐 별전","가지 전","모전 다듬기","식물 별전","분재 열쇄패"];
export const NAJEON_C = ["매조죽문항아리","당초문탁잔","국화문화형탁잔","국화모란장경병","청화국화문병","난초청낭자문병","도자기 다종","팔각통형병","표주박형병","십장생문각병"];
export const NAJEON_W = ["연화목 촛대","나비형목촛대","좌독기","혼례","과거시험","금의환향","투호","활","성곽기","투각파초문필통"];
export const NAJEON_S = ["운검","월도","검무","금제감장보검","환도빼앗기","실어 보내는 검","못 가져간 인검","모란각인환도","베갯머리 인검","침상 인검"];
export const NAJEON_COURTS = {
  P:["소년의 별전","무관의 별전","왕비의 별전","왕의 별전"],
  W:["소년의 기","무관의 등채","왕비의 촛대","왕의 촛대"],
  C:["소년의 자기","무관의 자기","왕비의 자기","왕의 자기"],
  S:["소년의 검","무관의 검","왕비의 검","왕의 검"]
};
export const NAJEON_78 = [
  ...NAJEON_MAJOR,
  ...NAJEON_W, ...NAJEON_COURTS.W,
  ...NAJEON_C, ...NAJEON_COURTS.C,
  ...NAJEON_S, ...NAJEON_COURTS.S,
  ...NAJEON_P, ...NAJEON_COURTS.P
];

// --- 로제딕 ---
const ROSEDIC_SUIT_LABELS = { P: 'Jewel', W: 'Cross', C: 'Glass', S: 'Sword' };
const ROSEDIC_RANKS = { 1: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Page', 12: 'Knight', 13: 'Queen', 14: 'King' };
function buildRosedicMinors(){ const suits = ['W','C','S','P']; const out = []; for(const s of suits){ for(let r=1;r<=14;r++){ out.push(`${ROSEDIC_SUIT_LABELS[s]} ${ROSEDIC_RANKS[r]}`);} } return out; }
export const ROSEDIC_78 = [...TAROT_MAJOR, ...buildRosedicMinors()];

// ===== small static arrays for perf =====
const NUMBERS_1_TO_78 = Array.from({ length: 78 }, (_, i) => i + 1);

// --- Aux decks ---
export const RUNES_24 = ["Fehu","Uruz","Thurisaz","Ansuz","Raidho","Kenaz","Gebo","Wunjo","Hagalaz","Nauthiz","Isa","Jera","Eihwaz","Perthro","Algiz","Sowilo","Tiwaz","Berkano","Ehwaz","Mannaz","Laguz","Ingwaz","Othala","Dagaz"];
export const LENORMAND_36 = [
  "1 라이더","2 클로버","3 배","4 집","5 나무","6 구름","7 뱀","8 관","9 꽃다발",
  "10 낫","11 채찍","12 새","13 아이","14 여우","15 곰","16 별","17 황새","18 개",
  "19 탑","20 정원","21 산","22 갈림길","23 쥐","24 하트","25 반지","26 책",
  "27 편지","28 남자","29 여자","30 백합","31 태양","32 달","33 열쇠","34 물고기",
  "35 닻","36 십자가"
];
export const OGANGI_5 = ["목(木)","화(火)","토(土)","금(金)","수(水)"];
export const OBANGGI_5 = ["동","서","남","북","중앙"];
export const REGINA_ORACLE_DECKS = [
  "Starseed Oracle","Sacred Creators Oracle","Voice of the Souls Oracle","Love Flower Oracle",
  "Healing Water Oracle","The Angel Guide Oracle","BUDDHA WISDOM SHAKTI POWER","Angelic Lightwork Healing Oracle","I Ching Oracle"
];

// ======= Oracle presets =======
const VOICE_OF_SOULS_CARDS = [
  'Abundance','Help','Love','Learning','Soon','Happiness','Calm me','It\'s not me','Anger','Communication','Duality','Education','Mirror effect','Children','Guide','Karma','Freedom','Loss','Forgiveness','Fears','Burden of tears','Repression','Regrets','Karmic relationship','Reproach','Respect','Reunion','Secrets','Physical pain','Submission','Source','You','Message of warning','Message of love','Message of peace','Message of guidance','Karmic message','Message of freedom','Free message','Message of forgiveness','Spiritual message','Message to pass on'
];
const PRESET_ORACLE_CARDS = { 'Voice of the Souls Oracle': VOICE_OF_SOULS_CARDS };

// --- Runtime env helpers ---
function isInIframe(){ try { return window.self !== window.top; } catch { return true; } }
function isSecure(){ try { return !!(window.isSecureContext); } catch { return false; } }

// --- Utils ---
export function shuffleInPlace(arr){ for(let i=arr.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; } return arr; }

export function getDeckCards(deckName){ if(deckName === '나전의 빛 타로') return NAJEON_78; if(deckName === '로제딕 타로') return ROSEDIC_78; if(deckName === '유니버셜 타로' || !deckName) return TAROT_78; return TAROT_78; }

export function drawRandomTarot(deckCards, count, allowReversal=true, reverseRatio=50){ const deck = shuffleInPlace([...deckCards]); return deck.slice(0,count).map(name=>({ name, reversed: !!allowReversal && Math.random()*100 < reverseRatio })); }
export const drawRunes = (n)=> shuffleInPlace([...RUNES_24]).slice(0,n);
export const drawLenormand = (n)=> shuffleInPlace([...LENORMAND_36]).slice(0,n);
export const drawOgangi = ()=> shuffleInPlace([...OGANGI_5])[0];
export const drawObanggi = ()=> shuffleInPlace([...OBANGGI_5])[0];

// ===== Oracle storage =====
const ORACLE_STORAGE_KEY = 'regina_oracle_cards_by_deck_v1';
function loadOracleCardsMap(){ try{ const raw = localStorage.getItem(ORACLE_STORAGE_KEY); if(!raw) return {}; const parsed = JSON.parse(raw); const clean = {}; Object.keys(parsed||{}).forEach(k=>{ const arr = Array.isArray(parsed[k])? parsed[k] : []; clean[k] = arr.filter(v=>typeof v==='string' && v.trim()).map(v=>v.trim()); }); return clean; }catch{ return {}; } }
function saveOracleCardsMap(map){ try{ localStorage.setItem(ORACLE_STORAGE_KEY, JSON.stringify(map||{})); }catch{} }
let ORACLE_CARDS_BY_DECK = loadOracleCardsMap();
export function setOracleDeckCards(deckName, names){ const list = (names||[]).filter(v=>typeof v==='string' && v.trim()).map(v=>v.trim()); ORACLE_CARDS_BY_DECK = { ...ORACLE_CARDS_BY_DECK, [deckName]: list }; saveOracleCardsMap(ORACLE_CARDS_BY_DECK); }
export function getOracleDeckCards(deckName){ if (PRESET_ORACLE_CARDS[deckName]) return PRESET_ORACLE_CARDS[deckName]; const list = ORACLE_CARDS_BY_DECK[deckName]; return Array.isArray(list) && list.length>0 ? list : null; }

// Fallback generic keywords
const ORACLE_KEYWORD_FALLBACK = [ '경계','확장','정화','인내','회복','소통','결단','유연성','균형','휴식','몰입','신뢰','재정비','성장','재시도','축복','배움','경로수정','연결','해방','용기','겸손','보호','변화','기회','통찰','경험','전환','안정','기초','자기돌봄','성찰','협력','해소','도약','선택','실행','기한','리스크관리','타이밍','감사','용서','경계선','열림','집중','휴지기' ];

// Pure formatter
export function buildTemplateText(r){ if (!r) return ''; const { tarotDeck, cardCount, tarot, runes, oracles, lenormand, aux } = r; const positions = tarot.map(t=>`- ${t.position}: ${t.card}`).join('\n'); const runesTxt = (runes?.length? `\n**룬**: ${runes.join(', ')}`:''); const oracleTxt = (oracles?.length? `\n**오라클**: ${oracles.join(', ')}`:''); const lenoTxt = (lenormand?.length? `\n**레노먼드**: ${lenormand.join(', ')}`:''); const auxTxt = (aux?.length? `\n**보조**: ${aux.join(', ')}`:''); return (`**덱**: ${tarotDeck}\n**장수**: ${cardCount}\n\n**포지션별 드로우**\n${positions}${runesTxt}${oracleTxt}${lenoTxt}${auxTxt}`); }

// Self tests (do not remove existing). Added a few more at the end.
export function _selfTests(){ const out = []; const T=(name, ok)=>out.push({name, pass: !!ok}); T('TAROT_78 size', TAROT_78.length===78); T('NAJEON_78 size', NAJEON_78.length===78); T('ROSEDIC_78 size', ROSEDIC_78.length===78); T('TAROT_78 unique', new Set(TAROT_78).size===78); T('NAJEON_78 unique', new Set(NAJEON_78).size===78); T('ROSEDIC_78 unique', new Set(ROSEDIC_78).size===78); const d=drawRandomTarot(TAROT_78,5,true,50); T('drawRandomTarot count=5', d.length===5); T('draw fields', d.every(x=>typeof x.name==='string' && typeof x.reversed==='boolean')); const dNoRev = drawRandomTarot(TAROT_78,3,false,100); T('no reversal', dNoRev.every(x=>x.reversed===false)); const allRev = drawRandomTarot(TAROT_78,4,true,100); T('all reversed', allRev.every(x=>x.reversed===true)); const noneRev = drawRandomTarot(TAROT_78,4,true,0); T('none reversed', noneRev.every(x=>x.reversed===false)); const sampleTxt = buildTemplateText({tarotDeck:'유니버셜 타로',cardCount:2,tarot:[{position:'카드 1',card:'0 바보'},{position:'카드 2',card:'I 마법사'}],runes:['Fehu'],oracles:[],lenormand:['1 라이더'],aux:['오간기: 목(木)']}); T('buildTemplateText ok', sampleTxt.includes('**덱**') && sampleTxt.includes('**포지션별 드로우**')); const sampleTxt2 = buildTemplateText({tarotDeck:'X',cardCount:2,tarot:[{position:'카드 1',card:'A'},{position:'카드 2',card:'B'}],runes:[],oracles:[],lenormand:[],aux:[]}); T('buildTemplateText newline join', sampleTxt2.includes('\n- 카드 2')); // extra tests
 T('getDeckCards fallback unknown', getDeckCards('없는덱').length===78);
 T('ROSEDIC contains Jewel Ace', ROSEDIC_78.includes('Jewel Ace'));
 T('LENORMAND_36 size ok', LENORMAND_36.length===36);
 return out; }

/** =====================================
 *  React UI (default export)
 *  ===================================== */
const REGINA_TAROT_DECKS = [
  '나전의 빛 타로','로제딕 타로','유니버셜 타로',
  '하모니 타로','드리밍 캣 타로','스테인드글라스 타로','고래의 꿈 타로 (유니버셜 기반)','무하 타로','세피로트 타로','밤의 별빛 타로','Spheres of Heaven Tarot','디바인 셀레스티얼 타로','로맨틱 타로','Legacy of the Divine Tarot (레거시 오브 더 디바인 타로)','Everyday Witch Tarot','Tattoo Tarot: Ink & Intuition','Luna Somnia Tarot','Holographic Universal Tarot (홀로그램 유니버셜 타로)','인어공주 타로카드','라스트 유니콘 타로','원더링 스피릿 타로','더 차일드 오브 리타 타로','라이드 비전스 타로','판타스티컬 타로','더 뱀파이어 타로','바나 일러스트 한국풍 타로','텀블벅 앤티크 타로','망가 타로','섀도스케이프 타로','일본 신화 타로','한국을 담은 환상 타로카드'
];

const NumberCell = React.memo(function NumberCell({ n, sel, disabled, title, onToggle }){
  const handleClick = React.useCallback(()=> onToggle(n), [onToggle, n]);
  return (
    <button
      title={title}
      onClick={handleClick}
      disabled={disabled}
      style={{touchAction:'manipulation'}}
      className={`text-xs px-2 py-1 rounded-lg border min-w-9 min-h-9 ${sel?'bg-indigo-600 border-indigo-500 text-white':'bg-slate-800/70 border-slate-700 hover:bg-slate-700'} ${disabled?'opacity-40 cursor-not-allowed':''}`}
    >
      {n}
    </button>
  );
});

export default function ReginaReadingApp(){
  // core state
  const [tarotDeck,setTarotDeck]=useState(REGINA_TAROT_DECKS[0]);
  const deckCardsMemo = React.useMemo(()=>getDeckCards(tarotDeck), [tarotDeck]);
  const [allowReversal,setAllowReversal]=useState(true);
  const [reverseRatio,setReverseRatio]=useState(50);
  const [cardCount,setCardCount]=useState(1); // 1..13

  // modes
  const [mode,setMode]=useState('random'); // 'random' | 'numbers'
  const [numMap,setNumMap]=useState([]); // 78-length permutation for mapping numbers->card
  const [selectedNums,setSelectedNums]=useState([]);

  // auxiliaries
  const [useRunesState,setUseRunesState]=useState(false);
  const [runeCount,setRuneCount] = useState(2);
  const [useOracle,setUseOracle]=useState(false);
  const [oracleDeck,setOracleDeck]=useState(REGINA_ORACLE_DECKS[0]);
  const [oracleCount,setOracleCount]=useState(1);
  const [useLenormand,setUseLenormand]=useState(false);
  const [lenormandCount,setLenormandCount]=useState(2);
  const [useOgangi,setUseOgangi]=useState(false);
  const [useObanggi,setUseObanggi]=useState(false);

  // result & export
  const [result,setResult]=useState(null);
  const [copyStatus,setCopyStatus]=useState({status:'idle',message:''});
  const hiddenTaRef = useRef(null);
  const preRef = useRef(null);
  const [envInfo] = useState(()=>({ inIframe: isInIframe(), secure: isSecure() }));

  // ===== MOBILE-ONLY LAYOUT HEURISTIC =====
  // Treat coarse pointers or <=1024px width as compact, so ChatGPT mobile webview also collapses nicely.
  const detectCompact = () => {
    try {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const vw = Math.min(window.innerWidth || 0, window.screen?.width || 0);
      return coarse || vw <= 1024;
    } catch { return true; }
  };
  const [compact,setCompact] = useState(()=> detectCompact());
  useEffect(()=>{
    const onResize = ()=> setCompact(detectCompact());
    window.addEventListener('resize', onResize, { passive:true });
    return ()=> window.removeEventListener('resize', onResize);
  },[]);

  // numbers map sync
  useEffect(()=>{
    if(mode==='numbers'){
      if(numMap.length!==78 || !numMap.every(x=>deckCardsMemo.includes(x))){
        setNumMap(shuffleInPlace([...deckCardsMemo]));
        setSelectedNums([]);
      }
    }
  },[mode, deckCardsMemo]);

  // Trim selected when cardCount shrinks
  useEffect(()=>{ if(selectedNums.length>cardCount){ setSelectedNums(prev=>prev.slice(0,cardCount)); } },[cardCount, selectedNums.length]);

  // hotkeys for card count (desktop only)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toUpperCase?.() || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.key >= '1' && e.key <= '9') setCardCount(parseInt(e.key, 10));
      else if (e.key === '0') setCardCount(10);
      else if (e.key === '-') setCardCount(11);
      else if (e.key === '=') setCardCount(12);
      else if (e.key.toLowerCase() === 'q') setCardCount(13);
    };
    if (!compact) window.addEventListener('keydown', handleKeyDown, { passive: true });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [compact]);

  const reshuffleNumMap = React.useCallback(()=>{ setNumMap(prev=>shuffleInPlace([...deckCardsMemo])); setSelectedNums([]); },[deckCardsMemo]);

  const toggleNum = React.useCallback((n)=>{
    setSelectedNums(prev=>{
      const exists = prev.includes(n);
      if (exists) return prev.filter(x=>x!==n);
      if (prev.length < cardCount) return [...prev, n];
      return prev;
    });
  },[cardCount]);

  function drawTarot(){
    const deckCards = deckCardsMemo;
    let picked=[];
    if(mode==='random') picked = drawRandomTarot(deckCards, cardCount, allowReversal, reverseRatio);
    else {
      if(selectedNums.length !== cardCount){ alert(`숫자 모드: 선택된 숫자가 ${cardCount}장과 일치해야 해요. (현재 ${selectedNums.length}장)`); return null; }
      picked = selectedNums.map(n=>({ name: numMap[n-1], reversed: !!allowReversal && Math.random()*100<reverseRatio }));
    }
    return picked.map((o,idx)=>({position:`카드 ${idx+1}`, card:o.name+(o.reversed?" (역방향)":"")}));
  }

  function drawOracles(n){
    const deckNames = getOracleDeckCards(oracleDeck);
    if (deckNames && deckNames.length){
      const picks = shuffleInPlace([...deckNames]).slice(0,n);
      return picks.map(k=>`${oracleDeck}: ${k}`);
    }
    const picks = shuffleInPlace([...ORACLE_KEYWORD_FALLBACK]).slice(0,n);
    return picks.map(k=>`${oracleDeck}: ${k}`);
  }

  function onDraw(){
    const tarot = drawTarot(); if (!tarot) return;
    const runes = useRunesState ? drawRunes(runeCount) : [];
    const oracles = useOracle ? drawOracles(oracleCount) : [];
    const lenormand = useLenormand ? drawLenormand(lenormandCount) : [];
    const aux = [];
    if (useOgangi) aux.push(`오간기: ${drawOgangi()}`);
    if (useObanggi) aux.push(`오방기: ${drawObanggi()}`);
    const r = {tarotDeck,cardCount,tarot,runes,oracles,lenormand,aux};
    setResult(r);
    setCopyStatus({status:'idle',message:''});
  }

  async function handleCopy(e){
    if (e && e.isTrusted === false) { setCopyStatus({status:'error',message:'사용자 동작이 아닌 복사는 허용되지 않아요.'}); return; }
    const txt = buildTemplateText(result); if (!txt){ alert('먼저 카드를 뽑아주세요.'); return; }
    try{
      if (navigator.clipboard && (window?.isSecureContext ?? true)) { await navigator.clipboard.writeText(txt); setCopyStatus({status:'success',message:'클립보드에 복사했어요.'}); return; }
    }catch(_){ }
    try {
      let ta = hiddenTaRef.current;
      if (!ta) { ta = document.createElement('textarea'); ta.setAttribute('aria-hidden','true'); ta.tabIndex = -1; ta.style.position='fixed'; ta.style.top='-1000px'; ta.style.opacity='0'; document.body.appendChild(ta); hiddenTaRef.current=ta; }
      const prev = ta.readOnly; ta.readOnly=false; ta.value=txt; ta.focus(); ta.select(); const ok = document.execCommand && document.execCommand('copy'); ta.readOnly=prev; if(ok){ setCopyStatus({status:'success',message:'클립보드에 복사했어요.'}); return; }
    } catch(_){ }
    const node = preRef.current; if (node) { const range=document.createRange(); range.selectNodeContents(node); const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range); setCopyStatus({status:'error',message:'자동 복사가 차단되어 텍스트를 선택해두었어요. Ctrl/Cmd+C 로 복사해주세요.'}); return; }
    setCopyStatus({status:'error',message:'클립보드 권한이 없어 자동 복사할 수 없어요. 표시된 텍스트를 수동 복사해주세요.'});
  }

  // (quiet on mobile): comment out verbose self-tests
  // useEffect(()=>{ try { console.table(_selfTests()); } catch(_){} },[]);

  const templateTextMemo = React.useMemo(()=>buildTemplateText(result), [result]);

  // compact-friendly paddings & sticky action for mobile webview
  const rootPad = compact ? 'p-3 pb-24' : 'p-4 md:p-6';
  const cardPad = compact ? 'p-3' : 'p-4';

  return (
    <div className={`min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 ${rootPad}`}>
      <div className="max-w-full md:max-w-5xl mx-auto">
        {(envInfo.inIframe && !envInfo.secure) && (
          <div className="mb-3 text-amber-300 text-[11px] sm:text-xs bg-amber-900/30 border border-amber-700 rounded-xl p-2">
            ⚠️ 외부 임베드(비보안 컨텍스트)에서는 자동 복사가 제한될 수 있어요. 실패 시 아래 텍스트가 자동 선택되니 Ctrl/Cmd+C 를 눌러주세요.
          </div>
        )}
        <header className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">레지나 리딩 보조앱 <span className="text-indigo-300">(β)</span></h1>
          <p className="text-slate-300 mt-1 text-sm md:text-base">장수(1~13)·랜덤/숫자 드로우·룬/레노먼드/오간기/오방기/오라클</p>
        </header>

        <section className="grid grid-cols-1 mb-4 md:mb-6">
          <div className={`bg-slate-800/60 rounded-2xl ${cardPad} border border-slate-700 shadow`}>
            <div className="mb-3">
              <label className="text-sm text-slate-300">드로우 모드</label>
              <div className="flex gap-2 mt-1">
                <button onClick={()=>setMode('random')} className={`flex-1 md:flex-none px-3 py-1 rounded ${mode==='random'?'bg-indigo-600':'bg-slate-700'}`}>랜덤</button>
                <button onClick={()=>setMode('numbers')} className={`flex-1 md:flex-none px-3 py-1 rounded ${mode==='numbers'?'bg-indigo-600':'bg-slate-700'}`}>숫자 뽑기</button>
              </div>
            </div>

            {mode==='numbers' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button onClick={reshuffleNumMap} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm">맵 다시 섞기</button>
                  <span className="text-xs text-slate-400">선택 {selectedNums.length}/{cardCount}</span>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-9 gap-1 max-h-[45vh] md:max-h-52 overflow-auto p-1 rounded-xl bg-slate-900/40 border border-slate-700" style={{contentVisibility:'auto', contain:'content'}}>
                  {NUMBERS_1_TO_78.map(n=> (
                    <NumberCell
                      key={n}
                      n={n}
                      sel={selectedNums.includes(n)}
                      disabled={!selectedNums.includes(n) && selectedNums.length>=cardCount}
                      title={numMap[n-1] || ''}
                      onToggle={toggleNum}
                    />
                  ))}
                </div>
              </div>
            )}

            <label className="text-sm text-slate-300 mt-3 block">메인 타로 덱</label>
            <select value={tarotDeck} onChange={e=>setTarotDeck(e.target.value)} className="w-full mt-1 bg-slate-900/60 border border-slate-700 rounded-xl p-2 text-sm">
              {REGINA_TAROT_DECKS.map(name=>(<option key={name} value={name}>{name}</option>))}
            </select>

            <div className="mt-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-300">역방향</label>
                <input type="checkbox" checked={allowReversal} onChange={e=>setAllowReversal(e.target.checked)} />
              </div>
              <input aria-label="역방향 비율" type="range" min={0} max={100} value={reverseRatio} onChange={e=>setReverseRatio(parseInt(e.target.value,10))} className="flex-1 h-2"/>
              <span className="text-xs text-slate-400 w-12 text-right">{reverseRatio}%</span>
            </div>

            <div className="mt-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <label className="text-sm text-slate-300">장수</label>
              <input type="number" min={1} max={13} value={cardCount} onChange={e=>setCardCount(Math.min(13, Math.max(1, parseInt(e.target.value,10)||1)))} className="w-24 bg-slate-900/60 border border-slate-700 rounded-xl p-1 h-10"/>
              <span className="text-xs text-slate-400">(1~9, 0=10, -=11, =12, Q=13)</span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2"><label className="text-sm text-slate-300">룬스톤</label><input type="checkbox" checked={useRunesState} onChange={e=>setUseRunesState(e.target.checked)} />{useRunesState && (<input type="number" min={1} max={6} value={runeCount} onChange={e=>setRuneCount(Math.min(6, Math.max(1, parseInt(e.target.value,10)||2)))} className="w-20 bg-slate-900/60 border border-slate-700 rounded-xl p-1 h-10"/>)}</div>
              <div className="flex items-center gap-2"><label className="text-sm text-slate-300">레노먼드</label><input type="checkbox" checked={useLenormand} onChange={e=>setUseLenormand(e.target.checked)} />{useLenormand && (<input type="number" min={1} max={5} value={lenormandCount} onChange={e=>setLenormandCount(Math.min(5, Math.max(1, parseInt(e.target.value,10)||2)))} className="w-20 bg-slate-900/60 border border-slate-700 rounded-xl p-1 h-10"/>)}</div>
              <div className="flex items-center gap-2"><label className="text-sm text-slate-300">오간기</label><input type="checkbox" checked={useOgangi} onChange={e=>setUseOgangi(e.target.checked)} /></div>
              <div className="flex items-center gap-2"><label className="text-sm text-slate-300">오방기</label><input type="checkbox" checked={useObanggi} onChange={e=>setUseObanggi(e.target.checked)} /></div>
              <div className="flex items-center gap-2"><label className="text-sm text-slate-300">오라클</label><input type="checkbox" checked={useOracle} onChange={e=>setUseOracle(e.target.checked)} /></div>
              {useOracle && (
                <div className="flex flex-col md:flex-row gap-2 col-span-full">
                  <select value={oracleDeck} onChange={e=>setOracleDeck(e.target.value)} className="flex-1 bg-slate-900/60 border border-slate-700 rounded-xl p-2 text-sm">
                    {REGINA_ORACLE_DECKS.map(n=>(<option key={n} value={n}>{n}</option>))}
                  </select>
                  <input type="number" min={1} max={3} value={oracleCount} onChange={e=>setOracleCount(Math.min(3, Math.max(1, parseInt(e.target.value,10)||1)))} className="w-24 bg-slate-900/60 border border-slate-700 rounded-xl p-1 h-10"/>
                </div>
              )}
            </div>
          </div>
        </section>

        {result && (
          <>
            <div className={`bg-slate-800/60 rounded-2xl ${cardPad} border border-slate-700 shadow`}>
              <div className="mb-3 text-sm"><b>덱:</b> {result.tarotDeck} | <b>장수:</b> {result.cardCount}</div>
              {result.tarot.map((t,idx)=>(<div key={idx} className="mb-2 text-sm">{t.position}: {t.card}</div>))}
              {result.lenormand?.length>0 && (
                <div className="mt-3">
                  <b className="text-sm">레노먼드:</b>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.lenormand.map((c,i)=>(<span key={i} className="px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-700 text-xs">{c}</span>))}
                  </div>
                </div>
              )}
              {result.runes?.length>0 && (<div className="mt-3 text-sm"><b>룬:</b> {result.runes.join(', ')}</div>)}
              {result.oracles?.length>0 && (<div className="mt-3 text-sm"><b>오라클:</b> {result.oracles.join(', ')}</div>)}
              {result.aux?.length>0 && (<div className="mt-3 text-sm"><b>보조:</b> {result.aux.join(', ')}</div>)}
            </div>

            <div className={`bg-slate-800/60 rounded-2xl ${cardPad} border border-slate-700 shadow mt-3`}>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={(e)=>handleCopy(e)} className="w-full md:w-auto px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm">복사</button>
              </div>
              {copyStatus.status==='success' && <div className="text-emerald-300 text-xs">✅ {copyStatus.message}</div>}
              {copyStatus.status==='error' && <div className="text-amber-300 text-xs">⚠️ {copyStatus.message}</div>}
              <pre ref={preRef} className="whitespace-pre-wrap text-xs md:text-sm bg-slate-900/50 p-2 md:p-3 rounded-xl border border-slate-700 max-h-60 md:max-h-80 overflow-auto">{templateTextMemo}</pre>
            </div>
          </>
        )}

        <div className="mt-4 md:mt-6 md:mb-2">
          <button onClick={onDraw} className="hidden md:inline-flex px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 shadow text-white font-medium">카드 뽑기</button>
        </div>
      </div>

      {/* Sticky mobile action bar for ChatGPT mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-700 backdrop-blur p-3 z-50" style={{paddingBottom:'calc(env(safe-area-inset-bottom, 0px) + 12px)'}}>
        <button onClick={onDraw} className="w-full h-12 rounded-xl bg-indigo-600 active:translate-y-px text-white font-medium" style={{touchAction:'manipulation'}} aria-label="카드 뽑기">카드 뽑기</button>
      </div>

      {/* Hidden textarea for execCommand fallback */}
      <textarea ref={hiddenTaRef} aria-hidden="true" tabIndex={-1} style={{position:'fixed', top:'-1000px', opacity:0}} defaultValue=""/>
    </div>
  );
}

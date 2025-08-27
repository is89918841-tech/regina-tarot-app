import React, { useState, useRef, useEffect } from 'react'

/** =====================================
 *  Regina Reading App (β) — Simplified
 *  - 랜덤/숫자 드로우 + 맵 다시 쉐긋기
 *  - 오라클(프리셋)
 *  - 보조: 룬, 레노몬드, 오간기, 오방기, 주역(I Ching)
 *  - 덩 편집기 제거 (per user)
 *  ===================================== */

// --- Tarot universal ---
const TAROT_MAJOR = [
  "0 바보 (The Fool)","I 마법사 (The Magician)","II 여사제 (The High Priestess)","III 여제 (The Empress)",
  "IV 황제 (The Emperor)","V 교황 (The Hierophant)","VI 연인 (The Lovers)","VII 전차 (The Chariot)",
  "VIII 힘 (Strength)","IX 은두난자 (The Hermit)","X 운명의 수레바퀴 (Wheel of Fortune)","XI 정의 (Justice)",
  "XII 매달린 남자 (The Hanged Man)","XIII 죽음 (Death)","XIV 절제 (Temperance)","XV 악마 (The Devil)",
  "XVI 탑 (The Tower)","XVII 별 (The Star)","XVIII 달 (The Moon)","XIX 태양 (The Sun)","XX 심판 (Judgement)","XXI 세계 (The World)"
];
const suitKR = s => ({W:"완드",C:"컵",S:"소드",P:"펜타클"})[s];
const minorKR = (suit, rank) => `${suitKR(suit)} ${rank===1?"에이스":rank<=10?rank:{11:"시종",12:"기사",13:"여왕",14:"왕"}[rank]}`;
const TAROT_MINOR = (()=>{ const suits=["W","C","S","P"]; const out=[]; for(const s of suits){ for(let r=1;r<=14;r++){ out.push(minorKR(s,r)); } } return out; })();
const TAROT_78 = [...TAROT_MAJOR, ...TAROT_MINOR];

// --- Aux decks ---
const RUNES_24 = ["Fehu","Uruz","Thurisaz","Ansuz","Raidho","Kenaz","Gebo","Wunjo","Hagalaz","Nauthiz","Isa","Jera","Eihwaz","Perthro","Algiz","Sowilo","Tiwaz","Berkano","Ehwaz","Mannaz","Laguz","Ingwaz","Othala","Dagaz"];
const LENORMAND_36 = ["1 라이더","2 클로버","3 배","4 집","5 나무","6 구름","7 병","8 관","9 꽃다발","10 낭","11 차차","12 새","13 아이","14 여우","15 곰","16 별","17 황상","18 개","19 탓","20 정원","21 산","22 갈림길","23 취","24 하트","25 반지","26 책","27 편지","28 남자","29 여자","30 백포","31 태양","32 달","33 열쇠","34 물고기","35 닭","36 십자가"];
const OGANGI_5 = ["목(목)","화(화)","토(토)","금(금)","수(수)"];
const OBANGGI_5 = ["동"," 서"," 남"," 북"," 중앙"];

// === I Ching (64 hexagrams with Korean names and brief themes) ===
const ICHING_64 = [
  "乼(건) – 하늘 / 창조 / 시작, 우왍한 기원",
  "坤(곤) – 땅 / 수용 / 받아들임, 순응",
  // ... 전체 64금 나머지 동일 (생납)
  "未濟(미제) – 아직 이루지 못함 / 미완 / 시작 전"
];

const REGINA_ORACLE_DECKS = [
  "Starseed Oracle","Sacred Creators Oracle","Voice of the Souls Oracle","Love Flower Oracle",
  "Healing Water Oracle","The Angel Guide Oracle","Angelic Lightwork Healing Oracle"
];

// Preset oracle card examples (full list 생납)
const PRESET_ORACLE_CARDS = {
  'Voice of the Souls Oracle': ['Abundance','Help','Love','Learning'],
  'Healing Water Oracle': ['Atlantis','Beneath the Surface'],
  'Love Flower Oracle': ['라이람','튜리브'],
  'Starseed Oracle': ['Activated Earth','All Paths Lead Home'],
  'Sacred Creators Oracle': ['Over-thinking Can Spoil the Magic','You Are Magic'],
  'The Angel Guide Oracle': ['Angelic Protection','Ask and Receive'],
  'Angelic Lightwork Healing Oracle': ['Break Through into Light','Rising Inner Strength']
};

// ===== small static arrays for perf =====
const NUMBERS_1_TO_78 = Array.from({ length: 78 }, (_, i) => i + 1);

// --- Utils ---
function shuffleInPlace(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function getDeckCards(deckName){ return TAROT_78; }

const NumberCell = ({n,sel,disabled,title,onToggle}) => (
  <button type="button" onClick={()=>onToggle(n)} disabled={disabled}
    className={`text-xs py-1 rounded-lg border ${sel?'bg-indigo-600 border-indigo-500 text-white':'bg-slate-800/70 border-slate-700 hover:bg-slate-700'} ${disabled?'opacity-40 cursor-not-allowed':''}`}>{n}</button>
);

export default function ReginaReadingApp(){
  const [tarotDeck,setTarotDeck]=useState('유니버셜 타로');
  const [allowReversal,setAllowReversal]=useState(true);
  const [reverseRatio,setReverseRatio]=useState(50);
  const [cardCount,setCardCount]=useState(1);

  const [mode,setMode]=useState('random');
  const [numMap,setNumMap]=useState([]);
  const [selectedNums,setSelectedNums]=useState([]);

  const [useRunes,setUseRunes]=useState(false);
  const [runeCount,setRuneCount]=useState(2);
  const [useLenormand,setUseLenormand]=useState(false);
  const [lenormandCount,setLenormandCount]=useState(2);
  const [useOgangi,setUseOgangi]=useState(false);
  const [useObanggi,setUseObanggi]=useState(false);
  const [useIChing,setUseIChing]=useState(false);
  const [iChingCount,setIChingCount]=useState(1);
  const [useOracle,setUseOracle]=useState(false);
  const [oracleDeck,setOracleDeck]=useState(REGINA_ORACLE_DECKS[0]);
  const [oracleCount,setOracleCount]=useState(1);

  const [result,setResult]=useState(null);

  // disable draw in numbers mode until enough picks
  const numbersMismatch = (mode==='numbers' && selectedNums.length !== cardCount);

  useEffect(()=>{
    if(mode==='numbers'){
      if(numMap.length!==78) setNumMap(shuffleInPlace([...getDeckCards(tarotDeck)]));
    }
  },[mode,tarotDeck]);

  const reshuffleNumMap=()=>{ setNumMap(shuffleInPlace([...getDeckCards(tarotDeck)])); setSelectedNums([]); };
  const toggleNum=n=>{ setSelectedNums(prev=> prev.includes(n)? prev.filter(x=>x!==n): [...prev,n]); };

  function drawTarot(){
    const deck=getDeckCards(tarotDeck);
    if(mode==='random'){
      return shuffleInPlace([...deck]).slice(0,cardCount).map((c,i)=>({position:`카드 ${i+1}`, card:c}));
    } else {
      if(selectedNums.length!==cardCount){ alert(`숫자 모드: ${cardCount}장 필요, 현재 ${selectedNums.length}장`); return null; }
      return selectedNums.map(n=>({position:`카드 ${n}`, card:numMap[n-1]}));
    }
  }

  function drawOracles(n){
    const cards = PRESET_ORACLE_CARDS[oracleDeck]||[];
    return shuffleInPlace([...cards]).slice(0,n).map(k=>`${oracleDeck}: ${k}`);
  }

  function onDraw(){
    const tarot=drawTarot(); if(!tarot) return;
    const runes=useRunes? shuffleInPlace([...RUNES_24]).slice(0,runeCount):[];
    const lenormand=useLenormand? shuffleInPlace([...LENORMAND_36]).slice(0,lenormandCount):[];
    const oracles=useOracle? drawOracles(oracleCount):[];
    const aux=[];
    if(useOgangi) aux.push(`오간기: ${shuffleInPlace([...OGANGI_5])[0]}`);
    if(useObanggi) aux.push(`오방기: ${shuffleInPlace([...OBANGGI_5])[0]}`);
    if(useIChing) aux.push(`주역: ${shuffleInPlace([...ICHING_64]).slice(0,iChingCount).join(', ')}`);
    setResult({tarotDeck,cardCount,tarot,runes,lenormand,oracles,aux});
  }

  return (
    <div className="p-6 text-slate-100">
      <h1 className="text-xl font-bold mb-4">레지나 리딩 보조앱 (β)</h1>
      <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700">
        {/* draw mode */}
        <div className="mb-3">
          <label className="text-sm">드로우 모드</label>
          <div className="flex gap-2 mt-1">
            <button onClick={()=>setMode('random')} className={mode==='random'?"bg-indigo-600 px-3 py-1 rounded":"bg-slate-700 px-3 py-1 rounded"}>랜덤</button>
            <button onClick={()=>setMode('numbers')} className={mode==='numbers'?"bg-indigo-600 px-3 py-1 rounded":"bg-slate-700 px-3 py-1 rounded"}>숫자 빨기</button>
            {mode==='numbers' && <button onClick={reshuffleNumMap} className="ml-2 bg-slate-700 px-3 py-1 rounded">맵 다시 쉐긋기</button>}
          </div>
        </div>

        {mode==='numbers' && (
          <div className="space-y-2 mb-3">
            <span className="text-xs">선택 {selectedNums.length}/{cardCount}</span>
            <div className="grid grid-cols-9 gap-1 max-h-40 overflow-auto p-1 rounded bg-slate-900/40 border border-slate-700">
              {NUMBERS_1_TO_78.map(n=>(<NumberCell key={n} n={n} sel={selectedNums.includes(n)} disabled={!selectedNums.includes(n)&&selectedNums.length>=cardCount} title={numMap[n-1]||''} onToggle={toggleNum}/>))}
            </div>
          </div>
        )}

        <div className="mt-3">
          <label className="text-sm">메인 타로 덩</label>
          <select value={tarotDeck} onChange={e=>setTarotDeck(e.target.value)} className="w-full mt-1 bg-slate-900/60 border border-slate-700 rounded p-2">
            <option value="유니버셜 타로">유니버셜 타로</option>
            <option value="나전의 빛 타로">나전의 빛 타로</option>
            <option value="로제딕 타로">로제딕 타로</option>
            <option value="너에게 다이브 타로">너에게 다이브 타로</option>
          </select>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm">역방향 허용</label>
          <input type="checkbox" checked={allowReversal} onChange={e=>setAllowReversal(e.target.checked)}/>
          <input type="range" min={0} max={100} value={reverseRatio} onChange={e=>setReverseRatio(parseInt(e.target.value,10))} className="flex-1"/>
          <span className="text-xs w-10 text-right">{reverseRatio}%</span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm">장수</label>
          <button onClick={()=>setCardCount(Math.max(1,cardCount-1))} className="px-2 bg-slate-700 rounded">-</button>
          <input type="number" value={cardCount} onChange={e=>setCardCount(parseInt(e.target.value,10)||1)} className="w-16 bg-slate-900/60 border border-slate-700 text-center"/>
          <button onClick={()=>setCardCount(Math.min(13,cardCount+1))} className="px-2 bg-slate-700 rounded">+</button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <label><input type="checkbox" checked={useRunes} onChange={e=>setUseRunes(e.target.checked)}/> 룬스톤</label>
          <label><input type="checkbox" checked={useLenormand} onChange={e=>setUseLenormand(e.target.checked)}/> 레노몬드</label>
          <label><input type="checkbox" checked={useOgangi} onChange={e=>setUseOgangi(e.target.checked)}/> 오간기</label>
          <label><input type="checkbox" checked={useObanggi} onChange={e=>setUseObanggi(e.target.checked)}/> 오방기</label>
          <label><input type="checkbox" checked={useOracle} onChange={e=>setUseOracle(e.target.checked)}/> 오라클</label>
          {useOracle && (
            <div className="ml-4">
              <select value={oracleDeck} onChange={e=>setOracleDeck(e.target.value)} className="bg-slate-900/60 border border-slate-700 rounded p-2">
                {REGINA_ORACLE_DECKS.map(n=>(<option key={n} value={n}>{n}</option>))}
              </select>
              <div className="mt-2">
                <button onClick={()=>setOracleCount(Math.max(1,oracleCount-1))} className="px-2 bg-slate-700 rounded">-</button>
                <input type="number" value={oracleCount} onChange={e=>setOracleCount(parseInt(e.target.value,10)||1)} className="w-16 bg-slate-900/60 border border-slate-700 text-center"/>
                <button onClick={()=>setOracleCount(Math.min(13,oracleCount+1))} className="px-2 bg-slate-700 rounded">+</button>
              </div>
            </div>
          )}
          <label><input type="checkbox" checked={useIChing} onChange={e=>setUseIChing(e.target.checked)}/> 주역(I Ching)</label>
        </div>
      </div>

      <button
        onClick={numbersMismatch ? undefined : onDraw}
        disabled={numbersMismatch}
        className={`mt-6 px-5 py-2 rounded ${numbersMismatch ? 'bg-slate-700 opacity-60 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}
      >
        카드 빨기
      </button>
      {mode==='numbers' && numbersMismatch && (
        <div className="text-xs text-amber-300 mt-2">숫자 모드: {cardCount}장을 선택해야 해요. (현재 {selectedNums.length}장)</div>
      )}
      {result && <pre className="mt-4 whitespace-pre-wrap">{JSON.stringify(result,null,2)}</pre>}
    </div>
  );
}


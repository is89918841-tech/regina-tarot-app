import React, { useMemo, useState } from 'react';

const LENORMAND_CARDS = [
  '라이더', '클로버', '배', '집', '나무', '구름', '뱀', '관', '꽃다발', '낫', '채찍', '새',
  '아이', '여우', '곰', '별', '황새', '개', '탑', '정원', '산', '갈림길', '쥐', '하트',
  '반지', '책', '편지', '남자', '여자', '백합', '태양', '달', '열쇠', '물고기', '닻', '십자가',
].map((name, index) => ({
  id: index + 1,
  label: `${index + 1}. ${name}`,
  name,
}));

const CARD_BY_ID = LENORMAND_CARDS.reduce((acc, card) => {
  acc[card.id] = card;
  return acc;
}, {});

const SHUFFLE = (arr) => {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const getRowCol = (house) => ({
  row: Math.floor((house - 1) / 9),
  col: (house - 1) % 9,
});

const generateSpread = () => SHUFFLE(LENORMAND_CARDS).map((card, i) => ({
  ...card,
  house: i + 1,
  ...getRowCol(i + 1),
}));

function getSignificatorDiagonals(spread, source) {
  if (!source) return { downRight: [], downLeft: [] };

  const byCoord = spread.reduce((acc, card) => {
    acc[`${card.row},${card.col}`] = card;
    return acc;
  }, {});

  const collectLine = (dr, dc) => {
    const line = [];

    let row = source.row + dr;
    let col = source.col + dc;
    while (byCoord[`${row},${col}`]) {
      line.push(byCoord[`${row},${col}`]);
      row += dr;
      col += dc;
    }

    row = source.row - dr;
    col = source.col - dc;
    while (byCoord[`${row},${col}`]) {
      line.unshift(byCoord[`${row},${col}`]);
      row -= dr;
      col -= dc;
    }

    return line;
  };

  return {
    downRight: collectLine(1, 1),
    downLeft: collectLine(1, -1),
  };
}

function analyze(spread, significatorConfig) {
  const byHouse = spread.reduce((acc, card) => {
    acc[card.house] = card;
    return acc;
  }, {});

  const selfId = significatorConfig.selfCard === 'man' ? 28 : 29;
  const partnerId = significatorConfig.partnerCard === 'man' ? 28 : 29;

  const self = spread.find((card) => card.id === selfId) || null;
  const partner = spread.find((card) => card.id === partnerId) || null;

  const getAdjacent = (source) => {
    if (!source) return [];
    const deltas = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1],
    ];

    return deltas
      .map(([dr, dc]) => spread.find((c) => c.row === source.row + dr && c.col === source.col + dc))
      .filter(Boolean);
  };

  const selfAdj = getAdjacent(self);
  const partnerAdj = getAdjacent(partner);

  const mainDiagonal = spread.filter((card) => card.row === card.col);
  const secondaryDiagonal = spread.filter((card) => card.row + card.col === 8);
  const significatorDiagonals = {
    self: getSignificatorDiagonals(spread, self),
    partner: getSignificatorDiagonals(spread, partner),
  };

  const focusCards = [self, partner, ...selfAdj].filter(Boolean);
  const fixedFocusCards = [...partnerAdj, byHouse[1], byHouse[36]].filter(Boolean);

  return {
    byHouse,
    significators: { self, partner },
    adjacency: {
      self: selfAdj,
      partner: partnerAdj,
    },
    mainDiagonal,
    secondaryDiagonal,
    significatorDiagonals,
    focusCards,
    fixedFocusCards,
  };
}

function traceHouseChain(startCardId, spread) {
  if (!startCardId) return null;

  const byId = spread.reduce((acc, card) => {
    acc[card.id] = card;
    return acc;
  }, {});

  const visitedOrder = [];
  const visitedSet = new Set();

  let currentCard = byId[startCardId];
  while (currentCard) {
    if (visitedSet.has(currentCard.id)) {
      const loopStartIndex = visitedOrder.findIndex((v) => v.id === currentCard.id);
      return {
        chain: [...visitedOrder, currentCard],
        isLoop: true,
        loopStartIndex,
      };
    }

    visitedOrder.push(currentCard);
    visitedSet.add(currentCard.id);

    const nextCard = byId[currentCard.house];
    if (!nextCard) {
      return {
        chain: visitedOrder,
        isLoop: false,
        loopStartIndex: -1,
      };
    }
    currentCard = nextCard;
  }

  return {
    chain: visitedOrder,
    isLoop: false,
    loopStartIndex: -1,
  };
}

const cardNames = (cards) => cards.map((c) => c.name).join(', ');

export default function ReginaReadingApp() {
  const [spread, setSpread] = useState(() => generateSpread());
  const [question, setQuestion] = useState('');
  const [memo, setMemo] = useState('');
  const [showHouseNumbers, setShowHouseNumbers] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [significatorConfig, setSignificatorConfig] = useState({
    selfCard: 'woman',
    partnerCard: 'man',
  });

  const analysis = useMemo(() => analyze(spread, significatorConfig), [spread, significatorConfig]);

  const chainResult = useMemo(
    () => traceHouseChain(selectedCardId, spread),
    [selectedCardId, spread],
  );

  const mergedFocus = useMemo(() => {
    const map = new Map();
    [...analysis.focusCards, ...analysis.fixedFocusCards].forEach((card) => {
      map.set(card.id, card);
    });
    return [...map.values()];
  }, [analysis]);

  const copyDetailed = async () => {
    const text = [
      '📌 레지나 그랑따블로 상세',
      '',
      question ? `질문: ${question}` : '질문: (없음)',
      memo ? `메모: ${memo}` : '메모: (없음)',
      '',
      '■ 배치 (하우스: 카드)',
      ...spread.map((c) => `${String(c.house).padStart(2, '0')}H: ${c.label}`),
      '',
      '■ 시그니피케이터',
      `나(${significatorConfig.selfCard === 'woman' ? '여자 카드' : '남자 카드'}): ${analysis.significators.self?.label || '없음'}`,
      `상대(${significatorConfig.partnerCard === 'woman' ? '여자 카드' : '남자 카드'}): ${analysis.significators.partner?.label || '없음'}`,
      '',
      '■ 인접',
      `나 인접: ${cardNames(analysis.adjacency.self) || '없음'}`,
      `상대 인접: ${cardNames(analysis.adjacency.partner) || '없음'}`,
      '',
      '■ 메인 대각선',
      cardNames(analysis.mainDiagonal) || '없음',
      '',
      '■ 보조 대각선',
      cardNames(analysis.secondaryDiagonal) || '없음',
      '',
      '■ 시그니피케이터 대각선',
      `나 (↘︎): ${cardNames(analysis.significatorDiagonals.self.downRight) || '없음'}`,
      `나 (↙︎): ${cardNames(analysis.significatorDiagonals.self.downLeft) || '없음'}`,
      `상대 (↘︎): ${cardNames(analysis.significatorDiagonals.partner.downRight) || '없음'}`,
      `상대 (↙︎): ${cardNames(analysis.significatorDiagonals.partner.downLeft) || '없음'}`,
      '',
      '■ 체인 추적',
      selectedCardId ? `시작 카드: ${CARD_BY_ID[selectedCardId]?.label || selectedCardId}` : '시작 카드: (선택 없음)',
      chainResult ? `체인: ${chainResult.chain.map((c) => c.name).join(' → ')}` : '체인: (선택 없음)',
      chainResult ? `루프 여부: ${chainResult.isLoop ? '루프 감지' : '정상 종료'}` : '루프 여부: (선택 없음)',
      '',
      '■ 포커스(중복 제거)',
      cardNames(mergedFocus) || '없음',
    ].join('\n');

    await navigator.clipboard.writeText(text);
  };

  const copySummary = async () => {
    const text = [
      '📌 레지나 리딩 요약',
      question ? `질문: ${question}` : '질문: (없음)',
      memo ? `메모: ${memo}` : '메모: (없음)',
      '',
      `시그니피케이터 | 나: ${analysis.significators.self?.name || '없음'} / 상대: ${analysis.significators.partner?.name || '없음'}`,
      `인접 | 나: ${cardNames(analysis.adjacency.self) || '없음'}`,
      `인접 | 상대: ${cardNames(analysis.adjacency.partner) || '없음'}`,
      `메인 대각선: ${cardNames(analysis.mainDiagonal) || '없음'}`,
      `포커스: ${cardNames(mergedFocus) || '없음'}`,
    ].join('\n');

    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-6 text-slate-100 bg-slate-950 min-h-screen">
      <h1 className="text-xl font-bold mb-4">레지나 그랑따블로 리딩 도구</h1>

      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            질문
            <input
              className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <label className="text-sm">
            메모
            <input
              className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            나 카드 선택
            <select
              className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700"
              value={significatorConfig.selfCard}
              onChange={(e) => setSignificatorConfig((prev) => ({ ...prev, selfCard: e.target.value }))}
            >
              <option value="woman">여자 카드</option>
              <option value="man">남자 카드</option>
            </select>
          </label>
          <label className="text-sm">
            상대 카드 선택
            <select
              className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700"
              value={significatorConfig.partnerCard}
              onChange={(e) => setSignificatorConfig((prev) => ({ ...prev, partnerCard: e.target.value }))}
            >
              <option value="man">남자 카드</option>
              <option value="woman">여자 카드</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            className="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded"
            onClick={() => {
              setSpread(generateSpread());
              setSelectedCardId(null);
            }}
          >
            새 배치 생성
          </button>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={showHouseNumbers}
              onChange={(e) => setShowHouseNumbers(e.target.checked)}
            />
            하우스 번호 표시
          </label>
          <button className="bg-slate-700 px-3 py-2 rounded" onClick={copyDetailed}>상세 복사</button>
          <button className="bg-slate-700 px-3 py-2 rounded" onClick={copySummary}>요약 복사</button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-9 gap-2">
        {spread.map((card) => (
          <button
            key={card.house}
            type="button"
            className={`relative p-2 rounded border text-left min-h-20 ${selectedCardId === card.id ? 'border-indigo-400 bg-indigo-900/30' : 'border-slate-700 bg-slate-900'}`}
            onClick={() => setSelectedCardId(card.id)}
          >
            {showHouseNumbers && (
              <span className="absolute top-1 right-1 text-[10px] text-slate-400">H{card.house}</span>
            )}
            <div className="text-[11px] text-slate-400">#{card.id}</div>
            <div className="text-xs leading-tight mt-1">{card.name}</div>
          </button>
        ))}
      </div>

      <div className="mt-5 bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">체인 추적</h2>
        <p className="text-sm text-slate-300">
          시작 카드: {selectedCardId ? CARD_BY_ID[selectedCardId]?.label : '선택 없음'}
        </p>
        {chainResult && (
          <>
            <div className="text-sm">
              {chainResult.chain.map((c) => c.name).join(' → ')}
            </div>
            {chainResult.isLoop && (
              <div className="text-amber-300 text-sm">
                루프 감지: {chainResult.chain[chainResult.loopStartIndex]?.name}부터 반복됨
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-5 bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-1 text-sm">
        <h2 className="font-semibold mb-2">분석 미리보기</h2>
        <div>나 시그니피케이터: {analysis.significators.self?.label || '없음'}</div>
        <div>상대 시그니피케이터: {analysis.significators.partner?.label || '없음'}</div>
        <div>나 인접: {cardNames(analysis.adjacency.self) || '없음'}</div>
        <div>상대 인접: {cardNames(analysis.adjacency.partner) || '없음'}</div>
        <div>메인 대각선: {cardNames(analysis.mainDiagonal) || '없음'}</div>
        <div>보조 대각선: {cardNames(analysis.secondaryDiagonal) || '없음'}</div>
        <div>나 대각선(↘︎): {cardNames(analysis.significatorDiagonals.self.downRight) || '없음'}</div>
        <div>나 대각선(↙︎): {cardNames(analysis.significatorDiagonals.self.downLeft) || '없음'}</div>
        <div>상대 대각선(↘︎): {cardNames(analysis.significatorDiagonals.partner.downRight) || '없음'}</div>
        <div>상대 대각선(↙︎): {cardNames(analysis.significatorDiagonals.partner.downLeft) || '없음'}</div>
        <div>포커스(중복 제거): {cardNames(mergedFocus) || '없음'}</div>
      </div>
    </div>
  );
}

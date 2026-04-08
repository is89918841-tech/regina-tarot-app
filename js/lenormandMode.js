const lenormandMode = (() => {
  const MAIN_ROWS = 4;
  const MAIN_COLS = 8;

  const fisherYates = (array) => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const cutShuffle = (array) => {
    const shuffled = fisherYates(array);
    const pileSize = Math.floor(shuffled.length / 3);
    const pile1 = shuffled.slice(0, pileSize);
    const pile2 = shuffled.slice(pileSize, pileSize * 2);
    const pile3 = shuffled.slice(pileSize * 2);
    return fisherYates([pile1, pile2, pile3]).flat();
  };

  const parseNumberSelection = (raw) => {
    if (!raw.trim()) return [];
    const tokens = raw.split(',').map((v) => v.trim()).filter(Boolean);
    const parsed = tokens.map((token) => {
      const value = Number(token);
      if (!Number.isInteger(value) || value < 1 || value > 36) {
        throw new Error(`번호 입력 오류: "${token}"는 1~36 정수가 아니에요.`);
      }
      return value;
    });

    if (new Set(parsed).size !== parsed.length) {
      throw new Error('번호 입력 오류: 중복 숫자는 사용할 수 없어요.');
    }

    return parsed;
  };

  const rowColFromPosition = (position) => {
    if (position <= 32) {
      return {
        row: Math.ceil(position / MAIN_COLS),
        col: ((position - 1) % MAIN_COLS) + 1,
      };
    }
    return {
      row: 5,
      col: position - 32,
    };
  };

  const positionFromRowCol = (row, col) => {
    if (row < 1 || row > 5) return null;
    if (row <= MAIN_ROWS) {
      if (col < 1 || col > MAIN_COLS) return null;
      return (row - 1) * MAIN_COLS + col;
    }
    if (col < 1 || col > 4) return null;
    return 32 + col;
  };

  const getAdjacentCards = (spread, position) => {
    const { row, col } = rowColFromPosition(position);
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1],
    ];

    return directions
      .map(([dr, dc]) => positionFromRowCol(row + dr, col + dc))
      .filter((nextPos) => nextPos !== null)
      .map((nextPos) => ({
        position: nextPos,
        card: spread[nextPos - 1],
      }));
  };

  const getDiagonalTLBR = (spread) => {
    const positions = [1, 10, 19, 28, 36];
    return positions.map((p) => spread[p - 1].name);
  };

  const getDiagonalTRBL = (spread) => {
    const positions = [8, 15, 22, 29, 33];
    return positions.map((p) => spread[p - 1].name);
  };

  const generateSpread = ({ deck, mode, numberRaw }) => {
    const base = deck.map((card) => ({ ...card }));

    if (mode === 'full') return fisherYates(base);
    if (mode === 'cut') return cutShuffle(base);

    const numbers = parseNumberSelection(numberRaw);
    if (!numbers.length) {
      throw new Error('번호 지정 추출은 1~36 숫자를 하나 이상 입력해야 해요. 예: 3,7,12');
    }

    const shuffled = fisherYates(base);
    const selected = numbers.map((num) => shuffled[num - 1]);
    const remaining = shuffled.filter((_, idx) => !numbers.includes(idx + 1));
    return [...selected, ...remaining];
  };

  const analyze = (spread, houses) => {
    const findSignificator = (targetId) => {
      const index = spread.findIndex((card) => card.id === targetId);
      if (index < 0) return null;
      const position = index + 1;
      return {
        cardName: spread[index].name,
        position,
        house: houses[position - 1],
        adjacent: getAdjacentCards(spread, position).map((item) => `${item.position}: ${item.card.name}`),
      };
    };

    return {
      woman: findSignificator(29),
      man: findSignificator(28),
      diagonalTLBR: getDiagonalTLBR(spread),
      diagonalTRBL: getDiagonalTRBL(spread),
    };
  };

  return {
    generateSpread,
    analyze,
  };
})();

const app = (() => {
  const shuffleModeEl = document.getElementById('shuffleMode');
  const numberSelectBoxEl = document.getElementById('numberSelectBox');
  const numberInputEl = document.getElementById('numberInput');
  const showHousesEl = document.getElementById('showHouses');
  const highlightSigEl = document.getElementById('highlightSig');
  const generateBtnEl = document.getElementById('generateBtn');
  const spreadContainerEl = document.getElementById('spreadContainer');
  const resultContainerEl = document.getElementById('resultContainer');
  const copyOutputEl = document.getElementById('copyOutput');
  const copyBtnEl = document.getElementById('copyBtn');
  const statusTextEl = document.getElementById('statusText');

  let deck = [];
  let houses = [];
  let currentState = null;

  const shuffleModeLabel = {
    full: '완전 랜덤',
    cut: '컷 포함 셔플',
    number: '번호 지정 추출',
  };

  const renderSpread = () => {
    if (!currentState) return;

    const { spread, options, analysis } = currentState;
    const topRows = spread.slice(0, 32);
    const bottomRow = spread.slice(32);

    const renderCard = (card, index) => {
      const position = index + 1;
      const shouldHighlight = options.highlightSignificator
        && (position === analysis.woman?.position || position === analysis.man?.position);
      const houseText = options.showHouses ? `<div class="card-house">하우스: ${houses[index]}</div>` : '';

      return `
        <article class="card ${shouldHighlight ? 'highlight' : ''}">
          <div class="card-head"><span>#${position}</span><span>${card.id}</span></div>
          <div class="card-name">${card.name}</div>
          ${houseText}
        </article>
      `;
    };

    spreadContainerEl.innerHTML = `
      <div class="spread-grid">
        ${topRows.map((card, idx) => renderCard(card, idx)).join('')}
      </div>
      <div class="bottom-grid">
        ${bottomRow.map((card, idx) => renderCard(card, idx + 32)).join('')}
      </div>
    `;
  };

  const renderResults = () => {
    if (!currentState) return;
    const { analysis } = currentState;

    const sigBlock = (title, sig) => {
      if (!sig) return `<div class="result-box"><h3>${title}</h3><p>배치에서 찾을 수 없습니다.</p></div>`;
      return `
        <div class="result-box">
          <h3>${title}</h3>
          <p>${sig.cardName} · 포지션 ${sig.position} · 하우스 ${sig.house}</p>
          <ul>${sig.adjacent.map((txt) => `<li>${txt}</li>`).join('')}</ul>
        </div>
      `;
    };

    resultContainerEl.innerHTML = `
      ${sigBlock('여자 시그니피케이터', analysis.woman)}
      ${sigBlock('남자 시그니피케이터', analysis.man)}
      <div class="result-box">
        <h3>대각선 흐름</h3>
        <p>TL→BR: ${analysis.diagonalTLBR.join(' → ')}</p>
        <p>TR→BL: ${analysis.diagonalTRBL.join(' → ')}</p>
      </div>
    `;
  };

  const buildCopyText = () => {
    if (!currentState) return '';
    const { spread, analysis, shuffleMode } = currentState;

    const spreadLines = spread.map((card, idx) => `${idx + 1}: ${card.name}`).join('\n');
    const houseLines = spread.map((card, idx) => `${idx + 1}: ${card.name} / ${houses[idx]} House`).join('\n');

    return [
      'Lenormand Grand Tableau',
      '',
      `Shuffle: ${shuffleModeLabel[shuffleMode]}`,
      'Layout: 8x4 + 4',
      '',
      '[Spread]',
      spreadLines,
      '',
      '[Houses]',
      houseLines,
      '',
      '[Significators]',
      `Woman: position ${analysis.woman?.position ?? 'N/A'} (House: ${analysis.woman?.house ?? 'N/A'})`,
      `Man: position ${analysis.man?.position ?? 'N/A'} (House: ${analysis.man?.house ?? 'N/A'})`,
      '',
      '[Adjacent]',
      `Woman: ${(analysis.woman?.adjacent || []).join(', ')}`,
      `Man: ${(analysis.man?.adjacent || []).join(', ')}`,
      '',
      '[Diagonal]',
      `TL→BR: ${analysis.diagonalTLBR.join(' → ')}`,
      `TR→BL: ${analysis.diagonalTRBL.join(' → ')}`,
    ].join('\n');
  };

  const generate = () => {
    try {
      const shuffleMode = shuffleModeEl.value;
      const spread = lenormandMode.generateSpread({
        deck,
        mode: shuffleMode,
        numberRaw: numberInputEl.value,
      });
      const analysis = lenormandMode.analyze(spread, houses);

      currentState = {
        shuffleMode,
        spread,
        analysis,
        options: {
          showHouses: showHousesEl.checked,
          highlightSignificator: highlightSigEl.checked,
        },
      };

      renderSpread();
      renderResults();
      copyOutputEl.value = buildCopyText();
      statusTextEl.textContent = `${shuffleModeLabel[shuffleMode]} 방식으로 36장 배치를 완료했어요.`;
    } catch (error) {
      statusTextEl.textContent = error.message;
    }
  };

  const bindEvents = () => {
    shuffleModeEl.addEventListener('change', () => {
      numberSelectBoxEl.classList.toggle('active', shuffleModeEl.value === 'number');
    });

    generateBtnEl.addEventListener('click', generate);
    showHousesEl.addEventListener('change', () => {
      if (!currentState) return;
      currentState.options.showHouses = showHousesEl.checked;
      renderSpread();
    });
    highlightSigEl.addEventListener('change', () => {
      if (!currentState) return;
      currentState.options.highlightSignificator = highlightSigEl.checked;
      renderSpread();
    });

    copyBtnEl.addEventListener('click', async () => {
      if (!copyOutputEl.value.trim()) return;
      try {
        await navigator.clipboard.writeText(copyOutputEl.value);
      } catch {
        copyOutputEl.select();
        document.execCommand('copy');
      }
      copyBtnEl.textContent = '복사 완료';
      setTimeout(() => {
        copyBtnEl.textContent = '복사하기';
      }, 1200);
    });
  };

  const init = async () => {
    try {
      const response = await fetch('./data/lenormand36.json');
      if (!response.ok) throw new Error('레노먼드 데이터 로드에 실패했어요.');
      deck = await response.json();
      houses = deck.map((card) => card.name);

      bindEvents();
      generate();
    } catch (error) {
      statusTextEl.textContent = error.message;
    }
  };

  return { init };
})();

app.init();

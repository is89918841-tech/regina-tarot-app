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

  const formatPositionCard = (spread, position) => `${position}: ${spread[position - 1].name}`;

  const walkLine = (startPosition, stepRow, stepCol) => {
    const out = [];
    let cursor = startPosition;
    while (cursor !== null) {
      out.push(cursor);
      const { row, col } = rowColFromPosition(cursor);
      cursor = positionFromRowCol(row + stepRow, col + stepCol);
    }
    return out;
  };

  const getAllDiagonalLines = (stepRow, stepCol) => {
    const lines = [];
    for (let position = 1; position <= 36; position += 1) {
      const { row, col } = rowColFromPosition(position);
      const previous = positionFromRowCol(row - stepRow, col - stepCol);
      if (previous !== null) continue;
      lines.push(walkLine(position, stepRow, stepCol));
    }
    return lines;
  };

  const getMainDiagonal = (lines) => lines.reduce((best, line) => (line.length > best.length ? line : best), []);

  const getLineThroughPosition = (position, stepRow, stepCol) => {
    const backward = [];
    let cursor = position;
    while (cursor !== null) {
      backward.push(cursor);
      const { row, col } = rowColFromPosition(cursor);
      cursor = positionFromRowCol(row - stepRow, col - stepCol);
    }
    backward.reverse();

    const forward = [];
    cursor = position;
    while (cursor !== null) {
      const { row, col } = rowColFromPosition(cursor);
      cursor = positionFromRowCol(row + stepRow, col + stepCol);
      if (cursor !== null) forward.push(cursor);
    }
    return [...backward, ...forward];
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

    const tlbrLines = getAllDiagonalLines(1, 1);
    const trblLines = getAllDiagonalLines(1, -1);
    const mainTlbr = getMainDiagonal(tlbrLines);
    const mainTrbl = getMainDiagonal(trblLines);

    const woman = findSignificator(29);
    const man = findSignificator(28);

    const mapLine = (line) => line.map((position) => formatPositionCard(spread, position));
    const filterParallel = (lines, main) => lines
      .filter((line) => line.length >= 3 && line.join(',') !== main.join(','))
      .map(mapLine);

    return {
      woman,
      man,
      mainDiagonals: {
        tlbr: mapLine(mainTlbr),
        trbl: mapLine(mainTrbl),
      },
      parallelDiagonals: {
        tlbr: filterParallel(tlbrLines, mainTlbr),
        trbl: filterParallel(trblLines, mainTrbl),
      },
      significatorDiagonals: {
        woman: woman
          ? {
              tlbr: mapLine(getLineThroughPosition(woman.position, 1, 1)),
              trbl: mapLine(getLineThroughPosition(woman.position, 1, -1)),
            }
          : { tlbr: [], trbl: [] },
        man: man
          ? {
              tlbr: mapLine(getLineThroughPosition(man.position, 1, 1)),
              trbl: mapLine(getLineThroughPosition(man.position, 1, -1)),
            }
          : { tlbr: [], trbl: [] },
      },
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
  const questionEl = document.getElementById('question');
  const memoEl = document.getElementById('memo');
  const generateBtnEl = document.getElementById('generateBtn');
  const saveBtnEl = document.getElementById('saveBtn');
  const extraToggleBtnEl = document.getElementById('extraToggleBtn');
  const spreadContainerEl = document.getElementById('spreadContainer');
  const resultContainerEl = document.getElementById('resultContainer');
  const extraResultContainerEl = document.getElementById('extraResultContainer');
  const historyContainerEl = document.getElementById('historyContainer');
  const copyOutputEl = document.getElementById('copyOutput');
  const copyBtnEl = document.getElementById('copyBtn');
  const statusTextEl = document.getElementById('statusText');

  let deck = [];
  let houses = [];
  let currentState = null;
  let focusCard = null;
  let showExtra = false;

  const shuffleModeLabel = {
    full: '완전 랜덤',
    cut: '컷 포함 셔플',
    number: '번호 지정 추출',
  };

  const sortDiagonalLines = (lines) => {
    const getFirstPosition = (line) => {
      const head = line[0] || '';
      const [numText] = head.split(':');
      const n = Number(numText.trim());
      return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
    };
    return [...lines].sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return getFirstPosition(a) - getFirstPosition(b);
    });
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
      const isFocus = focusCard === position;
      const houseText = options.showHouses ? `<div class="card-house">하우스: ${houses[index]}</div>` : '';

      return `
        <article class="card ${shouldHighlight ? 'highlight' : ''} ${isFocus ? 'focus' : ''}" data-position="${position}">
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

    spreadContainerEl.querySelectorAll('.card').forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        focusCard = Number(cardEl.dataset.position);
        renderSpread();
      });
    });
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
      ${sigBlock('여자 카드 위치', analysis.woman)}
      ${sigBlock('남자 카드 위치', analysis.man)}
      <div class="result-box">
        <h3>대각선 흐름</h3>
        <p>TL→BR: ${analysis.mainDiagonals.tlbr.join(' → ')}</p>
        <p>TR→BL: ${analysis.mainDiagonals.trbl.join(' → ')}</p>
      </div>
    `;

    if (!showExtra) {
      extraResultContainerEl.classList.add('hidden');
      extraResultContainerEl.innerHTML = '';
      return;
    }

    const sortedTlbrParallel = sortDiagonalLines(analysis.parallelDiagonals.tlbr);
    const sortedTrblParallel = sortDiagonalLines(analysis.parallelDiagonals.trbl);
    extraResultContainerEl.classList.remove('hidden');
    extraResultContainerEl.innerHTML = `
      <div class="result-box">
        <h3>보조 대각선</h3>
        <p><strong>TLBR</strong></p>
        <ul>${sortedTlbrParallel.map((line) => `<li>${line.join(' → ')}</li>`).join('')}</ul>
        <p><strong>TRBL</strong></p>
        <ul>${sortedTrblParallel.map((line) => `<li>${line.join(' → ')}</li>`).join('')}</ul>
      </div>
      <div class="result-box">
        <h3>시그니피케이터 대각선</h3>
        <p>여자 TLBR: ${analysis.significatorDiagonals.woman.tlbr.join(' → ')}</p>
        <p>여자 TRBL: ${analysis.significatorDiagonals.woman.trbl.join(' → ')}</p>
        <p>남자 TLBR: ${analysis.significatorDiagonals.man.tlbr.join(' → ')}</p>
        <p>남자 TRBL: ${analysis.significatorDiagonals.man.trbl.join(' → ')}</p>
      </div>
    `;
  };

  const renderHistory = () => {
    const history = JSON.parse(localStorage.getItem('lenormand_history') || '[]');
    if (!history.length) {
      historyContainerEl.innerHTML = '<div class="empty">저장된 배치가 없습니다.</div>';
      return;
    }
    historyContainerEl.innerHTML = history.map((item) => `
      <div class="result-box">
        <h3>${new Date(item.timestamp).toLocaleString('ko-KR')}</h3>
        <p>질문: ${item.question || '없음'}</p>
        <p>메모: ${item.memo || '없음'}</p>
        <p>카드: ${(item.cards || []).join(', ')}</p>
      </div>
    `).join('');
  };

  const saveSpread = () => {
    if (!currentState) {
      statusTextEl.textContent = '먼저 배치를 생성한 뒤 저장해 주세요.';
      return;
    }
    const history = JSON.parse(localStorage.getItem('lenormand_history') || '[]');
    const newItem = {
      question: questionEl.value.trim(),
      cards: currentState.spread.map((card) => card.name),
      memo: memoEl.value.trim(),
      timestamp: Date.now(),
    };
    const updated = [newItem, ...history].slice(0, 10);
    localStorage.setItem('lenormand_history', JSON.stringify(updated));
    renderHistory();
    statusTextEl.textContent = '현재 배치를 저장했어요.';
  };

  const buildCopyText = () => {
    if (!currentState) return '';
    const { spread, analysis, shuffleMode } = currentState;
    const sortedTlbrParallel = sortDiagonalLines(analysis.parallelDiagonals.tlbr);
    const sortedTrblParallel = sortDiagonalLines(analysis.parallelDiagonals.trbl);

    const spreadLines = spread.map((card, idx) => `${idx + 1}: ${card.name}`).join('\n');
    const houseLines = spread.map((card, idx) => `${idx + 1}: ${card.name} / ${houses[idx]} 하우스`).join('\n');

    return [
      '레노먼드 그랑따블로',
      '',
      `셔플 방식: ${shuffleModeLabel[shuffleMode]}`,
      '배치: 8x4 + 4',
      '',
      '[배치 카드]',
      spreadLines,
      '',
      '[하우스]',
      houseLines,
      '',
      '[시그니피케이터]',
      `여자: ${analysis.woman?.position ?? '없음'}번 (하우스: ${analysis.woman?.house ?? '없음'})`,
      `남자: ${analysis.man?.position ?? '없음'}번 (하우스: ${analysis.man?.house ?? '없음'})`,
      '',
      '[인접 카드]',
      `여자: ${(analysis.woman?.adjacent || []).join(', ')}`,
      `남자: ${(analysis.man?.adjacent || []).join(', ')}`,
      '',
      '[메인 대각선]',
      `TL→BR: ${analysis.mainDiagonals.tlbr.join(' → ')}`,
      `TR→BL: ${analysis.mainDiagonals.trbl.join(' → ')}`,
      '',
      '[확장 대각선]',
      '- TLBR 보조 대각선',
      ...sortedTlbrParallel.map((line, idx) => `  ${idx + 1}) ${line.join(' → ')}`),
      '- TRBL 보조 대각선',
      ...sortedTrblParallel.map((line, idx) => `  ${idx + 1}) ${line.join(' → ')}`),
      '',
      '[시그니피케이터 대각선]',
      `- 여자 TLBR: ${analysis.significatorDiagonals.woman.tlbr.join(' → ')}`,
      `- 여자 TRBL: ${analysis.significatorDiagonals.woman.trbl.join(' → ')}`,
      `- 남자 TLBR: ${analysis.significatorDiagonals.man.tlbr.join(' → ')}`,
      `- 남자 TRBL: ${analysis.significatorDiagonals.man.trbl.join(' → ')}`,
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
    saveBtnEl.addEventListener('click', saveSpread);
    extraToggleBtnEl.addEventListener('click', () => {
      showExtra = !showExtra;
      extraToggleBtnEl.textContent = showExtra ? '확장 닫기' : '확장 보기';
      renderResults();
    });
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
      renderHistory();
    } catch (error) {
      statusTextEl.textContent = error.message;
    }
  };

  return { init };
})();

app.init();

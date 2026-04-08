const lenormandMode = (() => {
  const gridWidths = [8, 8, 8, 8, 4];

  const fisherYates = (arr) => {
    const next = [...arr];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const cutShuffle = (arr) => {
    const shuffled = fisherYates(arr);
    const size = Math.floor(shuffled.length / 3);
    const piles = [
      shuffled.slice(0, size),
      shuffled.slice(size, size * 2),
      shuffled.slice(size * 2),
    ];
    const order = fisherYates([0, 1, 2]);
    return order.flatMap((idx) => piles[idx]);
  };

  const rowColFromPos = (pos) => {
    if (pos <= 32) {
      const row = Math.ceil(pos / 8);
      const col = ((pos - 1) % 8) + 1;
      return { row, col };
    }
    return { row: 5, col: pos - 32 };
  };

  const posFromRowCol = (row, col) => {
    if (row < 1 || row > 5) return null;
    const width = gridWidths[row - 1];
    if (col < 1 || col > width) return null;
    if (row <= 4) return (row - 1) * 8 + col;
    return 32 + col;
  };

  const getAdjacentPositions = (position) => {
    const { row, col } = rowColFromPos(position);
    const deltas = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1],
    ];
    return deltas
      .map(([dr, dc]) => posFromRowCol(row + dr, col + dc))
      .filter(Boolean);
  };

  const getDiagonals = (cardsByPos) => {
    const tlbr = [];
    const trbl = [];
    for (let i = 1; i <= 4; i += 1) {
      const p1 = (i - 1) * 8 + i;
      const p2 = (i - 1) * 8 + (9 - i);
      tlbr.push(cardsByPos[p1]?.name ?? '-');
      trbl.push(cardsByPos[p2]?.name ?? '-');
    }
    tlbr.push(cardsByPos[36]?.name ?? '-');
    trbl.push(cardsByPos[33]?.name ?? '-');
    return { tlbr, trbl };
  };

  const buildByMode = ({ deck, mode, numberSelection }) => {
    if (mode === 'cut_shuffle') return cutShuffle(deck);
    if (mode === 'number_selection') {
      const shuffled = fisherYates(deck);
      if (numberSelection.length !== 36) {
        throw new Error('Number Selection requires exactly 36 numbers (1-36).');
      }
      return numberSelection.map((n) => shuffled[n - 1]);
    }
    return fisherYates(deck);
  };

  const generate = ({ deck, mode, numberSelection }) => {
    const orderedCards = buildByMode({ deck, mode, numberSelection });
    const spread = orderedCards.map((card, idx) => ({
      position: idx + 1,
      card,
      house: deck[idx],
    }));
    const byPos = Object.fromEntries(spread.map((s) => [s.position, s.card]));

    const buildSignificator = (id) => {
      const found = spread.find((s) => s.card.id === id);
      if (!found) return null;
      const adjacent = getAdjacentPositions(found.position)
        .map((p) => ({ position: p, card: byPos[p]?.name ?? '-' }));
      return {
        name: found.card.name,
        position: found.position,
        house: found.house.name,
        adjacent,
      };
    };

    return {
      spread,
      significators: {
        woman: buildSignificator(29),
        man: buildSignificator(28),
      },
      diagonals: getDiagonals(byPos),
    };
  };

  const render = ({ result, showHouses, highlightSignificator, container }) => {
    container.innerHTML = '';
    const womanPos = result.significators.woman?.position;
    const manPos = result.significators.man?.position;

    const top32 = result.spread.slice(0, 32);
    top32.forEach((item) => {
      const div = document.createElement('article');
      div.className = 'card';
      if (highlightSignificator && (item.position === womanPos || item.position === manPos)) {
        div.classList.add('highlight');
      }
      div.innerHTML = `<div><strong>${item.position}. ${item.card.name}</strong></div>
      ${showHouses ? `<div class="meta">House: ${item.house.name}</div>` : ''}`;
      container.appendChild(div);
    });

    const bottom = document.createElement('div');
    bottom.className = 'bottom-row';
    result.spread.slice(32).forEach((item) => {
      const div = document.createElement('article');
      div.className = 'card';
      if (highlightSignificator && (item.position === womanPos || item.position === manPos)) {
        div.classList.add('highlight');
      }
      div.innerHTML = `<div><strong>${item.position}. ${item.card.name}</strong></div>
      ${showHouses ? `<div class="meta">House: ${item.house.name}</div>` : ''}`;
      bottom.appendChild(div);
    });
    container.appendChild(bottom);
  };

  const formatCopy = ({ result, shuffleMode }) => {
    const spreadLines = result.spread.map((s) => `${s.position}: ${s.card.name}`).join('\n');
    const houseLines = result.spread.map((s) => `${s.position}: ${s.card.name} / ${s.house.name} House`).join('\n');

    const fmtAdj = (sig) => sig?.adjacent?.map((a) => `${a.position}:${a.card}`).join(', ') || 'N/A';

    return [
      'Lenormand Grand Tableau',
      '',
      `Shuffle: ${shuffleMode}`,
      'Layout: 8x4 + 4',
      '',
      '[Spread]',
      spreadLines,
      '',
      '[Houses]',
      houseLines,
      '',
      '[Significators]',
      `Woman: position ${result.significators.woman?.position ?? 'N/A'} (House: ${result.significators.woman?.house ?? 'N/A'})`,
      `Man: position ${result.significators.man?.position ?? 'N/A'} (House: ${result.significators.man?.house ?? 'N/A'})`,
      '',
      '[Adjacent]',
      `Woman: ${fmtAdj(result.significators.woman)}`,
      `Man: ${fmtAdj(result.significators.man)}`,
      '',
      '[Diagonal]',
      `TL→BR: ${result.diagonals.tlbr.join(' → ')}`,
      `TR→BL: ${result.diagonals.trbl.join(' → ')}`,
    ].join('\n');
  };

  return { generate, render, formatCopy };
})();

const app = (() => {
  let deck = [];
  let latestText = '';

  const el = {
    shuffleMode: document.getElementById('shuffle-mode'),
    numbersInput: document.getElementById('number-selection-input'),
    showHouses: document.getElementById('show-houses'),
    highlight: document.getElementById('highlight-significator'),
    generate: document.getElementById('generate-btn'),
    copy: document.getElementById('copy-btn'),
    grid: document.getElementById('tableau-grid'),
    output: document.getElementById('result-output'),
  };

  const normalizeNumbers = (raw) => {
    const numbers = raw
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 36);
    if (new Set(numbers).size !== numbers.length) {
      throw new Error('Duplicate numbers are not allowed in Number Selection mode.');
    }
    return numbers;
  };

  const modeLabel = {
    full_random: 'Full Random',
    cut_shuffle: 'Cut Shuffle',
    number_selection: 'Number Selection',
  };

  const onGenerate = () => {
    try {
      const mode = el.shuffleMode.value;
      const result = lenormandMode.generate({
        deck,
        mode,
        numberSelection: mode === 'number_selection' ? normalizeNumbers(el.numbersInput.value) : [],
      });
      lenormandMode.render({
        result,
        showHouses: el.showHouses.checked,
        highlightSignificator: el.highlight.checked,
        container: el.grid,
      });
      latestText = lenormandMode.formatCopy({ result, shuffleMode: modeLabel[mode] });
      el.output.textContent = latestText;
      el.copy.disabled = false;
    } catch (err) {
      el.output.textContent = `Error: ${err.message}`;
      el.copy.disabled = true;
    }
  };

  const onCopy = async () => {
    if (!latestText) return;
    await navigator.clipboard.writeText(latestText);
  };

  const init = async () => {
    const response = await fetch('./data/lenormand36.json');
    deck = await response.json();

    el.generate.addEventListener('click', onGenerate);
    el.copy.addEventListener('click', onCopy);
    el.showHouses.addEventListener('change', () => el.generate.click());
    el.highlight.addEventListener('change', () => el.generate.click());
    onGenerate();
  };

  return { init };
})();

app.init();

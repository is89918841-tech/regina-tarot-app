// 레지나 백업 명식 계산기 v13 Phase A - 문장/표기 후처리

const TERM_MAP = {
  '천鉞': '천월',
  '천魁': '천괴',
  '화祿': '화록',
  '화權': '화권',
  '화科': '화과',
  '화忌': '화기',
};

function normalizeTerms(text = '') {
  let out = String(text ?? '');
  for (const [from, to] of Object.entries(TERM_MAP)) {
    out = out.split(from).join(to);
  }
  return out;
}

function normalizeKoreanParticles(text = '') {
  return String(text ?? '')
    .replace(/지혜은/g, '지혜는')
    .replace(/유연·지혜은/g, '유연·지혜는')
    .replace(/수을/g, '수를')
    .replace(/목을/g, '목을')
    .replace(/화을/g, '화를')
    .replace(/토을/g, '토를')
    .replace(/금을/g, '금을')
    .replace(/,\s*,/g, ',')
    .replace(/\/\s*\//g, '/')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function postProcessText(text = '') {
  return normalizeKoreanParticles(normalizeTerms(text));
}

module.exports = { postProcessText, normalizeTerms, normalizeKoreanParticles };

const { calculate } = require('./combinedAnalysis');

function buildLotteryContext(input) {
  return calculate(input, { mode: 'lottery' });
}

function buildBirthProfile(input) {
  return calculate(input, { mode: 'profile' });
}

function buildReadingContext(input) {
  return calculate(input, { mode: 'reading' });
}

module.exports = {
  calculate,
  buildLotteryContext,
  buildBirthProfile,
  buildReadingContext,
};

export const GAME_CONFIG = Object.freeze({
  startingLives: 3,
  questionsPerStage: 5,
  firstLimitMs: 3000,
  decreaseEvery: 3,
  decreaseMs: 100,
  minimumLimitMs: 1000,
  backgroundStartsAt: 31,
  maxSpeedBonus: 100,
  maxComboBonus: 50,
});

export const COLORS = Object.freeze([
  { id: 'red', labelKo: '빨강', labelEn: 'Red', hex: '#ff5361', background: '#351a20' },
  { id: 'blue', labelKo: '파랑', labelEn: 'Blue', hex: '#61a7ff', background: '#182844' },
  { id: 'green', labelKo: '초록', labelEn: 'Green', hex: '#5ce0a0', background: '#17342b' },
  { id: 'yellow', labelKo: '노랑', labelEn: 'Yellow', hex: '#ffd35c', background: '#393219' },
]);

export const WORDS = Object.freeze(['RED', 'BLUE', 'GREEN', 'YELLOW']);

export function limitForQuestion(questionNumber) {
  const n = Math.max(1, Math.floor(Number(questionNumber) || 1));
  return Math.max(
    GAME_CONFIG.minimumLimitMs,
    GAME_CONFIG.firstLimitMs - Math.floor((n - 1) / GAME_CONFIG.decreaseEvery) * GAME_CONFIG.decreaseMs,
  );
}

function seededRandom(seed) {
  let value = Number(seed) >>> 0;
  if (value === 0) value = 0x6d2b79f5;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    value >>>= 0;
    return value / 0x100000000;
  };
}

export function createQuestionSequence(seed) {
  const random = seededRandom(seed);
  let index = 0;
  return {
    next() {
      const questionNumber = index + 1;
      const wordIndex = Math.floor(random() * WORDS.length);
      const colorIndex = Math.floor(random() * COLORS.length);
      let backgroundIndex = null;
      if (questionNumber >= GAME_CONFIG.backgroundStartsAt) {
        do { backgroundIndex = Math.floor(random() * COLORS.length); }
        while (backgroundIndex === colorIndex || backgroundIndex === wordIndex);
      }
      const question = {
        index,
        number: questionNumber,
        stage: Math.floor(index / GAME_CONFIG.questionsPerStage) + 1,
        word: WORDS[wordIndex],
        wordIndex,
        colorIndex,
        correctColor: colorIndex,
        backgroundIndex,
        limitMs: limitForQuestion(questionNumber),
      };
      index += 1;
      return question;
    },
  };
}

export function questionAt(seed, requestedIndex) {
  const sequence = createQuestionSequence(seed);
  let question;
  for (let index = 0; index <= requestedIndex; index += 1) question = sequence.next();
  return question;
}

export function pointsForAnswer(reactionMs, limitMs, combo) {
  const reaction = Math.max(0, Number(reactionMs) || 0);
  const limit = Math.max(1, Number(limitMs) || GAME_CONFIG.firstLimitMs);
  const speedBonus = Math.max(0, Math.min(GAME_CONFIG.maxSpeedBonus, Math.floor(100 * (1 - reaction / limit))));
  const comboBonus = Math.min(GAME_CONFIG.maxComboBonus, Math.max(0, (combo - 1) * 5));
  return { speedBonus, comboBonus, total: 100 + speedBonus + comboBonus };
}

export function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] || 0x6d2b79f5;
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function localDailySeed(dateString) {
  let hash = 2166136261;
  for (const character of `playbox-stroop-daily-v3-${dateString}`) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x6d2b79f5;
}

export function kstDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

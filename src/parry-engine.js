export const PARRY_DIRECTIONS = Object.freeze(['left', 'right', 'up', 'down']);

export const PARRY_BOSSES = Object.freeze([
  { name: '훈련 검사', epithet: 'THE WARDEN', damage: 10 },
  { name: '쌍검 사냥꾼', epithet: 'TWIN FANG', damage: 14 },
  { name: '철갑 수문장', epithet: 'IRON GATE', damage: 18 },
  { name: '환영 검사', epithet: 'THE MIRAGE', damage: 22 },
  { name: '붉은 검성', epithet: 'RED SOVEREIGN', damage: 28 },
  { name: '무명의 검성', epithet: 'THE LAST BLADE', damage: 35 },
]);

export const PARRY_CONFIG = Object.freeze({
  startingHp: 100,
  bossHeal: 15,
  perfectWindowMs: 70,
  goodWindowMs: 150,
  bossHealDelayMs: 1500,
  countdownMs: 3000,
  perfectDamage: 25,
  goodDamage: 10,
});

export function bossName(bossNumber) {
  return PARRY_BOSSES[bossNumber - 1]?.name || '무한 검성';
}

export function bossEpithet(bossNumber) {
  return PARRY_BOSSES[bossNumber - 1]?.epithet || 'ENDLESS SWORD SAINT';
}

export function bossHp(bossNumber) {
  return Math.min(250, 100 + (Math.max(1, bossNumber) - 1) * 20);
}

export function bossDamage(bossNumber) {
  if (bossNumber <= PARRY_BOSSES.length) return PARRY_BOSSES[bossNumber - 1].damage;
  return Math.min(60, 35 + (bossNumber - 6) * 4);
}

function makeRandom(seed, bossNumber, planNumber) {
  let value = (Number(seed) ^ Math.imul(bossNumber, 0x9e3779b1) ^ Math.imul(planNumber + 1, 0x85ebca77)) >>> 0;
  if (value === 0) value = 0x6d2b79f5;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    value >>>= 0;
    return value / 0x100000000;
  };
}

export function createAttackPlan(seed, bossNumber, planNumber) {
  const boss = Math.max(1, Math.floor(Number(bossNumber) || 1));
  const planIndex = Math.max(0, Math.floor(Number(planNumber) || 0));
  const random = makeRandom(seed, boss, planIndex);
  const types = boss <= 2 ? ['slash'] : boss <= 4 ? ['slash','delay']
    : boss === 5 ? ['slash','delay','fast'] : ['slash','delay','feint','fast'];
  const type = types[Math.floor(random() * types.length)];

  let hitCount = 1;
  if (boss === 2) hitCount = random() < 0.55 ? 2 : 1;
  else if (boss === 3 || boss === 4) hitCount = random() < 0.65 ? 2 : 1;
  else if (boss === 5) hitCount = random() < 0.45 ? 3 : 2;
  else if (boss === 6) hitCount = random() < 0.25 ? 4 : random() < 0.55 ? 3 : 2;
  else if (boss >= 7) {
    const roll = random();
    hitCount = roll < 0.18 ? 1 : roll < 0.55 ? 2 : roll < 0.85 ? 3 : 4;
  }

  const hits = [];
  for (let index = 0; index < hitCount; index += 1) {
    const direction = PARRY_DIRECTIONS[Math.floor(random() * PARRY_DIRECTIONS.length)];
    const fakeDirection=type==='feint'&&index===0
      ? PARRY_DIRECTIONS[(PARRY_DIRECTIONS.indexOf(direction)+1+Math.floor(random()*3))%4]:null;
    hits.push({ direction, fakeDirection });
  }

  const baseWarning = Math.max(520, 900 - (boss - 1) * 45);
  const warningMs = Math.max(type==='feint'?850:520, baseWarning + (type === 'delay' ? 420 : 0) - (type === 'fast' ? 210 : 0));
  hits.forEach((hit,index)=>{hit.warningMs=index===0?warningMs:Math.max(360,Math.min(440,warningMs-240));});
  return {
    boss,
    index: planIndex,
    type,
    hitCount,
    warningMs,
    revealAfterMs: type==='feint'?warningMs-500:0,
    intervalMs: Math.max(125,205-Math.max(0,boss-2)*12),
    hits,
  };
}

export function classifyParry(direction, targetDirection, offsetMs) {
  const offset = Number(offsetMs);
  const inGoodWindow = Number.isFinite(offset) && Math.abs(offset) <= PARRY_CONFIG.goodWindowMs;
  if (!inGoodWindow || direction !== targetDirection) return 'miss';
  return Math.abs(offset) <= PARRY_CONFIG.perfectWindowMs ? 'perfect' : 'good';
}

export function parryScore(rating, combo, perfectStreak) {
  if (rating === 'miss') return 0;
  const base = rating === 'perfect' ? 150 : 100;
  const comboBonus = Math.min(50, Math.max(0, combo - 1) * 5);
  const perfectBonus = rating === 'perfect' ? Math.min(50, Math.max(0, perfectStreak - 1) * 10) : 0;
  return base + comboBonus + perfectBonus;
}

export function randomParrySeed() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] || 0x6d2b79f5;
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function dailyParrySeed(dateString) {
  let hash = 2166136261;
  for (const character of `playbox-parry-daily-v2-${dateString}`) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x6d2b79f5;
}

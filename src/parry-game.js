import {
  PARRY_CONFIG, bossDamage, bossEpithet, bossHp, bossName, classifyParry,
  createAttackPlan, dailyParrySeed, parryScore, randomParrySeed,
} from './parry-engine.js';
import { parryGet, parryPlayer, parryPost, saveParryNickname } from './parry-api.js';
import { attackMotion } from './parry-motion.js';
import { playCompletionChime,playMetalClash,prepareCombatAudio,playSwordSwing,stopCombatAudio } from './parry-audio.js';

const RECORD_KEY = 'playbox-parry-record-v1';
const SOUND_KEY = 'playbox-parry-sound-v1';
const DIR_NAME = { left: '왼쪽', right: '오른쪽', up: '위쪽', down: '아래쪽' };
const KEY_DIR = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };

function todayKst() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(date) {
  const [year, month, day] = date.split('-');
  return `${year}.${month}.${day}`;
}

function readRecords() {
  try { return JSON.parse(localStorage.getItem(RECORD_KEY) || '{}'); }
  catch { return {}; }
}

function writeRecords(records) {
  try { localStorage.setItem(RECORD_KEY, JSON.stringify(records)); }
  catch { /* Local records are optional. */ }
}

function localSoundEnabled() {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; }
  catch { return true; }
}

function emptyModel() {
  return {
    mode: 'survival', seed: 0, phase: 'lobby', boss: 1, bossHp: 100, bossMaxHp: 100,
    playerHp: 100, score: 0, combo: 0, bestCombo: 0, perfectStreak: 0,
    bossesDefeated: 0, lastBossParries: 0, totalAttacks: 0, perfects: 0, goods: 0,
    misses: 0, events: [], planIndex: 0, hitIndex: 0, plan: null, currentAttack: null,
    currentTime: performance.now(), startAt: 0, countdownEnds: 0, nextAt: 0,
    bossDeathAt: 0, effectUntil: 0, lastOutcome: '', lastParryDirection: null,
    ranked: false, runId: null, runToken: null, date: todayKst(), pauseAt: 0,
    resultRecord: false, soundOn: localSoundEnabled(),
  };
}

export function mountParryGame(root, { onExit = () => {} } = {}) {
  root.innerHTML = `
    <div class="parry-page">
      <header class="parry-bar"><a class="parry-back" href="./index.html#games">← <img class="noltap-icon" src="./icons/logo.webp" width="32" height="32" alt="" /><span>NOLTAP</span></a><span class="parry-bar-title">PARRY <i>·</i> LAST BLADE</span><button class="parry-sound" type="button" aria-label="효과음 끄기">♫</button></header>
      <section class="parry-lobby">
        <div class="parry-lobby-main">
          <img class="parry-lobby-art" src="./images/parry-card.webp" alt="" aria-hidden="true" decoding="async">
          <div class="parry-kicker"><i></i> GAME 02 / ENDLESS DUEL</div>
          <h1>PARRY<span>:</span><br><em>LAST BLADE</em></h1>
          <p class="parry-intro">정면의 검을 읽고, 충돌 순간에 쳐내.<br>끝없이 강해지는 검성 앞에서 마지막까지 살아남아.</p>
          <div class="parry-bestline"><span>나의 최고 기록</span><strong id="parry-personal-best">—</strong><i>보스 처치</i><b id="parry-personal-score">0 PTS</b></div>
          <div class="parry-mode-actions"><button class="parry-start" data-mode="survival" type="button"><span><small>ENDLESS SURVIVAL</small>무한 생존</span><b>↗</b></button><button class="parry-start parry-daily-start" data-mode="daily" type="button"><span><small>DAILY SWORD SAINT · <i id="parry-date-short">TODAY</i></small>오늘의 검성전</span><b>↗</b></button></div>
          <div class="parry-controls-note"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 방향키</span><i>검이 들어오는 방향으로 패링</i></div>
        </div>
        <div class="parry-lobby-side">
          <section class="parry-nickname"><label for="parry-nickname">랭킹 닉네임 <small>2–16자</small></label><div><input id="parry-nickname" maxlength="16" autocomplete="nickname"><button id="parry-save-name" type="button">저장</button></div><p id="parry-name-note">회원가입 없이 기기별 익명 기록으로 플레이해.</p></section>
          <section class="parry-board"><div class="parry-board-head"><div><span class="parry-kicker">SWORD SAINTS</span><h2 id="parry-board-title">오늘의 TOP 100</h2></div><div class="parry-tabs"><button class="is-active" data-board="daily" type="button">오늘</button><button data-board="survival" type="button">전체</button></div></div><div class="parry-board-date" id="parry-board-date">오늘의 검성전 · ${formatDate(todayKst())}</div><div class="parry-board-cols"><span>순위 · 플레이어</span><span>보스</span><span>점수</span></div><ol class="parry-board-list" id="parry-board-list"><li>랭킹을 불러오는 중…</li></ol><p class="parry-board-foot" id="parry-board-foot">개인 기록과 온라인 순위를 확인하세요.</p></section>
          <section class="parry-rules"><div class="parry-kicker">READ THE BLADE</div><h2>방향과 타이밍, 둘 다 맞춰</h2><p><b>PERFECT</b> ±70ms · 25 피해 반격</p><p><b>GOOD</b> ±150ms · 10 피해 반격</p><p><b>MISS</b> 실수 1회당 보스 공격력만큼 HP 감소</p><small>보스를 처치하면 HP 15 회복 · 패링 입력은 한 공격당 한 번</small><small>페이크는 6번째 보스부터 · 연속 베기는 짧은 간격으로 이어집니다</small></section>
        </div>
      </section>

      <section class="parry-battle hidden" aria-label="패링 전투">
        <div class="parry-hud-top"><button class="parry-exit" type="button">← 메뉴</button><div class="parry-boss-info"><div class="parry-boss-name"><span id="parry-boss-number">BOSS 01</span><strong id="parry-boss-name">훈련 검사</strong><i id="parry-boss-title">THE WARDEN</i></div><div class="parry-boss-health"><div><span>ENEMY VITALITY</span><b id="parry-boss-hp-text">100 / 100</b></div><div class="parry-health-track enemy-track"><i id="parry-boss-hp"></i></div></div></div><div class="parry-score"><span>SCORE</span><strong id="parry-score">000000</strong></div><button class="parry-pause" type="button" aria-label="일시정지">Ⅱ</button></div>
        <div class="parry-arena-wrap" id="parry-arena-wrap"><div class="parry-canvas" id="parry-canvas"></div><div class="parry-countdown hidden" id="parry-countdown"><small>THE DUEL BEGINS IN</small><strong id="parry-count-num">3</strong></div><div class="parry-intent" id="parry-intent"><span id="parry-intent-kicker">READ THE BLADE</span><strong id="parry-intent-text">적의 움직임을 살펴</strong><i id="parry-intent-mark">✦</i></div><div class="parry-feedback" id="parry-feedback"></div><div class="parry-pause-overlay hidden" id="parry-pause-overlay"><span>Ⅱ</span><strong>전투 일시정지</strong><button id="parry-resume" type="button">계속하기</button></div><div class="parry-fight-title" id="parry-fight-title"><span>FIRST ENCOUNTER</span><b>훈련 검사</b></div></div>
        <div class="parry-underbar"><div class="parry-player-vitality"><div><span>YOUR VITALITY</span><b id="parry-player-hp-text">100 / 100</b></div><div class="parry-health-track player-track"><i id="parry-player-hp"></i></div></div><div class="parry-combat-data"><span><small>COMBO</small><b id="parry-combo">× 0</b></span><span><small>PERFECT</small><b id="parry-perfects">0</b></span><span><small>DEFEATED</small><b id="parry-defeated">0</b></span></div><div class="parry-dpad" role="group" aria-label="4방향 패링"><button class="dpad-up" data-parry-dir="up" aria-label="위쪽 패링">↑</button><button class="dpad-left" data-parry-dir="left" aria-label="왼쪽 패링">←</button><button class="dpad-down" data-parry-dir="down" aria-label="아래쪽 패링">↓</button><button class="dpad-right" data-parry-dir="right" aria-label="오른쪽 패링">→</button></div></div><div class="parry-hint"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 또는 방향키로 막아</span><span>패링 판정은 검 충돌 시점 기준 ±150ms</span></div>
      </section>

      <section class="parry-result hidden" aria-label="전투 결과"><div class="parry-result-eyebrow"><i></i> THE DUEL IS OVER</div><h1>GAME<br><em>OVER</em></h1><p id="parry-result-message">이번 전투 기록이야.</p><div class="parry-result-main"><div class="parry-result-bosses"><span>DEFEATED BOSSES</span><strong id="parry-result-bosses">0</strong><small>BOSSES</small></div><div class="parry-result-score"><span>FINAL SCORE</span><strong id="parry-result-score">0</strong><small>PTS</small></div></div><div class="parry-result-grid"><div><span>최고 도달 보스</span><b id="parry-result-highest">1</b></div><div><span>마지막 보스 패링</span><b id="parry-result-last">0</b></div><div><span>전체 패링 성공</span><b id="parry-result-successes">0</b></div><div><span>최고 콤보</span><b id="parry-result-combo">0</b></div><div><span>PERFECT</span><b id="parry-result-perfect">0</b></div><div><span>GOOD</span><b id="parry-result-good">0</b></div><div><span>MISS</span><b id="parry-result-miss">0</b></div><div><span>패링 성공률</span><b id="parry-result-rate">0%</b></div><div><span>플레이 시간</span><b id="parry-result-duration">00:00</b></div></div><div class="parry-result-rank" id="parry-result-rank">개인 최고 기록을 저장했어.</div><div class="parry-result-actions"><button class="parry-start" data-mode="survival" type="button"><span><small>FIGHT AGAIN</small>다시 도전</span><b>↗</b></button><button id="parry-share" type="button">결과 공유 ↗</button><button id="parry-to-menu" type="button">모드 선택</button></div></section>
      <footer class="parry-site-footer"><span>© 2026 NOLTAP</span><nav class="site-links" aria-label="하단 메뉴"><a href="./about.html">사이트 소개</a><a href="./contact.html">문의</a><a href="./privacy.html">개인정보처리방침</a></nav></footer>
      <div class="parry-toast" id="parry-toast" role="status" aria-live="polite"></div>
    </div>`;

  const $ = (selector) => root.querySelector(selector);
  const lobby = $('.parry-lobby');
  const battle = $('.parry-battle');
  const result = $('.parry-result');
  const model = emptyModel();
  const nickname = parryPlayer().nickname || '플레이어';
  $('#parry-nickname').value = nickname;
  $('#parry-date-short').textContent = formatDate(todayKst());
  const soundButton = $('.parry-sound');
  let audioContext;
  let arenaRenderer;
  let rendererAsset;
  let activeBoard = 'daily';
  let toastTimer;
  let shuttingDown = false;
  let runStarting = false;
  let rendererFactory = null;

  function readyAudio(){
    if(!model.soundOn)return;
    try{
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)({latencyHint:'interactive'});
      if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
      void prepareCombatAudio(audioContext);
    }catch{/* Audio is optional. */}
  }

  function toast(message) {
    const node = $('#parry-toast');
    node.textContent = message;
    node.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove('is-visible'), 2400);
  }

  function playTone(frequency, duration = 0.09, type = 'triangle', volume = 0.04) {
    if (!model.soundOn) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    } catch { /* Audio is optional. */ }
  }

  function updateSoundButton() {
    soundButton.textContent = model.soundOn ? '♫' : '♪̸';
    soundButton.setAttribute('aria-label', model.soundOn ? '효과음 끄기' : '효과음 켜기');
  }

  function playClash(rating) {
    if (!model.soundOn) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      playMetalClash(audioContext,rating);
    } catch { /* Audio is optional. */ }
  }

  function updateLobbyRecord(local = readRecords()) {
    const survival = local.survival || {};
    $('#parry-personal-best').textContent = survival.bossesDefeated ? String(survival.bossesDefeated).padStart(2, '0') : '—';
    $('#parry-personal-score').textContent = `${(survival.score || 0).toLocaleString('ko-KR')} PTS`;
  }

  function setMode(mode) {
    activeBoard = mode;
    $('.parry-tabs').querySelectorAll('button').forEach((button) => button.classList.toggle('is-active', button.dataset.board === mode));
    $('#parry-board-title').textContent = mode === 'daily' ? '오늘의 TOP 100' : '전체 TOP 100';
    $('#parry-board-date').textContent = mode === 'daily' ? `오늘의 검성전 · ${formatDate(todayKst())}` : '무한 생존 누적 기록';
    loadLeaderboard(mode);
  }

  async function loadLeaderboard(mode = activeBoard) {
    const list = $('#parry-board-list');
    list.innerHTML = '<li>랭킹을 불러오는 중…</li>';
    try {
      const resultData = await parryGet('leaderboard', { mode, limit: '100', challenge_date: todayKst() });
      if (mode !== activeBoard) return;
      $('#parry-board-title').textContent = mode === 'daily' ? '오늘의 TOP 100' : '전체 TOP 100';
      list.replaceChildren();
      if (!resultData.rows?.length) {
        list.innerHTML = '<li>아직 기록이 없어. 첫 검성에 도전해봐!</li>';
      } else {
        resultData.rows.forEach((row, index) => {
          const item = document.createElement('li');
          item.innerHTML = `<span class="parry-rank"><i>${String(index + 1).padStart(2, '0')}</i><b></b></span><span>${Number(row.bosses_defeated).toLocaleString('ko-KR')}</span><span>${Number(row.score).toLocaleString('ko-KR')}</span>`;
          item.querySelector('.parry-rank b').textContent = row.nickname || '검객';
          if (row.is_me) item.classList.add('is-me');
          list.append(item);
        });
      }
      $('#parry-board-foot').textContent = mode === 'daily' ? '보스 처치 → 마지막 보스 패링 → 점수 → PERFECT 비율 순' : '회원가입 없이 익명으로 기록을 경쟁해.';
    } catch {
      if (mode !== activeBoard) return;
      const record=readRecords()[mode==='daily'?`daily-${todayKst()}`:'survival'];
      $('#parry-board-title').textContent='이 기기의 최고 기록';
      list.replaceChildren();
      const item=document.createElement('li');
      if(record){
        item.classList.add('is-me');
        item.innerHTML=`<span class="parry-rank"><i>MY</i><b></b></span><span>${Number(record.bossesDefeated)||0}</span><span>${(Number(record.score)||0).toLocaleString('ko-KR')}</span>`;
        item.querySelector('b').textContent=parryPlayer().nickname||'플레이어';
      }else{
        item.className='parry-empty-record';
        item.textContent='첫 결투를 시작하고 기록을 남겨보세요.';
      }
      list.append(item);
      $('#parry-board-foot').textContent='온라인 랭킹 연결 전까지 이 기기의 개인 기록을 표시합니다.';
    }
  }

  function setScreen(name) {
    if(name==='lobby'&&audioContext)stopCombatAudio(audioContext);
    if (name === 'lobby') $('#parry-name-note').textContent = '회원가입 없이 기기별 익명 기록으로 플레이해.';
    lobby.classList.toggle('hidden', name !== 'lobby');
    battle.classList.toggle('hidden', name !== 'battle');
    result.classList.toggle('hidden', name !== 'result');
    document.body.classList.toggle('parry-is-playing', name === 'battle');
    if (arenaRenderer) {
      if (name === 'battle') arenaRenderer.resume();
      else arenaRenderer.pause();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  let lastHudKey = '';
  function updateHud() {
    const hudAttack = model.currentAttack;
    const motion = attackMotion(hudAttack,hudAttack ? model.currentTime - hudAttack.startedAt : 0);
    const countdown = model.phase === 'countdown' ? Math.max(1, Math.ceil((model.countdownEnds - model.currentTime) / 1000)) : '';
    const hudKey = [model.boss,model.bossHp,model.bossMaxHp,model.score,model.playerHp,model.combo,model.perfects,model.bossesDefeated,model.phase,model.mode,model.planIndex,model.hitIndex,model.plan?.hitCount,hudAttack?.plan.type,hudAttack?.revealed,hudAttack?.direction,motion.stage,countdown].join('|');
    if (hudKey === lastHudKey) return;
    lastHudKey = hudKey;
    $('#parry-intent').dataset.motion = motion.stage;
    $('#parry-intent-mark').textContent = ['withdraw','redirect'].includes(motion.stage) ? '↺' : motion.stage === 'ready' ? '◇' : '✦';
    $('#parry-boss-number').textContent = `BOSS ${String(model.boss).padStart(2, '0')}`;
    $('#parry-boss-name').textContent = bossName(model.boss);
    $('#parry-boss-title').textContent = bossEpithet(model.boss);
    $('#parry-boss-hp-text').textContent = `${Math.max(0, model.bossHp)} / ${model.bossMaxHp}`;
    $('#parry-boss-hp').style.width = `${Math.max(0, model.bossHp / model.bossMaxHp * 100)}%`;
    $('#parry-score').textContent = String(model.score).padStart(6, '0');
    $('#parry-player-hp-text').textContent = `${model.playerHp} / 100`;
    $('#parry-player-hp').style.width = `${model.playerHp}%`;
    $('#parry-combo').textContent = `× ${model.combo}`;
    $('#parry-perfects').textContent = String(model.perfects).padStart(2, '0');
    $('#parry-defeated').textContent = String(model.bossesDefeated).padStart(2, '0');
    const attack = model.currentAttack;
    if (model.phase === 'countdown') {
      $('#parry-intent-kicker').textContent = model.mode === 'daily' ? 'DAILY SWORD SAINT' : 'ENDLESS SURVIVAL';
      $('#parry-intent-text').textContent = '결투 준비';
      $('#parry-countdown').classList.remove('hidden');
      $('#parry-fight-title').classList.remove('is-on');
    } else {
      $('#parry-countdown').classList.add('hidden');
      if (model.phase === 'telegraph' || model.phase === 'swing' || model.phase === 'impact') {
        const attackLabel=attack?.plan.type==='feint'&&!attack.fakeDirection?'SLASH':attack?.plan.type.toUpperCase()||'ATTACK';
        $('#parry-intent-kicker').textContent = `${attackLabel} · ${model.plan?.hitCount > 1 ? `${model.hitIndex + 1}/${model.plan.hitCount}` : 'INCOMING'}`;
        $('#parry-intent-text').textContent = model.boss === 1 && attack ? `훈련 힌트 · ${DIR_NAME[attack.direction]} 패링` : '검의 궤적을 읽어';
        if (motion.stage === 'withdraw' || motion.stage === 'redirect') {
          $('#parry-intent-kicker').textContent='REPOSITION · WAIT';
          $('#parry-intent-text').textContent='방향 전환 · 다시 준비 중';
        } else if (motion.stage === 'ready') {
          $('#parry-intent-kicker').textContent='READY · WATCH';
          $('#parry-intent-text').textContent='실제 공격 준비';
        } else if (motion.stage === 'fake') {
          $('#parry-intent-kicker').textContent='FEINT · WAIT';
          $('#parry-intent-text').textContent='검을 따라가지 마';
        } else if (motion.stage === 'strike') {
          $('#parry-intent-kicker').textContent = 'ATTACK · PARRY';
          if (model.boss !== 1) $('#parry-intent-text').textContent = '검이 들어온다';
        }
      } else if (model.phase === 'bossDeath') {
        $('#parry-intent-kicker').textContent = 'VICTORY';
        $('#parry-intent-text').textContent = '보스 격파';
      } else if (model.phase === 'between') {
        $('#parry-intent-kicker').textContent = `BOSS ${String(model.boss).padStart(2, '0')}`;
        $('#parry-intent-text').textContent = '다음 검격에 대비해';
      }
      if (model.phase === 'countdown') $('#parry-countdown').classList.remove('hidden');
    }
    if (model.phase === 'countdown') {
      $('#parry-count-num').textContent = String(Math.max(1, Math.ceil((model.countdownEnds - model.currentTime) / 1000)));
    }
    if (model.phase === 'bossDeath') {
      $('#parry-fight-title').innerHTML = `<span>ENCOUNTER CLEARED</span><b>${bossName(model.boss)}</b>`;
      $('#parry-fight-title').classList.add('is-on');
    } else if (model.boss > 1 && model.phase === 'between' && model.planIndex === 0) {
      $('#parry-fight-title').innerHTML = `<span>NEXT OPPONENT</span><b>${bossName(model.boss)}</b>`;
      $('#parry-fight-title').classList.add('is-on');
    } else if (attack || model.phase === 'telegraph' || model.phase === 'swing') {
      $('#parry-fight-title').classList.remove('is-on');
    }
  }

  function enterBattle() {
    setScreen('battle');
    updateHud();
    if (!arenaRenderer) {
      arenaRenderer = rendererFactory($('#parry-canvas'), model, tick, rendererAsset);
    }
  }

  function beginPlan(now) {
    model.plan = createAttackPlan(model.seed, model.boss, model.planIndex);
    model.hitIndex = 0;
    beginHit(now);
  }

  function beginHit(now) {
    const hit = model.plan.hits[model.hitIndex];
    model.currentAttack = {
      plan: model.plan,
      index: model.hitIndex,
      direction: hit.direction,
      fakeDirection: hit.fakeDirection,
      revealed: !hit.fakeDirection,
      startedAt: now,
      impactAt: now + hit.warningMs,
      swingAtMs: hit.warningMs - 180,
      impactAtMs: hit.warningMs,
      answered: false,
      rating: '',
    };
    model.phase = 'telegraph';
    updateHud();
  }

  function tick(now) {
    if (shuttingDown || model.phase === 'paused' || model.phase === 'lobby' || model.phase === 'gameover' || model.phase === 'submitting') return;
    model.currentTime = now;
    if (model.phase === 'countdown') {
      updateHud();
      if (now >= model.countdownEnds) beginPlan(now);
      return;
    }
    if (model.phase === 'bossDeath' && now >= model.nextAt) {
      if (arenaRenderer?.isBossReady && !arenaRenderer.isBossReady(model.boss+1)) {
        model.assetWaitAt ||= now;
        arenaRenderer.prepareBoss(model.boss+1);
        return;
      }
      if (model.assetWaitAt) { model.startAt += now-model.assetWaitAt;model.assetWaitAt=0; }
      model.boss += 1;
      model.bossHp = bossHp(model.boss);
      model.bossMaxHp = model.bossHp;
      model.playerHp = Math.min(100, model.playerHp + PARRY_CONFIG.bossHeal);
      model.planIndex = 0;
      model.hitIndex = 0;
      model.plan = null;
      model.currentAttack = null;
      model.lastBossParries = 0;
      model.phase = 'between';
      model.nextAt = now + 520;
      updateHud();
      return;
    }
    if (model.phase === 'between' && now >= model.nextAt) {
      if (model.plan && model.hitIndex + 1 < model.plan.hitCount) {
        model.hitIndex += 1;
        beginHit(now);
      } else {
        model.planIndex += 1;
        beginPlan(now);
      }
      return;
    }
    const attack = model.currentAttack;
    if (!attack || attack.answered) return;
    const age = now - attack.startedAt;
    if(age>=attack.swingAtMs&&!attack.swingSoundPlayed){
      attack.swingSoundPlayed=true;
      if(model.soundOn&&audioContext)playSwordSwing(audioContext);
    }
    if (!attack.revealed && age >= attack.plan.revealAfterMs) attack.revealed = true;
    if (age >= attack.swingAtMs && age < attack.impactAtMs) model.phase = 'swing';
    if (age >= attack.impactAtMs - 60 && age <= attack.impactAtMs + 60) model.phase = 'impact';
    if (now > attack.impactAt + PARRY_CONFIG.goodWindowMs) resolveParry(null, now, true);
    updateHud();
  }

  function showFeedback(rating, offset) {
    const node = $('#parry-feedback');
    node.className = `parry-feedback is-${rating}`;
    node.textContent = rating === 'perfect' ? `PERFECT · ${Math.abs(offset)}MS` : rating === 'good' ? `GOOD · ${Math.abs(offset)}MS` : 'MISS';
    window.setTimeout(() => { if (node.textContent) node.className = 'parry-feedback'; }, 650);
  }

  function resolveParry(direction, now = performance.now(), timeout = false) {
    const attack = model.currentAttack;
    if (!attack || attack.answered || !['telegraph', 'swing', 'impact'].includes(model.phase)) return;
    if (!attack.revealed) return;
    const offset = timeout ? PARRY_CONFIG.goodWindowMs + 1 : Math.round(now - attack.impactAt);
    const rating = classifyParry(direction, attack.direction, offset);
    attack.answered = true;
    attack.rating = rating;
    attack.resolvedAt = now;
    attack.resolvedAgeMs = now - attack.startedAt;
    model.lastImpactAt = now;
    model.lastImpactAttack = attack;
    model.currentTime = now;
    model.totalAttacks += 1;
    model.lastParryDirection = direction;
    model.lastOutcome = rating;
    model.effectUntil = now + (rating === 'perfect' ? 460 : 350);
    model.phase = 'impact';

    if (rating === 'miss') {
      model.misses += 1;
      model.playerHp = Math.max(0, model.playerHp - bossDamage(model.boss));
      model.combo = 0;
      model.perfectStreak = 0;
      playClash('miss');
      if (navigator.vibrate) navigator.vibrate(42);
    } else {
      model.combo += 1;
      model.bestCombo = Math.max(model.bestCombo, model.combo);
      model.lastBossParries += 1;
      if (rating === 'perfect') {
        model.perfects += 1;
        model.perfectStreak += 1;
        model.bossHp = Math.max(0, model.bossHp - PARRY_CONFIG.perfectDamage);
        playClash('perfect');
      } else {
        model.goods += 1;
        model.perfectStreak = 0;
        model.bossHp = Math.max(0, model.bossHp - PARRY_CONFIG.goodDamage);
        playClash('good');
      }
      model.score += parryScore(rating, model.combo, model.perfectStreak);
      if (navigator.vibrate) navigator.vibrate(rating === 'perfect' ? 18 : 10);
      if (model.bossHp <= 0) {
        model.bossesDefeated += 1;
        model.score += 500;
        if (model.soundOn && audioContext) playCompletionChime(audioContext);
      }
    }

    model.events.push({
      boss: model.boss,
      plan_index: model.plan.index,
      hit_index: attack.index,
      direction,
      offset_ms: timeout ? PARRY_CONFIG.goodWindowMs + 1 : offset,
      rating,
      elapsed_ms: Math.max(0, Math.round(now - model.startAt)),
    });
    showFeedback(rating, offset);
    updateHud();

    if (model.playerHp <= 0) {
      finishRun();
      return;
    }
    if (model.bossHp <= 0) {
      model.phase = 'bossDeath';
      model.bossDeathAt = now;
      model.nextAt = now + PARRY_CONFIG.bossHealDelayMs;
      model.currentAttack = attack;
      return;
    }
    model.phase = 'between';
    const nextIsComboHit = model.hitIndex + 1 < model.plan.hitCount;
    model.nextAt = now + (nextIsComboHit ? model.plan.intervalMs : 620);
  }

  function startCountdown() {
    model.phase = 'countdown';
    model.startAt = performance.now();
    model.countdownEnds = model.startAt + PARRY_CONFIG.countdownMs;
    model.currentTime = model.startAt;
    model.boss = 1;
    model.bossHp = bossHp(1);
    model.bossMaxHp = model.bossHp;
    model.playerHp = 100;
    model.score = 0;
    model.combo = 0;
    model.bestCombo = 0;
    model.perfectStreak = 0;
    model.bossesDefeated = 0;
    model.lastBossParries = 0;
    model.totalAttacks = 0;
    model.perfects = 0;
    model.goods = 0;
    model.misses = 0;
    model.events = [];
    model.planIndex = 0;
    model.hitIndex = 0;
    model.plan = null;
    model.currentAttack = null;
    model.lastOutcome = '';
    model.effectUntil = 0;
    model.pauseAt = 0;
    updateHud();
    enterBattle();
  }

  async function startRun(mode) {
    if (runStarting || ['countdown', 'telegraph', 'swing', 'impact', 'between', 'bossDeath', 'paused'].includes(model.phase)) return;
    runStarting = true;
    readyAudio();
    root.querySelectorAll('[data-mode]').forEach((button) => { button.disabled = true; });
    $('#parry-name-note').textContent = mode === 'daily' ? '오늘의 결투에 입장하고 있어…' : '결투에 입장하고 있어…';
    const rendererLoad = import('./parry-three.js').then(async (renderer) => {
      rendererFactory = renderer.createParryRenderer;
      rendererAsset = await renderer.prepareParryAssets();
    }).then(() => null, (error) => error);
    model.mode = mode;
    model.date = todayKst();
    model.seed = mode === 'daily' ? dailyParrySeed(model.date) : randomParrySeed();
    model.ranked = false;
    model.runId = null;
    model.runToken = null;
    const cleanName = saveParryNickname($('#parry-nickname').value || '플레이어');
    $('#parry-nickname').value = cleanName;
    try {
      const session = await parryPost('start', { mode, challenge_date: model.date, nickname: cleanName });
      model.seed = Number(session.seed) >>> 0;
      model.runId = session.run_id;
      model.runToken = session.run_token;
      model.ranked = true;
      $('#parry-name-note').textContent = '온라인 랭킹 연결됨 · 익명 플레이어로 기록해.';
    } catch {
      $('#parry-name-note').textContent = '로컬 모드로 시작해. 서버 랭킹 기록은 저장되지 않아.';
      toast('서버 연결이 없어 로컬 모드로 시작해.');
    }
    try {
      $('#parry-name-note').textContent = '3D 전장에 입장 중…';
      const rendererError = await rendererLoad;
      if (rendererError) throw rendererError;
      startCountdown();
    } catch {
      abandon();
      model.phase = 'lobby';
      setScreen('lobby');
      root.querySelectorAll('[data-mode]').forEach((button) => { button.disabled = false; });
      runStarting = false;
      toast('3D 전투 화면을 불러오지 못했어. WebGL 지원과 models 폴더 업로드를 확인해줘.');
      return;
    }
    root.querySelectorAll('[data-mode]').forEach((button) => { button.disabled = false; });
    runStarting = false;
  }

  function isNewRecord(stats) {
    const records = readRecords();
    const key = stats.mode === 'daily' ? `daily-${stats.date}` : 'survival';
    const previous = records[key];
    const isBetter = !previous
      || stats.bossesDefeated > previous.bossesDefeated
      || (stats.bossesDefeated === previous.bossesDefeated && stats.lastBossParries > previous.lastBossParries)
      || (stats.bossesDefeated === previous.bossesDefeated && stats.lastBossParries === previous.lastBossParries && stats.score > previous.score)
      || (stats.bossesDefeated === previous.bossesDefeated && stats.lastBossParries === previous.lastBossParries && stats.score === previous.score && stats.perfectRate > previous.perfectRate);
    if (isBetter) {
      records[key] = stats;
      writeRecords(records);
    }
    return isBetter;
  }

  async function finishRun() {
    if (model.phase === 'gameover' || model.phase === 'submitting') return;
    model.phase = 'submitting';
    const successes = model.perfects + model.goods;
    const stats = {
      mode: model.mode,
      date: model.date,
      score: model.score,
      bossesDefeated: model.bossesDefeated,
      lastBossParries: model.lastBossParries,
      bestCombo: model.bestCombo,
      perfects: model.perfects,
      goods: model.goods,
      misses: model.misses,
      totalAttacks: model.totalAttacks,
      perfectRate: successes ? model.perfects / successes * 100 : 0,
      parryRate: model.totalAttacks ? successes / model.totalAttacks * 100 : 0,
      durationMs: Math.max(0, Math.round(model.currentTime - model.startAt)),
    };
    model.resultRecord = isNewRecord(stats);
    setScreen('result');
    $('#parry-result-bosses').textContent = String(stats.bossesDefeated);
    $('#parry-result-score').textContent = stats.score.toLocaleString('ko-KR');
    $('#parry-result-last').textContent = String(stats.lastBossParries);
    $('#parry-result-highest').textContent = String(model.boss);
    $('#parry-result-successes').textContent = String(successes);
    $('#parry-result-combo').textContent = String(stats.bestCombo);
    $('#parry-result-perfect').textContent = String(stats.perfects);
    $('#parry-result-good').textContent = String(stats.goods);
    $('#parry-result-miss').textContent = String(stats.misses);
    $('#parry-result-rate').textContent = `${Math.round(stats.parryRate)}%`;
    const durationSeconds = Math.floor(stats.durationMs / 1000);
    $('#parry-result-duration').textContent = `${String(Math.floor(durationSeconds / 60)).padStart(2, '0')}:${String(durationSeconds % 60).padStart(2, '0')}`;
    $('#parry-result-message').textContent = stats.mode === 'daily' ? `오늘의 검성전 · ${formatDate(stats.date)}` : '전투 기록을 남겼어. 다시 검을 들어.';
    $('#parry-result-rank').textContent = model.resultRecord ? '✦ 개인 최고 기록 갱신' : '개인 최고 기록을 저장했어.';
    updateLobbyRecord();
    model.phase = 'gameover';
    if (model.ranked && model.runId && model.runToken) {
      try {
        const response = await parryPost('submit', { run_id: model.runId, run_token: model.runToken, events: model.events }, true);
        $('#parry-result-rank').textContent = response.player_rank ? `온라인 기록 등록 · 현재 ${response.player_rank}위` : '온라인 기록을 등록했어.';
        loadLeaderboard(activeBoard);
      } catch (error) {
        $('#parry-result-rank').textContent = `로컬 기록 저장 완료 · 온라인 등록 실패 (${error.message})`;
      }
    }
  }

  function pauseGame() {
    if (!['countdown', 'telegraph', 'swing', 'impact', 'between', 'bossDeath'].includes(model.phase)) return;
    model.pauseAt = performance.now();
    if(audioContext)stopCombatAudio(audioContext);
    model.phaseBeforePause = model.phase;
    model.phase = 'paused';
    $('#parry-pause-overlay').classList.remove('hidden');
    arenaRenderer?.pause();
  }

  function resumeGame() {
    if (model.phase !== 'paused') return;
    const delta = performance.now() - model.pauseAt;
    model.startAt += delta;
    model.countdownEnds += delta;
    model.nextAt += delta;
    model.bossDeathAt += delta;
    if (model.assetWaitAt) model.assetWaitAt += delta;
    model.effectUntil += delta;
    if (model.lastImpactAt) model.lastImpactAt += delta;
    if (model.currentAttack) {
      model.currentAttack.startedAt += delta;
      model.currentAttack.impactAt += delta;
      if (model.currentAttack.resolvedAt) model.currentAttack.resolvedAt += delta;
    }
    model.phase = model.phaseBeforePause;
    $('#parry-pause-overlay').classList.add('hidden');
    arenaRenderer?.resume();
  }

  function abandon() {
    if (model.ranked && model.runId && model.runToken) {
      parryPost('abandon', { run_id: model.runId, run_token: model.runToken }, true).catch(() => {});
    }
    model.ranked = false;
  }

  function leaveBattle() {
    if (['countdown', 'telegraph', 'swing', 'impact', 'between', 'bossDeath', 'paused'].includes(model.phase)) abandon();
    model.phase = 'lobby';
    model.currentAttack = null;
    setScreen('lobby');
    updateLobbyRecord();
  }

  function handleDirection(direction) {
    if (model.phase === 'paused' || model.phase === 'countdown' || model.phase === 'between' || model.phase === 'bossDeath') return;
    resolveParry(direction);
  }

  function updateCountdownPreview() {
    if (model.phase === 'countdown') {
      model.currentTime = performance.now();
      $('#parry-count-num').textContent = String(Math.max(1, Math.ceil((model.countdownEnds - model.currentTime) / 1000)));
    }
  }

  $('.parry-back').addEventListener('click', (event) => {
    event.preventDefault();
    if (model.ranked) abandon();
    shuttingDown = true;
    arenaRenderer?.destroy();
    onExit();
    window.location.href = './index.html#games';
  });
  $('.parry-exit').addEventListener('click', leaveBattle);
  $('.parry-pause').addEventListener('click', pauseGame);
  $('#parry-resume').addEventListener('click', resumeGame);
  $('#parry-to-menu').addEventListener('click', () => { setScreen('lobby'); updateLobbyRecord(); loadLeaderboard(activeBoard); });
  $('#parry-share').addEventListener('click', async () => {
    const text = `PARRY: LAST BLADE\n${model.bossesDefeated}명 처치 · ${model.score.toLocaleString('ko-KR')}점 · 최고 콤보 ${model.bestCombo}\n네가 이 기록을 넘을 수 있을까?`;
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set('mode', model.mode);
    if (model.mode === 'daily') shareUrl.searchParams.set('date', model.date);
    else shareUrl.searchParams.delete('date');
    try {
      if (navigator.share) await navigator.share({ title: 'PARRY: LAST BLADE', text, url: shareUrl.toString() });
      else { await navigator.clipboard.writeText(`${text}\n${shareUrl.toString()}`); toast('결과 링크를 복사했어.'); }
    } catch { /* Share dialog dismissed. */ }
  });
  soundButton.addEventListener('click', () => {
    model.soundOn = !model.soundOn;
    if(model.soundOn)readyAudio();
    else if(audioContext)stopCombatAudio(audioContext);
    try { localStorage.setItem(SOUND_KEY, model.soundOn ? 'on' : 'off'); } catch { /* Optional. */ }
    updateSoundButton();
    playTone(740, 0.08);
  });
  $('.parry-mode-actions').addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (button) startRun(button.dataset.mode);
  });
  result.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (button) startRun(button.dataset.mode);
  });
  $('#parry-save-name').addEventListener('click', async () => {
    const value = [...$('#parry-nickname').value.trim()].slice(0, 16).join('');
    if ([...value].length < 2) { $('#parry-name-note').textContent = '닉네임은 2자 이상 입력해줘.'; return; }
    const clean = saveParryNickname(value);
    $('#parry-nickname').value = clean;
    try { await parryPost('profile', { nickname: clean }); $('#parry-name-note').textContent = '닉네임을 익명 플레이어 기록에 연결했어.'; }
    catch { $('#parry-name-note').textContent = '이 기기에 닉네임을 저장했어. 온라인 랭킹은 서버 연결 후 가능해.'; }
  });
  $('.parry-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-board]');
    if (button) setMode(button.dataset.board);
  });
  $('.parry-dpad').querySelectorAll('[data-parry-dir]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handleDirection(button.dataset.parryDir);
    });
  });
  const onKeyDown = (event) => {
    const direction = KEY_DIR[event.key];
    if (direction && !battle.classList.contains('hidden')) {
      if (event.repeat) return;
      event.preventDefault();
      handleDirection(direction);
    } else if (event.key === 'Escape' && !battle.classList.contains('hidden')) {
      event.preventDefault();
      model.phase === 'paused' ? resumeGame() : pauseGame();
    }
  };
  const onVisibility = () => {
    if (document.hidden && !battle.classList.contains('hidden')) pauseGame();
  };
  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibility);
  model.currentTime = performance.now();
  updateSoundButton();
  updateLobbyRecord();
  parryPost('profile', { nickname }).finally(() => loadLeaderboard()).catch(() => {});

  return {
    destroy() {
      shuttingDown = true;
      abandon();
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(toastTimer);
      arenaRenderer?.destroy();
      document.body.classList.remove('parry-is-playing');
    },
    show() { setScreen('lobby'); updateLobbyRecord(); loadLeaderboard(activeBoard); },
    start(mode = 'survival') { startRun(mode); },
  };
}

import './style.css';
import { GAME, COLORS } from './config.js';
import { PirateGame, randomInt } from './engine.js';
import { PirateSound } from './audio.js';
import { PirateScene } from './scene.js';

const RECORD_KEY = 'noltap-pirate-record-v1', SETTINGS_KEY = 'noltap-pirate-settings-v1';
const defaultPlayers = () => [{ name: '플레이어 1', color: 0 }, { name: '플레이어 2', color: 1 }];
function read(key, fallback) { try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return { ...fallback }; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private storage may be unavailable. */ } }
function validRoster(input) {
  const used = new Set();
  const players = (Array.isArray(input) ? input : []).slice(0, 8).map((player, index) => {
    let color = Number(player?.color);
    if (!Number.isInteger(color) || color < 0 || color >= COLORS.length || used.has(color)) color = COLORS.findIndex((_, i) => !used.has(i));
    used.add(color);
    return { name: String(player?.name || `플레이어 ${index + 1}`).trim().slice(0, 16) || `플레이어 ${index + 1}`, color };
  });
  return players.length >= 2 ? players : defaultPlayers();
}
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
let settings = read(SETTINGS_KEY, { sound: true, players: defaultPlayers() });
settings.sound = settings.sound !== false;
let roster = validRoster(settings.players), draftRoster = roster.map(player => ({ ...player }));
let record = read(RECORD_KEY, { matches: 0, bestScore: 0 });
const game = new PirateGame(randomInt, roster), sound = new PirateSound(settings.sound);
let scene, token = 0, paused = false, roundBusy = false, recorded = false;
const root = document.querySelector('#pirate-app');
root.innerHTML = `
  <main class="pirate-game">
    <div class="harbor-scenery" aria-hidden="true"></div><div class="ship-deck" aria-hidden="true"></div>
    <nav class="pirate-nav"><a href="./index.html#games">← <b>NOLTAP</b> <span>게임 모음</span></a><span>GAME 03 <i>✦</i> LUCK & LAUGHTER</span><button id="help-open" aria-label="게임 방법과 전적 보기">게임 방법 ⓘ</button></nav>
    <header class="game-masthead">
      <div class="pirate-logo"><span class="logo-hat" aria-hidden="true">☠</span><span class="logo-bounce">통통!</span><h1>해적 <em>룰렛</em></h1><small>PIRATE BARREL</small></div>
      <div class="score-board wood-panel" aria-label="현재 게임 점수판">
        <div><span class="score-icon">⚔</span><p>현재 차례<strong id="turn-owner">플레이어 1</strong></p></div>
        <div><span class="score-icon wheel">☸</span><p>라운드<strong><span id="round">1</span><small> / 10</small></strong></p></div>
        <div><span class="score-icon">♟</span><p>참가 인원<strong id="player-count">2명</strong></p></div>
        <div><span class="score-icon skull">☠</span><p>남은 칼<strong id="remaining">16</strong></p></div>
      </div>
    </header>
    <section class="duel-arena" aria-label="참가자와 해적 룰렛">
      <div class="players-strip" id="players-strip" aria-label="참가자별 점수"></div>
      <div class="barrel-stage">
        <div class="round-chip" id="round-chip">ROUND 01 <span>플레이어 1 시작</span></div>
        <div id="scene" class="scene-host"><div id="slot-labels" class="slot-labels"></div><div class="scene-loading" id="scene-loading">항구에 도착하는 중…</div></div>
        <div class="rotate-controls"><button id="rotate-left" aria-label="통을 왼쪽으로 회전">↶</button><span>드래그해서 통 돌리기</span><button id="rotate-right" aria-label="통을 오른쪽으로 회전">↷</button></div>
        <span class="remaining-chip">남은 구멍 <b id="remaining-label">16</b><span>/ 16</span></span>
      </div>
    </section>
    <section class="pirate-controls" aria-label="플레이어 칼 색과 게임 조작">
      <div class="knife-tray wood-panel"><span class="tray-caption">PLAYER COLORS <i>각자 고른 칼 색</i></span><div class="knife-options" id="player-knives"></div></div>
      <div class="command-row"><div class="parchment command-message" role="status" aria-live="polite"><span aria-hidden="true">☸</span><p id="instruction">참가자를 설정하고 게임을 시작하세요!</p><small id="instruction-sub">함정은 하나, 한 번에 한 명씩 돌아가며 칼을 꽂아요.</small></div><button class="chunky-button setup-button" id="setup-open"><span>♟</span> 참가자 설정</button><button class="chunky-button restart-button" id="restart"><span>↻</span> 다시 시작</button><button class="chunky-button sound-button" id="sound"><span>♫</span> 효과음 ON</button></div>
    </section>
    <footer class="pirate-footer"><span id="model-status">3D 모델 불러오는 중</span><span>© 2026 NOLTAP <i>✦</i> <a href="./privacy.html">개인정보처리방침</a></span></footer>
    <dialog id="setup-dialog" class="pirate-dialog setup-dialog"><div class="modal-inner"><span class="result-eyebrow">PASS & PLAY · 2–8 PLAYERS</span><h2>해적단을 모아라!</h2><p>참가 인원과 각자 사용할 칼 색을 정하세요. 다른 색을 골라야 플레이어별 칼을 구분하기 쉬워요.</p><label class="setup-count">참가 인원<select id="setup-count">${Array.from({ length: 7 }, (_, i) => `<option value="${i + 2}">${i + 2}명</option>`).join('')}</select></label><div id="setup-player-list" class="setup-player-list"></div><button class="chunky-button next-button" id="setup-start">이 인원으로 시작 →</button><button class="reset-record" id="setup-cancel" hidden>계속 진행 중인 게임으로</button></div></dialog>
    <dialog id="result-dialog" class="pirate-dialog"><div class="modal-inner"><span class="result-eyebrow" id="result-eyebrow">ROUND COMPLETE</span><div class="result-symbol" id="result-symbol">✦</div><h2 id="result-title"></h2><p id="result-description"></p><div class="result-scores" id="result-scores"></div><p class="result-note" id="result-note"></p><button class="chunky-button next-button" id="next-round">다음 라운드 →</button><div class="modal-links"><button id="result-restart">처음부터 다시</button><a href="./index.html#games">게임 모음으로</a></div></div></dialog>
    <dialog id="help-dialog" class="pirate-dialog help-dialog"><div class="modal-inner"><span class="result-eyebrow">A LITTLE COURAGE, A LITTLE LUCK</span><h2>통통! 해적 룰렛</h2><ol class="rules"><li><b>2~8명이 한 기기에서 번갈아!</b> 참가 인원과 이름, 각자 다른 칼 색을 정해요.</li><li><b>내 차례에 구멍을 골라요.</b> 안전하면 20점, 드래그하거나 회전 버튼으로 통 뒤쪽도 볼 수 있어요.</li><li><b>함정은 단 하나.</b> 걸린 사람은 라운드에서 패배하고, 나머지는 생존 보너스 100점을 받아요.</li><li><b>10라운드 총점으로 승부!</b> 라운드마다 시작 순서를 바꾸고, 최종 점수가 가장 높은 사람이 우승해요.</li></ol><p class="help-fair">칼 색깔은 각 참가자를 구분하기 위한 표시예요. 색에 따라 확률이 달라지지 않습니다.</p><div class="local-record"><span>이 브라우저의 전적</span><strong id="record-summary"></strong><small id="record-best"></small></div><details class="accessible-slots"><summary>키보드·보조기술용 구멍 목록</summary><p>아직 사용하지 않은 번호를 선택하세요. 3D 화면과 같은 구멍입니다.</p><div id="accessible-slots">${Array.from({ length: 16 }, (_, i) => `<button data-slot="${i}" aria-label="구멍 ${i + 1}에 칼 꽂기">${i + 1}</button>`).join('')}</div></details><button class="chunky-button next-button" id="help-close">알겠어요! 돌아가기</button><button class="reset-record" id="clear-record">이 브라우저 전적 초기화</button></div></dialog>
    <dialog id="confirm-dialog" class="pirate-dialog"><div class="modal-inner"><span class="result-eyebrow">NEW ADVENTURE</span><h2 id="confirm-title"></h2><p id="confirm-text"></p><button class="chunky-button next-button" id="confirm-yes">초기화하기</button><button class="reset-record" id="confirm-no">취소하고 돌아가기</button></div></dialog>
    <div class="pause-shade" id="pause-shade" hidden><strong>잠시 쉬어가는 중 ☸</strong><p>돌아오면 이어서 진행해요.</p></div>
  </main>`;
const $ = selector => root.querySelector(selector);
const dialogs = [...root.querySelectorAll('dialog')];
function busyModal() { return dialogs.some(dialog => dialog.open); }
function say(title, subtitle = '드래그로 통을 돌려 다른 구멍도 확인하세요.') { $('#instruction').textContent = title; $('#instruction-sub').textContent = subtitle; }
function renderPlayerChips() {
  $('#players-strip').innerHTML = roster.map((player, index) => {
    const color = COLORS[player.color];
    const active = game.phase === 'ready' && game.turnIndex === index;
    const outcome = game.last?.trap ? game.last.loser === index ? '함정' : '생존' : '';
    return `<article class="player-chip${active ? ' active' : ''}${outcome === '함정' ? ' eliminated' : ''}" style="--player-color:${color[2]}" aria-current="${active ? 'step' : 'false'}"><span class="player-color-dot" aria-hidden="true"></span><span class="player-chip-label"><small>P${index + 1} · ${color[1]}</small><strong>${escapeHTML(player.name)}</strong></span><span class="player-chip-score">${game.score[index]}<small>점</small></span>${outcome ? `<span class="player-chip-outcome">${outcome}</span>` : ''}</article>`;
  }).join('');
  $('#player-knives').innerHTML = roster.map((player, index) => `<div class="player-knife" style="--knife-color:${COLORS[player.color][2]}" aria-label="${escapeHTML(player.name)}의 ${COLORS[player.color][1]} 칼"><span class="mini-knife" aria-hidden="true"><i></i><b></b></span><small>P${index + 1} · ${COLORS[player.color][1]}</small></div>`).join('');
}
function sync() {
  const current = roster[game.turnIndex];
  $('#turn-owner').textContent = game.phase === 'round-over' || game.phase === 'match-over' ? '라운드 종료' : current.name;
  $('#round').textContent = game.round; $('#player-count').textContent = `${roster.length}명`;
  $('#remaining').textContent = $('#remaining-label').textContent = game.available().length;
  $('#round-chip').innerHTML = `ROUND ${String(game.round).padStart(2, '0')} <span>${escapeHTML(current.name)} 차례</span>`;
  const input = game.phase === 'ready' && !paused && (!busyModal() || $('#help-dialog').open) && !roundBusy;
  scene?.setInput(input, game.used.keys());
  renderPlayerChips();
  const accessibleInput = input;
  root.querySelectorAll('[data-slot]').forEach(button => { button.disabled = !accessibleInput || game.used.has(Number(button.dataset.slot)); });
  $('#help-open').disabled = $('#restart').disabled = $('#setup-open').disabled = game.phase === 'inserting' || roundBusy;
  $('#sound').innerHTML = `<span>${settings.sound ? '♫' : '♪'}</span> 효과음 ${settings.sound ? 'ON' : 'OFF'}`; $('#sound').setAttribute('aria-label', settings.sound ? '효과음 끄기' : '효과음 켜기');
  $('#record-summary').textContent = `${record.matches}회 플레이`;
  $('#record-best').textContent = `개인 최고 참가자 점수 ${Number(record.bestScore || 0).toLocaleString('ko-KR')}점`;
}
function readDraftNames() {
  root.querySelectorAll('[data-player-name]').forEach(input => { const index = Number(input.dataset.playerName); if (draftRoster[index]) draftRoster[index].name = input.value.slice(0, 16); });
}
function renderSetupDraft() {
  $('#setup-count').value = String(draftRoster.length);
  $('#setup-player-list').innerHTML = draftRoster.map((player, index) => {
    const usedByOthers = new Set(draftRoster.filter((_, other) => other !== index).map(other => other.color));
    return `<section class="setup-player-row"><label class="setup-name-label">P${index + 1}<input data-player-name="${index}" maxlength="16" value="${escapeHTML(player.name)}" aria-label="플레이어 ${index + 1} 이름" /></label><div class="setup-colors" role="group" aria-label="${escapeHTML(player.name)} 칼 색 선택">${COLORS.map(([key, name, hex], color) => `<button type="button" data-draft-player="${index}" data-draft-color="${color}" class="setup-color${player.color === color ? ' selected' : ''}" style="--knife-color:${hex}" aria-label="${name} 칼" aria-pressed="${player.color === color}" ${usedByOthers.has(color) ? 'disabled' : ''}><i></i><span>${name}</span></button>`).join('')}</div></section>`;
  }).join('');
}
function openSetup() {
  draftRoster = roster.map(player => ({ ...player })); renderSetupDraft(); $('#setup-cancel').hidden = false; $('#setup-dialog').showModal(); sync();
}
function adjustPlayerCount(count) {
  readDraftNames();
  while (draftRoster.length < count) {
    const used = new Set(draftRoster.map(player => player.color));
    const color = COLORS.findIndex((_, index) => !used.has(index));
    draftRoster.push({ name: `플레이어 ${draftRoster.length + 1}`, color });
  }
  draftRoster = draftRoster.slice(0, count); renderSetupDraft();
}
function startConfiguredGame() {
  readDraftNames();
  const colors = draftRoster.map(player => player.color);
  if (new Set(colors).size !== colors.length) { say('플레이어마다 다른 칼 색을 골라주세요.'); return; }
  roster = draftRoster.map((player, index) => ({ name: player.name.trim() || `플레이어 ${index + 1}`, color: player.color }));
  settings.players = roster.map(player => ({ ...player })); save(SETTINGS_KEY, settings);
  token++; scene?.reset(); roundBusy = false; recorded = false; root.classList.remove('pirate-pop');
  game.configurePlayers(roster); $('#setup-dialog').close(); sync();
  say(`${roster.length}인 해적 룰렛 시작!`, `${roster[0].name}부터 시작해요. 각자 자기 칼 색으로 차례를 표시해요.`); sound.unlock(); sound.play('select');
}
async function pick(id, playerIndex = game.turnIndex) {
  if (paused || roundBusy || (busyModal() && !$('#help-dialog').open)) return;
  if ($('#help-dialog').open) $('#help-dialog').close();
  const player = roster[playerIndex]; if (!player) return;
  sound.unlock(); const run = token, color = player.color;
  const selection = game.beginPick(id, playerIndex, color); if (!selection) return;
  sync(); say(`${player.name}의 칼을 꽂는 중…`, '이번에도 무사히 넘어갈 수 있을까요?');
  const complete = scene ? await scene.insert(id, color) : await fallbackAnimation();
  if (!complete || run !== token) return;
  sound.play('insert'); const outcome = game.completePick(); if (!outcome) return;
  sync();
  if (outcome.trap) {
    roundBusy = true; sync(); say(`${player.name}이(가) 함정에 걸렸어요!`, `${outcome.winners.length}명이 살아남았어요. 해적이 튀어나옵니다!`); sound.play('pop');
    root.classList.add('pirate-pop');
    if (scene) await scene.pop(); else await fallbackAnimation();
    if (run !== token) return;
    root.classList.remove('pirate-pop'); roundBusy = false; showResult(outcome);
  } else {
    const nextPlayer = roster[game.turnIndex];
    say(`${player.name} 안전! +${GAME.safePoints}점`, `기기를 ${nextPlayer.name}에게 넘겨주세요.`);
  }
}
function fallbackAnimation() { return new Promise(resolve => setTimeout(() => resolve(true), GAME.insertMs)); }
function showResult(outcome) {
  const final = game.phase === 'match-over';
  const winners = final ? game.matchWinners() : outcome.winners;
  const ordered = roster.map((player, index) => ({ player, index, score: game.score[index], roundScore: game.roundScore[index] })).sort((a, b) => b.score - a.score || a.index - b.index);
  $('#result-eyebrow').textContent = final ? '10 ROUNDS · FINAL RESULT' : `ROUND ${String(game.round).padStart(2, '0')} COMPLETE`;
  $('#result-symbol').textContent = final ? winners.length === 1 ? '🏆' : '⚓' : '☠';
  $('#result-title').textContent = final ? winners.length === 1 ? `${roster[winners[0]].name} 최종 우승!` : '공동 우승!' : `${roster[outcome.loser].name} 함정에 걸렸어요!`;
  $('#result-description').textContent = final ? winners.map(index => roster[index].name).join(', ') + (winners.length === 1 ? '의 승리예요!' : '의 점수가 같아요!') : `${outcome.winners.map(index => roster[index].name).join(', ')} 생존 보너스 +${GAME.winPoints}점`;
  $('#result-scores').innerHTML = ordered.map(({ player, index, score, roundScore }) => {
    const won = winners.includes(index), lost = !final && outcome.loser === index;
    const status = final ? won ? '우승' : '최종 점수' : lost ? '함정' : '생존';
    return `<div class="result-player${won ? ' winner' : ''}${lost ? ' loser' : ''}"><span>P${index + 1} · ${escapeHTML(player.name)}</span><small>${status} +${roundScore}</small><strong>${score.toLocaleString('ko-KR')}<i>점</i></strong></div>`;
  }).join('');
  $('#result-note').textContent = final ? `최고 참가자 점수 ${Math.max(...game.score).toLocaleString('ko-KR')}점` : `다음 라운드는 ${roster[game.round % roster.length].name}부터 시작해요.`;
  $('#next-round').textContent = final ? '새 게임 설정 →' : '다음 라운드 →';
  if (final && !recorded) {
    recorded = true; record.matches = Number(record.matches || 0) + 1; record.bestScore = Math.max(Number(record.bestScore || 0), ...game.score); save(RECORD_KEY, record);
  }
  sound.play(final && winners.length === 1 ? 'win' : 'lose'); $('#result-dialog').showModal(); sync();
}
function restart() { token++; sound.stop(); scene?.reset(); roundBusy = false; recorded = false; root.classList.remove('pirate-pop'); dialogs.forEach(dialog => { if (dialog.open) dialog.close(); }); game.restart(); sync(); say('새 판을 시작해요!', `${roster[0].name}부터 차례가 돌아갑니다.`); }
function next() { $('#result-dialog').close(); if (game.phase === 'match-over') { openSetup(); return; } token++; scene?.reset(); game.nextRound(); sync(); say('새 통, 새로운 행운!', `${roster[game.turnIndex].name}부터 시작해요.`); }
let confirmAction;
function confirm(title, text, action) { $('#confirm-title').textContent = title; $('#confirm-text').textContent = text; confirmAction = action; $('#confirm-dialog').showModal(); sync(); }
$('#restart').addEventListener('click', () => confirm('다시 시작할까요?', '현재 10라운드의 점수와 진행 상황이 초기화됩니다. 참가자 설정과 저장된 전적은 유지돼요.', restart));
$('#confirm-yes').addEventListener('click', () => { $('#confirm-dialog').close(); confirmAction?.(); }); $('#confirm-no').addEventListener('click', () => $('#confirm-dialog').close());
$('#result-restart').addEventListener('click', restart); $('#next-round').addEventListener('click', next);
$('#help-open').addEventListener('click', () => { $('#help-dialog').showModal(); sync(); }); $('#help-close').addEventListener('click', () => $('#help-dialog').close());
$('#setup-open').addEventListener('click', openSetup); $('#setup-cancel').addEventListener('click', () => $('#setup-dialog').close()); $('#setup-start').addEventListener('click', startConfiguredGame);
$('#setup-count').addEventListener('change', event => adjustPlayerCount(Number(event.currentTarget.value)));
$('#setup-player-list').addEventListener('click', event => {
  const button = event.target.closest('[data-draft-player]'); if (!button || button.disabled) return;
  readDraftNames(); draftRoster[Number(button.dataset.draftPlayer)].color = Number(button.dataset.draftColor); renderSetupDraft();
});
$('#clear-record').addEventListener('click', () => confirm('전적을 지울까요?', '이 브라우저에 저장된 플레이 횟수와 최고 점수를 삭제합니다.', () => { record = { matches: 0, bestScore: 0 }; save(RECORD_KEY, record); sync(); }));
$('#sound').addEventListener('click', () => { settings.sound = !settings.sound; sound.enabled = settings.sound; if (settings.sound) { sound.unlock(); sound.play('select'); } else sound.stop(); save(SETTINGS_KEY, settings); sync(); });
root.querySelectorAll('[data-slot]').forEach(button => button.addEventListener('click', () => pick(Number(button.dataset.slot))));
$('#rotate-left').addEventListener('click', () => scene?.rotate(-1)); $('#rotate-right').addEventListener('click', () => scene?.rotate(1));
for (const dialog of dialogs) dialog.addEventListener('close', sync);
$('#result-dialog').addEventListener('cancel', event => event.preventDefault());
document.addEventListener('visibilitychange', () => { paused = document.hidden; $('#pause-shade').hidden = !paused; if (paused) sound.stop(); sync(); });
try {
  scene = new PirateScene($('#scene'), $('#slot-labels'), { pick: id => pick(id), models: status => {
    const loaded = Object.values(status).filter(state => state === 'loaded').length; $('#model-status').textContent = loaded === 3 ? 'Meshy 3D 모델 적용 · 통·해적·칼' : `임시 3D 모델로 플레이 중 · GLB ${loaded}/3 적용`;
  } });
  $('#scene-loading').hidden = true;
} catch (error) {
  $('#scene-loading').innerHTML = '<strong>3D 화면을 열 수 없어요.</strong><p>브라우저의 그래픽 가속을 확인해주세요.<br>아래 번호 버튼으로도 동일한 게임을 즐길 수 있어요.</p><div class="fallback-slots"></div>';
  $('#scene').classList.add('fallback-mode'); $('#model-status').textContent = '3D 사용 불가 · 번호 선택 모드';
  for (let id = 0; id < GAME.slots; id++) { const button = document.createElement('button'); button.dataset.slot = id; button.textContent = id + 1; button.setAttribute('aria-label', `구멍 ${id + 1}에 칼 꽂기`); button.addEventListener('click', () => pick(id)); $('.fallback-slots').append(button); }
}
window.addEventListener('pagehide', event => { if (!event.persisted) { token++; scene?.dispose(); sound.stop(); } });
renderSetupDraft(); sync(); $('#setup-cancel').hidden = true; $('#setup-dialog').showModal();

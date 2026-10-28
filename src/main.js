import './style.css';
import { COLORS, GAME_CONFIG, createQuestionSequence, kstDateString, limitForQuestion, localDailySeed, pointsForAnswer, randomSeed } from './game-engine.js';
import { apiGet, apiPost, getPlayerIdentity, saveNickname } from './ranking-api.js';

const STORAGE_KEY = 'playbox-records-v3';
const ACHIEVEMENTS_KEY = 'playbox-achievements-v1';
const SOUND_KEY = 'dont-click-sound-v1';

const emptyRecord = { questions: 0, stage: 0, score: 0, accuracy: 0, averageMs: null, bestCombo: 0 };
const defaults = { survival: { ...emptyRecord }, daily: { ...emptyRecord } };

function readRecord() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      survival: { ...emptyRecord, ...(parsed.survival || {}) },
      daily: { ...emptyRecord, ...(parsed.daily || {}) },
    };
  } catch {
    return { survival: { ...emptyRecord }, daily: { ...emptyRecord } };
  }
}

function readAchievements() {
  try { return new Set(JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '[]')); }
  catch { return new Set(); }
}

function readSoundPreference() {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; }
  catch { return true; }
}

const state = {
  view: 'home',
  phase: 'idle',
  score: 0,
  stage: 1,
  highestStage: 1,
  questionIndex: 0,
  stageProgress: 0,
  combo: 0,
  bestCombo: 0,
  lives: 3,
  correctCount: 0,
  wrongCount: 0,
  timeoutCount: 0,
  processedCount: 0,
  reactionTimes: [],
  currentQuestion: null,
  questionSequence: null,
  mode: 'survival',
  difficulty: 'normal',
  seed: 0,
  events: [],
  runStartedAt: 0,
  runId: null,
  runToken: null,
  ranked: false,
  challengeDate: null,
  requestedChallengeDate: null,
  player: getPlayerIdentity(),
  playerId: null,
  localRecords: readRecord(),
  unlockedAchievements: readAchievements(),
  rankScope: 'daily',
  rankLimit: 10,
  rankRows: [],
  lastResult: null,
  dailyRank: null,
  gameTimerKind: null,
  soundOn: readSoundPreference(),
  timerId: null,
  deadline: 0,
  remaining: 0,
  previousPhase: null,
  reactionStartedAt: 0,
  questionDeadline: 0,
  questionLocked: false,
  lastPointerAt: 0,
  pausedAt: 0,
  resultWasRecord: false,
  noticeTimer: null,
  chaosNoticeShown: false,
};

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="#home" aria-label="놀탭 홈">
        <span class="brand-mark"><span></span><span></span><span></span></span>
        <span class="brand-name">NOL<span>TAP</span></span>
      </a>
      <nav class="main-nav" aria-label="주 메뉴">
        <a href="#games">게임 목록 <small>03</small></a>
        <a href="#my-records">나의 기록</a>
      </nav>
      <div class="topbar-right">
        <button class="icon-button sound-toggle" type="button" aria-label="효과음 설정"></button>
      </div>
    </header>

    <main>
      <section class="view home-view" id="home-view">
        <div class="portal-hero" id="home">
          <div class="hero-copy">
            <div class="eyebrow"><span class="eyebrow-line"></span> NOLTAP / A LITTLE EVERYDAY FUN</div>
            <h1>지금, 뭐 하고<br />놀까<span class="title-dot">?</span></h1>
            <p class="hero-description">심심할 때도, 필요할 때도. 놀탭.<br />지금은 마음에 드는 게임을 골라 바로 시작해봐.</p>
            <div class="hero-actions">
              <a class="primary-button browse-button" href="#games"><span>게임 둘러보기</span><b aria-hidden="true">↓</b></a>
              <span class="quick-note"><i class="dot-green"></i> 가입 없이 바로 플레이</span>
            </div>
          </div>

          <div class="hero-art" aria-label="놀탭 게임 컬렉션">
            <div class="hero-art-orbit orbit-one"></div><div class="hero-art-orbit orbit-two"></div>
            <div class="hero-art-label"><span>YOUR NEXT</span><b>FAVORITE<br />GAME</b><i>↘</i></div>
            <div class="hero-art-tile tile-back"><span class="tile-number">03 / LIVE</span><span class="tile-glyph">☠</span><span class="tile-label">PIRATE<br />BARREL</span></div>
            <div class="hero-art-tile tile-mid"><span class="tile-number">02 / LIVE</span><span class="tile-glyph">⚔</span><span class="tile-label">PARRY<br />LAST BLADE</span></div>
            <div class="hero-art-tile tile-front"><span class="tile-number">01 / LIVE</span><div class="mini-signal"><i>RED</i></div><strong>DON'T<br />CLICK</strong><span class="tile-label">COLOR GAME</span></div>
            <span class="art-spark spark-a">✦</span><span class="art-spark spark-b">✳</span><span class="art-sticker">PLAY<br />ANYTIME</span>
          </div>
          <div class="hero-bottom"><span><b>03</b> GAMES AVAILABLE</span><i></i><span>새로운 게임이 계속 추가돼</span><span class="hero-scroll">SCROLL TO EXPLORE ↓</span></div>
        </div>

        <section class="game-library" id="games" aria-labelledby="games-heading">
          <div class="library-heading">
            <div><span class="section-kicker">PICK YOUR GAME</span><h2 id="games-heading">게임 목록 <span>03</span></h2><p>지금 바로 플레이하거나, 다음 업데이트를 기다려봐.</p></div>
            <div class="game-filters" role="group" aria-label="게임 장르 필터">
              <button class="filter-chip is-active" type="button" data-filter="all" aria-pressed="true">전체 <small>03</small></button>
              <button class="filter-chip" type="button" data-filter="reaction" aria-pressed="false">반응속도 <small>01</small></button>
              <button class="filter-chip" type="button" data-filter="action" aria-pressed="false">액션 <small>01</small></button>
              <button class="filter-chip" type="button" data-filter="casual" aria-pressed="false">캐주얼 <small>01</small></button>
            </div>
          </div>

          <div class="game-card-grid">
            <article class="game-card playable-card" data-category="reaction">
              <div class="card-art click-art">
                <span class="card-index">01 <i>·</i> FEATURED</span><span class="card-status"><i></i> PLAY NOW</span>
                <div class="card-signal"><span>RED</span></div>
                <div class="card-art-title">DON'T<br /><em>CLICK</em></div>
                <span class="card-art-caption">GREEN MEANS GO?<br />THINK AGAIN.</span>
                <span class="card-art-star">✳</span>
              </div>
              <div class="game-card-body">
                <div class="card-title-row"><div><div class="game-tags"><span>반응속도</span><span>1인 플레이</span></div><h3>누르지 마! <small>DON'T CLICK</small></h3></div><span class="card-arrow">↗</span></div>
                <p>영어 단어의 뜻에 속지 말고, 실제 글자색을 골라. 세 번 실수하기 전에 기록을 세워봐.</p>
                <div class="game-card-footer"><span class="card-best">최고 기록 <b id="home-best-score">0</b><i>문제</i></span><button class="card-play-button start-button" type="button">플레이 <b>→</b></button></div>
              </div>
            </article>
            <article class="game-card playable-card playable-parry" data-category="action">
              <a class="card-art parry-card-art" href="./parry.html" aria-label="PARRY: LAST BLADE 플레이하기">
                <span class="card-index">02 <i>·</i> NEW DUEL</span><span class="card-status"><i></i> PLAY NOW</span>
                <img class="parry-card-image" src="./images/parry-card.webp" width="1280" height="640" alt="불이 켜진 성채에서 검을 든 붉은 망토의 3D 기사" loading="lazy" decoding="async" />
                <span class="parry-card-title">PARRY<br /><em>LAST BLADE</em></span><span class="art-number">02</span>
              </a>
              <div class="game-card-body"><div class="card-title-row"><div><div class="game-tags"><span>패링 액션</span><span>보스 러시</span></div><h3>패리: 라스트 블레이드</h3></div><span class="card-arrow">↗</span></div><p>정면의 검을 읽고 충돌 순간에 쳐내. 끝없이 강해지는 검성에게 맞서 살아남아.</p><div class="game-card-footer"><span class="card-best">1인칭 검술 <i>무한 생존</i></span><a class="card-play-button" href="./parry.html">플레이 <b>→</b></a></div></div>
            </article>
            <article class="game-card playable-card" data-category="casual">
              <a class="card-art pirate-card-art" href="./pirate.html" aria-label="통통! 해적 룰렛 플레이하기"><span class="card-index">03 <i>·</i> NEW ADVENTURE</span><span class="card-status"><i></i> PLAY NOW</span><img class="pirate-card-gameplay" src="./images/pirate-gameplay.webp" width="1434" height="747" alt="통에서 고개를 내민 해적과 실제 3D 게임 장면" loading="lazy" decoding="async" /><strong class="pirate-card-title">통통!<br /><em>해적 룰렛</em></strong><span class="art-number">03</span></a>
              <div class="game-card-body"><div class="card-title-row"><div><div class="game-tags"><span>3D 캐주얼</span><span>2~8인 로컬 대전</span></div><h3>통통! 해적 룰렛</h3></div><span class="card-arrow">↗</span></div><p>친구들과 한 화면에서 차례로 칼을 꽂고, 각자 고른 칼 색으로 함정의 행운을 겨뤄봐.</p><div class="game-card-footer"><span class="card-best">한 기기에서 함께 <i>짧은 한 판 승부</i></span><a class="card-play-button" href="./pirate.html">플레이 <b>→</b></a></div></div>
            </article>
          </div>
          <div class="library-footnote"><span><i></i> 새 게임을 준비하고 있어</span><span>SHOWING <b id="shown-game-count">03</b> GAMES</span></div>
        </section>

        <section class="records-strip" id="my-records" aria-labelledby="record-heading">
          <div class="records-intro"><span class="section-kicker">YOUR PLAY DATA</span><h2 id="record-heading">나의 플레이 기록</h2><p>이 기기에서 플레이한 개인 최고 기록이야.</p></div>
          <div class="record-metric"><span>누르지 마! 최고 점수</span><strong id="home-record-score">0</strong><i>PTS</i></div>
          <div class="record-metric"><span>최고 콤보</span><strong id="home-best-combo">0</strong><i>COMBO</i></div>
          <div class="record-metric"><span>최고 문제 수</span><strong id="home-best-level">0</strong><i>Q</i></div>
          <div class="record-foot"><span><i class="tiny-dot"></i> 최고 반응 <b id="home-best-time">—</b></span><span>자동 저장</span></div>
        </section>
        <div class="ad-slot" aria-label="광고 배치 예정 영역"><span>AD SPACE</span><small>게임 선택과 기록 확인을 방해하지 않는 광고 영역</small></div>
      </section>

      <section class="view lobby-view hidden" id="lobby-view" aria-label="누르지 마 게임 메뉴">
        <div class="lobby-topline"><button class="hub-back" type="button">← 게임 모음</button><span>GAME 01 <i>·</i> REACTION</span></div>
        <div class="lobby-heading">
          <div class="lobby-title-block">
            <div class="lobby-signal-mark"><span>!</span><i></i></div>
            <div><span class="section-kicker">COLOR · FOCUS · SURVIVAL</span><h1>누르지 마<span>!</span></h1><p>단어의 뜻은 무시하고, 글자가 실제로 표시된 색을 골라봐.</p></div>
          </div>
          <div class="nickname-card"><label for="nickname-input">랭킹 닉네임 <small>2–16자</small></label><div><input id="nickname-input" type="text" maxlength="16" autocomplete="nickname" placeholder="플레이어" /><button class="save-nickname" type="button">저장</button></div><small class="nickname-help" id="nickname-help">닉네임은 이 익명 플레이어 기록에 연결됩니다.</small></div>
        </div>

        <div class="lobby-grid">
          <div class="lobby-main-column">
            <section class="mode-section" aria-labelledby="mode-heading"><div class="section-heading"><div><span class="section-kicker">CHOOSE YOUR MODE</span><h2 id="mode-heading">모드 선택</h2></div><span class="how-count">3 LIVES · 5 QUESTIONS / STAGE</span></div>
              <fieldset class="difficulty-options"><legend>버튼 난이도</legend><label><input type="radio" name="choice-difficulty" value="normal" checked /><span><b>기본</b><small>기존 색 버튼으로 선택</small></span></label><label><input type="radio" name="choice-difficulty" value="hard" /><span><b>어려움</b><small>첫 문제부터 색 없이 단어만</small></span></label></fieldset>
              <div class="mode-cards">
                <article class="mode-card survival-mode"><div class="mode-card-top"><span class="mode-icon">∞</span><span class="mode-pill">ENDLESS</span></div><h3>무한 생존</h3><p>세 번 실수하기 전까지 색상 판단에 도전해. 기록은 전체 랭킹에 등록돼.</p><div class="mode-card-bottom"><span>내 최고 <b id="lobby-survival-best">—</b></span><button class="mode-start" id="start-survival" type="button">시작하기 <b>↗</b></button></div></article>
                <article class="mode-card daily-mode"><div class="mode-card-top"><span class="mode-icon">◷</span><span class="mode-pill daily-pill">DAILY <i id="challenge-date-short">오늘</i></span></div><h3>오늘의 도전</h3><p>모든 플레이어가 같은 색상 순서로 도전해. 한국 시간 자정에 새 패턴이 시작돼.</p><div class="mode-card-bottom"><span>오늘 최고 <b id="lobby-daily-best">—</b></span><button class="mode-start" id="start-daily" type="button">도전하기 <b>↗</b></button></div></article>
              </div>
            </section>

            <section class="leaderboard-panel" aria-labelledby="leaderboard-heading">
              <div class="leaderboard-head"><div><span class="section-kicker">PLAYERS AROUND THE WORLD</span><h2 id="leaderboard-heading">오늘의 TOP 10</h2></div><div class="board-tabs" role="tablist" aria-label="랭킹 기간"><button class="board-tab is-active" type="button" data-scope="daily" role="tab" aria-selected="true">오늘</button><button class="board-tab" type="button" data-scope="survival" role="tab" aria-selected="false">전체</button></div></div>
              <div class="board-date-row"><span id="board-date-label">오늘의 도전</span><button class="leaderboard-more" type="button">TOP 100 보기 <b>↗</b></button></div>
              <div class="leaderboard-columns"><span>순위 · 플레이어</span><span>Q</span><span>SCORE</span><span>정확도</span></div>
              <ol class="leaderboard-list" id="leaderboard-list"><li class="board-empty">랭킹을 불러오는 중…</li></ol>
              <div class="leaderboard-note" id="leaderboard-note">랭킹은 서버 연결 후 표시됩니다.</div>
            </section>
          </div>

          <aside class="lobby-side-column">
            <section class="personal-best-panel"><span class="section-kicker">YOUR PERSONAL BEST</span><div class="personal-best-title"><h2>나의 기록</h2><span>LOCAL + ONLINE</span></div><div class="personal-best-score"><strong id="profile-best-stage">—</strong><span>QUESTIONS</span><b id="profile-best-score">0</b><i>PTS</i></div><div class="personal-best-sub"><span>평균 반응 <b id="profile-average">—</b></span><span>최고 콤보 <b id="profile-combo">0</b></span></div><div class="profile-status" id="profile-status"><i></i> 이 기기에 자동 저장</div></section>
            <section class="how-to-panel"><div class="section-heading"><div><span class="section-kicker">HOW TO PLAY</span><h2>단어 말고 글자색</h2></div><span class="how-count">01—03</span></div><div class="how-to-list"><div><b>01</b><span class="rule-shape shape-green">Aa</span><p><strong>영어 단어의 뜻은 무시해</strong><small>단어가 실제로 표시된 글자색이 정답이야.</small></p></div><div><b>02</b><span class="rule-shape shape-red">●</span><p><strong>아래 4개 색 버튼 중 선택</strong><small>키보드 1 빨강 · 2 파랑 · 3 초록 · 4 노랑</small></p></div><div><b>03</b><span class="fake-mark">1s</span><p><strong>시간은 3문제마다 짧아져</strong><small>31번부터 배경도 바뀌어. 어려움은 처음부터 단어 버튼만 보여.</small></p></div></div><div class="lobby-example"><span style="color:#61a7ff">RED</span><b>→</b><strong>파랑 버튼</strong><small>글자색이 파랑이라서</small></div><div class="control-hint"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd><span>또는 색상 버튼 터치</span></div></section>
            <div class="fair-play-note"><span>◈</span><p>반응속도는 기기와 브라우저의 입력 지연에 영향을 받는 참고 기록입니다.</p></div>
          </aside>
        </div>
        <div class="ad-slot lobby-ad" aria-label="광고 배치 예정 영역"><span>AD SPACE</span><small>광고는 게임 플레이 중 표시되지 않습니다</small></div>
      </section>

      <section class="view game-view hidden" id="game-view" aria-label="게임 화면">
        <div class="game-toolbar">
          <button class="back-button" type="button" aria-label="홈으로 나가기">← <span>나가기</span></button>
          <div class="game-stats">
            <div class="game-stat score-stat"><span>점수</span><strong id="score-value">00000</strong></div>
            <div class="game-stat"><span>문제</span><strong id="question-value">01</strong></div>
            <div class="game-stat"><span>스테이지</span><strong id="stage-value">01</strong></div>
            <div class="game-stat"><span>콤보</span><strong id="combo-value">× 00</strong></div>
          </div>
          <button class="pause-button" type="button" aria-label="일시정지"><span class="pause-glyph">Ⅱ</span></button>
        </div>
        <div class="game-progress"><span class="progress-label" id="progress-label">QUESTION 01 <i>·</i> LIMIT 3.0S</span><div class="progress-track timer-track"><span id="progress-fill"></span></div><span class="lives" id="lives-value" aria-label="남은 생명 3개"></span></div>

        <div class="play-area" id="play-area">
          <div class="round-info"><span id="mode-label">무한 생존</span><span id="average-label">평균 반응 —</span></div>
          <div class="chaos-notice hidden" id="chaos-notice" aria-live="polite">BACKGROUND CHAOS!</div>
          <div class="word-card" id="word-card" aria-live="polite"><span class="word-overline">IGNORE THE WORD</span><strong id="word-display">READY</strong><span class="word-caption" id="word-caption">글자의 실제 색을 선택해</span></div>
          <div class="feedback" id="feedback" aria-live="polite"></div>
          <div class="countdown-overlay hidden" id="countdown-overlay"><span class="countdown-caption">준비</span><strong id="countdown-value">3</strong></div>
          <div class="pause-overlay hidden" id="pause-overlay"><span class="pause-icon">Ⅱ</span><strong>잠깐 멈춤</strong><span>준비되면 다시 이어서 플레이해</span><button class="primary-button resume-button" type="button"><span>계속하기</span><b>↗</b></button></div>
        </div>
        <div class="color-choices" id="color-choices" role="group" aria-label="글자색을 선택하세요">
          <button class="color-choice choice-red" type="button" data-color="0" aria-label="빨강 선택, 키보드 1"><span>RED<small>빨강</small></span><kbd>1</kbd></button>
          <button class="color-choice choice-blue" type="button" data-color="1" aria-label="파랑 선택, 키보드 2"><span>BLUE<small>파랑</small></span><kbd>2</kbd></button>
          <button class="color-choice choice-green" type="button" data-color="2" aria-label="초록 선택, 키보드 3"><span>GREEN<small>초록</small></span><kbd>3</kbd></button>
          <button class="color-choice choice-yellow" type="button" data-color="3" aria-label="노랑 선택, 키보드 4"><span>YELLOW<small>노랑</small></span><kbd>4</kbd></button>
        </div>
        <div class="game-footer"><span><kbd>1—4</kbd> 색상 선택</span><span>반응속도는 기기별 입력 지연의 영향을 받습니다</span><button class="sound-inline" type="button">효과음 <b></b></button></div>
      </section>

      <section class="view result-view hidden" id="result-view" aria-label="게임 결과">
        <div class="result-content">
          <div class="result-eyebrow"><span></span> RUN COMPLETE</div>
          <h1 id="result-title">끝까지 버텼어<span>!</span></h1>
          <p class="result-subtitle" id="result-subtitle">이번 기록을 확인해봐.</p>
          <div class="result-score-card">
            <span class="result-label">FINAL SCORE</span>
            <strong id="final-score">0</strong><span class="result-unit">PTS</span>
            <div class="record-badge hidden" id="record-badge">✦ NEW PERSONAL BEST</div>
          </div>
          <div class="result-stats-grid">
            <div><span>평균 반응속도</span><strong id="result-average">—<small> ms</small></strong></div>
            <div><span>최고 반응속도</span><strong id="result-fastest">—<small> ms</small></strong></div>
            <div><span>정확도</span><strong id="result-accuracy">—<small> %</small></strong></div>
            <div><span>최고 콤보</span><strong id="result-combo">0<small> ×</small></strong></div>
            <div><span>처리한 문제</span><strong id="result-questions">0<small> Q</small></strong></div>
            <div><span>실수</span><strong id="result-mistakes">0<small> / 3</small></strong></div>
          </div>
          <div class="result-rank-row"><span>랭킹 결과</span><strong id="result-rank">서버 연결 확인 중</strong></div>
          <div class="result-record-comparison" id="result-record-comparison"></div>
          <div class="achievement-row" id="result-achievements"></div>
          <div class="result-actions"><button class="primary-button retry-button" type="button"><span>다시 도전</span><b>↗</b></button><button class="secondary-button share-button" type="button">결과 공유 <span>↗</span></button><button class="text-button home-button" type="button">모드 선택</button></div>
          <p class="measurement-note">반응속도는 기기와 브라우저의 입력 지연에 따라 달라질 수 있는 참고 기록입니다.</p>
        </div>
        <div class="result-side-mark" aria-hidden="true"><span>DON'T</span><b>CLICK</b><i>✳</i></div>
        <div class="ad-slot result-ad" aria-label="광고 배치 예정 영역"><span>AD SPACE</span><small>결과 확인 후 배치되는 광고 영역</small></div>
      </section>
    </main>

    <footer class="site-footer"><span>© 2026 NOLTAP</span><nav class="site-links" aria-label="하단 메뉴"><a href="./about.html">사이트 소개</a><a href="./contact.html">문의</a><a href="./privacy.html">개인정보처리방침</a></nav></footer>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  </div>
`;

const $ = (selector) => document.querySelector(selector);
const homeView = $('#home-view');
const lobbyView = $('#lobby-view');
const gameView = $('#game-view');
const resultView = $('#result-view');
const wordDisplay = $('#word-display');
const playArea = $('#play-area');
const progressFill = $('#progress-fill');
const feedback = $('#feedback');
const countdownOverlay = $('#countdown-overlay');
const pauseOverlay = $('#pause-overlay');
const chaosNotice = $('#chaos-notice');
let audioContext;

function formatScore(value) {
  return String(value).padStart(5, '0');
}

function getKstDate() {
  return kstDateString();
}

function formatDate(date) {
  const [year, month, day] = date.split('-');
  return `${year}.${month}.${day}`;
}

function updateRecordDisplay() {
  const survival = state.localRecords.survival;
  const storedDaily = state.localRecords.daily;
  const daily = storedDaily.challengeDate === getKstDate() ? storedDaily : emptyRecord;
  $('#home-best-score').textContent = survival.score.toLocaleString('ko-KR');
  $('#home-record-score').textContent = survival.score.toLocaleString('ko-KR');
  $('#home-best-combo').textContent = survival.bestCombo;
  $('#home-best-level').textContent = survival.questions || 0;
  $('#home-best-time').textContent = survival.averageMs == null ? '—' : `${survival.averageMs}MS`;
  $('#lobby-survival-best').textContent = survival.questions ? `${survival.questions}문제` : '—';
  $('#lobby-daily-best').textContent = daily.questions ? `${daily.questions}문제` : '—';

  const profile = state.onlineProfile;
  const selected = profile?.survival || survival;
  $('#profile-best-stage').textContent = selected.questions ? String(selected.questions).padStart(2, '0') : '—';
  $('#profile-best-score').textContent = (selected.score || 0).toLocaleString('ko-KR');
  $('#profile-average').textContent = selected.average_ms ? `${selected.average_ms}ms` : selected.averageMs ? `${selected.averageMs}ms` : '—';
  $('#profile-combo').textContent = selected.best_combo ?? selected.bestCombo ?? 0;
}

function updateSoundButtons() {
  const symbol = state.soundOn ? '♫' : '♪̸';
  const label = state.soundOn ? '효과음 끄기' : '효과음 켜기';
  $('.sound-toggle').textContent = symbol;
  $('.sound-toggle').setAttribute('aria-label', label);
  $('.sound-inline b').textContent = state.soundOn ? 'ON' : 'OFF';
  $('.sound-inline').setAttribute('aria-label', label);
}

function showView(view) {
  state.view = view;
  $('.site-footer').classList.toggle('hidden', view === 'game');
  homeView.classList.toggle('hidden', view !== 'home');
  lobbyView.classList.toggle('hidden', view !== 'lobby');
  gameView.classList.toggle('hidden', view !== 'game');
  resultView.classList.toggle('hidden', view !== 'result');
  $('.main-nav').classList.toggle('hidden', view !== 'home');
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (view === 'home' || view === 'lobby') updateRecordDisplay();
}

function clearGameTimer() {
  if (state.timerId) {
    window.clearTimeout(state.timerId);
    window.clearInterval(state.timerId);
  }
  state.timerId = null;
  state.deadline = 0;
  state.gameTimerKind = null;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
}

function scheduleTimer(callback, delay, kind = 'timeout') {
  if (state.timerId) window.clearTimeout(state.timerId);
  state.deadline = performance.now() + delay;
  state.gameTimerKind = kind;
  state.timerId = window.setTimeout(() => {
    state.timerId = null;
    state.deadline = 0;
    state.gameTimerKind = null;
    callback();
  }, delay);
}

function updateGameStats() {
  state.stage = Math.floor(state.questionIndex / GAME_CONFIG.questionsPerStage) + 1;
  state.stageProgress = state.questionIndex % GAME_CONFIG.questionsPerStage;
  $('#score-value').textContent = formatScore(state.score);
  $('#question-value').textContent = String((state.currentQuestion?.number || state.questionIndex + 1)).padStart(2, '0');
  $('#stage-value').textContent = String(state.currentQuestion?.stage || state.stage).padStart(2, '0');
  $('#combo-value').textContent = `× ${String(state.combo).padStart(2, '0')}`;
  const questionNumber = state.currentQuestion?.number || state.questionIndex + 1;
  const limit = state.currentQuestion?.limitMs || limitForQuestion(questionNumber);
  $('#progress-label').innerHTML = `QUESTION ${String(questionNumber).padStart(2, '0')} <i>·</i> LIMIT ${(limit / 1000).toFixed(1)}S`;
  $('#average-label').textContent = state.reactionTimes.length
    ? `평균 반응 ${Math.round(state.reactionTimes.reduce((sum, value) => sum + value, 0) / state.reactionTimes.length)}MS`
    : '평균 반응 —';
  $('#mode-label').textContent = state.mode === 'daily' ? `오늘의 도전 · ${formatDate(state.challengeDate || getKstDate())}` : '무한 생존';
  $('#mode-label').textContent += state.difficulty === 'hard' ? ' · 어려움' : ' · 기본';
  $('#lives-value').innerHTML = [0, 1, 2].map((index) => `<i class="life ${index < state.lives ? 'life-on' : ''}">♥</i>`).join('');
  $('#lives-value').setAttribute('aria-label', `남은 생명 ${state.lives}개`);
}

function playTone(frequency, duration = 0.08, type = 'sine', volume = 0.035) {
  if (!state.soundOn) return;
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
  } catch { /* Audio is optional. */ }
}

function showFeedback(message, kind = 'good') {
  feedback.textContent = message;
  feedback.className = `feedback feedback-${kind} feedback-visible`;
  if (state.noticeTimer) window.clearTimeout(state.noticeTimer);
  state.noticeTimer = window.setTimeout(() => feedback.classList.remove('feedback-visible'), 700);
}

function updateBoardTabs() {
  document.querySelectorAll('.board-tab').forEach((tab) => {
    const active = tab.dataset.scope === state.rankScope;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  $('#leaderboard-heading').textContent = state.rankScope === 'daily' ? `오늘의 TOP ${state.rankLimit}` : `전체 TOP ${state.rankLimit}`;
  $('#board-date-label').textContent = state.rankScope === 'daily' ? `오늘의 도전 · ${formatDate(state.requestedChallengeDate || getKstDate())}` : '무한 생존 누적 기록';
  $('.leaderboard-more').innerHTML = state.rankLimit === 10 ? 'TOP 100 보기 <b>↗</b>' : 'TOP 10 보기 <b>↗</b>';
}

function renderLeaderboard(rows, message = '') {
  const list = $('#leaderboard-list');
  list.replaceChildren();
  if (!rows?.length) {
    const empty = document.createElement('li');
    empty.className = 'board-empty';
    empty.textContent = message || '아직 등록된 기록이 없어. 첫 번째 기록에 도전해봐!';
    list.append(empty);
    return;
  }
  rows.forEach((row) => {
    const item = document.createElement('li');
    item.className = `board-row ${String(row.player_id) === String(state.playerId) ? 'is-me' : ''}`;
    const label = row.rank <= 3 ? `0${row.rank}` : String(row.rank);
    const questions = Number(row.questions_processed ?? row.stage ?? 0);
    item.innerHTML = `<span class="board-player"><b class="board-rank">${label}</b><span class="board-nickname"></span></span><span class="board-stage">${questions}</span><span class="board-score">${Number(row.score).toLocaleString('ko-KR')}</span><span class="board-accuracy">${row.accuracy}%</span>`;
    item.querySelector('.board-nickname').textContent = row.nickname || '플레이어';
    if (String(row.player_id) === String(state.playerId)) item.querySelector('.board-nickname').insertAdjacentHTML('afterend', '<i class="me-mark">ME</i>');
    list.append(item);
  });
}

async function loadLeaderboard(scope = state.rankScope, limit = state.rankLimit) {
  state.rankScope = scope;
  state.rankLimit = limit;
  updateBoardTabs();
  renderLeaderboard([], '랭킹을 불러오는 중…');
  try {
    const params = { mode: scope, limit: String(limit) };
    if (state.playerId) params.player_id = state.playerId;
    if (scope === 'daily') params.challenge_date = state.requestedChallengeDate || getKstDate();
    const response = await apiGet('leaderboard', params);
    state.rankRows = response.rows || [];
    renderLeaderboard(state.rankRows, response.message || '아직 등록된 기록이 없어. 첫 기록을 남겨봐!');
    $('#leaderboard-note').textContent = response.player_rank
      ? `내 순위 ${response.player_rank}위 · 처리 문제 → 점수 → 정확도 순으로 정렬`
      : '처리 문제 → 점수 → 정확도 순으로 정렬';
    return response;
  } catch (error) {
    renderLeaderboard([], '랭킹 서버에 연결할 수 없어. 게임은 로컬 모드로 플레이할 수 있어.');
    $('#leaderboard-note').textContent = 'DB 설정 후 서버 랭킹을 사용할 수 있습니다.';
    return null;
  }
}

async function openGameLobby() {
  showView('lobby');
  const date = state.requestedChallengeDate || getKstDate();
  $('#challenge-date-short').textContent = date === getKstDate() ? '오늘' : formatDate(date);
  $('#nickname-input').value = state.player.nickname;
  $('#nickname-help').textContent = '닉네임은 이 익명 플레이어 기록에 연결됩니다.';
  updateRecordDisplay();
  const profileTask = apiPost('profile', { nickname: state.player.nickname });
  await loadLeaderboard(state.rankScope, state.rankLimit);
  try {
    const profile = await profileTask;
    state.playerId = profile.player_id;
    state.player.nickname = profile.nickname || state.player.nickname;
    state.onlineProfile = profile.records || null;
    $('#nickname-input').value = state.player.nickname;
    $('#profile-status').innerHTML = '<i></i> 랭킹 서버 연결됨 · 익명 ID 보호 중';
    updateRecordDisplay();
    await loadLeaderboard(state.rankScope, state.rankLimit);
  } catch {
    state.onlineProfile = null;
    $('#profile-status').innerHTML = '<i class="offline-dot"></i> 로컬 기록 · 랭킹 서버 연결 대기';
  }
}

async function savePlayerNickname() {
  const raw = $('#nickname-input').value.trim().replace(/\s+/g, ' ');
  const length = [...raw].length;
  if (length < 2 || length > 16) {
    $('#nickname-help').textContent = '닉네임은 2~16자로 입력해줘.';
    $('#nickname-help').classList.add('help-error');
    return;
  }
  state.player.nickname = saveNickname(raw);
  $('#nickname-help').classList.remove('help-error');
  try {
    const profile = await apiPost('profile', { nickname: state.player.nickname });
    state.playerId = profile.player_id;
    state.player.nickname = profile.nickname;
    state.onlineProfile = profile.records || null;
    $('#nickname-input').value = state.player.nickname;
    $('#nickname-help').textContent = '닉네임이 이 플레이어 ID에 저장됐어.';
    $('#profile-status').innerHTML = '<i></i> 랭킹 서버 연결됨 · 익명 ID 보호 중';
    await loadLeaderboard(state.rankScope, state.rankLimit);
  } catch {
    $('#nickname-help').textContent = '이 기기에 저장했어. 랭킹 저장은 서버 연결 후 가능해.';
  }
}

function setStartButtons(disabled) {
  document.querySelectorAll('.mode-start').forEach((button) => { button.disabled = disabled; });
}

async function beginGame(mode = 'survival') {
  if (!['survival', 'daily'].includes(mode)) return;
  const requestedDate = state.requestedChallengeDate || getKstDate();
  if (mode === 'daily' && requestedDate !== getKstDate()) {
    toast('지난 도전은 기록 확인만 할 수 있어. 오늘의 도전을 시작해줘.');
    return;
  }
  setStartButtons(true);
  state.mode = mode;
  state.difficulty = $('input[name="choice-difficulty"]:checked').value;
  state.player.nickname = saveNickname($('#nickname-input').value || state.player.nickname);
  let session = null;
  try {
    session = await apiPost('start', {
      nickname: state.player.nickname,
      mode,
      challenge_date: mode === 'daily' ? requestedDate : null,
    });
  } catch { /* Play locally when PHP or the database has not been configured yet. */ }

  state.runId = session?.run_id || null;
  state.runToken = session?.run_token || null;
  state.playerId = session?.player_id || state.playerId;
  state.ranked = Boolean(session?.run_id && session?.run_token);
  state.challengeDate = session?.challenge_date || requestedDate;
  state.seed = Number.isFinite(Number(session?.seed))
    ? Number(session.seed)
    : mode === 'daily' ? localDailySeed(state.challengeDate) : randomSeed();
  state.questionSequence = createQuestionSequence(state.seed);
  state.phase = 'countdown';
  state.score = 0;
  state.stage = 1;
  state.highestStage = 1;
  state.questionIndex = 0;
  state.stageProgress = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.lives = GAME_CONFIG.startingLives;
  state.correctCount = 0;
  state.wrongCount = 0;
  state.timeoutCount = 0;
  state.processedCount = 0;
  state.reactionTimes = [];
  state.events = [];
  state.currentQuestion = null;
  state.questionLocked = false;
  state.chaosNoticeShown = false;
  state.runStartedAt = performance.now();
  state.lastResult = null;
  state.newAchievements = [];
  feedback.className = 'feedback';
  feedback.textContent = '';
  countdownOverlay.classList.remove('hidden');
  pauseOverlay.classList.add('hidden');
  setStartButtons(false);
  showView('game');
  wordDisplay.textContent = 'READY';
  wordDisplay.style.color = '#f1f3f0';
  playArea.style.removeProperty('--question-bg');
  $('#color-choices').classList.toggle('words-only', state.difficulty === 'hard');
  progressFill.style.width = '100%';
  document.querySelectorAll('.color-choice').forEach((button) => { button.disabled = true; });
  updateGameStats();
  startCountdown(3);
}

function startCountdown(count = 3) {
  clearGameTimer();
  state.phase = 'countdown';
  state.countdownCount = count;
  countdownOverlay.classList.remove('hidden');
  $('#countdown-value').textContent = count;
  playTone(500, 0.08);
  state.timerId = window.setInterval(() => {
    state.countdownCount -= 1;
    if (state.countdownCount > 0) {
      $('#countdown-value').textContent = state.countdownCount;
      playTone(500, 0.08);
    } else {
      clearGameTimer();
      countdownOverlay.classList.add('hidden');
      $('#countdown-value').textContent = 'GO';
      $('#countdown-value').classList.add('countdown-go');
      playTone(900, 0.16);
      window.setTimeout(() => $('#countdown-value').classList.remove('countdown-go'), 280);
      showQuestion();
    }
  }, 1000);
}

function showQuestion() {
  if (state.phase === 'finished' || state.phase === 'paused') return;
  const question = state.questionSequence.next();
  state.currentQuestion = question;
  state.questionIndex = question.index;
  state.highestStage = Math.max(state.highestStage, question.stage);
  state.phase = 'presenting';
  state.questionLocked = false;
  wordDisplay.textContent = question.word;
  wordDisplay.style.color = COLORS[question.colorIndex].hex;
  const wordsOnly = state.difficulty === 'hard';
  $('#color-choices').classList.toggle('words-only', wordsOnly);
  if (question.backgroundIndex == null) playArea.style.removeProperty('--question-bg');
  else playArea.style.setProperty('--question-bg', COLORS[question.backgroundIndex].background);
  $('#word-caption').textContent = wordsOnly ? '글자색과 같은 이름의 버튼을 선택해' : question.backgroundIndex == null ? '글자의 실제 색을 선택해' : '배경색은 무시하고 글자색을 선택해';
  document.querySelectorAll('.color-choice').forEach((button) => { button.disabled = true; });
  updateGameStats();
  progressFill.style.transition = 'none';
  progressFill.style.width = '100%';
  if (question.number === 31 && !state.chaosNoticeShown) {
    state.chaosNoticeShown = true;
    showChaosNotice('BACKGROUND CHAOS!');
  } else if (question.number === 61) {
    showChaosNotice('MAX SPEED · 1.0 SEC');
  }
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = requestAnimationFrame(() => {
    if (state.phase !== 'presenting' || state.currentQuestion !== question) return;
    state.phase = 'answering';
    state.reactionStartedAt = performance.now();
    state.questionDeadline = state.reactionStartedAt + question.limitMs;
    document.querySelectorAll('.color-choice').forEach((button) => { button.disabled = false; });
    progressFill.style.transition = 'none';
    const tick = () => {
      if (state.phase !== 'answering' || !state.currentQuestion) return;
      const remaining = Math.max(0, state.questionDeadline - performance.now());
      progressFill.style.width = `${Math.max(0, remaining / question.limitMs * 100)}%`;
      state.rafId = requestAnimationFrame(tick);
    };
    state.rafId = requestAnimationFrame(tick);
    scheduleTimer(() => resolveQuestion(null, true), question.limitMs, 'question-timeout');
  });
}

function showChaosNotice(message) {
  chaosNotice.textContent = message;
  chaosNotice.classList.remove('hidden');
  window.clearTimeout(state.chaosTimer);
  state.chaosTimer = window.setTimeout(() => chaosNotice.classList.add('hidden'), 1450);
}

function resolveQuestion(choiceIndex, timedOut = false) {
  if (!state.currentQuestion || state.phase !== 'answering' || state.questionLocked) return;
  state.questionLocked = true;
  const now = performance.now();
  if (!timedOut && now >= state.questionDeadline) timedOut = true;
  clearGameTimer();
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  document.querySelectorAll('.color-choice').forEach((button) => { button.disabled = true; });
  const reactionMs = timedOut ? null : Math.max(0, Math.round(now - state.reactionStartedAt));
  const correct = !timedOut && choiceIndex === state.currentQuestion.correctColor;
  const elapsedMs = Math.max(0, Math.round(now - state.runStartedAt));
  const event = {
    question_index: state.currentQuestion.index,
    stage: state.currentQuestion.stage,
    choice_index: timedOut ? null : choiceIndex,
    kind: timedOut ? 'timeout' : correct ? 'correct' : 'wrong',
    reaction_ms: reactionMs,
    elapsed_ms: elapsedMs,
  };
  state.events.push(event);
  state.processedCount += 1;
  if (correct) {
    state.correctCount += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.reactionTimes.push(reactionMs);
    const points = pointsForAnswer(reactionMs, state.currentQuestion.limitMs, state.combo);
    state.score += points.total;
    showFeedback(`${COLORS[choiceIndex].labelKo} 정답 · ${reactionMs}MS  +${points.total}`, 'good');
    playTone(980, 0.075, 'sine', 0.028);
  } else {
    if (timedOut) state.timeoutCount += 1;
    else state.wrongCount += 1;
    state.lives -= 1;
    state.combo = 0;
    const message = timedOut ? '시간 초과 · 생명 −1' : `오답 · 정답은 ${COLORS[state.currentQuestion.correctColor].labelKo}`;
    showFeedback(message, 'bad');
    playTone(170, 0.12, 'sawtooth', 0.03);
  }
  state.questionIndex = state.events.length;
  state.currentQuestion = null;
  updateGameStats();
  if (state.lives <= 0) {
    endGame();
  } else {
    showQuestion();
  }
}

function handleColorInput(choiceIndex, event) {
  if (event) event.preventDefault();
  if (Number.isInteger(choiceIndex) && choiceIndex >= 0 && choiceIndex < COLORS.length) {
    resolveQuestion(choiceIndex, false);
  }
}

function currentStatistics() {
  const averageMs = state.reactionTimes.length
    ? Math.round(state.reactionTimes.reduce((sum, value) => sum + value, 0) / state.reactionTimes.length)
    : null;
  const fastestMs = state.reactionTimes.length ? Math.min(...state.reactionTimes) : null;
  const accuracy = state.events.length ? Math.round(state.correctCount / state.events.length * 100) : 0;
  const questions = state.events.length;
  return {
    questions,
    stage: questions ? Math.floor((questions - 1) / GAME_CONFIG.questionsPerStage) + 1 : 0,
    score: state.score,
    accuracy,
    averageMs,
    fastestMs,
    bestCombo: state.bestCombo,
    mistakes: state.wrongCount + state.timeoutCount,
    wrongCount: state.wrongCount,
    timeoutCount: state.timeoutCount,
    correctCount: state.correctCount,
  };
}

function recordIsBetter(next, old) {
  if (next.questions !== old.questions) return next.questions > old.questions;
  if (next.score !== old.score) return next.score > old.score;
  return next.accuracy > old.accuracy;
}

function achievementsFor(stats) {
  const catalog = [
    { id: 'first-play', title: '첫 플레이', detail: '첫 게임 플레이', unlocked: stats.questions > 0 },
    { id: 'survive-10', title: '10문제 생존', detail: '10문제 처리', unlocked: stats.questions >= 10 },
    { id: 'survive-20', title: '20문제 생존', detail: '20문제 처리', unlocked: stats.questions >= 20 },
    { id: 'survive-30', title: '30문제 생존', detail: '30문제 처리', unlocked: stats.questions >= 30 },
    { id: 'background-31', title: '혼돈 진입', detail: '배경 변화가 시작되는 31번째 문제 도달', unlocked: stats.questions >= 31 },
    { id: 'survive-50', title: '50문제 생존', detail: '50문제 처리', unlocked: stats.questions >= 50 },
    { id: 'max-speed-61', title: '최고 속도', detail: '1초 제한이 시작되는 61번째 문제 도달', unlocked: stats.questions >= 61 },
    { id: 'survive-100', title: '100문제 생존', detail: '100문제 처리', unlocked: stats.questions >= 100 },
    { id: 'combo-10', title: '10콤보', detail: '10연속 정답', unlocked: stats.bestCombo >= 10 },
    { id: 'combo-30', title: '30콤보', detail: '30연속 정답', unlocked: stats.bestCombo >= 30 },
    { id: 'perfect-20', title: '완벽한 집중', detail: '20문제 연속 정답', unlocked: stats.questions >= 20 && stats.mistakes === 0 },
  ];
  return catalog.filter((item) => item.unlocked);
}

function persistLocalResult(stats) {
  const key = state.mode;
  const saved = state.localRecords[key] || { ...emptyRecord };
  const previous = key === 'daily' && saved.challengeDate !== state.challengeDate ? { ...emptyRecord } : saved;
  const next = { questions: stats.questions, stage: stats.stage, score: stats.score, accuracy: stats.accuracy, averageMs: stats.averageMs, bestCombo: stats.bestCombo };
  if (key === 'daily') next.challengeDate = state.challengeDate;
  state.previousRecord = { ...previous };
  state.newPersonalBest = recordIsBetter(next, previous);
  if (state.newPersonalBest) state.localRecords[key] = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.localRecords)); } catch { /* The session result is still available. */ }
  state.newAchievements = achievementsFor(stats).filter((item) => !state.unlockedAchievements.has(item.id));
  state.newAchievements.forEach((item) => state.unlockedAchievements.add(item.id));
  try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...state.unlockedAchievements])); } catch { /* Achievements are optional local data. */ }
  updateRecordDisplay();
}

function renderAchievements(items) {
  const container = $('#result-achievements');
  container.replaceChildren();
  if (!items?.length) {
    const note = document.createElement('span');
    note.className = 'achievement-empty';
    note.textContent = '이번 판에서 새로 획득한 업적이 없어';
    container.append(note);
    return;
  }
  items.forEach((item) => {
    const badge = document.createElement('span');
    badge.className = 'achievement-badge';
    badge.textContent = `✦ ${item.title}`;
    badge.title = item.detail;
    container.append(badge);
  });
}

function renderResult(stats) {
  $('#final-score').textContent = stats.score.toLocaleString('ko-KR');
  $('#result-average').innerHTML = stats.averageMs == null ? '—' : `${stats.averageMs}<small> ms</small>`;
  $('#result-fastest').innerHTML = stats.fastestMs == null ? '—' : `${stats.fastestMs}<small> ms</small>`;
  $('#result-accuracy').innerHTML = `${stats.accuracy}<small> %</small>`;
  $('#result-combo').innerHTML = `${stats.bestCombo}<small> ×</small>`;
  $('#result-questions').innerHTML = `${stats.questions}<small> Q</small>`;
  $('#result-mistakes').innerHTML = `${stats.mistakes}<small> / 3</small>`;
  $('#result-title').innerHTML = state.endReason ? '세션 종료' : state.newPersonalBest ? '새 기록 달성<span>!</span>' : '도전 완료<span>!</span>';
  $('#result-subtitle').textContent = state.endReason || (state.mode === 'daily' ? `오늘의 도전 · ${formatDate(state.challengeDate)}` : '무한 생존 기록을 확인해봐.');
  $('#result-subtitle').textContent += state.difficulty === 'hard' ? ' · 어려움' : ' · 기본';
  $('#record-badge').classList.toggle('hidden', !state.newPersonalBest);
  const previous = state.previousRecord || emptyRecord;
  $('#result-record-comparison').textContent = state.newPersonalBest
    ? `이전 기록보다 ${stats.questions - previous.questions}문제 · ${(stats.score - previous.score).toLocaleString('ko-KR')}점 높아!`
    : `개인 최고 ${previous.questions || 0}문제 · ${(previous.score || 0).toLocaleString('ko-KR')}점`;
  $('#result-rank').textContent = state.ranked ? '랭킹 검증 중…' : '로컬 플레이 · 랭킹 서버 미연결';
  renderAchievements(state.newAchievements);
  showView('result');
  playTone(state.newPersonalBest ? 1100 : 280, 0.28, 'triangle', 0.035);
}

async function endGame(reason = '') {
  if (state.phase === 'finished') return;
  clearGameTimer();
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  state.endReason = reason;
  state.phase = 'finished';
  const stats = currentStatistics();
  state.lastResult = stats;
  persistLocalResult(stats);
  renderResult(stats);
  if (!state.ranked) return;

  try {
    const response = await apiPost('submit', {
      run_id: state.runId,
      run_token: state.runToken,
      events: state.events,
    });
    state.playerId = response.player_id || state.playerId;
    const rank = response.rank;
    if (rank) {
      state.dailyRank = state.mode === 'daily' ? rank : null;
      $('#result-rank').textContent = `${state.mode === 'daily' ? '오늘' : '전체'} ${rank}위${rank <= 10 ? ' · TOP 10' : ''}`;
      if (state.mode === 'daily' && rank <= 10 && !state.unlockedAchievements.has('daily-top-10')) {
        const achievement = { id: 'daily-top-10', title: '오늘의 TOP 10', detail: '오늘의 도전 상위 10위 진입' };
        state.unlockedAchievements.add(achievement.id);
        state.newAchievements.push(achievement);
        try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...state.unlockedAchievements])); } catch { /* Optional. */ }
        renderAchievements(state.newAchievements);
      }
    } else {
      $('#result-rank').textContent = response.message || '기록 등록 완료 · TOP 100 밖';
    }
    $('#leaderboard-note').textContent = '서버에서 색상 순서, 반응 시간, 점수 공식을 검증했습니다.';
    loadLeaderboard(state.mode === 'daily' ? 'daily' : 'survival', 10);
  } catch (error) {
    $('#result-rank').textContent = `랭킹 미등록 · ${error.message || '검증 실패'}`;
  }
}

async function shareResult() {
  const stats = state.lastResult || currentStatistics();
  const url = new URL(window.location.href);
  if (state.mode === 'daily') {
    url.searchParams.set('challenge', 'daily');
    url.searchParams.set('date', state.challengeDate || getKstDate());
  } else {
    url.searchParams.delete('challenge');
    url.searchParams.delete('date');
  }
  const text = `누르지 마! ${state.mode === 'daily' ? '오늘의 도전' : '무한 생존'} ${state.difficulty === 'hard' ? ' · 어려움' : ' · 기본'} 기록\n${stats.questions}문제 처리 · ${stats.score.toLocaleString('ko-KR')}점\n평균 반응 ${stats.averageMs ?? '—'}ms · 정확도 ${stats.accuracy}%\n이 기록을 넘어봐!`;
  if (navigator.share) {
    try { await navigator.share({ title: '누르지 마! — Noltap', text, url: url.toString() }); } catch { /* User cancelled sharing. */ }
  } else if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(`${text}\n${url.toString()}`); toast('결과와 도전 링크를 복사했어'); }
    catch { toast('공유를 사용할 수 없어'); }
  } else {
    toast('이 브라우저에서는 공유 기능을 사용할 수 없어');
  }
}

function abandonRankedRun() {
  if (state.ranked && state.runId && state.runToken) {
    apiPost('abandon', { run_id: state.runId, run_token: state.runToken }, { keepalive: true }).catch(() => {});
  }
  state.ranked = false;
}

function pauseGame() {
  if (state.view !== 'game' || state.phase === 'paused' || state.phase === 'finished' || state.phase === 'idle') return;
  if (!['countdown', 'answering'].includes(state.phase)) return;
  state.previousPhase = state.phase;
  state.pausedRemaining = state.phase === 'answering' ? Math.max(0, state.questionDeadline - performance.now()) : 0;
  if (state.phase === 'countdown') state.countdownPausedAt = state.countdownCount;
  if (state.timerId) {
    window.clearTimeout(state.timerId);
    window.clearInterval(state.timerId);
  }
  state.timerId = null;
  state.deadline = 0;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  if (state.ranked) {
    abandonRankedRun();
    toast('일시정지된 판은 온라인 랭킹에 등록되지 않아.');
  }
  state.phase = 'paused';
  pauseOverlay.classList.remove('hidden');
}

function resumeGame() {
  if (state.phase !== 'paused') return;
  const phase = state.previousPhase;
  pauseOverlay.classList.add('hidden');
  state.phase = phase;
  if (phase === 'countdown') {
    startCountdown(state.countdownPausedAt || 1);
  } else if (phase === 'answering' && state.currentQuestion) {
    state.reactionStartedAt = performance.now() - (state.currentQuestion.limitMs - state.pausedRemaining);
    state.questionDeadline = performance.now() + state.pausedRemaining;
    progressFill.style.transition = 'none';
    scheduleTimer(() => resolveQuestion(null, true), state.pausedRemaining, 'question-timeout');
    const tick = () => {
      if (state.phase !== 'answering' || !state.currentQuestion) return;
      progressFill.style.width = `${Math.max(0, (state.questionDeadline - performance.now()) / state.currentQuestion.limitMs * 100)}%`;
      state.rafId = requestAnimationFrame(tick);
    };
    state.rafId = requestAnimationFrame(tick);
  } else {
    showQuestion();
  }
}

function toggleSound() {
  state.soundOn = !state.soundOn;
  try { localStorage.setItem(SOUND_KEY, state.soundOn ? 'on' : 'off'); } catch { /* Sound preference is optional. */ }
  updateSoundButtons();
  if (state.soundOn) playTone(740, 0.09);
}

function toast(message) {
  const toastEl = $('#toast');
  toastEl.textContent = message;
  toastEl.classList.add('toast-visible');
  window.setTimeout(() => toastEl.classList.remove('toast-visible'), 2200);
}

$('.start-button').addEventListener('click', openGameLobby);
$('.brand').addEventListener('click', (event) => {
  if (state.view === 'home') return;
  event.preventDefault();
  abandonRankedRun();
  clearGameTimer();
  state.phase = 'idle';
  showView('home');
});
$('.hub-back').addEventListener('click', () => showView('home'));
$('.retry-button').addEventListener('click', () => beginGame(state.mode));
$('.home-button').addEventListener('click', openGameLobby);
$('.share-button').addEventListener('click', shareResult);
$('.sound-toggle').addEventListener('click', toggleSound);
$('.sound-inline').addEventListener('click', toggleSound);
$('.save-nickname').addEventListener('click', savePlayerNickname);
$('#nickname-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') savePlayerNickname(); });
$('#start-survival').addEventListener('click', () => beginGame('survival'));
$('#start-daily').addEventListener('click', () => beginGame('daily'));
$('.leaderboard-more').addEventListener('click', () => loadLeaderboard(state.rankScope, state.rankLimit === 10 ? 100 : 10));
document.querySelectorAll('.board-tab').forEach((tab) => tab.addEventListener('click', () => loadLeaderboard(tab.dataset.scope, 10)));
$('.pause-button').addEventListener('click', pauseGame);
$('.resume-button').addEventListener('click', resumeGame);
$('.back-button').addEventListener('click', () => {
  abandonRankedRun();
  clearGameTimer();
  state.phase = 'idle';
  openGameLobby();
});
document.querySelectorAll('.color-choice').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    state.lastPointerAt = performance.now();
    handleColorInput(Number(button.dataset.color), event);
  });
  button.addEventListener('click', (event) => {
    if (event.detail > 0 && performance.now() - state.lastPointerAt < 800) return;
    handleColorInput(Number(button.dataset.color), event);
  });
});
document.querySelectorAll('.filter-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const filter = chip.dataset.filter;
    document.querySelectorAll('.filter-chip').forEach((item) => {
      item.classList.toggle('is-active', item === chip);
      item.setAttribute('aria-pressed', String(item === chip));
    });
    const cards = [...document.querySelectorAll('.game-card')];
    let visibleCount = 0;
    cards.forEach((card) => {
      const visible = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('hidden', !visible);
      if (visible) visibleCount += 1;
    });
    $('#shown-game-count').textContent = String(visibleCount).padStart(2, '0');
  });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.view === 'game' && state.phase !== 'finished' && state.phase !== 'idle') {
    abandonRankedRun();
    endGame('탭이 비활성화되어 온라인 랭킹 세션이 종료됐어.');
  }
});
window.addEventListener('pagehide', () => {
  if (state.view === 'game' && state.phase !== 'finished') {
    abandonRankedRun();
    clearGameTimer();
  }
});
window.addEventListener('keydown', (event) => {
  if (/^[1-4]$/.test(event.key) && state.view === 'game') {
    if (event.repeat) return;
    event.preventDefault();
    handleColorInput(Number(event.key) - 1, event);
  }
  if (event.key === 'Escape' && state.view === 'game' && state.phase !== 'paused') pauseGame();
});

updateRecordDisplay();
updateSoundButtons();
const sharedChallenge = new URLSearchParams(window.location.search);
if (sharedChallenge.get('challenge') === 'daily') {
  const requestedDate = sharedChallenge.get('date') || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) state.requestedChallengeDate = requestedDate;
  openGameLobby();
}

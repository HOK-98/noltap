const NICKNAME_STORAGE = 'playbox-nickname-v1';
const RANKING_DISABLED = import.meta.env.VITE_DISABLE_RANKING === 'true';

if (RANKING_DISABLED) document.documentElement.classList.add('rankings-disabled');

export function getPlayerIdentity() {
  let nickname = '플레이어';
  try {
    nickname = localStorage.getItem(NICKNAME_STORAGE) || nickname;
  } catch { /* The game can still be played without persistent storage. */ }
  return { nickname };
}

export function saveNickname(nickname) {
  const clean = nickname.trim().replace(/\s+/g, ' ').slice(0, 16) || '플레이어';
  try { localStorage.setItem(NICKNAME_STORAGE, clean); } catch { /* Ranking identity still exists for this page session. */ }
  return clean;
}

export async function apiGet(action, params = {}) {
  if (RANKING_DISABLED) throw new Error('온라인 랭킹은 GitHub Pages 미리보기에서 제외되어 있습니다.');
  const query = new URLSearchParams({ action, ...params });
  return request(`/api/index.php?${query.toString()}`, { method: 'GET' });
}

export async function apiPost(action, payload = {}, requestOptions = {}) {
  if (RANKING_DISABLED) throw new Error('온라인 랭킹은 GitHub Pages 미리보기에서 제외되어 있습니다.');
  return request(`/api/index.php?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: Boolean(requestOptions.keepalive),
  });
}

async function request(url, options) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.keepalive ? 5000 : 1800);
  let response;
  try {
    response = await fetch(url, { ...options, cache: 'no-store', signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    const error = new Error(result.message || '서버에 연결할 수 없습니다.');
    error.status = response.status;
    error.code = result.error || 'request_failed';
    throw error;
  }
  return result;
}


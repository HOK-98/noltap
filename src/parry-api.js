import { getPlayerIdentity, saveNickname } from './ranking-api.js';

const ENDPOINT = '/api/parry.php';

export function parryPlayer() {
  return getPlayerIdentity();
}

export function saveParryNickname(value) {
  return saveNickname(value);
}

export async function parryGet(action, params = {}) {
  const query = new URLSearchParams({ action, ...params });
  return parryRequest(`${ENDPOINT}?${query.toString()}`, { method: 'GET' });
}

export async function parryPost(action, payload = {}, keepalive = false) {
  return parryRequest(`${ENDPOINT}?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive,
  });
}

async function parryRequest(url, options) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.keepalive ? 6000 : 1700);
  let response;
  try {
    response = await fetch(url, {
      ...options,
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || '랭킹 서버에 연결할 수 없습니다.');
    error.status = response.status;
    error.code = data.error || 'request_failed';
    throw error;
  }
  return data;
}

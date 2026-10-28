import { GAME } from './config.js';

export function randomInt(max) {
  if (!Number.isInteger(max) || max < 1) throw new Error('Invalid random range');
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % max;
}

export class PirateGame {
  #trap;
  #pending;
  constructor(rng = randomInt, players = [
    { name: '플레이어 1', color: 0 },
    { name: '플레이어 2', color: 1 },
  ]) {
    this.rng = rng;
    this.configurePlayers(players);
  }
  configurePlayers(players) {
    if (!Array.isArray(players) || players.length < 2 || players.length > 8) throw new Error('2~8명의 플레이어가 필요합니다.');
    const normalized = players.map((player, index) => ({
      name: String(player.name || `플레이어 ${index + 1}`).trim().slice(0, 16) || `플레이어 ${index + 1}`,
      color: Number(player.color),
    }));
    if (normalized.some(player => !Number.isInteger(player.color) || player.color < 0 || player.color > 7)) throw new Error('칼 색을 확인해주세요.');
    if (new Set(normalized.map(player => player.color)).size !== normalized.length) throw new Error('플레이어마다 서로 다른 칼 색을 골라주세요.');
    this.players = normalized;
    this.restart();
    return true;
  }
  restart() {
    this.#trap = this.rng(GAME.slots); this.#pending = null; this.used = new Map();
    this.turnIndex = 0;
    this.phase = 'ready'; this.last = null;
  }
  available() { return Array.from({ length: GAME.slots }, (_, id) => id).filter(id => !this.used.has(id)); }
  beginPick(id, playerIndex, color = this.players[playerIndex]?.color) {
    if (!Number.isInteger(id) || id < 0 || id >= GAME.slots || playerIndex !== this.turnIndex || this.used.has(id)) return null;
    if (color !== this.players[playerIndex]?.color || this.phase !== 'ready') return null;
    this.phase = 'inserting'; this.used.set(id, { player: playerIndex, color }); this.#pending = { id, player: playerIndex, color };
    return { ...this.#pending };
  }
  completePick() {
    if (this.phase !== 'inserting' || !this.#pending) return null;
    const pick = this.#pending; this.#pending = null;
    const trap = pick.id === this.#trap;
    if (trap) {
      const winners = this.players.map((_, index) => index).filter(index => index !== pick.player);
      this.phase = 'game-over';
      this.last = { ...pick, trap: true, winners, loser: pick.player };
    } else {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
      this.phase = 'ready';
      this.last = { ...pick, trap: false, winners: [], loser: null };
    }
    return this.last;
  }
}

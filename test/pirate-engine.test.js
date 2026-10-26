import test from 'node:test';
import assert from 'node:assert/strict';
import { PirateGame, computerChoice } from '../src/pirate/engine.js';
import { GAME, SLOTS } from '../src/pirate/config.js';

test('16 unique anchors in two rows; each normal points outward', () => {
  assert.equal(SLOTS.length, 16); assert.equal(new Set(SLOTS.map(s => s.id)).size, 16);
  for (const s of SLOTS) { assert.ok(Math.abs(Math.hypot(...s.normal) - 1) < 1e-9); assert.ok(s.position[0] * s.normal[0] + s.position[2] * s.normal[2] > 1); }
});
test('a trap exists at exactly one of the 16 possible positions', () => {
  for (let trap = 0; trap < 16; trap++) {
    const game = new PirateGame(() => trap);
    for (const id of [...game.available().filter(id => id !== trap), trap]) {
      assert.ok(game.beginPick(id, game.turn, 0)); const result = game.completePick(); assert.equal(result.trap, id === trap);
    }
    assert.equal(game.used.size, 16); assert.equal(game.phase, 'round-over'); assert.equal(game.wins + game.losses, 1);
  }
});
test('duplicate, wrong turn, invalid and rapid repeated input are blocked', () => {
  const game = new PirateGame(() => 15);
  assert.equal(game.beginPick(-1, 'player', 0), null); assert.equal(game.beginPick(1.5, 'player', 0), null); assert.equal(game.beginPick(16, 'player', 0), null);
  assert.equal(game.beginPick(0, 'cpu', 0), null); assert.ok(game.beginPick(0, 'player', 0));
  assert.equal(game.beginPick(1, 'player', 0), null); assert.equal(game.completePick().trap, false); assert.equal(game.completePick(), null);
  assert.equal(game.beginPick(0, 'cpu', 0), null); assert.equal(game.score.player, 20);
});
test('the inserting side loses and the opposite side gets the round bonus', () => {
  const game = new PirateGame(() => 1); game.beginPick(0, 'player', 2); game.completePick(); game.beginPick(1, 'cpu', 3);
  const result = game.completePick(); assert.equal(result.winner, 'player'); assert.equal(game.score.player, 120); assert.equal(game.wins, 1); assert.equal(game.losses, 0);
});
test('AI selects from available slots only, without receiving a trap', () => {
  let received; const available = [2, 7, 15];
  assert.equal(computerChoice(available, max => { received = max; return 2; }), 15); assert.equal(received, 3);
  assert.equal(computerChoice([], () => { throw new Error('Must not run'); }), null);
});
test('round restart resets slots, changes trap, alternates starter; match ends at round 10', () => {
  let n = 0; const game = new PirateGame(() => (n++) % 16);
  for (let round = 1; round <= 10; round++) {
    const starter = round % 2 ? 'player' : 'cpu'; assert.equal(game.turn, starter); assert.equal(game.used.size, 0);
    game.beginPick(round - 1, starter, 0); assert.equal(game.completePick().trap, true);
    assert.equal(game.nextRound(), round < 10);
  }
  assert.equal(game.round, 10); assert.equal(game.phase, 'match-over'); assert.equal(game.wins, 5); assert.equal(game.losses, 5); assert.equal(game.matchWinner(), 'draw');
  assert.equal(game.beginPick(12, game.turn, 0), null); game.restart(); assert.equal(game.round, 1); assert.equal(game.score.player, 0); assert.equal(game.score.cpu, 0);
});
test('final winner uses total points instead of round wins', () => {
  const game = new PirateGame(() => 0); game.score.player = 500; game.score.cpu = 480; game.wins = 4; game.losses = 6; assert.equal(game.matchWinner(), 'player');
  game.score.cpu = 520; assert.equal(game.matchWinner(), 'cpu'); assert.equal(GAME.rounds, 10);
});

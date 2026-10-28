import test from 'node:test';
import assert from 'node:assert/strict';
import { PirateGame } from '../src/pirate/engine.js';
const roster = Array.from({length:8},(_,i)=>({name:`P${i+1}`,color:i}));
test('each possible trap ends exactly one scoreless game and blocks further picks',()=>{
  for(let trap=0;trap<16;trap++){
    const game=new PirateGame(()=>trap,roster);
    for(const id of [...game.available().filter(id=>id!==trap),trap]){
      const player=game.turnIndex;
      assert.ok(game.beginPick(id,player));
      const result=game.completePick();
      assert.equal(result.trap,id===trap);
      assert.equal(game.used.get(id).color,roster[player].color);
      if(result.trap){assert.equal(result.loser,player);assert.equal(result.winners.length,7);}
    }
    assert.equal(game.phase,'game-over'); assert.equal(game.score,undefined);
    assert.equal(game.beginPick(0,game.turnIndex),null);
  }
});
test('turn, color, duplicate and repeated input guards remain active',()=>{
  const game=new PirateGame(()=>15,roster);
  assert.equal(game.beginPick(0,1),null);assert.equal(game.beginPick(0,0,1),null);
  assert.ok(game.beginPick(0,0));assert.equal(game.beginPick(1,0),null);
  game.completePick();assert.equal(game.completePick(),null);
  assert.equal(game.turnIndex,1);assert.equal(game.beginPick(0,1),null);
  assert.ok(game.beginPick(1,1));game.completePick();
  assert.equal(game.used.get(0).color,0);assert.equal(game.used.get(1).color,1);
});
test('one more game resets trap and used slots while preserving the roster',()=>{
  let trap=0;const game=new PirateGame(()=>trap,roster);
  game.beginPick(0,0);game.completePick();trap=1;game.restart();
  assert.equal(game.used.size,0);assert.equal(game.phase,'ready');assert.deepEqual(game.players,roster);
  game.beginPick(0,0);assert.equal(game.completePick().trap,false);
  game.beginPick(1,1);assert.equal(game.completePick().trap,true);
});

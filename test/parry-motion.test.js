import test from 'node:test';
import assert from 'node:assert/strict';
import {attackMotion,swordTrajectory} from '../src/parry-motion.js';
import {createAttackPlan} from '../src/parry-engine.js';

test('bosses 1 to 5 never generate feints; boss 6 and endless bosses may feint',()=>{
  for(const boss of [1,2,3,4,5,6,7,10,20,50,100,1000]){
    let feints=0;
    for(let seed=1;seed<=120;seed++)for(let index=0;index<8;index++){
      const plan=createAttackPlan(Math.imul(seed,0x9e3779b1)>>>0,boss,index);
      if(boss<=5){assert.notEqual(plan.type,'feint');assert.ok(plan.hits.every(hit=>hit.fakeDirection===null));}
      if(plan.type==='feint'){
        feints++;assert.ok(boss>=6);assert.ok(plan.warningMs>=850);
        assert.notEqual(plan.hits[0].fakeDirection,plan.hits[0].direction);
        assert.ok(plan.hits.slice(1).every(hit=>hit.fakeDirection===null));
        const hit={...plan.hits[0],plan,swingAtMs:plan.warningMs-180};
        assert.equal(attackMotion(hit,plan.revealAfterMs+140).stage,'ready');
        assert.equal(attackMotion(hit,hit.swingAtMs-160).stage,'ready');
      }
    }
    if(boss>=6)assert.ok(feints>0);
  }
});

test('follow-up cuts arrive in a bounded fast cadence with enough visible preparation',()=>{
  let combos=0;
  for(let boss=2;boss<=60;boss++)for(let seed=1;seed<=30;seed++){
    const plan=createAttackPlan(Math.imul(seed,0x9e3779b1)>>>0,boss,0);
    assert.equal(plan.hits[0].warningMs,plan.warningMs);
    for(const hit of plan.hits.slice(1)){
      combos++;assert.ok(hit.warningMs>=360&&hit.warningMs<=440);
      const cadence=plan.intervalMs+hit.warningMs;
      assert.ok(cadence>=450&&cadence<=610);
      assert.ok(hit.warningMs<plan.warningMs);
    }
  }
  assert.ok(combos>1000);
});

test('real attacks never change direction and each cut meets at the impact clock',()=>{
  const poses={};
  for(const direction of ['left','right','up','down']){
    const active={direction,swingAtMs:585,fakeDirection:null};
    for(let age=0;age<=765;age+=5)assert.equal(attackMotion(active,age).direction,direction);
    poses[direction]=swordTrajectory(attackMotion(active,675)).tip;
    const impact=swordTrajectory(attackMotion(active,765));
    assert.deepEqual(impact.tip,[0,1.5,2.45]);
    const follow=swordTrajectory(attackMotion(active,765),1e-5);
    assert.ok(Math.hypot(...follow.tip.map((value,i)=>value-impact.tip[i]))<1e-6);
  }
  assert.ok(poses.left[0]<0&&poses.right[0]>0);
  assert.ok(poses.up[1]>poses.down[1]+.5);
});

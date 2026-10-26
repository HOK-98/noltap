import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPixelRatio,createFrameBudget} from '../src/parry-performance.js';

test('high density displays stay within the render pixel budget', () => {
  for (const [width,height,dpr,mobile] of [[1920,1080,2,false],[390,844,3,true],[1280,720,1,false],[2560,1440,2,false]]) {
    const ratio = initialPixelRatio(width,height,dpr,mobile);
    assert.ok(width*height*ratio*ratio <= 1600001);
    assert.ok(ratio <= dpr);
    assert.ok(ratio <= (mobile ? 1.15 : 1.35));
  }
});

test('sustained slow frames lower resolution, stable fast frames recover slowly, pause gaps are ignored', () => {
  const budget = createFrameBudget(1.35);
  let now = 1, ratio = 1.35;
  for (let i=0;i<400;i++) { now+=30; ratio=budget.sample(now) ?? ratio; }
  assert.equal(ratio,.7);
  for (let i=0;i<180;i++) { now+=16; ratio=budget.sample(now) ?? ratio; }
  assert.equal(ratio,.7, 'brief improvements must not cause quality oscillation');
  for (let i=0;i<500;i++) { now+=16; ratio=budget.sample(now) ?? ratio; }
  assert.ok(ratio>.7 && ratio<=.8);
  budget.reset(); now+=60000;
  assert.equal(budget.sample(now),null);
  for(let i=0;i<60;i++) { now+=16; assert.equal(budget.sample(now),null); }
});

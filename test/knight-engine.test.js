import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {neighbors,moves,status,solve,stars,validate,dailyStage} from '../src/knight/engine.js';const stages=JSON.parse(fs.readFileSync(new URL('../src/knight/data/stages.json',import.meta.url)));
test('30 complete valid paths, blocked cells excluded and goals last',()=>{assert.equal(stages.length,30);for(const s of stages){assert.ok(validate(s));const p=[s.start];assert.equal(p.length,1);for(const id of s.solution.slice(1)){assert.ok(moves(s,p).includes(id));assert.ok(!moves(s,p).includes(p[0]));p.push(id);}assert.equal(status(s,p),'clear');}});
test('knight L geometry and dead end',()=>{for(const s of stages)for(const a of neighbors(s.start,s.size)){const dx=Math.abs(a%s.size-s.start%s.size),dy=Math.abs(Math.floor(a/s.size)-Math.floor(s.start/s.size));assert.equal(dx*dy,2);}const s={size:3,start:0,blocked:[],goal:null};assert.equal(status(s,[0,5,6,1,8,3,2,7]),'failed');});
test('hint gives a proven completion, no false impossible on exhausted budget',()=>{const s=stages[0],r=solve(s,[s.start]);assert.equal(r.state,'solved');assert.deepEqual(r.path,s.solution.slice(1));const other=moves(s,[s.start]).find(n=>n!==s.solution[1]);assert.equal(solve(s,[s.start,other],{maxNodes:0}).state,'timeout');});
test('star thresholds and deterministic daily with valid solution',()=>{assert.equal(stars(0,0),3);assert.equal(stars(1,2),2);assert.equal(stars(2,0),1);assert.equal(stars(0,3),1);for(let d=1;d<=28;d++){const day=`2026-10-${String(d).padStart(2,'0')}`;assert.deepEqual(dailyStage(stages,day),dailyStage(stages,day));assert.ok(validate(dailyStage(stages,day)));}});
import {migrateProgress,unlockedStage} from '../src/knight/progress.js';
test('each stage adds cells, expands boards without shrinking, and adds goal after tutorial',()=>{
 assert.deepEqual(stages.slice(0,3).map(s=>s.solution.length),[9,12,15]);
 for(let i=0;i<stages.length;i++){
  const s=stages[i],active=new Set(s.solution);
  assert.equal(s.goal==null,i<3);
  const edges=s.solution.reduce((n,id)=>n+neighbors(id,s.size).filter(x=>active.has(x)).length,0)/2;
  assert.equal(s.branchCycles,edges-s.solution.length+1);
  if(i){assert.ok(s.solution.length>stages[i-1].solution.length);assert.ok(s.size>=stages[i-1].size);assert.ok(s.branchCycles>=stages[i-1].branchCycles);}
 }
 assert.equal(stages.at(-1).solution.length,64);
});
test('old map records are archived once, with sound and stage access retained',()=>{
 const old={records:{'normal-1':{stars:3},'normal-2':{stars:2},'normal-3':{stars:3}},daily:{'2026-10-28':{stars:3}},sound:true};
 const data=migrateProgress(old);assert.equal(unlockedStage(data),4);assert.deepEqual(data.records,{});assert.deepEqual(data.daily,{});assert.deepEqual(data.archivedV1.records,old.records);assert.equal(data.sound,true);assert.deepEqual(migrateProgress(data),data);
 data.records['normal-4']={stars:3};data.unlockedStage=5;assert.equal(unlockedStage(migrateProgress(data)),5);assert.equal(unlockedStage(migrateProgress(null)),1);
});

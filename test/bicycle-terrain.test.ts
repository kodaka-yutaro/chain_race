import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCourseMap} from '../shared/courses';
import {createWorld,newRunner,stepWorld,emptyInput} from '../shared/physics';

function setup(){
 const m=newCourseMap(40,30);m.tiles=Array.from({length:30},()=>'.'.repeat(40));
 const w=createWorld(m),r=newRunner(1,m);r.ability='bicycle';w.runners=[r];return {m,w,r};
}
test('bicycle stopper collision includes top and bottom corners on both layers',()=>{
 for(const layer of ['game','front'] as const)for(const type of [60,240])for(const y of [330,285]){
  const {m,w,r}=setup();m.dd![layer]=[[10*m.width+10,type,11]];
  r.x=275;r.y=y;r.vx=20;r.vy=-.5;
  stepWorld(w,new Map([[1,{...emptyInput(),right:true}]]));
  assert.ok(r.x+42<=320.01,`${layer}/${type}/${y}: leading edge ${r.x+42}`);
 }
});
test('bicycle can cross one-way tiles in their permitted direction',()=>{
 for(const type of [60,240]){
  const {m,w,r}=setup();m.dd!.game=[[10*m.width+10,type,11]];
  r.x=400;r.y=330;r.vx=-50;r.vy=-.5;
  stepWorld(w,new Map([[1,{...emptyInput(),left:true}]]));assert.ok(r.x<365);
 }
});
test('frozen bicycle falls through a freeze volume instead of resting on its internal rows',()=>{
 for(const type of ['legacy',9,12,144] as const){
  const {m,w,r}=setup();const rows=m.tiles.map(s=>[...s]);
  for(let y=5;y<20;y++)for(let x=4;x<16;x++){
   if(type==='legacy')rows[y][x]='~';else m.dd!.game.push([y*m.width+x,type,0]);
  }
  rows[24].fill('#');m.tiles=rows.map(s=>s.join(''));
  r.x=300;r.y=7*32-42;const start=r.y;
  for(let i=0;i<2;i++)stepWorld(w,new Map());
  assert.ok(r.stun>0,`${type}: did not freeze`);
  for(let i=0;i<28;i++)stepWorld(w,new Map([[1,{...emptyInput(),right:true,jump:true}]]));
  assert.ok(r.y>start+100,`${type}: frozen bicycle stayed at ${r.y}`);assert.ok(r.stun>0);assert.equal(r.x,300);
  for(let i=0;i<90;i++)stepWorld(w,new Map());
  assert.ok(Math.abs(r.y-(24*32-42))<1,`${type}: must land on solid ground`);
  assert.equal(r.ability,'bicycle');
 }
});
test('high-speed bicycle stops outside every blocked edge and can retreat',()=>{
 for(const layer of ['game','front'] as const)for(const type of [60,240])for(const [flags,x,y,vx,vy] of [
  [11,250,330,120,0],[8,420,330,-120,0],[0,330,240,0,120],[3,330,400,0,-120],
 ]){
  const {m,w,r}=setup();m.dd![layer]=[[10*m.width+10,type,flags]];
  Object.assign(r,{x,y,vx,vy:vy-.5});stepWorld(w,new Map());
  assert.ok(flags===11?r.x+42<=320.01:flags===8?r.x-42>=351.99:flags===0?r.y+42<=320.01:r.y-14>=351.99,`${layer}/${type}/${flags}: ${r.x},${r.y}`);
  const bx=r.x,by=r.y;r.vx=-vx;r.vy=-vy-.5;stepWorld(w,new Map());
  assert.ok(Math.hypot(r.x-bx,r.y-by)>10,'must be able to retreat');
 }
});

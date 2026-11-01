import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCourseMap} from '../shared/courses';
import {createWorld,newRunner,stepWorld,emptyInput,PHYS,WIRE_ATTACHED} from '../shared/physics';

function setup(){
 const m=newCourseMap(120,40);m.tiles=Array.from({length:40},()=>'.'.repeat(120));
 const w=createWorld(m),r=newRunner(1,m);r.x=300;r.y=300;r.ability='hook';r.wireState=WIRE_ATTACHED;r.prevWire=true;w.runners=[r];
 return {w,r};
}
for(const kind of ['ball','mini','terrain','player'] as const)test(`attached ${kind} hook stays connected beyond launch range`,()=>{
 const {w,r}=setup();r.wireX=1200;r.wireY=300;
 if(kind==='ball'){w.balls=[{id:1,x:1200,y:300,vx:20,vy:0,homeX:1200,homeY:300}];r.wireBall=1;}
 if(kind==='mini'){
  const owner=newRunner(2,w.map);owner.ability='bun';owner.x=1800;owner.y=300;w.runners.push(owner);
  w.words=[{id:1,owner:2,kind:'mini',x:1184,y:284,vx:20,vy:0,born:0,expires:-1,solid:true,mouthX:0,mouthY:0}];r.wireWord=1;r.wireLocalX=r.wireLocalY=16;
 }
 if(kind==='player'){const other=newRunner(2,w.map);other.x=1200;other.y=300;w.runners.push(other);r.wireRunner=2;}
 for(let i=0;i<8;i++){
  stepWorld(w,new Map([[1,{...emptyInput(),fire:true}]]));
  assert.equal(r.wireState,WIRE_ATTACHED);assert.ok(Math.hypot(r.x-r.wireX,r.y-r.wireY)>PHYS.hookLength+32);
 }
 stepWorld(w,new Map());assert.equal(r.wireState,0,'releasing input still detaches');
});
test('player hook still expires, while endless hook keeps it attached',()=>{
 for(const endless of [false,true]){
  const {w,r}=setup(),other=newRunner(2,w.map);other.x=1200;other.y=300;w.runners.push(other);
  r.wireRunner=2;r.wireTick=PHYS.hookPlayerTicks;r.dd!.endlessHook=endless;
  stepWorld(w,new Map([[1,{...emptyInput(),fire:true}]]));assert.equal(r.wireState,endless?WIRE_ATTACHED:0);
 }
});
test('unattached hook still retracts at launch range',()=>{
 const {w,r}=setup();r.wireState=0;r.prevWire=false;
 for(let i=0;i<10;i++)stepWorld(w,new Map([[1,{...emptyInput(),fire:true,aimX:1,aimY:0}]]));
 assert.equal(r.wireState,0);
});
test('removed and collected anchors still release their hooks',()=>{
 for(const kind of ['missing-ball','collected-ball','missing-mini']){
  const {w,r}=setup();
  if(kind==='missing-mini')r.wireWord=1;
  else {r.wireBall=1;if(kind==='collected-ball')w.balls=[{id:1,x:1200,y:300,vx:0,vy:0,homeX:1200,homeY:300,carriedBy:2}];}
  stepWorld(w,new Map([[1,{...emptyInput(),fire:true}]]));assert.equal(r.wireState,0);
 }
});

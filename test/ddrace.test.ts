import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, emptyInput, newRunner, stepWorld, type MapDef } from '../shared/physics';
import { ddCache, ddTiles, ddFire, ddSwitchActive } from '../shared/ddrace';
import { toView } from '../shared/protocol';
import { stageById } from '../shared/legacy-maps';

function setup() {
  const tiles=Array.from({length:20},(_,y)=>y===19?'#'.repeat(30):'.'.repeat(30));
  const m:MapDef={id:'dd-test',name:'test',description:'',minPlayers:2,width:30,height:20,tiles,hints:[],dd:{game:[],front:[],tele:[],speed:[],switches:[],doors:[]}};
  return m;
}
function runner(m:MapDef,x=4,y=5) {
  const w=createWorld(m),t=newRunner(1,m); t.x=x*32+16;t.y=y*32+16;w.runners.push(t);return {w,t};
}
test('official Kobra import retains full geometry, teleport pairs and door channels',()=>{
  const m=stageById('dd-kobra')!;
  assert.equal(m.width,900);assert.equal(m.height,897);assert.equal(m.tiles.length,897);
  assert.ok(m.tiles.every(row=>row.length===900));
  assert.equal(m.dd!.tele.filter(t=>t[1]===10).length,5011);
  const c=ddCache(m);
  for(const [,type,n] of m.dd!.tele)if(type===10||type===15)assert.ok(c.exits.get(n)?.length,`missing exit ${n}`);
  assert.equal(m.dd!.doors.length,32);
});
test('evil teleport moves to its numbered exit, clears velocity/hooks and retains race progress',()=>{
  const m=setup();m.dd!.tele=[[5*30+4,10,7],[12*30+20,27,7]];
  const {w,t}=runner(m);t.vx=10;t.vy=12;t.wireState=2;t.raceStart=23;t.stun=42;
  const o=newRunner(2,m);o.wireState=2;o.wireRunner=1;w.runners.push(o);
  ddTiles(w,t);
  assert.equal(t.x,20*32+16);assert.equal(t.y,12*32+16);assert.equal(t.vx,0);assert.equal(t.vy,0);
  assert.equal(t.wireState,0);assert.equal(o.wireState,0);assert.equal(t.raceStart,23);assert.equal(t.stun,42);
});
test('all-direction stoppers block a runner while allowing a hook to pass',()=>{
  const m=setup();m.dd!.game=[[5*30+5,62,0]];
  m.tiles[6]='#'.repeat(30);
  m.tiles[5]=m.tiles[5].slice(0,8)+'#'+m.tiles[5].slice(9);
  const {w,t}=runner(m);t.x=5*32-20;
  for(let i=0;i<10;i++)stepWorld(w,new Map([[1,{...emptyInput(),right:true,wire:true}]]));
  assert.ok(t.x<=146);assert.equal(t.wireState,2);assert.ok(t.wireX>240);
});
test('switch close disables the original numbered door and timed open restores it',()=>{
  const m=setup();m.dd!.doors=[[176,112,0,1,96,2]];m.dd!.switches=[[5*30+4,25,2,0,0],[5*30+6,22,2,0,1]];
  const {w,t}=runner(m);assert.equal(ddSwitchActive(w,2),true);ddTiles(w,t);assert.equal(ddSwitchActive(w,2),false);
  t.x=6*32+16;ddTiles(w,t);assert.equal(ddSwitchActive(w,2),true);
  t.x=20*32+16;
  for(let i=0;i<52;i++)stepWorld(w,new Map());
  assert.equal(ddSwitchActive(w,2),false);
});
test('hook teleports continue from the exit and attach beyond it',()=>{
  const m=setup();m.dd!.tele=[[5*30+5,15,1],[5*30+20,27,1]];
  m.tiles[5]=m.tiles[5].slice(0,24)+'#'+m.tiles[5].slice(25);m.tiles[6]='#'.repeat(30);
  const {w,t}=runner(m);
  for(let i=0;i<5;i++)stepWorld(w,new Map([[1,{...emptyInput(),wire:true}]]));
  assert.equal(t.dd!.hookTeleported,true);assert.equal(t.wireState,2);assert.ok(t.wireX>740);
});
test('solo tiles disable player collision, hooks and hammer interaction',()=>{
  const m=setup();m.dd!.front=[[5*30+4,21,0]];const {w,t}=runner(m);
  const o=newRunner(2,m);o.x=t.x+20;o.y=t.y;o.stun=100;w.runners.push(o);
  stepWorld(w,new Map([[1,{...emptyInput(),wire:true,fire:true}]]));
  assert.equal(t.dd!.solo,true);assert.equal(t.wireRunner,-1);assert.equal(o.stun,99);assert.equal(o.vx,0);
  assert.equal(toView(t).dd!.solo,true);
});
test('weapon pickups unlock selection; laser unfreezes partner and shotgun pulls partner',()=>{
  const m=setup();m.dd!.game=[[5*30+4,202,0]];const {w,t}=runner(m);
  const o=newRunner(2,m);o.x=t.x+100;o.y=t.y;o.stun=90;w.runners.push(o);ddTiles(w,t);
  assert.equal(t.dd!.weapon,4);ddFire(w,t,{...emptyInput(),fire:true});assert.equal(o.stun,0);
  t.dd!.cooldown=0;t.dd!.weapon=2;t.dd!.weapons|=1<<2;o.stun=30;
  ddFire(w,t,{...emptyInput(),fire:true});assert.ok(o.vx<0);assert.equal(o.stun,30);
});
test('grenade explosion can propel its owner',()=>{
  const m=setup();const {w,t}=runner(m,8,17);t.dd!.weapon=3;t.dd!.weapons|=1<<3;t.aimX=0;t.aimY=1;
  stepWorld(w,new Map([[1,{...emptyInput(),fire:true,aimX:0,aimY:1}]]));
  let upward=false;
  for(let i=0;i<15;i++){stepWorld(w,new Map());if(t.vy<0)upward=true;}
  assert.ok(upward);
});
test('jump count and jetpack tiles affect only the runner touching them',()=>{
  const m=setup();m.dd!.switches=[[5*30+4,7,0,0,3]];m.dd!.front=[[5*30+4,106,0]];const {w,t}=runner(m);
  stepWorld(w,new Map());assert.equal(t.dd!.jumps,3);assert.equal(t.dd!.jetpack,true);
  t.dd!.weapon=1;t.aimX=0;t.aimY=1;const vy=t.vy;
  ddFire(w,t,{...emptyInput(),fire:true});assert.ok(t.vy<vy);
  t.dd!.jetpack=false;
  for(let i=0;i<3;i++){
    t.vy=0;stepWorld(w,new Map([[1,{...emptyInput(),jump:true}]]));
    assert.equal(t.vy<0,i<2);stepWorld(w,new Map());
  }
});

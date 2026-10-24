import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, newRunner, emptyInput, stepWorld, WIRE_ATTACHED, WIRE_IDLE, type Input, type World } from '../shared/physics';
import { wordBoxHit, type WordBlock } from '../shared/word-blocks';

function arena(wall?:number,backWall?:number) {
  const width=48,height=34;
  const tiles:string[][]=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>
    y===0||y>=30||x===0||x===width-1||x===wall||x===backWall?'X':'.'));
  tiles[29][9]='S';
  const w=createWorld({id:'mini-arena',name:'mini',description:'',width,height,tiles:tiles.map(r=>r.join('')),minPlayers:1,hints:[],wordBlocks:true});
  const r=newRunner(1,w.map);w.runners.push(r);r.x=300;r.y=946;
  return {w,r};
}
function tick(w:World,n:number,input:Partial<Input>={}) {
  for(let i=0;i<n;i++)stepWorld(w,new Map([[1,{...emptyInput(),...input}]]));
}
function mini(w:World,x:number,y=928):WordBlock {
  const b:WordBlock={id:++w.wordSeq,owner:1,kind:'mini',x,y,vx:0,vy:0,born:0,expires:-1,solid:true,mouthX:x,mouthY:y};
  w.words.push(b);return b;
}
function separate(w:World) {
  for(const b of w.words){
    for(const r of w.runners)assert.ok(!wordBoxHit(b,r.x-13.99,r.y-13.99,27.98,27.98),`runner overlaps box ${b.id}`);
    for(const o of w.words)if(b!==o)assert.ok(!wordBoxHit(b,o.x,o.y,32,32),`boxes ${b.id}, ${o.id} overlap`);
  }
}

test('歩いて複数のミニを押せて、壁に達した箱とプレイヤーは壁の手前で止まる',()=>{
  const {w,r}=arena(20);const a=mini(w,330),b=mini(w,362);
  tick(w,15,{right:true});assert.ok(a.x>400);assert.ok(b.x>=a.x+31.99);separate(w);
  tick(w,70,{right:true});assert.ok(b.x+32<=640.001);assert.ok(r.x+13.99<=a.x+.01);separate(w);
});

test('狭い前方へ吐くと既存のミニの列を押し出し、新しい箱を作れる',()=>{
  const {w,r}=arena();const a=mini(w,330),b=mini(w,362),c=mini(w,394);
  tick(w,1,{miniSpit:true});assert.equal(w.words.length,4);
  assert.ok(a.x>=362);assert.ok(b.x>=394);assert.ok(c.x>=426);assert.equal(r.x,300);separate(w);
});

test('前が固定壁なら自分が押し戻され、後ろにも壁があれば箱を埋め込まずに失敗する',()=>{
  const open=arena(11);open.r.x=318;
  tick(open.w,1,{miniSpit:true});assert.equal(open.w.words.length,1);assert.ok(open.r.x<294);
  assert.ok(open.w.words[0].x+32<=352.001);separate(open.w);
  const tight=arena(11,8);tight.r.x=318;
  tick(tight.w,1,{miniSpit:true});assert.equal(tight.w.words.length,0);assert.equal(tight.r.x,318);
  assert.ok(tight.r.spit.blockedUntil>tight.w.tick);
});

test('押し出しに失敗したときは途中まで動かした箱や乗っていた仲間も元に戻す',()=>{
  const {w,r}=arena(14,8);r.x=306;const a=mini(w,336),b=mini(w,368),c=mini(w,400);
  const rider=newRunner(2,w.map);rider.x=384;rider.y=914;w.runners.push(rider);
  const xs=w.words.map(b=>b.x);
  tick(w,1,{miniSpit:true});assert.equal(w.words.length,3);assert.deepEqual(w.words.map(b=>b.x),xs);
  assert.equal(rider.x,384);assert.equal(r.x,306);separate(w);
});

test('ハンマーは狙ったミニを打ち飛ばし、長押しで連打せず、壁をすり抜けない',()=>{
  const {w,r}=arena(14);const b=mini(w,330);
  tick(w,1,{fire:true});assert.ok(b.vx>15);assert.ok(b.vy<0);assert.equal(b.hitTick,w.tick);
  const hit=b.hitTick;tick(w,30,{fire:true});assert.equal(b.hitTick,hit);assert.ok(b.x+32<=448.001);separate(w);
  assert.ok(Math.abs(r.y-946)<1,'鎖なしで叩いても自分だけ飛ばない');
});

test('頭上へ吐いたミニを鎖でつかんで叩くと、箱と自分が上へ飛ぶ',()=>{
  const {w,r}=arena();const start=r.y;
  tick(w,1,{miniSpit:true,wire:true,fire:true,aimX:0,aimY:-1});
  assert.equal(r.wireState,WIRE_ATTACHED);assert.equal(r.wireWord,w.words[0].id);assert.ok(w.words[0].vy< -18);
  tick(w,12,{wire:true,aimX:0,aimY:-1});
  assert.ok(r.y<start-100,`runner y=${r.y}`);assert.ok(w.words[0].y<start-170);separate(w);
  tick(w,1);assert.equal(r.wireState,WIRE_IDLE);
});

test('吐く・つかむ・叩くを別々に操作しても、頭の上に戻ったミニで打ち上がれる',()=>{
  const {w,r}=arena();const start=r.y;
  tick(w,1,{miniSpit:true,aimX:0,aimY:-1});tick(w,35);
  tick(w,2,{wire:true,aimX:0,aimY:-1});assert.equal(r.wireState,WIRE_ATTACHED);
  tick(w,1,{wire:true,fire:true,aimX:0,aimY:-1});tick(w,12,{wire:true,aimX:0,aimY:-1});
  assert.ok(r.y<start-100,`runner y=${r.y}`);separate(w);
});

test('頭上の箱を打ち上げても天井へ埋まらず、鎖を離すと箱だけが飛ぶ',()=>{
  const {w,r}=arena();r.y=110;
  tick(w,1,{miniSpit:true,wire:true,fire:true,aimX:0,aimY:-1});tick(w,20,{wire:true,aimX:0,aimY:-1});
  assert.ok(r.y>=45.99);assert.ok(w.words[0].y>=31.999);separate(w);
  const free=arena(),y=free.r.y;
  tick(free.w,1,{miniSpit:true,wire:true,fire:true,aimX:0,aimY:-1});tick(free.w,12);
  assert.equal(free.r.wireState,WIRE_IDLE);assert.ok(Math.abs(free.r.y-y)<1);assert.ok(free.w.words[0].y<y-170);
});

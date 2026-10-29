import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, newRunner, emptyInput, stepWorld, isSolid, WIRE_ATTACHED, WIRE_IDLE, type World, type Input } from '../shared/physics';
import { mapById } from '../shared/maps';
import { newCourseMap, validateCourseMap } from '../shared/courses';
import { WORD_CELL, WORD_CHARGE, WORD_FORM, WORD_COOLDOWN, MINI_SIZE, MINI_LIMIT, wordBoxHit, type WordBlock } from '../shared/word-blocks';
import { HostHub, type Link } from '../client/host/hub';
import type { ServerMsg } from '../shared/protocol';

function setup() {
  const w=createWorld(mapById('word-practice')!);
  const r=newRunner(1,w.map);w.runners.push(r);
  tick(w,30);return {w,r};
}
function tick(w:World,n:number,input:Partial<Input>={}) {
  for(let i=0;i<n;i++)stepWorld(w,new Map([[1,{...emptyInput(),...input}]]));
}
const block=(owner=1):WordBlock=>({id:1,owner,x:300,y:400,vx:1.15,vy:0,born:0,expires:10000,solid:true,mouthX:250,mouthY:400});

test('自転車は車輪で大中華に乗り、車体ごと運ばれ、めり込まない',()=>{
  const w=createWorld(newCourseMap(40,30)),r=newRunner(1,w.map),b=block();
  w.runners.push(r);w.words=[b];r.ability='bicycle';r.x=b.x+60;r.y=b.y-40;r.vx=r.vy=0;
  const x=r.x;tick(w,40);
  assert.ok(r.x>x+40);assert.ok(Math.abs(r.y+40-b.y)<1);
  assert.equal(wordBoxHit(b,r.x-29.99,r.y-13.99,59.98,53.98),false);
});

test('上昇する大中華は天井との間の自転車を潰さず止まる',()=>{
  const m=newCourseMap(40,30);m.tiles[10]='#'.repeat(40);
  const w=createWorld(m),r=newRunner(1,m),b={...block(),y:430,vx:0,vy:-1};
  w.runners.push(r);w.words=[b];r.ability='bicycle';r.x=b.x+60;r.y=b.y-40;r.vx=r.vy=0;
  tick(w,80);assert.ok(r.y-14>=352);assert.ok(b.y>=406);assert.equal(b.vy,-1);
  assert.equal(wordBoxHit(b,r.x-29.99,r.y-13.99,59.98,53.98),false);
});

test('文字の線にだけ当たり判定があり、中の穴と文字間は空洞',()=>{
  const {w}=setup(),b=block();w.words=[b];
  assert.ok(isSolid(w,b.x+WORD_CELL*.5,b.y+WORD_CELL*5));
  assert.equal(isSolid(w,b.x+WORD_CELL*3,b.y+WORD_CELL*6.5),false);
  assert.equal(wordBoxHit(b,b.x+WORD_CELL*3,b.y+WORD_CELL*6.25,WORD_CELL*2,WORD_CELL*2),false);
  assert.equal(wordBoxHit(b,b.x+WORD_CELL*16.25,b.y+10,WORD_CELL*2.5,100),false);
  assert.ok(wordBoxHit(b,b.x+WORD_CELL*7,b.y,WORD_CELL*2,20));
});

test('大中華は溜めて実体化し、長押しで連射せず時間では消えない',()=>{
  const {w,r}=setup();
  tick(w,1,{spit:true});assert.equal(r.spit.charge,WORD_CHARGE);assert.equal(w.words.length,0);
  tick(w,WORD_CHARGE,{spit:true});assert.equal(w.words.length,1);assert.equal(w.words[0].solid,false);
  tick(w,WORD_FORM,{spit:true});assert.equal(w.words[0].solid,true);
  tick(w,WORD_COOLDOWN,{spit:true});assert.equal(w.words.length,1);
  tick(w,1800,{spit:true});assert.equal(w.words.length,1);
  tick(w,1,{clearWord:true});assert.equal(w.words.length,0);
  w.map={...w.map,wordBlocks:false};tick(w,1);tick(w,WORD_CHARGE+2,{spit:true});assert.equal(w.words.length,0);
});

test('大中華は一人1個まで、消した後に再発生でき、壁に埋まらない',()=>{
  const {w,r}=setup();
  tick(w,WORD_CHARGE+WORD_FORM+1,{spit:true});tick(w,1);tick(w,1,{spit:true});assert.equal(w.words.length,1);
  // Cooldown finishes; the first word has travelled out of the next spawn area.
  tick(w,WORD_COOLDOWN);tick(w,WORD_CHARGE+WORD_FORM+1,{spit:true});assert.equal(w.words.length,1);
  tick(w,1,{clearWord:true});assert.equal(w.words.length,0);
  tick(w,WORD_COOLDOWN);tick(w,WORD_CHARGE+WORD_FORM+1,{spit:true});assert.equal(w.words.length,1);
  w.words=[];r.spit.cooldown=0;tick(w,1);tick(w,WORD_CHARGE+1,{spit:true,aimX:-1});
  assert.equal(w.words.length,0);assert.ok(r.spit.blockedUntil>w.tick);
});

test('動く文字に二人が乗って運ばれ、壁に向かう足場は跳ね返る',()=>{
  const {w,r}=setup(),b=block();w.words=[b];
  r.x=b.x+60;r.y=b.y-14;r.vx=r.vy=0;
  const friend=newRunner(2,w.map);friend.x=b.x+152+36;friend.y=b.y-14;w.runners.push(friend);
  const x=r.x,fx=friend.x;tick(w,20);
  assert.ok(Math.abs(r.x-x-23)<.01);assert.ok(Math.abs(friend.x-fx-23)<.01);assert.ok(r.grounded&&friend.grounded);
  b.x=32;b.vx=-1.15;r.x=100;r.y=818;friend.x=180;friend.y=818;tick(w,1);
  assert.equal(b.x,32);assert.ok(b.vx>0);
});

test('消去は自分の大中華と溜めだけに効き、ミニや仲間の足場を消さない',()=>{
  const {w,r}=setup();
  const friend=newRunner(2,w.map);friend.x=650;w.runners.push(friend);
  w.words=[block(),{...block(2),id:2,x:650},{...block(),id:3,kind:'mini',x:400,y:760,vx:0}];
  tick(w,1,{clearWord:true});assert.deepEqual(w.words.map(b=>b.id),[2,3]);
  tick(w,1,{spit:true});assert.ok(r.spit.charge>0);
  tick(w,1,{clearWord:true});assert.equal(r.spit.charge,0);
  tick(w,WORD_CHARGE+WORD_FORM+2);assert.equal(w.words.filter(b=>b.owner===1&&b.kind!=='mini').length,0);
});

test('ミニ中華は5個を保ち、大中華の枠を使わず、地面へ落ちて止まる',()=>{
  const {w,r}=setup();
  for(let n=0;n<6;n++){
    // Stay behind the earlier boxes instead of teleporting inside a settled box.
    r.x=650-n*100;r.y=818;r.vx=r.vy=0;
    tick(w,1,{miniSpit:true,aimX:1,aimY:0});tick(w,65);
  }
  assert.equal(w.words.length,MINI_LIMIT);assert.ok(w.words.every(b=>b.kind==='mini'&&b.solid));
  assert.deepEqual(w.words.map(b=>b.id),[2,3,4,5,6]);
  for(const b of w.words){assert.ok(Math.abs(b.y+MINI_SIZE-832)<1);assert.equal(b.vy,0);}
  tick(w,1000);assert.equal(w.words.length,MINI_LIMIT);
  w.map={...w.map,wordBlocks:false};tick(w,1,{miniSpit:true});assert.equal(w.words.length,0);
});

test('ミニは積める実体の箱になり、フックで箱を手元へ引ける',()=>{
  const {w,r}=setup();
  const bottom={...block(),kind:'mini' as const,x:400,y:799.8,vx:0,vy:0,expires:-1};
  const top={...bottom,id:2,y:680};w.words=[bottom,top];
  tick(w,100);assert.ok(Math.abs(top.y+MINI_SIZE-bottom.y)<1);
  assert.ok(isSolid(w,top.x+16,top.y+16));
  w.words=[bottom];bottom.x=360;r.x=200;r.y=818;r.vx=r.vy=0;
  tick(w,25,{wire:true,aimX:1,aimY:0});
  assert.equal(r.wireWord,bottom.id);assert.equal(r.wireState,WIRE_ATTACHED);
  assert.ok(bottom.x<325,`mini x=${bottom.x}`);
  assert.ok(Math.abs(r.x-200)<1,`runner x=${r.x}`);
  tick(w,70);assert.equal(r.wireState,WIRE_IDLE);assert.equal(bottom.vy,0);
});

test('文字の上の人が低い天井に押し込まれない',()=>{
  const {w,r}=setup(),b=block();w.words=[b];b.y=92;b.vy=-1.15;b.vx=0;
  r.x=b.x+60;r.y=b.y-14;r.vx=r.vy=0;
  tick(w,50);
  assert.ok(r.y>=46-.01,`ceiling overlap y=${r.y}`);
  assert.ok(!wordBoxHit(b,r.x-13.99,r.y-13.99,27.98,27.98));
});

test('フックの支点は動く文字に追従し、文字が消えると外れる',()=>{
  const {w,r}=setup(),b=block();w.words=[b];
  r.x=200;r.y=440;r.vx=r.vy=0;
  tick(w,3,{wire:true,aimX:1,aimY:0});assert.equal(r.wireState,WIRE_ATTACHED);assert.equal(r.wireWord,b.id);
  const x=r.wireX;tick(w,10,{wire:true});assert.ok(Math.abs(r.wireX-x-11.5)<.01);
  tick(w,1,{wire:true,clearWord:true});assert.equal(r.wireState,WIRE_IDLE);assert.equal(r.wireWord,-1);
});

test('コース保存に技の設定が残り、二人に同一の文字と溜め状態が配信される',()=>{
  const m=validateCourseMap({...newCourseMap(40,24),wordBlocks:true});assert.equal(m.wordBlocks,true);
  assert.equal(validateCourseMap({...m,wordBlocks:'false'}).wordBlocks,true);
  const hub=new HostHub('words-test','文字の部屋');
  function peer(name:string){
    const messages:ServerMsg[]=[];
    const link:Link={send:m=>messages.push(structuredClone(m)),close:()=>{},onMessage:()=>{},onClose:()=>{}};
    hub.connect(link,hub.members.size===0);link.onMessage({t:'hello',name,guest:true});
    link.onMessage({t:'stageJoin',stageId:'word-practice'});
    return {messages,link};
  }
  const a=peer('赤'),b=peer('青');a.link.onMessage({t:'roomStart'});
  const game=[...hub.games].find(g=>g.stageId==='word-practice')!;
  game.world.runners[0].ability='bun';
  // Move the partner clear of the emitted silhouette; both remain on the ground.
  game.world.runners[1].x=650;
  for(let i=0;i<30;i++)hub.tick();
  a.link.onMessage({t:'input',gameId:game.id,list:[{seq:1,input:{...emptyInput(),spit:true}}]});
  for(let seq=2;seq<=14;seq++)a.link.onMessage({t:'input',gameId:game.id,list:[{seq,input:{...emptyInput(),spit:true}}]});
  for(let i=0;i<3;i++)hub.tick();
  const charging=b.messages.filter(m=>m.t==='snap').filter(m=>m.gameId===game.id).at(-1)!;
  assert.ok(charging.others[0].spit!.charge>0);
  for(let i=0;i<30;i++)hub.tick();
  const sa=a.messages.filter(m=>m.t==='snap').filter(m=>m.gameId===game.id).at(-1)!;
  const sb=b.messages.filter(m=>m.t==='snap').filter(m=>m.gameId===game.id).at(-1)!;
  assert.equal(sa.words?.length,1);assert.ok(sa.words![0].solid);assert.deepEqual(sa.words,sb.words);
  game.world.runners[0].x=100;game.world.runners[0].vx=0;
  a.link.onMessage({t:'input',gameId:game.id,list:[{seq:15,input:{...emptyInput(),miniSpit:true}}]});
  for(let seq=16;seq<=28;seq++)a.link.onMessage({t:'input',gameId:game.id,list:[{seq,input:emptyInput()}]});
  for(let i=0;i<20;i++)hub.tick();
  const miniSnap=b.messages.filter(m=>m.t==='snap').filter(m=>m.gameId===game.id).at(-1)!;
  assert.equal(miniSnap.words!.filter(b=>b.kind==='mini').length,1);
  a.link.onMessage({t:'input',gameId:game.id,list:[{seq:29,input:{...emptyInput(),clearWord:true}}]});
  for(let seq=30;seq<=42;seq++)a.link.onMessage({t:'input',gameId:game.id,list:[{seq,input:emptyInput()}]});
  for(let i=0;i<10;i++)hub.tick();
  const clearedA=a.messages.filter(m=>m.t==='snap').filter(m=>m.gameId===game.id).at(-1)!;
  const clearedB=b.messages.filter(m=>m.t==='snap').filter(m=>m.gameId===game.id).at(-1)!;
  assert.equal(clearedA.words!.length,1);assert.equal(clearedA.words![0].kind,'mini');assert.deepEqual(clearedA.words,clearedB.words);
});

test('稽古場は吐いた文字に乗り、谷を渡ってゴールできる',()=>{
  const {w,r}=setup();
  while(r.x<680)tick(w,1,{right:true});
  tick(w,18);tick(w,WORD_CHARGE+WORD_FORM+1,{spit:true});
  assert.equal(w.words.length,1);
  let rode=false;
  for(let i=0;i<700;i++){
    const b=w.words[0];assert.ok(b,'渡り終える前に文字が消えた');
    const target=b.x+64,delta=target-r.x;
    tick(w,1,{jump:i<3,right:delta>8,left:delta< -8});
    if(r.grounded&&r.y<700){rode=true;if(b.x>1250)break;}
  }
  assert.ok(rode,'文字に乗れない');
  for(let i=0;i<220&&r.finishedTime<0;i++){
    const ev=stepWorld(w,new Map([[1,{...emptyInput(),right:true,jump:i<3||(i>=20&&i<23)}]]));
    assert.equal(ev.killed.length,0,`谷に落ちた x=${r.x}, y=${r.y}`);
  }
  assert.ok(r.finishedTime>0,`ゴールできない x=${r.x}, y=${r.y}`);
});

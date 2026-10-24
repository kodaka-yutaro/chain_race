import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, newRunner, emptyInput, stepWorld, isSolid, WIRE_ATTACHED, WIRE_IDLE, type World, type Input } from '../shared/physics';
import { mapById } from '../shared/maps';
import { newCourseMap, validateCourseMap } from '../shared/courses';
import { WORD_CHARGE, WORD_FORM, WORD_COOLDOWN, WORD_LIFE, wordBoxHit, type WordBlock } from '../shared/word-blocks';
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

test('文字の線にだけ当たり判定があり、中の穴と文字間は空洞',()=>{
  const {w}=setup(),b=block();w.words=[b];
  assert.ok(isSolid(w,304,440));
  assert.equal(isSolid(w,324,452),false);
  assert.equal(wordBoxHit(b,324,450,20,20),false);
  assert.equal(wordBoxHit(b,430,410,20,100),false);
  assert.ok(wordBoxHit(b,355,400,20,20));
});

test('溜め・実体化・寿命があり、長押しでは連射せず非対応コースでは出ない',()=>{
  const {w,r}=setup();
  tick(w,1,{spit:true});assert.equal(r.spit.charge,WORD_CHARGE);assert.equal(w.words.length,0);
  tick(w,WORD_CHARGE,{spit:true});assert.equal(w.words.length,1);assert.equal(w.words[0].solid,false);
  tick(w,WORD_FORM,{spit:true});assert.equal(w.words[0].solid,true);
  tick(w,WORD_COOLDOWN,{spit:true});assert.equal(w.words.length,1);
  tick(w,WORD_LIFE,{spit:true});assert.equal(w.words.length,0);
  w.map={...w.map,wordBlocks:false};tick(w,1);tick(w,WORD_CHARGE+2,{spit:true});assert.equal(w.words.length,0);
});

test('再使用待ちと一人2個の制限、壁に埋まる発生を防ぐ',()=>{
  const {w,r}=setup();
  tick(w,WORD_CHARGE+WORD_FORM+1,{spit:true});tick(w,1);tick(w,1,{spit:true});assert.equal(w.words.length,1);
  // Cooldown finishes; the first word has travelled out of the next spawn area.
  tick(w,WORD_COOLDOWN);tick(w,WORD_CHARGE+WORD_FORM+1,{spit:true});assert.equal(w.words.length,2);
  tick(w,WORD_COOLDOWN);tick(w,WORD_CHARGE+WORD_FORM+1,{spit:true});assert.equal(w.words.length,2);
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
  b.expires=w.tick+1;tick(w,1,{wire:true});assert.equal(r.wireState,WIRE_IDLE);assert.equal(r.wireWord,-1);
});

test('コース保存に技の設定が残り、二人に同一の文字と溜め状態が配信される',()=>{
  const m=validateCourseMap({...newCourseMap(40,24),wordBlocks:true});assert.equal(m.wordBlocks,true);
  assert.equal(validateCourseMap({...m,wordBlocks:'false'}).wordBlocks,undefined);
  const hub=new HostHub('words-test','文字の部屋');
  function peer(name:string){
    const messages:ServerMsg[]=[];
    const link:Link={send:m=>messages.push(structuredClone(m)),close:()=>{},onMessage:()=>{},onClose:()=>{}};
    hub.connect(link);link.onMessage({t:'hello',name,guest:true});
    link.onMessage({t:'stageJoin',stageId:'word-practice'});
    return {messages,link};
  }
  const a=peer('赤'),b=peer('青');
  const game=[...hub.games].find(g=>g.stageId==='word-practice')!;
  // Move the partner clear of the emitted silhouette; both remain on the ground.
  game.world.runners[1].x=650;
  for(let i=0;i<30;i++)hub.tick();
  a.link.onMessage({t:'input',gameId:game.id,list:[{seq:1,input:{...emptyInput(),spit:true}}]});
  for(let seq=2;seq<=14;seq++)a.link.onMessage({t:'input',gameId:game.id,list:[{seq,input:emptyInput()}]});
  for(let i=0;i<3;i++)hub.tick();
  const charging=b.messages.filter(m=>m.t==='snap').filter(m=>m.gameId===game.id).at(-1)!;
  assert.ok(charging.others[0].spit!.charge>0);
  for(let i=0;i<30;i++)hub.tick();
  const sa=a.messages.filter(m=>m.t==='snap').filter(m=>m.gameId===game.id).at(-1)!;
  const sb=b.messages.filter(m=>m.t==='snap').filter(m=>m.gameId===game.id).at(-1)!;
  assert.equal(sa.words?.length,1);assert.ok(sa.words![0].solid);assert.deepEqual(sa.words,sb.words);
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

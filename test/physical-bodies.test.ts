import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,newRunner,emptyInput,stepWorld,type World,type Input} from '../shared/physics';
import {newCourseMap} from '../shared/courses';
import {ballCount} from '../shared/abilities';
import {toView} from '../shared/protocol';
function setup(){const m=newCourseMap(40,20),w=createWorld(m),r=newRunner(1,m);r.x=200;r.y=530;w.runners.push(r);return {w,r,m};}
function tick(w:World,n=1,input:Partial<Input>={},id=1){for(let i=0;i<n;i++)stepWorld(w,new Map([[id,{...emptyInput(),...input}]]));}
test('自分の霊体で本体をフックし、動いた本体へ戻れる',()=>{
 const {w,r}=setup();r.ability='ghost';tick(w,30,{fire:true});assert.ok(r.ghostBody);
 r.x=340;r.y=430;tick(w,30,{wire:true,aimX:-140,aimY:100});
 assert.equal(r.wireRunner,1000000001);assert.ok(r.ghostBody!.x>210);assert.ok(r.ghostBody!.y<530);
 assert.equal(w.runners.length,1);assert.deepEqual(toView(r).ghostBody,r.ghostBody);
 tick(w);tick(w,30,{fire:true});assert.equal(r.ghostBody,null);assert.ok(r.x>210);
});
test('仲間が本体をフックで引け、本体は壁をすり抜けない',()=>{
 const {w,r,m}=setup();r.ability='ghost';tick(w,30,{fire:true});r.x=100;r.y=350;
 const friend=newRunner(2,m);friend.x=430;friend.y=530;w.runners.push(friend);
 tick(w,30,{wire:true,aimX:-1,aimY:0},2);assert.equal(friend.wireRunner,1000000001);assert.ok(r.ghostBody!.x>210);
 r.ghostBody!.x=250;r.ghostBody!.vx=0;
 const rows=m.tiles.map(s=>[...s]);for(let y=2;y<17;y++)rows[y][10]='#';m.tiles=rows.map(s=>s.join(''));
 tick(w,60,{wire:true,aimX:-1,aimY:0},2);assert.ok(r.ghostBody!.x<=320-14);assert.equal(w.runners.length,2);
});
test('本体はスイッチを押せ、危険に触れたら霊体も復活する',()=>{
 const {w,r,m}=setup();m.tiles[16]=m.tiles[16].slice(0,6)+'1'+m.tiles[16].slice(7);
 r.ability='ghost';tick(w,30,{fire:true});r.x=500;r.y=300;tick(w);assert.equal(w.plates[0],1);
 m.tiles[16]=m.tiles[16].replace('1','^');tick(w);assert.equal(r.ghostBody,null);assert.equal(r.ability,'basic');assert.equal(w.runners.length,1);
});
test('小中華と赤ボールは1個ずつボタンの重しになり、回収した球は押さない',()=>{
 const {w,r,m}=setup();r.x=100;m.channels=[{need:2}];m.tiles[16]=m.tiles[16].slice(0,9)+'11'+m.tiles[16].slice(11);
 const owner=newRunner(2,m);owner.ability='bun';owner.x=800;w.runners.push(owner);
 w.words.push({id:1,owner:2,kind:'mini',x:288,y:512,vx:0,vy:0,born:0,expires:-1,solid:true,mouthX:0,mouthY:0});
 w.balls.push({id:0,x:336,y:512,vx:0,vy:0,homeX:336,homeY:512});
 tick(w);assert.equal(w.plates[0],2);assert.equal(w.doorsOpen[0],true);
 r.ability='bicycle';w.balls[0].carriedBy=1;tick(w);assert.equal(w.plates[0],1);assert.equal(w.doorsOpen[0],false);
 w.balls[0].carriedBy=undefined;w.balls[0].owner=1;w.balls[0].x=350;tick(w,1,{wire:true});assert.equal(ballCount(w,1),1);assert.equal(w.balls[0].respawnAt,undefined);
});
test('大中華の溜めを途中で離すと中断し、次も最初から溜める',()=>{
 const {w,r}=setup();r.ability='bun';tick(w,25,{fire:true});assert.ok(r.spit.charge>0);tick(w);assert.equal(r.spit.charge,0);tick(w,40);assert.equal(w.words.length,0);
 tick(w,35,{fire:true});assert.equal(w.words.length,0);tick(w,1,{fire:true});assert.equal(w.words.length,1);tick(w,120,{fire:true});assert.equal(w.wordSeq,1);
});
test('小中華と赤ボールはDD系スイッチも動かせる',()=>{
 const {w,r,m}=setup();r.x=100;r.ability='bun';m.dd!.switches=[[16*40+9,25,7,0,0],[16*40+10,24,8,0,0]];
 w.words.push({id:1,owner:1,kind:'mini',x:288,y:512,vx:0,vy:0,born:0,expires:-1,solid:true,mouthX:0,mouthY:0});
 w.balls.push({id:0,x:352,y:512,vx:0,vy:0,homeX:352,homeY:512});tick(w);
 assert.equal(w.dd!.switches[7].on,false);assert.equal(w.dd!.switches[8].on,true);
});

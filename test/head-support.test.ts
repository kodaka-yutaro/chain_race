import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,newRunner,stepWorld,emptyInput,type World,type Input} from '../shared/physics';
import {newCourseMap} from '../shared/courses';
function setup(){const w=createWorld(newCourseMap(40,20)),r=newRunner(1,w.map);r.x=300;r.y=530;w.runners.push(r);return {w,r};}
function tick(w:World,n:number,input:Partial<Input>={},id=1){for(let i=0;i<n;i++)stepWorld(w,new Map([[id,{...emptyInput(),...input}]]));}
function mini(w:World,x:number,y:number){const b={id:1,owner:1,kind:'mini' as const,x,y,vx:0,vy:0,born:0,expires:-1,solid:true,mouthX:0,mouthY:0};w.words.push(b);return b;}
test('少し横にずれたプレイヤーも頭に着地して安定し、下の移動についてくる',()=>{
 const {w,r}=setup(),up=newRunner(2,w.map);up.x=r.x+20;up.y=460;w.runners.push(up);
 tick(w,60);assert.ok(Math.abs(up.y+28-r.y)<.1);assert.ok(Math.abs(up.x-r.x-20)<1);
 const x=up.x;tick(w,15,{right:true});assert.ok(up.x>x+20);assert.ok(Math.abs(up.y+28-r.y)<1);
 tick(w,1,{jump:true},2);assert.ok(up.vy<0);
});
test('小中華が頭へ落ちるとプレイヤーを押し下げずに乗り、移動についてくる',()=>{
 const {w,r}=setup(),b=mini(w,304,420);tick(w,60);
 assert.ok(Math.abs(b.y+32-(r.y-14))<.1);assert.equal(r.y,530);
 const x=b.x;tick(w,15,{right:true});assert.ok(b.x>x+20);assert.ok(Math.abs(b.y+32-(r.y-14))<1);
});
test('小中華へのフックは当たった端ではなく中心を追従する',()=>{
 const {w,r}=setup(),b=mini(w,450,512);r.ability='basic';r.x=300;r.y=510;
 tick(w,10,{wire:true,aimX:1,aimY:.1});assert.equal(r.wireWord,b.id);assert.equal(r.wireLocalX,16);assert.equal(r.wireLocalY,16);
 assert.equal(r.wireX,b.x+16);assert.equal(r.wireY,b.y+16);
});
test('頭への吸着は横からの接触や上向きジャンプを捕まえない',()=>{
 const {w,r}=setup(),up=newRunner(2,w.map);up.x=320;up.y=530;w.runners.push(up);tick(w,1);
 assert.ok(Math.abs(up.y-r.y)<1);
 up.x=r.x;up.y=r.y-28;up.vy=-10;tick(w,1);assert.ok(up.y<r.y-30);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,newRunner,stepWorld,emptyInput,PHYS,type World,type Input} from '../shared/physics';
import {hammerMinis} from '../shared/word-blocks';
import {newCourseMap} from '../shared/courses';
function setup(){const w=createWorld(newCourseMap(40,20)),r=newRunner(1,w.map);r.x=300;r.y=530;w.runners.push(r);return {w,r};}
function tick(w:World,n:number,input:Partial<Input>={},id=1){for(let i=0;i<n;i++)stepWorld(w,new Map([[id,{...emptyInput(),...input}]]));}
function mini(w:World,x:number,y:number){const b={id:1,owner:1,kind:'mini' as const,x,y,vx:0,vy:0,born:0,expires:-1,solid:true,mouthX:0,mouthY:0};w.words.push(b);return b;}
test('小中華のハンマー反動は同じ位置のプレイヤーと同じ強さになる',()=>{
 const player=setup(),other=newRunner(2,player.w.map);other.x=340;other.y=530;player.w.runners.unshift(other);
 tick(player.w,1,{fire:true,aimX:1,aimY:0});
 const box=setup(),b=mini(box.w,324,514);box.r.aimX=1;box.r.aimY=0;
 hammerMinis(box.w,box.r,321,530);
 assert.ok(Math.abs(b.vx-other.vx)<.001);assert.ok(Math.abs(b.vy+PHYS.gravity-other.vy)<.001);
 assert.ok(Math.hypot(b.vx,b.vy)<12);
});
test('頭の上を地面とみなさず空中ジャンプを回復しない',()=>{
 const {w,r}=setup(),up=newRunner(2,w.map);up.x=r.x;up.y=r.y-28;up.jumped=2;w.runners.push(up);
 tick(w,1);assert.equal(up.grounded,false);assert.ok(up.jumped&2);
});
test('頭の上のプレイヤーと小中華を下の人の横移動に追従させない',()=>{
 const {w,r}=setup(),up=newRunner(2,w.map);up.x=r.x;up.y=r.y-28;w.runners.push(up);const x=up.x;
 tick(w,1,{right:true});assert.equal(up.x,x);assert.ok(r.x>x);
 const box=setup(),b=mini(box.w,box.r.x-16,box.r.y-46),bx=b.x;
 tick(box.w,1,{right:true});assert.equal(b.x,bx);assert.ok(box.r.x>300);
});
test('小中華へのフックは当たった端ではなく中心を追従する',()=>{
 const {w,r}=setup(),b=mini(w,450,512);r.ability='basic';r.x=300;r.y=510;
 tick(w,10,{wire:true,aimX:1,aimY:.1});assert.equal(r.wireWord,b.id);assert.equal(r.wireLocalX,16);assert.equal(r.wireLocalY,16);
 assert.equal(r.wireX,b.x+16);assert.equal(r.wireY,b.y+16);
});
test('横からの接触で頭へ吸着せず上向きの移動を妨げない',()=>{
 const {w,r}=setup(),up=newRunner(2,w.map);up.x=320;up.y=530;w.runners.push(up);tick(w,1);
 assert.ok(Math.abs(up.y-r.y)<1);
 up.x=r.x;up.y=r.y-28;up.vy=-10;tick(w,1);assert.ok(up.y<r.y-30);
});

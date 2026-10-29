import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,newRunner,emptyInput,stepWorld,type Input,type World} from '../shared/physics';
import {newCourseMap,validateCourseMap} from '../shared/courses';
import {bicycleBlocked} from '../shared/abilities';
import {defaultFace,validFace} from '../shared/face';
function setup(){const m=newCourseMap(40,20),w=createWorld(m),r=newRunner(1,m);w.runners.push(r);r.x=200;r.y=17*32-14;return {m,w,r};}
function tick(w:World,n=1,input:Partial<Input>={}){for(let i=0;i<n;i++)stepWorld(w,new Map([[1,{...emptyInput(),...input}]]));}
function tile(w:World,x:number,y:number,c:string){const r=w.map.tiles[y].split('');r[x]=c;w.map.tiles[y]=r.join('');}
test('初期能力は手。アイテムを取ると以前の能力は使えず、復活すると手に戻る',()=>{
 const {w,r}=setup();assert.equal(r.ability,'hand');tick(w,1,{wire:true,fire:true,spit:true,miniSpit:true});assert.equal(r.wireState,0);assert.equal(r.hammerTick,-100);assert.equal(w.words.length,0);
 tile(w,6,16,'H');tick(w);assert.equal(r.ability,'hook');tick(w,1,{wire:true});assert.notEqual(r.wireState,0);
 tile(w,6,16,'M');w.pickups={};tick(w);assert.equal(r.ability,'hammer');tick(w,1,{wire:true,fire:true});assert.equal(r.wireState,0);assert.equal(r.hammerTick,w.tick);
 tick(w,1,{kill:true});assert.equal(r.ability,'hand');
});
test('中華まんだけが小中華と大中華を生成できる',()=>{
 const {w,r}=setup();r.ability='bun';tick(w,1,{miniSpit:true});assert.equal(w.words.filter(b=>b.kind==='mini').length,1);
 tick(w);r.x=400;tick(w,1,{spit:true});tick(w,30);assert.equal(w.words.filter(b=>b.kind!=='mini').length,1);
 r.ability='hammer';tick(w,20,{miniSpit:true});assert.equal(w.words.filter(b=>b.kind==='mini').length,1);
});
test('自転車は一段ジャンプで、歩行者が通れる幅の通路に入れない',()=>{
 const {w,r}=setup();r.ability='bicycle';r.y=17*32-40;tick(w,1,{jump:true});assert.ok(r.vy<0);tick(w);const vy=r.vy;tick(w,1,{jump:true});assert.ok(r.vy>vy,'空中で再ジャンプしない');
 for(let y=1;y<17;y++){tile(w,10,y,'X');tile(w,12,y,'X');}assert.ok(bicycleBlocked(w,11*32+16,300));
 r.ability='hand';r.x=11*32+16;r.y=300;r.vx=0;tick(w,10);assert.equal(r.x,11*32+16);
});
test('自転車の車輪はしびれ床とトゲの上を走れるが、乗員に触れると反応する',()=>{
 for(const hazard of ['~','^']){const {w,r}=setup();for(let x=2;x<30;x++)tile(w,x,16,hazard);r.ability='bicycle';r.y=16*32-40;tick(w,25,{right:true});assert.equal(r.stun,0);assert.equal(r.ability,'bicycle');assert.ok(Math.abs(r.y-(16*32-40))<1);
   r.y=16*32+16;tick(w);if(hazard==='~')assert.ok(r.stun>0);else assert.equal(r.ability,'hand');}
});
test('マジックハンドで赤いボールを持ち運んで離せる。壁越しにはつかめない',()=>{
 const {w,r}=setup();w.balls.push({id:1,x:r.x+40,y:r.y,vx:0,vy:0,homeX:240,homeY:r.y});tick(w,1,{fire:true});assert.deepEqual(r.held,{kind:'ball',id:1});tick(w,10,{right:true});assert.ok(Math.abs(w.balls[0].x-r.x-48)<1);
 tick(w,1,{fire:true});assert.equal(r.held,null);tick(w);r.x=200;r.y=400;w.balls[0].x=250;w.balls[0].y=400;tile(w,7,12,'X');tick(w,1,{fire:true});assert.equal(r.held,null);
});
test('赤いボールを自転車でシュートでき、別のプレイヤーのフックでつかめる',()=>{
 const {w,r}=setup();r.ability='bicycle';r.y=17*32-40;w.balls.push({id:0,x:r.x+38,y:r.y+24,vx:0,vy:0,homeX:240,homeY:r.y});tick(w,1,{fire:true});assert.ok(w.balls[0].vx>15);
 r.ability='hook';r.x=180;r.y=400;w.balls[0].x=270;w.balls[0].y=400;w.balls[0].vx=w.balls[0].vy=0;tick(w,1,{wire:true});assert.equal(r.wireBall,0);assert.equal(r.wireState,2);
});
test('乗員のボディをフックでつかめる',()=>{
 const {w,r}=setup();r.ability='hook';r.x=180;r.y=400;const b=newRunner(2,w.map);b.ability='bicycle';b.x=260;b.y=400;w.runners.push(b);tick(w,1,{wire:true});assert.equal(r.wireRunner,2);
});
test('能力アイテムと赤いボールをエディタ形式で往復でき、顔は固定サイズの描画データのみ許可する',()=>{
 const {w}=setup();['G','H','M','V','N','o'].forEach((c,i)=>tile(w,10+i,15,c));const copy=validateCourseMap(JSON.parse(JSON.stringify(w.map)));assert.equal(copy.minPlayers,1);assert.ok(copy.tiles[15].includes('GHMVNo'));assert.equal(createWorld(copy).balls.length,1);
 assert.ok(validFace(defaultFace()));assert.equal(validFace('<script>'),false);assert.equal(validFace('1'.repeat(100000)),false);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCourseMap,validateCourseMap,validateCoursePreview} from '../shared/courses';
import {createWorld,newRunner,emptyInput,stepWorld,wordCollision,type World} from '../shared/physics';
import {stepWords,wordBoxHit,type WordBlock} from '../shared/word-blocks';
import {stepBalls,metalPart,abilityInput,shotLaunch,clearShotLaunch,explodeOwned,BLAST_FORCE,BLAST_RADIUS,SHOT_MAX_DISTANCE} from '../shared/abilities';
import {composeMusic} from '../shared/music';
import {ddClamp} from '../shared/ddrace';
import {extendCell} from '../shared/editor-fill';
function setup(){const m=newCourseMap(50,30),w=createWorld(m),r=newRunner(1,m);r.x=100;r.y=800;r.ability='bun';w.runners.push(r);return {m,w,r};}
function big(w:World,extra:Partial<WordBlock>={}){const b:WordBlock={id:1,owner:1,x:300,y:450,vx:2.4,vy:0,born:0,expires:-1,solid:true,mouthX:0,mouthY:0,...extra};w.words.push(b);return b;}
function mini(w:World,x:number,y:number){const b:WordBlock={id:w.words.length+1,owner:1,kind:'mini',x,y,vx:0,vy:0,born:0,expires:-1,solid:true,mouthX:0,mouthY:0};w.words.push(b);return b;}
function words(w:World,n:number){for(let i=0;i<n;i++){w.tick++;stepWords(w,wordCollision(w));}}
function ceiling(w:World){w.map.tiles[10]='#'.repeat(w.map.width);}
function ball(w:World,x:number,y:number,vx=0,vy=0){const b={id:w.balls.length,x,y,vx,vy,homeX:x,homeY:y};w.balls.push(b);return b;}
test('large bun carries stacked small buns without losing speed',()=>{
 const {w}=setup(),b=big(w),a=mini(w,350,418),c=mini(w,350,386);
 words(w,40);assert.ok(Math.abs(b.x-396)<.01);assert.ok(Math.abs(a.x-446)<.01);assert.ok(Math.abs(c.x-446)<.01);
 assert.equal(b.vx,2.4);assert.equal(wordBoxHit(b,a.x,a.y,32,32),false);
});
test('large bun pushes loose balls and stops before crushing a ball against the ceiling',()=>{
 const {w}=setup(),b=big(w,{vx:0,vy:-2.4}),o=ball(w,356,418);ceiling(w);
 words(w,80);assert.ok(o.y-32>=352-.001);assert.ok(b.y>=416-.001);assert.ok(b.y<450);
 assert.equal(wordBoxHit(b,o.x-32,o.y-32,64,64),false);assert.equal(b.vy,-2.4);
});
test('large bun stops atomically before a small bun or stacked small buns hit a ceiling',()=>{
 for(const stacked of [false,true]){const {w}=setup(),b=big(w,{vx:0,vy:-2.4}),a=mini(w,350,418);if(stacked)mini(w,350,386);ceiling(w);
  words(w,80);for(const o of w.words.filter(o=>o.kind==='mini'))assert.ok(o.y>=352-.001);
  assert.ok(b.y>=(stacked?416:384)-.001);assert.equal(wordBoxHit(b,a.x,a.y,32,32),false);
 }
});
test('high-speed large bun cannot tunnel through a one-tile wall',()=>{
 const {w,m}=setup(),b=big(w,{vx:180});for(let y=0;y<m.height;y++)m.tiles[y]=m.tiles[y].slice(0,20)+'#'+m.tiles[y].slice(21);
 words(w,2);assert.ok(b.x+245<=640+.001);assert.ok(b.x>300);
});
test('moving bicycle cannot drive into another player in either simulation order',()=>{
 for(const reverse of [false,true]){const {w,r,m}=setup();r.ability='bicycle';r.x=300;r.y=400;r.vx=90;
  const o=newRunner(2,m);o.x=370;o.y=426;w.runners=reverse?[o,r]:[r,o];
  for(let i=0;i<10;i++){
   stepWorld(w,new Map([[1,{...emptyInput(),right:true}]]));const p=metalPart(r)!;
   assert.ok(!(p.x<o.x+13.99&&p.x+p.w>o.x-13.99&&p.y<o.y+13.99&&p.y+p.h>o.y-13.99));
  }
 }
});
test('players cannot enter a stationary bicycle from either side at high speed',()=>{
 for(const side of [-1,1]){const {w,r,m}=setup();r.ability='bicycle';r.x=400;r.y=400;const o=newRunner(2,m);o.x=400+side*90;o.y=426;o.vx=-side*180;w.runners.push(o);
 stepWorld(w,new Map());const p=metalPart(r)!;assert.ok(o.x+14<=p.x+.01||o.x-14>=p.x+p.w-.01);}
});
test('basic ability reset pickup works for consecutive players and ignores old cooldowns',()=>{
 const {w,r,m}=setup();const idx=12*m.width+10;m.tiles[12]=m.tiles[12].slice(0,10)+'G'+m.tiles[12].slice(11);w.pickups[idx]=10000;
 for(let id=1;id<=3;id++){const p=newRunner(id,m);p.ability='bun';p.x=336;p.y=400;w.runners=[p];abilityInput(w,p,emptyInput(),wordCollision(w));assert.equal(p.ability,'basic');assert.equal(w.pickups[idx],undefined);}
});
test('stronger maximum shot and blast retain bounded parameters',()=>{
 const {w,r}=setup();r.ability='bicycle';r.x=200;r.y=500;
 assert.ok(SHOT_MAX_DISTANCE>960);assert.ok(shotLaunch(r,100000,0).vx>shotLaunch(r,960,0).vx);
 assert.deepEqual(shotLaunch(r,100000,0),shotLaunch(r,SHOT_MAX_DISTANCE,0));
 const o=newRunner(2,w.map);o.x=336;o.y=500;w.runners.push(o);ball(w,320,500);explodeOwned(w,1);
 assert.ok(o.vx>22);assert.equal(w.blasts[0].radius,BLAST_RADIUS);assert.ok(BLAST_FORCE>22);
});
test('fast balls and blast-driven players remain on their side of thin walls',()=>{
 for(const speed of [80,300,1000]){const {w,m,r}=setup();for(let y=0;y<m.height;y++)m.tiles[y]=m.tiles[y].slice(0,20)+'#'+m.tiles[y].slice(21);
 const o=ball(w,550,500,speed,0);stepBalls(w,wordCollision(w));assert.ok(o.x+32<=640+.001);
 r.ability='basic';r.x=570;r.y=500;r.vx=speed;stepWorld(w,new Map());assert.ok(r.x+14<=640+.01);}
});
test('launch sweep prevents spawning a ball past a wall near the muzzle',()=>{
 const {w,m,r}=setup();r.ability='bicycle';r.x=290;r.y=400;r.aimX=1;r.aimY=0;r.aimDistance=1200;
 for(let y=0;y<m.height;y++)m.tiles[y]=m.tiles[y].slice(0,10)+'#'+m.tiles[y].slice(11);
 assert.equal(clearShotLaunch(w,r,wordCollision(w)),false);
});
test('red one-way stoppers block balls in all four directions and allow the reverse',()=>{
 for(const [flags,dx,dy] of [[11,1,0],[8,-1,0],[0,0,1],[3,0,-1]]){
  const {w,m}=setup();m.dd!.game=[[12*m.width+20,240,flags]];
  const o=ball(w,656-dx*90,400-dy*90,dx*160,dy*160);stepBalls(w,wordCollision(w));
  assert.ok(dx?dx*(o.x-656)<=-48+.01:dy*(o.y-400)<=-48+.01);
  o.x=656+dx*90;o.y=400+dy*90;o.vx=-dx*160;o.vy=-dy*160;stepBalls(w,wordCollision(w));
  assert.ok(dx?dx*(o.x-656)<0:dy*(o.y-400)<0);
 }
});
test('red stoppers stop player input while regular stoppers still let balls through',()=>{
 const {w,m,r}=setup();m.dd!.game=[[12*m.width+20,240,11]];r.x=656;r.y=400;r.vx=30;ddClamp(w,r);assert.equal(r.vx,0);r.vx=-30;ddClamp(w,r);assert.equal(r.vx,-30);
 const other=setup();other.m.dd!.game=[[12*50+20,60,11]];const o=ball(other.w,566,400,160);stepBalls(other.w,wordCollision(other.w));assert.ok(o.x>656);
});
test('teleporter colors survive validation, preview and extension; invalid colors fail',()=>{
 const m=newCourseMap();m.dd!.tele=[[10*m.width+10,26,1,1],[10*m.width+20,27,1,0],[10*m.width+30,27,2]];
 assert.deepEqual(validateCourseMap(JSON.parse(JSON.stringify(m))).dd!.tele,m.dd!.tele);
 assert.deepEqual(validateCoursePreview(m).dd!.tele,m.dd!.tele);
 extendCell(m,10,10,1,0);assert.ok(m.dd!.tele.filter(r=>r[1]===26).every(r=>r[3]===1));
 m.dd!.tele[0][3]=5;assert.throws(()=>validateCourseMap(m));
});
test('new major-key tracks stay diatonic and low tracks keep the melody low',()=>{
 for(const [id,root] of [['sunrise',60],['warmbass',53]] as const){const allowed=new Set([0,2,4,5,7,9,11]);for(const n of composeMusic(id).notes.filter(n=>!['kick','snare','hat'].includes(n.voice)))assert.ok(allowed.has(((n.pitch-root)%12+12)%12));}
 const melody=composeMusic('deep').notes.filter(n=>n.voice==='strings');assert.ok(Math.max(...melody.map(n=>n.pitch))<65);
});

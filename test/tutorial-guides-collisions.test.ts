import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCourseMap} from '../shared/courses';
import {createWorld,newRunner,emptyInput,stepWorld,wordCollision,type World} from '../shared/physics';
import {ddPressSwitch,ddTick,ddSwitchActive} from '../shared/ddrace';
import {stepWords,type WordBlock} from '../shared/word-blocks';
import {abilityGuide} from '../client/in-game-guide';
import raw from '../shared/tutorial-course.json';
function setup(){const m=newCourseMap(50,30),w=createWorld(m),r=newRunner(1,m);r.x=300;r.y=400;w.runners=[r];return {m,w,r};}
function tile(w:World,x:number,y:number,c:string){const row=[...w.map.tiles[y]];row[x]=c;w.map.tiles[y]=row.join('');}
test('Basic Class starts around spawn and explains recall before shooting and one large bun',()=>{
 const sy=raw.tiles.findIndex(r=>r.includes('S')),sx=raw.tiles[sy].indexOf('S');for(let y=sy-1;y<=sy+1;y++)for(let x=sx-1;x<=sx+1;x++)if(x!==sx||y!==sy)assert.equal(raw.tiles[y][x],'>');
 assert.ok(raw.hints[2].text.indexOf('右クリック')<raw.hints[2].text.indexOf('左クリック'));assert.match(raw.hints[5].text,/１人１個/);assert.equal(raw.hints[6].y,118);
});
test('timed and direct switch doors defer closing until the whole bicycle has cleared',()=>{
 for(const timed of [false,true]){const {m,w,r}=setup();r.ability='bicycle';r.x=300;r.y=400;m.dd!.doors=[[336,400,0,1,32,1]];w.dd!.switches[1]={on:false,until:timed?1:0,after:true};
 if(timed){w.tick=1;ddTick(w);}else{m.dd!.switches=[[12*50+9,24,1,0,0]];ddPressSwitch(w,12*50+9);}
 assert.equal(ddSwitchActive(w,1),false);assert.equal(w.dd!.switches[1].pending,true);r.x=220;ddTick(w);assert.equal(ddSwitchActive(w,1),true);
 }
});
test('a timed ON that expires while occupied never closes later',()=>{
 const {m,w,r}=setup();r.x=336;r.y=400;m.dd!.doors=[[336,400,0,1,32,1]];m.dd!.switches=[[12*50+9,22,1,0,1]];ddPressSwitch(w,12*50+9);assert.equal(ddSwitchActive(w,1),false);w.tick=51;ddTick(w);r.x=200;ddTick(w);assert.equal(ddSwitchActive(w,1),false);
});
test('ordinary switch doors wait for a player to leave instead of embedding them',()=>{
 const {w,r}=setup();tile(w,9,12,'a');w.doorsOpen[0]=true;stepWorld(w,new Map());assert.equal(w.doorsOpen[0],true);r.x=200;stepWorld(w,new Map());assert.equal(w.doorsOpen[0],false);
});
test('large and small buns cannot carry a player through the blocked side of a stopper',()=>{
 for(const mini of [false,true])for(const bike of [false,true]){const {m,w,r}=setup();r.ability=bike?'bicycle':'basic';r.x=340;r.y=400-(bike?42:14);const b:WordBlock={id:1,owner:1,x:mini?324:300,y:400,vx:3,vy:0,born:0,expires:-1,solid:true,mouthX:0,mouthY:0,...(mini?{kind:'mini' as const}:{})};w.words=[b];m.dd!.game=[[11*m.width+12,60,11]];
 for(let i=0;i<80;i++){w.tick++;stepWords(w,wordCollision(w));}assert.ok(r.x+(bike?42:14)<=384+.01,`${mini}/${bike}: ${r.x}`);
 }
});
test('a flying ghost enters portals while its physical body remains behind',()=>{
 const {m,w,r}=setup();r.ability='ghost';r.x=336;r.y=400;r.ghostBody={x:200,y:600,vx:0,vy:0,stun:0};m.dd!.tele=[[12*m.width+10,26,1],[12*m.width+25,27,1]];stepWorld(w,new Map());assert.equal(r.x,816);assert.ok(r.ghostBody);assert.ok(Math.abs(r.ghostBody!.x-200)<1);
});
test('ability summaries follow equipment and put bicycle recall first',()=>{
 assert.match(abilityGuide('bun'),/１人１個/);assert.ok(abilityGuide('bicycle').indexOf('右：')<abilityGuide('bicycle').indexOf('左：'));assert.match(abilityGuide('ghost',true),/WASD/);assert.match(abilityGuide('basic'),/ハンマー/);
});

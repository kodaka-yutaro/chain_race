import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCourseMap} from '../shared/courses';
import {createWorld,newRunner,emptyInput,stepWorld,wordCollision,type World,type Input} from '../shared/physics';
import {bicycleBlocked,recoverBicycle,stepBalls,metalPart} from '../shared/abilities';
import {ddClamp,ddTiles,ddTick} from '../shared/ddrace';
import {waitingMap} from '../shared/waiting-map';
import {HostHub,type Link} from '../client/host/hub';
import type {ServerMsg,ClientMsg} from '../shared/protocol';
function setup(){const m=newCourseMap(120,30),w=createWorld(m),r=newRunner(1,m);w.runners.push(r);r.ability='bicycle';r.x=300;r.y=27*32-42;return {m,w,r};}
function tick(w:World,n=1,input:Partial<Input>={}){for(let i=0;i<n;i++)stepWorld(w,new Map([[1,{...emptyInput(),...input}]]));}
function tile(w:World,x:number,y:number,c:string){const row=[...w.map.tiles[y]];row[x]=c;w.map.tiles[y]=row.join('');}
test('bicycle is a 3 by 2 body and its lower outer corner obeys one-way tiles',()=>{
 const {w,r}=setup();assert.deepEqual(metalPart(r),{x:258,y:808,w:84,h:56});
 r.x=300;r.y=300;w.map.dd!.game=[[10*w.map.width+10,60,11]];r.vx=20;ddClamp(w,r);assert.equal(r.vx,0);
 r.vx=-20;ddClamp(w,r);assert.equal(r.vx,-20);
});
test('a player can stand on the upper side of a bicycle without sinking',()=>{
 const {w,r}=setup(),o=newRunner(2,w.map);o.x=r.x+30;o.y=r.y-28;w.runners.push(o);tick(w,80);
 assert.ok(Math.abs(o.y-(r.y-28))<1);assert.ok(o.grounded);
});
test('bicycle upper side catches a hook; lower side lets it reach a player behind',()=>{
 for(const upper of [true,false]){const {w,r}=setup();r.x=300;r.y=400;const a=newRunner(2,w.map),b=newRunner(3,w.map);a.x=200;a.y=upper?400:428;b.x=430;b.y=a.y;w.runners.push(a,b);
 for(let i=0;i<3;i++)stepWorld(w,new Map([[2,{...emptyInput(),wire:true,aimX:1,aimY:0}]]));assert.equal(a.wireRunner,upper?1:3);}
});
test('bicycle accelerates after sustained travel and resets on reversal',()=>{
 const {w,r}=setup();tick(w,40,{right:true});const slow=r.vx;tick(w,55,{right:true});assert.ok(r.vx>slow+4);assert.ok((r.bikeTicks??0)>=75);tick(w,1,{left:true});assert.equal(r.bikeTicks,0);
});
test('teleported bicycle is moved clear of nearby walls; tight exit releases equipment',()=>{
 const {w,r}=setup();r.x=320;r.y=400;tile(w,9,12,'#');assert.ok(bicycleBlocked(w,r.x,r.y));recoverBicycle(w,r);assert.equal(r.ability,'bicycle');assert.equal(bicycleBlocked(w,r.x,r.y),false);
 for(let y=4;y<22;y++)for(let x=3;x<18;x++)tile(w,x,y,'#');tile(w,10,12,'.');r.x=336;r.y=400;recoverBicycle(w,r);assert.equal(r.ability,'basic');tick(w,1,{right:true});assert.ok(Number.isFinite(r.x));
});
test('shared portal transfers high-speed balls and players, ordinary portals ignore balls',()=>{
 for(const type of [241,26]){const {w,r}=setup();r.ability='basic';r.x=336;r.y=400;w.map.dd!.tele=[[12*w.map.width+10,type,1],[12*w.map.width+25,27,1]];
 const b={id:0,x:250,y:400,vx:120,vy:0,homeX:250,homeY:400};w.balls.push(b);stepBalls(w,wordCollision(w));if(type===241)assert.ok(b.x>750);else assert.ok(b.x<500);
 ddTiles(w,r);assert.equal(r.x,816);}
});
test('special effects log only state changes and timed switches expire',()=>{
 const {w,r}=setup();r.x=336;r.y=400;w.map.dd!.game=[[12*w.map.width+10,105,0]];w.map.dd!.switches=[[12*w.map.width+10,22,2,0,3]];
 ddTiles(w,r);ddTiles(w,r);assert.equal(r.dd!.notices?.length,1);assert.match(r.dd!.notices![0].text,/無限ジャンプ ON/);assert.equal(w.dd!.switches[2].until,151);w.tick=151;ddTick(w);assert.equal(w.dd!.switches[2].on,false);
});
function peer(h:HostHub,name:string,host=false){const got:ServerMsg[]=[];const l:Link={send:m=>got.push(structuredClone(m)),close:()=>{},onMessage:()=>{},onClose:()=>{}};h.connect(l,host);l.onMessage({t:'hello',name,guest:true,resumeToken:(host?'a':'b').repeat(36)});return {got,say:(m:ClientMsg)=>l.onMessage(m)};}
test('waiting playground has four abilities, three balls, and survives room save and course transitions',()=>{
 const map=waitingMap();assert.equal(map.width,80);assert.equal(map.height,30);assert.equal(map.tiles.join('').split('o').length-1,3);for(const c of ['V','N','P','G'])assert.ok(map.tiles.join('').includes(c));
 const h=new HostHub('test','room'),a=peer(h,'主',true),b=peer(h,'友達');assert.equal(h.games.size,0);assert.equal([...h.members][0].game?.mode,'lobby');h.tick();
 const saved=h.save(),restored=new HostHub('test','room');restored.restore(saved);assert.equal(restored.save().lobby?.world.balls.length,3);
 a.say({t:'courseJoin',map:{...newCourseMap(),id:'user-123456789012345678'}});a.say({t:'roomStart'});assert.equal(h.games.size,1);assert.equal([...h.games][0].size,2);
 b.say({t:'leaveGame'});assert.equal([...h.members][1].game?.mode,'lobby');b.say({t:'roomResume'});assert.equal([...h.games][0].size,2);a.say({t:'roomStop'});assert.equal(h.games.size,0);assert.ok([...h.members].every(c=>c.game?.mode==='lobby'));
});

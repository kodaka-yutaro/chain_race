import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCourseMap,validateCourseMap} from '../shared/courses';
import {createWorld,newRunner,stepWorld,emptyInput,wordCollision,type World} from '../shared/physics';
import {abilityInput,bodyBounds,metalPart,metalOverlap,recoverBicycle,stepBalls,hammerBalls} from '../shared/abilities';
import {hammerImpulse} from '../shared/hammer';
import {ddTiles} from '../shared/ddrace';
import {areaKind} from '../client/course-art';
function setup(){const m=newCourseMap(100,30),w=createWorld(m),a=newRunner(1,m),b=newRunner(2,m);a.x=300;a.y=27*32-42;a.ability='bicycle';b.x=360;b.y=27*32-14;w.runners.push(a,b);return {m,w,a,b};}
function tile(w:World,x:number,y:number,c:string){const row=[...w.map.tiles[y]];row[x]=c;w.map.tiles[y]=row.join('');}
function ball(w:World,x:number,y:number,vx=0,vy=0){const b={id:0,x,y,vx,vy,homeX:x,homeY:y};w.balls.push(b);return b;}
test('becoming a bicycle checks the other bicycle frame, not only its rider',()=>{
 const {w,a,b}=setup();tile(w,11,26,'V');abilityInput(w,b,emptyInput(),wordCollision(w));assert.equal(b.ability,'basic');b.x=450;tile(w,14,26,'V');abilityInput(w,b,emptyInput(),wordCollision(w));assert.equal(b.ability,'bicycle');assert.equal(metalOverlap(w,b.x-42,b.y-14,84,56,b.id),false);
 b.x=a.x+60;b.y=a.y;recoverBicycle(w,b);assert.equal(metalOverlap(w,b.x-42,b.y-14,84,56,b.id),false);
});
test('bicycle carries a standing rider in either simulation order, without pushing them into walls',()=>{
 for(const reverse of [false,true]){const {w,a,b}=setup();b.x=a.x+25;b.y=a.y-28;if(reverse)w.runners.reverse();const offset=b.x-a.x;
 for(let i=0;i<100;i++)stepWorld(w,new Map([[1,{...emptyInput(),right:true}]]));assert.ok(a.x>800);assert.ok(Math.abs(b.x-a.x-offset)<1);assert.ok(Math.abs(b.y+28-a.y)<1);
 const wallX=Math.floor((b.x+50)/32);for(let y=21;y<=25;y++)tile(w,wallX,y,'#');for(let i=0;i<30;i++)stepWorld(w,new Map([[1,{...emptyInput(),right:true}]]));assert.ok(b.x+14<=wallX*32+.01);
 }
});
test('only the central player catches a bicycle hook, the upper wings and lower frame pass it',()=>{
 for(const aimX of [300,330]){const {w,a,b}=setup();a.x=300;a.y=400;b.x=aimX;b.y=300;b.ability='basic';for(let i=0;i<2;i++)stepWorld(w,new Map([[2,{...emptyInput(),wire:true,aimX:0,aimY:1}]]));assert.equal(b.wireRunner,aimX===300?1:-1);}
});
test('hammer hits balls with player impulse through a diagonal corner; balls cannot cross the wall',()=>{
 const {w,a}=setup();w.runners=[a];a.ability='basic';a.x=304;a.y=304;tile(w,10,9,'#');tile(w,9,10,'#');const b=ball(w,352,352),expected=hammerImpulse(48,48);
 assert.equal(hammerBalls(w,a,319,319),true);assert.equal(b.vx,expected.vx);assert.equal(b.vy,expected.vy);
 for(let i=0;i<12;i++)stepBalls(w,wordCollision(w));assert.ok(b.x-32>=320-.01);assert.ok(b.y-32>=320-.01);

});
test('ball-only portal ignores people and transfers the ball; red colors survive saves',()=>{
 const {m,w,a}=setup();a.ability='basic';a.x=336;a.y=400;m.dd!.tele=[[12*m.width+10,242,7,2],[12*m.width+25,27,7,2]];ddTiles(w,a);assert.equal(a.x,336);const b=ball(w,336,400);stepBalls(w,wordCollision(w));assert.equal(b.x,816);assert.equal(validateCourseMap(m).dd!.tele[0][3],2);assert.equal(areaKind('dd:tele:242:0'),'entrance');
});
test('ball accelerator boosts only balls, preserves travel away from pad, and respects a thin wall',()=>{
 const {m,w,a}=setup();w.runners=[];m.dd!.game=[[12*m.width+10,243,11]];const b=ball(w,336,400);stepBalls(w,wordCollision(w));assert.equal(b.vx,14);for(let i=0;i<8;i++)stepBalls(w,wordCollision(w));assert.equal(b.vx,14);assert.ok(b.x>450);
 for(let y=1;y<27;y++)tile(w,18,y,'#');for(let i=0;i<20;i++)stepBalls(w,wordCollision(w));assert.ok(b.x+32<=18*32+.01);assert.equal(areaKind('dd:game:243:11'),'ball-speed');
 w.runners=[a];a.x=336;a.y=400;a.ability='basic';stepWorld(w,new Map());assert.equal(a.vx,0);
});

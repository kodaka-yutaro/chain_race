import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,newRunner,collidePlayerVelocity,collidePlayerMovement} from '../shared/physics';
import {newCourseMap} from '../shared/courses';
function pair(){const w=createWorld(newCourseMap(40,20)),a=newRunner(1,w.map),b=newRunner(2,w.map);a.x=100;a.y=200;b.x=130;b.y=200;a.vx=a.vy=b.vx=b.vy=0;w.runners=[a,b];return {w,a,b};}
test('DDNet contact response depends on approach velocity, without snapping position',()=>{
 const {w,a}=pair();a.vx=2;collidePlayerVelocity(w,a);assert.ok(Math.abs(a.vx-(-5.0575))<1e-9);assert.equal(a.x,100);assert.equal(a.y,200);
 a.vx=-2;collidePlayerVelocity(w,a);assert.equal(a.vx,-1.7);
 a.vx=0;collidePlayerVelocity(w,a);assert.ok(Math.abs(a.vx-(-3.37875))<1e-9);
});
test('swept circular contact blocks fast crossings but permits leaving an overlap',()=>{
 const {w,a,b}=pair();b.x=150;a.x=200;collidePlayerMovement(w,a,100,200);assert.equal(a.x,122);
 a.x=100;collidePlayerMovement(w,a,145,200);assert.equal(a.x,100);
 a.x=149;collidePlayerMovement(w,a,145,200);assert.equal(a.x,145);
});
test('solo, collision-disabled and ghost states do not block another player',()=>{
 for(const mode of ['solo','noCollision','ghost'] as const){const {w,a,b}=pair();
 if(mode==='ghost')b.ghostBody={x:130,y:200,vx:0,vy:0,stun:0};else b.dd![mode]=true;
 a.vx=2;collidePlayerVelocity(w,a);assert.equal(a.vx,2);
 a.x=200;collidePlayerMovement(w,a,100,200);assert.equal(a.x,200);
 }
});

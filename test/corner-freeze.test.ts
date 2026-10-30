import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,newRunner,stepWorld,intersectLine,emptyInput,WIRE_FLYING} from '../shared/physics';
import {newCourseMap} from '../shared/courses';
import {blankDD} from '../shared/dd-parts';
function world(){const m=newCourseMap();m.tiles=Array.from({length:m.height},()=>'.'.repeat(m.width));return createWorld(m);}
test('legacy and DD normal freeze share edge contact, duration, and thaw',()=>{
 const run=(dd:boolean)=>{const w=world();if(dd){w.map.dd=blankDD();w.map.dd.game=[[2*w.map.width+2,9,0],[2*w.map.width+5,11,0]];Object.assign(w,createWorld(w.map));}else {const rows=w.map.tiles.map(r=>[...r]);rows[2][2]='~';rows[2][5]='U';w.map.tiles=rows.map(r=>r.join(''));}
 const r=newRunner(1,w.map);w.runners=[r];r.x=55;r.y=80;stepWorld(w,new Map());const freeze=r.stun;r.x=120;r.y=80;stepWorld(w,new Map());const leaving=r.stun;r.x=151;r.y=80;stepWorld(w,new Map());return [freeze,leaving,r.stun];};
 assert.deepEqual(run(false),[150,149,0]);assert.deepEqual(run(true),run(false));
});

// Reference algorithm from DDNet CCollision::IntersectLineTeleHook.
function referenceHit(w:ReturnType<typeof world>,x0:number,y0:number,x1:number,y1:number){
 const count=Math.trunc(Math.hypot(x1-x0,y1-y0)+1);
 for(let i=0;i<=count;i++){const f=i/count,x=x0+(x1-x0)*f,y=y0+(y1-y0)*f;
 const tile=w.map.tiles[Math.floor(Math.round(y)/32)]?.[Math.floor(Math.round(x)/32)];
 if(tile==='#'||tile==='X')return {x,y};}
 return null;
}
test('corner hook launch and terrain contact match DDNet across positions and angles',()=>{
 for(const sx of [-1,1])for(const sy of [-1,1])for(const distance of [14,14.8,15,24,40])for(const offset of [-44,-40,-30,-20,0,20,30,40,44]){
 const w=world(),rows=w.map.tiles.map(r=>[...r]);const same=sx===sy;
 rows[4][same?5:4]='#';rows[5][same?4:5]='X';w.map.tiles=rows.map(r=>r.join(''));
 const r=newRunner(1,w.map);r.x=160-sx*distance;r.y=160-sy*distance;w.runners=[r];
 const angle=Math.atan2(sy,sx)+offset*Math.PI/180,dx=Math.cos(angle),dy=Math.sin(angle);
 const x0=r.x+dx*42,y0=r.y+dy*42,x1=x0+dx*80,y1=y0+dy*80;
 const expected=referenceHit(w,x0,y0,x1,y1);
 stepWorld(w,new Map([[r.id,{...emptyInput(),wire:true,aimX:dx,aimY:dy}]]));
 assert.equal(r.wireState===WIRE_FLYING,!expected,`${sx},${sy},${distance},${offset}`);
 if(!expected){assert.ok(Math.abs(r.wireX-x1)<1e-8);assert.ok(Math.abs(r.wireY-y1)<1e-8);}
 }
});
test('terrain ray uses DDNet pixel rounding, including narrow corner contacts and solid walls',()=>{
 const w=world(),rows=w.map.tiles.map(r=>[...r]);rows[4][4]='#';rows[5][5]='#';w.map.tiles=rows.map(r=>r.join(''));
 for(const delta of [-1,-.51,-.49,0,.49,.51,1]){
 const args:[number,number,number,number]=[144,176+delta,176,144+delta];
 const expected=referenceHit(w,...args),actual=intersectLine(w,...args);
 assert.equal(actual.hit,!!expected);if(expected){assert.equal(actual.x,expected.x);assert.equal(actual.y,expected.y);}
 }
 assert.equal(intersectLine(w,120,144,180,144).hit,true);
});

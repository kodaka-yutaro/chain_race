import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,newRunner,stepWorld,intersectLine,emptyInput,WIRE_FLYING} from '../shared/physics';
import {newCourseMap} from '../shared/courses';
import {blankDD} from '../shared/dd-parts';
function world(){const m=newCourseMap();m.tiles=Array.from({length:m.height},()=>'.'.repeat(m.width));return createWorld(m);}
test('diagonal corners pass in both directions, but tile faces still block',()=>{
 for(const flip of [false,true])for(const material of ['#','X']){
 const w=world();const rows=w.map.tiles.map(r=>[...r]);rows[2][flip?3:2]=material;rows[3][flip?2:3]=material;w.map.tiles=rows.map(r=>r.join(''));
 const a=flip?[80,80]:[80,112],b=flip?[112,112]:[112,80];
 assert.equal(intersectLine(w,...a as [number,number],...b as [number,number]).hit,false);
 assert.equal(intersectLine(w,...b as [number,number],...a as [number,number]).hit,false);
 assert.equal(intersectLine(w,48,80,120,80).hit,true);
 }
 const w=world();w.map.tiles[2]='.'.repeat(2)+'##'+'.'.repeat(w.map.width-4);
 assert.equal(intersectLine(w,96,48,96,112).hit,true);
});
test('legacy and DD normal freeze share edge contact, duration, and thaw',()=>{
 const run=(dd:boolean)=>{const w=world();if(dd){w.map.dd=blankDD();w.map.dd.game=[[2*w.map.width+2,9,0],[2*w.map.width+5,11,0]];Object.assign(w,createWorld(w.map));}else {const rows=w.map.tiles.map(r=>[...r]);rows[2][2]='~';rows[2][5]='U';w.map.tiles=rows.map(r=>r.join(''));}
 const r=newRunner(1,w.map);w.runners=[r];r.x=55;r.y=80;stepWorld(w,new Map());const freeze=r.stun;r.x=120;r.y=80;stepWorld(w,new Map());const leaving=r.stun;r.x=151;r.y=80;stepWorld(w,new Map());return [freeze,leaving,r.stun];};
 assert.deepEqual(run(false),[150,149,0]);assert.deepEqual(run(true),run(false));
});

test('touching diagonal gaps permits +/-40 degrees in all four orientations',()=>{
 for(const sx of [-1,1])for(const sy of [-1,1])for(const offset of [-40,-30,0,30,40]){
 const w=world(),rows=w.map.tiles.map(r=>[...r]);const same=sx===sy;
 rows[2][same?3:2]='#';rows[3][same?2:3]='X';w.map.tiles=rows.map(r=>r.join(''));
 const r=newRunner(1,w.map);r.x=96-sx*14;r.y=96-sy*14;w.runners=[r];
 const angle=Math.atan2(sy,sx)+offset*Math.PI/180;
 stepWorld(w,new Map([[r.id,{...emptyInput(),wire:true,aimX:Math.cos(angle),aimY:Math.sin(angle)}]]));
 assert.equal(r.wireState,WIRE_FLYING,`${sx},${sy},${offset}`);
 assert.ok((r.wireX-96)*sx>0&&(r.wireY-96)*sy>0);
 }
});
test('corner assistance does not bypass walls from afar or outside the aiming fan',()=>{
 for(const distance of [14,24])for(const degrees of [0,4,86,90]){
 const w=world(),rows=w.map.tiles.map(r=>[...r]);rows[2][3]='#';rows[3][2]='#';w.map.tiles=rows.map(r=>r.join(''));
 const r=newRunner(1,w.map);r.x=96-distance;r.y=96-distance;w.runners=[r];
 const angle=degrees*Math.PI/180;
 stepWorld(w,new Map([[r.id,{...emptyInput(),wire:true,aimX:Math.cos(angle),aimY:Math.sin(angle)}]]));
 assert.notEqual(r.wireState,WIRE_FLYING);
 }
});

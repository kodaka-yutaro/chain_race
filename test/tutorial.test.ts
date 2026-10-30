import {test} from 'node:test';
import assert from 'node:assert/strict';
import raw from '../shared/tutorial-course.json';
import {validateCourseMap,validateCoursePreview} from '../shared/courses';
test('tutorial keeps seven ordered signs across publication and preview, removes only placeholder tiles',()=>{
 const m=validateCourseMap(JSON.parse(JSON.stringify(raw)));assert.equal(m.hints.length,7);assert.equal(m.background,'tutorial');
 assert.deepEqual(m.hints.map(h=>h.x),[14,43,85,110,127,151,172]);assert.ok(!m.dd!.game.some(r=>r[1]===145));
 assert.equal(m.dd!.tele.length,24);assert.deepEqual(validateCoursePreview(m).hints,m.hints);
 assert.throws(()=>validateCourseMap({...raw,hints:[{x:NaN,y:0,text:'bad'}]}));
 assert.throws(()=>validateCourseMap({...raw,hints:[{x:1,y:0,text:123}]}));
});


import {BUILTIN_COURSES,isBuiltinCourse} from '../shared/builtin-courses';
import {HostHub,type Link} from '../client/host/hub';
import type {ServerMsg} from '../shared/protocol';
test('Basic Class is released, has the requested signs and upbeat music, and starts in a room',()=>{
 const c=BUILTIN_COURSES[0];assert.equal(c.status,'released');assert.equal(c.firstClear,undefined);assert.equal(c.map.name,'Basic Class');assert.equal(c.map.music,'autumn');assert.ok(isBuiltinCourse(c.id));
 assert.equal(c.map.hints[3].text,'赤ボールもフックで\n右クリックでボールをつかもう\n引き寄せられて上にいけるよ');
 assert.ok(!c.map.hints[6].text.includes('帰還先も移る'));assert.match(c.id,/^user-[a-f0-9]{18}$/);
 const hub=new HostHub('basic-class','test'),got:ServerMsg[]=[];
 const link:Link={send:m=>got.push(m),close:()=>{},onMessage:()=>{},onClose:()=>{}};hub.connect(link,true);link.onMessage({t:'hello',name:'主',guest:true});
 link.onMessage({t:'courseJoin',map:c.map});link.onMessage({t:'roomStart'});
 const start=got.filter(m=>m.t==='gameStart').find(m=>m.mode!=='lobby');assert.equal(start?.map?.name,'Basic Class');assert.equal(start?.map?.music,'autumn');assert.deepEqual(start?.map?.hints,c.map.hints);
});

// Include the signboard and its post, not only the anchor tile.
test('Basic Class signs do not cover terrain, items or DD parts',()=>{
 const occupied=new Set<number>();
 raw.tiles.forEach((row,y)=>[...row].forEach((c,x)=>{if(c!=='.')occupied.add(y*raw.width+x);}));
 for(const key of ['game','front','tele','speed','switches','entities'] as const)for(const r of raw.dd?.[key]??[])occupied.add(r[0]);
 for(const h of raw.hints){const x=h.x*32+16-186,y=h.y*32-20,height=64+Math.max(1,h.text.split('\n').length-1)*26+22;
  for(let cy=Math.floor(y/32);cy<Math.ceil((y+height)/32);cy++)for(let cx=Math.floor(x/32);cx<Math.ceil((x+372)/32);cx++)assert.ok(!occupied.has(cy*raw.width+cx),`${h.text.split('\n')[0]} covers ${cx},${cy}`);
 }
});

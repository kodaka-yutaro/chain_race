import {test} from 'node:test';
import assert from 'node:assert/strict';
import raw from '../shared/tutorial-course.json';
import {validateCourseMap,validateCoursePreview} from '../shared/courses';
test('tutorial keeps seven ordered signs across publication and preview, removes only placeholder tiles',()=>{
 const m=validateCourseMap(JSON.parse(JSON.stringify(raw)));assert.equal(m.hints.length,7);assert.equal(m.background,'tutorial');
 assert.deepEqual(m.hints.map(h=>h.x),[14,43,85,109,127,151,172]);assert.ok(!m.dd!.game.some(r=>r[1]===145));
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
 const start=got.find(m=>m.t==='gameStart');assert.equal(start?.map?.name,'Basic Class');assert.equal(start?.map?.music,'autumn');assert.deepEqual(start?.map?.hints,c.map.hints);
});

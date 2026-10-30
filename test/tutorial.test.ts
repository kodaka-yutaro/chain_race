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


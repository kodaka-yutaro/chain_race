import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localBackend} from '../client/net/local';
import {newCourseMap} from '../shared/courses';
function storage(){const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)};}
test('プレリリースはログイン必須で、初クリア者は後から上書きされない',async()=>{
 Object.defineProperty(globalThis,'localStorage',{value:storage(),configurable:true});
 Object.defineProperty(globalThis,'sessionStorage',{value:storage(),configurable:true});
 Object.defineProperty(globalThis,'BroadcastChannel',{value:class {addEventListener(){} removeEventListener(){} postMessage(){}},configurable:true});
 const b=localBackend();await assert.rejects(b.publishCourse(newCourseMap(),'偽名'));
 await b.register('作者','test-only');const c=await b.publishCourse(newCourseMap(),'作者');assert.equal(c.status,'prerelease');
 await b.guest();await assert.rejects(b.releaseCourse(c.id,[{id:1,name:'ゲスト',time:2}]));
 await b.register('最初の人','test-only');assert.equal(await b.releaseCourse(c.id,[{id:1,name:'別名',time:3}]),'最初の人');
 await b.register('次の人','test-only');assert.equal(await b.releaseCourse(c.id,[{id:2,name:'次の人',time:1}]),'最初の人');
 const saved=(await b.listCourses())[0];assert.deepEqual(saved.firstClear?.names,['最初の人']);assert.equal(saved.firstClear?.time,3);
 await assert.rejects(b.releaseCourse(c.id,[{id:1,name:'次の人',time:NaN}]));
});

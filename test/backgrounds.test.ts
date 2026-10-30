import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BACKGROUNDS,backgroundId} from '../shared/backgrounds';
import {newCourseMap,validateCourseMap,validateCoursePreview} from '../shared/courses';
import {HostHub,type Link} from '../client/host/hub';
import type {ServerMsg} from '../shared/protocol';
test('11種類の背景がJSON保存・公開検証・テスト用コピーに残る',()=>{
 assert.equal(BACKGROUNDS.length,11);assert.equal(new Set(BACKGROUNDS.map(b=>b[0])).size,11);
 for(const [background] of BACKGROUNDS){const m=JSON.parse(JSON.stringify({...newCourseMap(),background}));assert.equal(validateCourseMap(m).background,background);assert.equal(validateCoursePreview(m).background,background);}
 assert.equal(validateCourseMap({...newCourseMap(),background:undefined}).background,'dusk');assert.equal(backgroundId('invalid'),'dusk');
});
test('ホストが選んだ背景が参加者にも送られる',()=>{
 const hub=new HostHub('background','test'),got:ServerMsg[]=[];
 const link:Link={send:m=>got.push(m),close:()=>{},onMessage:()=>{},onClose:()=>{}};hub.connect(link,true);link.onMessage({t:'hello',name:'主',guest:true});
 link.onMessage({t:'courseJoin',map:{...newCourseMap(),id:'user-123456789012345678',background:'spirals'}});link.onMessage({t:'roomStart'});
 assert.equal(got.filter(m=>m.t==='gameStart').find(m=>m.mode!=='lobby')?.map?.background,'spirals');
});

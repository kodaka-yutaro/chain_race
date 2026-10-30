import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MUSIC,composeMusic,musicId} from '../shared/music';
import {newCourseMap,validateCourseMap,validateCoursePreview} from '../shared/courses';
import {HostHub,type Link} from '../client/host/hub';
import type {ServerMsg} from '../shared/protocol';

test('course music survives save/import, preview and publication; old maps remain silent',()=>{
 for(const [music] of MUSIC){const m=JSON.parse(JSON.stringify({...newCourseMap(),music}));assert.equal(validateCourseMap(m).music,music);assert.equal(validateCoursePreview(m).music,music);}
 assert.equal(musicId('https://untrusted.invalid/audio'),'none');assert.equal(musicId({}),'none');
 assert.equal(validateCourseMap({...newCourseMap(),music:undefined}).music,'none');
});
test('host sends selected music with course to participants',()=>{
 const hub=new HostHub('music','test'),got:ServerMsg[]=[];
 const link:Link={send:m=>got.push(m),close:()=>{},onMessage:()=>{},onClose:()=>{}};hub.connect(link,true);link.onMessage({t:'hello',name:'主',guest:true});
 link.onMessage({t:'courseJoin',map:{...newCourseMap(),id:'user-123456789012345678',music:'jazz'}});link.onMessage({t:'roomStart'});
 assert.equal(got.find(m=>m.t==='gameStart')?.map?.music,'jazz');
});
test('eight original arrangements contain finite, ordered notes and distinct motifs',()=>{
 const fingerprints=new Set<string>();
 for(const [id] of MUSIC){const score=composeMusic(id);if(id==='none'){assert.equal(score.notes.length,0);continue;}
  assert.ok(score.notes.length>100);assert.ok(score.bpm>=60&&score.bpm<=180);
  score.notes.forEach((n,i)=>{assert.ok(n.beat>=0&&n.beat<score.beats);assert.ok(n.duration>0);assert.ok(Number.isFinite(n.pitch)&&n.pitch>0&&n.pitch<128);assert.ok(n.gain>0&&n.gain<=.3);assert.ok(n.pan>=-1&&n.pan<=1);if(i)assert.ok(n.beat>=score.notes[i-1].beat);});
  fingerprints.add(JSON.stringify(score));assert.deepEqual(composeMusic(id),score);
 }
 assert.equal(fingerprints.size,8);
});

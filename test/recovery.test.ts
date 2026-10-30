import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HostHub,type Link} from '../client/host/hub';
import {newCourseMap} from '../shared/courses';
import {emptyInput} from '../shared/physics';
import type {ClientMsg,ServerMsg} from '../shared/protocol';
import {readRecovery,writeRecovery,type Recovery} from '../client/net/recovery';
function peer(h:HostHub,token:string,host=false){
 const got:ServerMsg[]=[];const l:Link={send:m=>got.push(structuredClone(m)),close:()=>l.onClose(),onMessage:()=>{},onClose:()=>{}};
 h.connect(l,host);l.onMessage({t:'hello',name:host?'主':'友達',guest:true,resumeToken:token});
 return {got,say:(m:ClientMsg)=>l.onMessage(m),drop:()=>l.onClose()};
}
const aToken='a'.repeat(36),bToken='b'.repeat(36);
function setup(){const h=new HostHub('room','部屋'),a=peer(h,aToken,true),b=peer(h,bToken);
 a.say({t:'courseJoin',map:{...newCourseMap(),id:'user-123456789012345678'}});a.say({t:'roomStart',withDummy:true});
 return {h,a,b,g:[...h.games][0]};}
test('参加者の再読み込みは世界を一時停止し、同じID・位置・ダミーを復元する',()=>{
 const {h,a,b,g}=setup();g.world.runners[1].x=500;g.world.runners[1].raceStart=20;g.world.tick=500;
 b.say({t:'dummy',action:'add'});b.say({t:'dummy',action:'switch'});
 const before=structuredClone(g.world);b.drop();for(let i=0;i<10;i++)h.tick();assert.deepEqual(g.world,before);
 const resumed=peer(h,bToken);assert.equal(g.size,2);assert.equal(h.members.size,2);assert.equal(resumed.got.find(m=>m.t==='welcome')?.you.id,2);
 assert.equal(resumed.got.find(m=>m.t==='dummyState')?.activeId,1000002);
 assert.equal(resumed.got.find(m=>m.t==='control')?.runner.id,1000002);
 assert.deepEqual(g.world,before);h.tick();assert.equal(g.world.tick,501);
 a.say({t:'roomStop'});assert.equal(h.games.size,0);
});
test('ホスト保存をJSON往復して全員再接続後に同じ世界から再開する',()=>{
 const {h,g}=setup();g.world.tick=450;g.world.runners[0].x=500;g.world.runners[0].raceStart=20;
 g.world.doorsOpen[0]=true;g.world.timers[0]=100;g.world.pickups[2]=999;
 const snapshot=JSON.parse(JSON.stringify(h.save()));
 const restored=new HostHub('room','部屋');restored.restore(snapshot);
 const a=peer(restored,aToken,true),rg=[...restored.games][0];restored.tick();assert.deepEqual(rg.world,g.world);
 const b=peer(restored,bToken);assert.equal(restored.members.size,2);assert.deepEqual(rg.world,g.world);
 assert.equal(a.got.find(m=>m.t==='dummyState')?.dummyId,1000001);
 b.say({t:'input',gameId:rg.id,list:[{seq:1,input:emptyInput()}]});restored.tick();assert.equal(rg.world.tick,451);
});
test('古い接続の遅延切断や入力は再接続したキャラクターに作用しない',()=>{
 const {h,b,g}=setup();const resumed=peer(h,bToken);b.drop();
 b.say({t:'bye'});h.tick();assert.equal(g.world.tick,1);assert.equal(g.size,2);
 resumed.say({t:'bye'});assert.equal(g.size,1);assert.equal(h.members.size,1);
});
test('再接続猶予が切れた参加者は削除される',()=>{
 const {h,b,g}=setup();b.drop();const now=Date.now;Date.now=()=>now()+121000;
 try{h.tick();assert.equal(g.size,1);assert.equal(g.world.tick,1);}finally{Date.now=now;}
});
test('別のトークンやホスト権限では既存キャラクターを引き継げない',()=>{
 const {h,g}=setup();peer(h,aToken,false);assert.equal(g.size,2);
 const extra=peer(h,'c'.repeat(36));assert.equal(extra.got.find(m=>m.t==='welcome')?.you.id,4);
});
test('破損・旧形式・期限切れ・保存容量不足に対応する',()=>{
 const r:Recovery={version:1,at:Date.now(),hubId:'a'.repeat(18),hostId:'b'.repeat(18),hubName:'部屋',isHost:false,token:aToken,profile:{name:'主',guest:true}};
 let value='';const storage={getItem:()=>value,setItem:(_:string,v:string)=>{value=v;}};
 assert.equal(writeRecovery(r,storage),true);assert.equal(readRecovery(storage)?.token,aToken);
 for(const bad of ['broken','null',JSON.stringify({...r,version:0}),JSON.stringify({...r,at:0})]){value=bad;assert.equal(readRecovery(storage),null);}
 assert.equal(writeRecovery(r,{setItem:()=>{throw Error('quota');}}),false);
});

test('pagehide通知で即座に止まり、部屋の選択状態も復元される',()=>{
 const {h,b,g}=setup();b.say({t:'suspend'});h.tick();assert.equal(g.world.tick,0);
 peer(h,bToken);h.tick();assert.equal(g.world.tick,1);
 const restored=new HostHub('room','部屋');restored.restore(JSON.parse(JSON.stringify(h.save())));
 const a=peer(restored,aToken,true);peer(restored,bToken);
 a.say({t:'roomStop'});a.say({t:'roomStart'});assert.equal(restored.games.size,1);
 assert.equal([...restored.games][0].stageId,'user-123456789012345678');
});

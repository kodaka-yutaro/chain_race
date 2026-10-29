import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HostHub,type Link} from '../client/host/hub';
import {emptyInput} from '../shared/physics';
import {newCourseMap} from '../shared/courses';
import {defaultFace} from '../shared/face';
import type {ClientMsg,ServerMsg} from '../shared/protocol';
function peer(h:HostHub,name:string,host=false){const got:ServerMsg[]=[];const l:Link={send:m=>got.push(structuredClone(m)),close:()=>l.onClose(),onMessage:()=>{},onClose:()=>{}};h.connect(l,host);l.onMessage({t:'hello',name,guest:true,face:defaultFace()});return {got,say:(m:ClientMsg)=>l.onMessage(m),drop:()=>l.onClose()};}
function setup(){const h=new HostHub('dummy','test'),a=peer(h,'主',true);a.say({t:'roomStart'});return {h,a,g:[...h.games][0]};}
function state(a:ReturnType<typeof peer>){return a.got.filter(m=>m.t==='dummyState').at(-1)!;}
test('ダミーは1人1体で専用の顔と名前を共有し、部屋の人間の人数は増やさない',()=>{
 const {h,a,g}=setup(),b=peer(h,'友');const face='2'.repeat(576);
 a.say({t:'dummy',action:'add',face});const id=state(a).dummyId!;a.say({t:'dummy',action:'add',face});
 assert.equal(g.world.runners.length,3);assert.equal(h.members.size,2);assert.equal(g.names()[id],'主 のダミー');assert.equal(g.faces()[id],face);
 a.say({t:'dummy',action:'configure',face:'3'.repeat(576)});assert.equal(b.got.filter(m=>m.t==='names').at(-1)!.faces![id],'3'.repeat(576));
 a.say({t:'dummy',action:'configure',face:'bad'});assert.equal(g.faces()[id],'3'.repeat(576));
 b.say({t:'dummy',action:'switch'});assert.equal(state(b).activeId,2);
});
test('切替後はダミーだけが移動し、遅れて届く本体の入力を捨てる',()=>{
 const {h,a,g}=setup();a.say({t:'dummy',action:'add'});const id=state(a).dummyId!,body=g.world.runners[0],dummy=g.world.runners[1];body.x=250;dummy.x=400;
 a.say({t:'dummy',action:'switch'});assert.equal(state(a).activeId,id);
 a.say({t:'input',gameId:g.id,controlledId:1,list:[{seq:1,input:{...emptyInput(),kill:true}}]});
 for(let seq=2;seq<12;seq++){a.say({t:'input',gameId:g.id,controlledId:id,list:[{seq,input:{...emptyInput(),right:true}}]});h.tick();}
 assert.equal(body.x,250);assert.ok(dummy.x>400);const snap=a.got.filter(m=>m.t==='snap').at(-1)!;assert.equal(snap.me!.id,id);assert.ok(snap.others.some(r=>r.id===1));
 a.say({t:'dummy',action:'remove'});assert.equal(state(a).activeId,1);assert.equal(g.world.runners.length,1);
});
test('ダミーは仲間と同様にフック・ハンマーの対象になり、同時操作もできる',()=>{
 const {h,a,g}=setup();a.say({t:'dummy',action:'add'});const id=state(a).dummyId!,body=g.world.runners[0],dummy=g.world.runners[1];body.x=200;dummy.x=270;body.y=dummy.y=500;
 a.say({t:'input',gameId:g.id,controlledId:1,list:[{seq:1,input:{...emptyInput(),wire:true,aimX:100,aimY:0}}]});for(let i=0;i<6;i++)h.tick();assert.equal(body.wireRunner,id);
 body.x=200;dummy.x=235;body.y=dummy.y=500;dummy.vx=dummy.vy=0;
 a.say({t:'input',gameId:g.id,controlledId:1,list:[{seq:2,input:{...emptyInput(),fire:true,aimX:100}}]});h.tick();assert.ok(dummy.vx>0);
 body.x=300;dummy.x=500;body.vx=dummy.vx=0;a.say({t:'dummy',action:'configure',copy:true});
 a.say({t:'input',gameId:g.id,controlledId:1,list:[{seq:3,input:{...emptyInput(),right:true}}]});for(let i=0;i<5;i++)h.tick();assert.ok(body.x>300&&dummy.x>500);
});
test('ダミーと開始すれば1人でも2人用コースを動かせる',()=>{
 const h=new HostHub('dummy','test'),a=peer(h,'主',true);a.say({t:'courseJoin',map:{...newCourseMap(),id:'user-123456789012345678',minPlayers:2}});a.say({t:'roomStart',withDummy:true});const g=[...h.games][0];assert.equal(g.world.runners.length,2);h.tick();h.tick();assert.equal(a.got.filter(m=>m.t==='snap').at(-1)!.waiting,false);
 for(const r of g.world.runners)r.finishedTime=10;h.tick();assert.equal(a.got.filter(m=>m.t==='partyClear').at(-1)!.assisted,true);
});
test('持ち主の切断でダミーも消え、残った仲間のフックを解除する',()=>{
 const {h,a,g}=setup(),b=peer(h,'友');a.say({t:'dummy',action:'add'});const id=state(a).dummyId!,other=g.world.runners.find(r=>r.id===2)!;other.wireState=2;other.wireRunner=id;a.drop();assert.deepEqual(g.world.runners.map(r=>r.id),[2]);assert.equal(other.wireState,0);assert.equal(h.members.size,1);assert.ok(b.got.length);
});

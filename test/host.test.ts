import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HostHub, type Link } from '../client/host/hub';
import { emptyInput,findSpawn } from '../shared/physics';
import { defaultFace } from '../shared/face';
import { newCourseMap } from '../shared/courses';
import type { ClientMsg, ServerMsg } from '../shared/protocol';
function peer(h:HostHub,name:string,host=false){const got:ServerMsg[]=[];const l:Link={send:m=>got.push(structuredClone(m)),close:()=>l.onClose(),onMessage:()=>{},onClose:()=>{}};h.connect(l,host);l.onMessage({t:'hello',name,guest:true,face:defaultFace()});return {got,say:(m:ClientMsg)=>l.onMessage(m),drop:()=>l.onClose()};}
test('ホストだけが選択と開始を行い、全員が同じ世界と顔を受け取る',()=>{
 const h=new HostHub('test','部屋'),a=peer(h,'主',true),b=peer(h,'友達');
 assert.equal(h.games.size,0);b.say({t:'roomStart'});assert.equal(h.games.size,0);
 a.say({t:'roomStart'});assert.equal(h.games.size,0);a.say({t:'courseJoin',map:{...newCourseMap(),id:'user-123456789012345678'}});a.say({t:'roomStart'});const sa=a.got.filter(m=>m.t==='gameStart').find(m=>m.mode!=='lobby')!,sb=b.got.filter(m=>m.t==='gameStart').find(m=>m.mode!=='lobby')!;
 assert.equal(sa.gameId,sb.gameId);assert.equal([...h.games][0].size,2);assert.equal(sb.faces?.[1],defaultFace());
 b.say({t:'roomStop'});assert.equal(h.games.size,1);a.say({t:'roomStop'});assert.equal(h.games.size,0);
 assert.equal(b.got.filter(m=>m.t==='hubState').at(-1)!.hub.playing,false);
});
test('必要人数に満たない場合は開始せず、ホストが開始した部屋には後から合流できる',()=>{
 const h=new HostHub('test','部屋'),a=peer(h,'主',true);a.say({t:'courseJoin',map:{...newCourseMap(),minPlayers:2,id:'user-123456789012345678'}});a.say({t:'roomStart'});assert.equal(h.games.size,0);
 const b=peer(h,'友達');a.say({t:'roomStart'});const c=peer(h,'追加');assert.equal([...h.games][0].size,3);assert.ok(c.got.some(m=>m.t==='gameStart'&&m.mode!=='lobby'));
 b.say({t:'leaveGame'});assert.equal([...h.games][0].size,2);b.say({t:'roomResume'});assert.equal([...h.games][0].size,3);
});
test('遅延した入力からのリスポーンは一度だけ実行し、相手を移動させない',()=>{
 const h=new HostHub('test','部屋'),a=peer(h,'主',true),b=peer(h,'友達');a.say({t:'courseJoin',map:{...newCourseMap(),id:'user-123456789012345678'}});a.say({t:'roomStart'});const g=[...h.games][0],r=g.world.runners[0],o=g.world.runners[1];r.x=500;o.x=650;
 a.say({t:'input',gameId:g.id,list:[{seq:1,input:{...emptyInput(),kill:true}}]});
 for(let seq=2;seq<15;seq++)a.say({t:'input',gameId:g.id,list:[{seq,input:emptyInput()}]});h.tick();assert.equal(r.x,findSpawn(g.world.map).x);assert.equal(o.x,650);
 for(let seq=15;seq<40;seq++){a.say({t:'input',gameId:g.id,list:[{seq,input:{...emptyInput(),right:true}}]});h.tick();}assert.ok(r.x>findSpawn(g.world.map).x+30);
});
test('満員と不正な名前を拒否し、切断したメンバーを一覧から外す',()=>{
 const h=new HostHub('test','部屋');peer(h,'主',true);for(let i=0;i<15;i++)peer(h,'人'+i);const extra=peer(h,'満員');assert.equal(h.members.size,16);assert.ok(extra.got.some(m=>m.t==='error'));peer(h,'<bad>');assert.equal(h.members.size,16);
});

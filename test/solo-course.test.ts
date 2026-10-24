import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapById } from '../shared/maps';
import { createWorld, newRunner, emptyInput, stepWorld, tileAt } from '../shared/physics';
import { HostHub, type Link } from '../client/host/hub';
import type { ServerMsg } from '../shared/protocol';

test('ひとり旅は1人の移動・二段ジャンプだけでも出発からゴールまで通れる',()=>{
  const map=mapById('solo-chinatown')!,w=createWorld(map),r=newRunner(1,map);w.runners.push(r);
  assert.ok(map.solo);assert.equal(map.minPlayers,1);
  let jumpedAt=-100;
  for(let i=0;i<1600&&r.finishedTime<0;i++){
    const ahead=tileAt(map,Math.floor((r.x+50)/32),Math.floor(r.y/32));
    const takeoff=r.grounded&&'#X'.includes(ahead);
    if(takeoff)jumpedAt=i;
    const ev=stepWorld(w,new Map([[1,{...emptyInput(),right:true,jump:takeoff||i-jumpedAt===18}]]));
    assert.equal(ev.killed.length,0);
  }
  assert.ok(r.finishedTime>0,`x=${r.x}, y=${r.y}`);
});

test('同じ1人用コースを選んだ2人は別々の世界へ入り、待たずに動ける',()=>{
  const hub=new HostHub('solo-test','1人用');
  function peer(name:string){
    const got:ServerMsg[]=[];
    const link:Link={send:m=>got.push(structuredClone(m)),close:()=>{},onMessage:()=>{},onClose:()=>{}};
    hub.connect(link);link.onMessage({t:'hello',name,guest:true});link.onMessage({t:'stageJoin',stageId:'solo-chinatown'});
    const start=got.filter(m=>m.t==='gameStart').at(-1)!;
    return {link,got,start};
  }
  const a=peer('赤'),b=peer('青');assert.notEqual(a.start.gameId,b.start.gameId);
  const ga=[...hub.games].find(g=>g.id===a.start.gameId)!,gb=[...hub.games].find(g=>g.id===b.start.gameId)!;
  const x=ga.world.runners[0].x;
  for(let seq=1;seq<=20;seq++){
    a.link.onMessage({t:'input',gameId:ga.id,list:[{seq,input:{...emptyInput(),right:true}}]});hub.tick();
  }
  assert.equal(ga.size,1);assert.equal(gb.size,1);assert.ok(ga.world.runners[0].x>x+60);assert.equal(gb.world.runners[0].x,x);
  assert.equal(a.got.filter(m=>m.t==='snap').filter(m=>m.gameId===ga.id).at(-1)!.others.length,0);
  a.link.onMessage({t:'leaveGame'});assert.ok(!hub.games.has(ga));assert.ok(hub.games.has(gb));
});

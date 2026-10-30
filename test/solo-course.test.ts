import { test } from 'node:test';
import assert from 'node:assert/strict';
import {mapById} from '../shared/legacy-maps';
import {registerCourse} from '../shared/maps';
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

test('1人から開始できるコースでも部屋の全員が同じ世界で遊ぶ',()=>{
 const h=new HostHub('solo','部屋');const messages:ServerMsg[][]=[];const links:Link[]=[];
 for(let i=0;i<2;i++){const got:ServerMsg[]=[];messages.push(got);const l:Link={send:m=>got.push(m),close:()=>{},onMessage:()=>{},onClose:()=>{}};links.push(l);h.connect(l,i===0);l.onMessage({t:'hello',name:'人'+i,guest:true});}
 registerCourse(mapById('solo-chinatown')!);links[0].onMessage({t:'stageJoin',stageId:'solo-chinatown'});links[0].onMessage({t:'roomStart'});assert.equal(h.games.size,1);assert.equal([...h.games][0].size,2);
});

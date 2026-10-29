import { test } from 'node:test';
import { DD_PARTS } from '../shared/dd-parts';

test('DDパーツの全分類を保存して再読込でき、不正な行は拒否する',()=>{
  const m=newCourseMap(40,30);
  for(const [i,p] of DD_PARTS.entries()){
    const idx=200+i, row=p.layer==='doors'?[320,320,1,0,32,1]:p.layer==='switches'?[idx,p.type,1,0,3]:p.layer==='speed'?[idx,2,50,0]:p.layer==='entities'?[idx,p.type,1,0,2]:[idx,p.type,p.flags??1];
    (m.dd![p.layer]??=[]).push(row);
  }
  assert.deepEqual(validateCourseMap(JSON.parse(JSON.stringify(m))).dd,m.dd);
  m.dd!.tele=[[]];assert.throws(()=>validateCourseMap(m));
  m.dd!.tele=[];m.dd!.doors=[[1,1,0,0,32,1]];assert.throws(()=>validateCourseMap(m));
});
import assert from 'node:assert/strict';
import { canRelease, newCourseMap, validateCourseMap, validateCoursePreview } from '../shared/courses';
import { HostHub, type Link } from '../client/host/hub';
import { createWorld, emptyInput, newRunner, stepWorld, TILE } from '../shared/physics';
import type { ClientMsg, ServerMsg } from '../shared/protocol';

function peer(hub: HostHub, name: string) {
  const messages: ServerMsg[] = [];
  const link: Link = { send: m => messages.push(m), close: () => link.onClose(), onMessage: () => {}, onClose: () => {} };
  hub.connect(link, hub.members.size===0);
  const send = (m: ClientMsg) => link.onMessage(m);
  send({ t: 'hello', name, guest: true });
  return { messages, send, drop: () => link.onClose() };
}
const latest = (messages: ServerMsg[]) => messages.filter(m => m.t === 'gameStart').at(-1)!;
const map = () => ({ ...validateCourseMap(newCourseMap(24, 16)), minPlayers:2, id: 'user-0123456789abcdef01' });

test('制作途中のコースは出現地点だけで1人テストでき、元の下書きを変更しない',()=>{
 const m=map();m.name='';m.minPlayers=8;m.tiles=m.tiles.map(row=>row.replaceAll('>','.').replaceAll('F','.'));
 const before=structuredClone(m),preview=validateCoursePreview(m);
 assert.equal(preview.minPlayers,1);assert.equal(preview.name,'制作中のコース');assert.deepEqual(m,before);
 assert.throws(()=>validateCourseMap(m));
 const hub=new HostHub('preview','テスト',()=>{},true),a=peer(hub,'テスト');
 a.send({t:'courseJoin',map:m});a.send({t:'roomStart'});
 assert.equal(hub.games.size,1);assert.deepEqual(latest(a.messages).map!.tiles,m.tiles);
 const runner=[...hub.games][0].world.runners[0],x=runner.x;
 for(let seq=1;seq<=10;seq++){a.send({t:'input',gameId:latest(a.messages).gameId,list:[{seq,input:{...emptyInput(),right:true}}]});hub.tick();}
 assert.ok(runner.x>x);
 assert.throws(()=>validateCoursePreview({...m,tiles:m.tiles.map(row=>row.replaceAll('S','.'))}),/出現/);
});

test('公開時は未完成のマップを拒否し、下書きでは保持できる', () => {
  const m = newCourseMap(); m.tiles = m.tiles.map(r => r.replaceAll('F', '.'));
  assert.throws(() => validateCourseMap(m), /ゴール/);
  assert.equal(validateCourseMap(m, false).width, 80);
  assert.throws(() => validateCourseMap({ ...newCourseMap(), width: 100000 }));
  const m2 = newCourseMap(); m2.tiles[0] = 'S' + m2.tiles[0].slice(1);
  assert.throws(() => validateCourseMap(m2), /出現/);
});

test('人数、ID、有限タイムを確認し、ひとりや重複IDで正式公開しない', () => {
  const a = { id: 1, name: 'あ', time: 12 };
  assert.equal(canRelease([a]), false);
  assert.equal(canRelease([a, a]), false);
  assert.equal(canRelease([a, { id: 2, name: 'い', time: NaN }]), false);
  assert.equal(canRelease([a, { id: 2, name: 'い', time: 15 }]), true);
});

test('選択だけでは開始せず、開始後に全員ゴールすると一度だけ通知する',()=>{
 const h=new HostHub('h','部屋'),a=peer(h,'あ'),b=peer(h,'い'),m=map();a.send({t:'courseJoin',map:m});assert.equal(h.games.size,0);a.send({t:'roomStart'});
 const g=[...h.games][0];assert.equal(latest(a.messages).gameId,latest(b.messages).gameId);assert.deepEqual(latest(b.messages).map,m);
 g.world.runners[0].finishedTime=10;h.tick();assert.equal(a.messages.some(m=>m.t==='partyClear'),false);g.world.runners[1].finishedTime=12;h.tick();h.tick();assert.equal(a.messages.filter(m=>m.t==='partyClear').length,1);
});

test('途中離脱して残りの人がゴールしても正式公開しない', () => {
  const hub = new HostHub('h', '工房'), a = peer(hub, 'あ'), b = peer(hub, 'い'), m = map();
  a.send({ t: 'courseJoin', map: m }); a.send({t:'roomStart'});
  const game = [...hub.games].find(g => g.stageId === m.id)!;
  game.world.runners[0].finishedTime = 10; b.drop(); hub.tick();
  assert.equal(a.messages.some(m => m.t === 'partyClear'), false);
});

test('参加者のコース変更とプレイ中の差し替え、不正なタイルを拒否する',()=>{
 const h=new HostHub('h','部屋'),a=peer(h,'あ'),b=peer(h,'い'),m=map();a.send({t:'courseJoin',map:m});b.send({t:'courseJoin',map:{...m,name:'改変'}});a.send({t:'roomStart'});assert.equal([...h.games][0].world.map.name,m.name);
 a.send({t:'courseJoin',map:{...m,name:'変更'}});assert.equal([...h.games][0].world.map.name,m.name);
 assert.throws(()=>validateCourseMap({...m,tiles:m.tiles.map(r=>r.replace('S','?'))}));
});

test('DDNetのしびれ解除タイルで即座に動けるようになる', () => {
  const m = newCourseMap(24, 16); m.tiles[12] = m.tiles[12].slice(0, 3) + 'U' + m.tiles[12].slice(4);
  const world = createWorld(m), r = newRunner(1, m); r.stun = 100; r.x = 3.5 * TILE; r.y = 12.5 * TILE; world.runners.push(r);
  stepWorld(world, new Map([[1, emptyInput()]])); assert.equal(r.stun, 0);
});

test('実際の移動入力で2人がスタート線とゴール線を通過すると正式公開判定が出る', () => {
  const hub = new HostHub('run-proof', '実走検証'), a = peer(hub, '赤'), b = peer(hub, '青'), m = map();
  a.send({ t: 'courseJoin', map: m });
  a.send({t:'roomStart'});
  const gameId = latest(a.messages).gameId;
  for (let seq = 1; seq <= 220; seq++) {
    for (const p of [a, b]) p.send({ t: 'input', gameId, list: [{ seq, input: { ...emptyInput(), right: true } }] });
    hub.tick();
  }
  const completed = a.messages.filter(msg => msg.t === 'partyClear');
  assert.equal(completed.length, 1);
  assert.equal(completed[0].results.length, 2);
  assert.ok(completed[0].results.every(r => r.time > 0));
});

test('DDNetの透過壁はプレイヤーを止め、フックだけを奥の岩へ通す', () => {
  const m = newCourseMap(24, 16), rows = m.tiles.map(row => [...row]);
  for (let y = 2; y < 13; y++) { rows[y][8] = 'O'; rows[y][12] = '#'; }
  m.tiles = rows.map(row => row.join(''));
  const world = createWorld(m), r = newRunner(1, m); r.ability='hook'; r.x = 5.5 * TILE; r.y = 6.5 * TILE; world.runners.push(r);
  for (let i = 0; i < 24; i++) stepWorld(world, new Map([[1, { ...emptyInput(), fire: true, right: true, aimX: 1, aimY: 0 }]]));
  assert.equal(r.wireState, 2);
  assert.ok(r.wireX > 11 * TILE);
  assert.ok(r.x < 8 * TILE - 13);
});

test('Kobraと同じ900×897マスを保存・読込・テストでき、上限超過は拒否する',()=>{
 const m=newCourseMap(900,897);m.dd!.tele=[[900*896+898,26,1]];
 const loaded=validateCourseMap(JSON.parse(JSON.stringify(m)));
 assert.equal(loaded.width,900);assert.equal(loaded.height,897);assert.deepEqual(loaded.dd,m.dd);
 assert.equal(validateCoursePreview(loaded).tiles.length,897);
 assert.throws(()=>validateCourseMap(newCourseMap(901,897)));
 assert.throws(()=>validateCourseMap(newCourseMap(900,898)));
});

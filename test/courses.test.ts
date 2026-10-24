import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRelease, newCourseMap, validateCourseMap } from '../shared/courses';
import { HostHub, type Link } from '../client/host/hub';
import { createWorld, emptyInput, newRunner, stepWorld, TILE } from '../shared/physics';
import type { ClientMsg, ServerMsg } from '../shared/protocol';

function peer(hub: HostHub, name: string) {
  const messages: ServerMsg[] = [];
  const link: Link = { send: m => messages.push(m), close: () => link.onClose(), onMessage: () => {}, onClose: () => {} };
  hub.connect(link);
  const send = (m: ClientMsg) => link.onMessage(m);
  send({ t: 'hello', name, guest: true });
  return { messages, send, drop: () => link.onClose() };
}
const latest = (messages: ServerMsg[]) => messages.filter(m => m.t === 'gameStart').at(-1)!;
const map = () => ({ ...validateCourseMap(newCourseMap(24, 16)), id: 'user-0123456789abcdef01' });

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

test('同じコースを配信し、2人揃うまで進まず、全員ゴール後に一度だけ通知する', () => {
  const hub = new HostHub('h', '工房'), a = peer(hub, 'あ'), b = peer(hub, 'い'), m = map();
  a.send({ t: 'courseJoin', map: m });
  const game = [...hub.games].find(g => g.stageId === m.id)!;
  const before = structuredClone(game.world.runners[0]);
  for (let i = 0; i < 15; i++) hub.tick();
  assert.deepEqual(game.world.runners[0], before);
  b.send({ t: 'courseJoin', map: m });
  assert.equal(latest(a.messages).gameId, latest(b.messages).gameId);
  assert.deepEqual(latest(b.messages).map, m);
  assert.equal(game.size, 2);
  game.world.runners[0].finishedTime = 10; hub.tick();
  assert.equal(a.messages.some(m => m.t === 'partyClear'), false);
  game.world.runners[1].finishedTime = 12; hub.tick(); hub.tick();
  const clears = a.messages.filter(m => m.t === 'partyClear');
  assert.equal(clears.length, 1);
  assert.equal(clears[0].stageId, m.id);
  assert.equal(clears[0].results.length, 2);
});

test('途中離脱して残りの人がゴールしても正式公開しない', () => {
  const hub = new HostHub('h', '工房'), a = peer(hub, 'あ'), b = peer(hub, 'い'), m = map();
  a.send({ t: 'courseJoin', map: m }); b.send({ t: 'courseJoin', map: m });
  const game = [...hub.games].find(g => g.stageId === m.id)!;
  game.world.runners[0].finishedTime = 10; b.drop(); hub.tick();
  assert.equal(a.messages.some(m => m.t === 'partyClear'), false);
});

test('出発後の途中参加、違う版のコース、不正なタイルを拒否する', () => {
  const hub = new HostHub('h', '工房'), a = peer(hub, 'あ'), b = peer(hub, 'い'), m = map();
  a.send({ t: 'courseJoin', map: m });
  b.send({ t: 'courseJoin', map: { ...m, name: '別の版' } });
  assert.equal(latest(b.messages).mode, 'lobby');
  const game = [...hub.games].find(g => g.stageId === m.id)!;
  game.world.runners[0].raceStart = 0;
  b.send({ t: 'courseJoin', map: m });
  assert.equal(latest(b.messages).mode, 'lobby');
});

test('DDNetのしびれ解除タイルで即座に動けるようになる', () => {
  const m = newCourseMap(24, 16); m.tiles[12] = m.tiles[12].slice(0, 3) + 'U' + m.tiles[12].slice(4);
  const world = createWorld(m), r = newRunner(1, m); r.stun = 100; r.x = 3.5 * TILE; r.y = 12.5 * TILE; world.runners.push(r);
  stepWorld(world, new Map([[1, emptyInput()]])); assert.equal(r.stun, 0);
});

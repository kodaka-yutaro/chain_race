import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOBBY_MAP } from '../shared/maps';
import { emptyInput, TILE } from '../shared/physics';
import { PARTY_COUNTDOWN_TICKS, type ClientMsg, type ServerMsg } from '../shared/protocol';
import { HostHub, type Link } from '../client/host/hub';

function fakeLink(hub: HostHub) {
  const got: ServerMsg[] = [];
  const link: Link = { send: (m) => got.push(m), close: () => link.onClose(), onMessage: () => {}, onClose: () => {} };
  hub.connect(link);
  return { got, say: (m: ClientMsg) => link.onMessage(m), drop: () => link.onClose() };
}

const last = <T extends ServerMsg['t']>(got: ServerMsg[], t: T) =>
  [...got].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;

test('大部屋の主のブラウザで、入室から協力の台で出発するまで進む', () => {
  const counts: number[] = [];
  const hub = new HostHub('h', '大部屋', (n) => counts.push(n));
  const a = fakeLink(hub), b = fakeLink(hub);
  a.say({ t: 'hello', name: 'あ', guest: true });
  b.say({ t: 'hello', name: 'い', guest: false });
  assert.equal(last(a.got, 'gameStart')?.mode, 'lobby');
  assert.equal(last(b.got, 'hubState')?.hub.members.length, 2);
  assert.deepEqual(counts, [1, 2]);

  // 2人を塔の協力の台に乗せて F
  const z = LOBBY_MAP.zones!.find((x) => x.kind === 'party' && x.stageId === 'tower')!;
  for (const r of hub.lobby.world.runners) { r.x = (z.x + z.w / 2) * TILE; r.y = (z.y + z.h - 1) * TILE; }
  for (let i = 0; i < 20; i++) hub.tick();
  a.say({ t: 'interact' });
  for (let i = 0; i < PARTY_COUNTDOWN_TICKS + 5; i++) hub.tick();
  const start = last(b.got, 'gameStart')!;
  assert.equal(start.mode, 'party');
  assert.equal(start.stageId, 'tower');

  // 同じ入力が重ねて届いても1回ぶんとして扱い、ほかのゲーム宛ての入力は無視する
  const inp = emptyInput();
  b.say({ t: 'input', gameId: start.gameId, list: [{ seq: 1, input: inp }, { seq: 2, input: inp }] });
  b.say({ t: 'input', gameId: start.gameId, list: [{ seq: 1, input: inp }, { seq: 2, input: inp }, { seq: 3, input: inp }] });
  b.say({ t: 'input', gameId: 'old', list: [{ seq: 99, input: inp }] });
  for (let i = 0; i < 4; i++) hub.tick();
  const snap = last(b.got, 'snap')!;
  assert.equal(snap.gameId, start.gameId);
  assert.equal(snap.lastSeq, 3);

  a.drop();
  assert.equal(last(b.got, 'hubState')?.hub.members.length, 1);
  assert.deepEqual(counts, [1, 2, 1]);
});

test('満員や名前の不正な人は入れない', () => {
  const hub = new HostHub('h', '大部屋');
  const x = fakeLink(hub);
  x.say({ t: 'hello', name: '', guest: true });
  assert.equal(x.got[0]?.t, 'error');
  assert.equal(hub.members.size, 0);
});

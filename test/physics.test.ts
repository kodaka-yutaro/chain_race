import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOBBY_MAP, MAPS, mapById } from '../shared/maps';
import {
  createWorld, emptyInput, inZone, newRunner, stepWorld, TEE_SIZE, TILE, WIRE_ATTACHED, WIRE_IDLE, type Input, type World,
} from '../shared/physics';

const inp = (p: Partial<Input>): Input => ({ ...emptyInput(), ...p });

function place(w: World, id: number, tx: number) {
  const r = newRunner(id, w.map);
  r.x = tx * TILE + TILE / 2;
  w.runners.push(r);
  return r;
}

function settle(w: World, ticks = 30) {
  for (let i = 0; i < ticks; i++) stepWorld(w, new Map());
}

test('すべてのステージにスポーン・スタート・ゴールがある', () => {
  for (const m of MAPS) {
    const all = m.tiles.join('');
    assert.equal(m.tiles.length, m.height);
    for (const row of m.tiles) assert.equal(row.length, m.width);
    for (const c of ['S', '>', 'F']) assert.ok(all.includes(c), `${m.id} に ${c} がない`);
  }
});

test('二段ジャンプの最高到達点は金属の塔より低い（1人では越えられない）', () => {
  const w = createWorld(mapById('tower')!);
  const r = place(w, 1, 36);
  settle(w);
  const groundY = r.y;
  let minY = r.y;
  for (let i = 0; i < 150; i++) {
    stepWorld(w, new Map([[1, inp({ jump: i < 3 || (i >= 20 && i < 23) })]]));
    minY = Math.min(minY, r.y);
  }
  const rise = (groundY - minY) / TILE;
  assert.ok(rise > 9 && rise < 11.5, `rise=${rise}`);
  assert.ok(minY + 14 > 14 * TILE, '1人で塔の上に届いてしまう');
});

test('ハンマーで打ち上げれば塔の上に届き、フックで仲間を引き上げられる', () => {
  const w = createWorld(mapById('tower')!);
  const a = place(w, 1, 41); // 打ち上げる人
  const b = place(w, 2, 41); // 打ち上げられる人（a の頭の上に乗る）
  settle(w);
  b.x = a.x; b.y = a.y - TEE_SIZE - 1;
  settle(w);
  let reachedTop = false;
  for (let i = 0; i < 200 && !reachedTop; i++) {
    const m = new Map<number, Input>();
    m.set(1, inp({ jump: i < 3, fire: i === 6, aimX: b.x - a.x || 0.01, aimY: b.y - a.y }));
    m.set(2, inp({ jump: i < 3 || (i >= 15 && i < 18), right: i > 10 && b.x < 45.5 * TILE }));
    stepWorld(w, m);
    if (b.grounded && b.y < 14 * TILE && b.x > 44 * TILE) reachedTop = true;
  }
  assert.ok(reachedTop, `打ち上げで塔に乗れない b=(${b.x / TILE},${b.y / TILE})`);

  // 塔の左端に立った b が、ジャンプした a にフックを掛けて引き上げる
  b.x = 43.8 * TILE; b.vx = 0;
  a.x = 39.5 * TILE; a.vx = 0;
  settle(w, 40);
  let pulled = false;
  for (let i = 0; i < 250 && !pulled; i++) {
    const m = new Map<number, Input>();
    m.set(2, inp({ wire: i >= 20, right: i > 40 && b.x < 47 * TILE, aimX: a.x - b.x, aimY: a.y - b.y }));
    m.set(1, inp({ jump: i < 3 || (i >= 20 && i < 23), right: i > 5 }));
    stepWorld(w, m);
    if (i === 22) assert.equal(b.wireRunner, a.id, 'フックが仲間に掛からない');
    if (a.grounded && a.y < 14 * TILE && a.x > 44 * TILE) pulled = true;
  }
  assert.ok(pulled, `引き上げられない a=(${a.x / TILE},${a.y / TILE})`);
});

test('岩の天井にフックを掛けると引き寄せられ、金属には掛からない', () => {
  const w = createWorld(mapById('hill')!);
  const r = place(w, 1, 60);
  r.y = 22 * TILE;
  for (let i = 0; i < 60; i++) stepWorld(w, new Map([[1, inp({ wire: true, aimX: 0, aimY: -1 })]]));
  assert.equal(r.wireState, WIRE_ATTACHED);
  assert.ok(r.y < 18 * TILE, `y=${r.y / TILE}`);

  const c = createWorld(mapById('cave')!);
  const s = place(c, 1, 20);
  settle(c);
  for (let i = 0; i < 20; i++) stepWorld(c, new Map([[1, inp({ wire: true, aimX: 0, aimY: -1 })]]));
  assert.equal(s.wireState, WIRE_IDLE);
});

test('しびれ洞窟の回廊は岩の支点をフックでたどって渡れる', () => {
  const w = createWorld(mapById('cave')!);
  const r = place(w, 1, 24);
  settle(w);
  const anchors = [30.5, 37.5, 44.5, 51.5, 58.5, 66].map((x) => x * TILE);
  let idx = 0, gap = 0;
  for (let i = 0; i < 800 && r.x < 62 * TILE && r.stun === 0; i++) {
    if (gap === 0 && r.wireState === WIRE_ATTACHED && r.x > anchors[idx] - TILE) { idx++; gap = 2; }
    const hold = gap === 0;
    if (gap > 0) gap--;
    stepWorld(w, new Map([[1, inp({
      right: true, jump: i < 3 || (i >= 12 && i < 15), wire: hold, aimX: anchors[idx] - r.x, aimY: 12.5 * TILE - r.y,
    })]]));
  }
  assert.ok(r.x >= 62 * TILE && r.stun === 0, `x=${r.x / TILE} stun=${r.stun}`);
});

test('しびれ洞窟の煙突は左右の岩壁にフックを掛けて登れる', () => {
  const w = createWorld(mapById('cave')!);
  const r = place(w, 1, 115);
  r.y = 25 * TILE;
  settle(w, 20);
  let top = r.y;
  for (let i = 0; i < 600; i++) {
    const side = Math.floor(i / 17) % 2 ? 1 : -1;
    stepWorld(w, new Map([[1, inp({ jump: i < 3 || (i >= 12 && i < 15), wire: i % 17 < 15, aimX: side * 0.8, aimY: -1 })]]));
    top = Math.min(top, r.y);
  }
  assert.ok(top < 4 * TILE, `top=${top / TILE}`);
});

test('大部屋の広場に、ステージごとのフリー入口と協力の台がある', () => {
  const zones = LOBBY_MAP.zones ?? [];
  for (const m of MAPS) {
    assert.ok(zones.some((z) => z.kind === 'free' && z.stageId === m.id), `${m.id} のフリー入口がない`);
    assert.ok(zones.some((z) => z.kind === 'party' && z.stageId === m.id), `${m.id} の協力の台がない`);
  }
  const w = createWorld(LOBBY_MAP);
  const r = newRunner(1, LOBBY_MAP);
  w.runners.push(r);
  settle(w);
  assert.ok(!zones.some((z) => inZone(z, r.x, r.y)), 'スポーン地点がゾーンの中にある');
  // 地面に立ったまま各ゾーンに入れる
  for (const z of zones) {
    r.x = (z.x + z.w / 2) * TILE;
    settle(w, 20);
    assert.ok(r.grounded && inZone(z, r.x, r.y), `${z.id} に立てない`);
  }
});

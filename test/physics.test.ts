import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOBBY_MAP, MAPS, mapById } from '../shared/maps';
import {
  createWorld, emptyInput, inZone, newRunner, stepWorld, TILE, WIRE_ATTACHED, type Input, type World,
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

test('ジャンプ＋上ダッシュの最高到達点は金属の塔より低い（1人では越えられない）', () => {
  const w = createWorld(mapById('tower')!);
  const r = place(w, 1, 40);
  settle(w);
  const groundY = r.y;
  let minY = r.y;
  for (let i = 0; i < 120; i++) {
    const ev = new Map([[1, inp({ jump: i === 0 || i === 25, aimX: 0, aimY: -1 })]]);
    stepWorld(w, ev);
    minY = Math.min(minY, r.y);
  }
  const rise = groundY - minY;
  assert.ok(rise > 250 && rise < 340, `rise=${rise}`);
  const towerTop = 14 * TILE;
  assert.ok(minY + 14 > towerTop, '1人で塔の上に届いてしまう');
});

test('エアキャノンで打ち上げれば塔の上に届き、ワイヤーで仲間を引き上げられる', () => {
  const w = createWorld(mapById('tower')!);
  const a = place(w, 1, 41); // 打ち上げる人
  const b = place(w, 2, 42); // 打ち上げられる人
  settle(w);
  let reachedTop = false;
  for (let i = 0; i < 200 && !reachedTop; i++) {
    const m = new Map<number, Input>();
    m.set(2, inp({ jump: i === 0 || i === 14, right: i > 10 && b.x < 45.5 * TILE, aimX: 0, aimY: -1 }));
    m.set(1, inp({ fire: i === 6, aimX: 0.3, aimY: -1 }));
    stepWorld(w, m);
    if (b.grounded && b.y < 14 * TILE && b.x > 44 * TILE) reachedTop = true;
  }
  assert.ok(reachedTop, `打ち上げで塔に乗れない b=(${b.x / TILE},${b.y / TILE})`);
  settle(w, 10);

  // a がジャンプしたところで、塔の上の b がワイヤーを刺して巻き取る
  let pulled = false;
  for (let i = 0; i < 300 && !pulled; i++) {
    const dx = a.x - b.x, dy = a.y - b.y;
    const m = new Map<number, Input>();
    // 塔の左端まで寄ってから撃つ
    m.set(2, inp({ left: b.x > 44.45 * TILE && i < 10, right: i > 80 && b.x < 47 * TILE, wire: i >= 10, up: i > 15, aimX: dx, aimY: dy }));
    m.set(1, inp({ jump: i === 0, right: i > 60 }));
    stepWorld(w, m);
    if (i === 14) assert.equal(b.wireState, WIRE_ATTACHED, 'ワイヤーが仲間に刺さらない');
    if (a.y < 14 * TILE) pulled = true;
  }
  assert.ok(pulled, `引き上げられない a=(${a.x / TILE},${a.y / TILE})`);
});

test('岩の天井にワイヤーを刺すとロープ長が保たれる', () => {
  const w = createWorld(mapById('hill')!);
  const r = place(w, 1, 60);
  r.y = 20 * TILE;
  for (let i = 0; i < 60; i++) {
    stepWorld(w, new Map([[1, inp({ wire: true, right: true, aimX: 0.5, aimY: -1 })]]));
  }
  assert.equal(r.wireState, WIRE_ATTACHED);
  const d = Math.hypot(r.x - r.wireX, r.y - r.wireY);
  assert.ok(d <= r.wireLen + 1, `d=${d} len=${r.wireLen}`);
});

test('しびれ洞窟の煙突は壁キックだけで登りきれる', () => {
  const w = createWorld(mapById('cave')!);
  const r = place(w, 1, 115);
  r.y = 25 * TILE + 2;
  settle(w, 5);
  let face = 1;
  let top = r.y;
  for (let i = 0; i < 400; i++) {
    const jump = (i === 0) || (r.wallSide !== 0 && r.wallSide === face && w.tick % 2 === 0);
    if (r.wallSide === face && jump && i > 0) face = -face;
    stepWorld(w, new Map([[1, inp({ jump, right: face === 1, left: face === -1, aimX: 0, aimY: -1 })]]));
    top = Math.min(top, r.y);
    if (r.x > 121 * TILE) break;
  }
  assert.ok(top < 8 * TILE, `top=${top / TILE}`);
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

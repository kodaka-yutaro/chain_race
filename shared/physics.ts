// サーバーとクライアントで共有する決定的な物理シミュレーション（50 tick/秒）。

export const TILE = 32;
export const TICK_RATE = 50;
export const TEE_SIZE = 28;
const R = TEE_SIZE / 2;

export const PHYS = {
  gravity: 0.5,
  groundSpeed: 10,
  groundAccel: 2,
  groundFriction: 0.5,
  airSpeed: 5,
  airAccel: 1.5,
  airFriction: 0.95,
  jump: 12,
  dashSpeed: 13,
  wallKickUp: 11,
  wallKickSide: 9,
  wallSlide: 2.5,
  wireLength: 380,
  wireFireSpeed: 80,
  wireMinLength: 40,
  wireReel: 7,
  springSpeed: 18,
  stunTicks: 150,
  cannonCooldown: 20,
  cannonRange: 90,
  cannonPower: 12,
  cannonRecoil: 3,
  maxSpeed: 40,
};

// タイル:
//   .  空
//   #  岩壁（ワイヤーが刺さる・壁キックできる）
//   X  金属壁（ワイヤーも壁キックも不可）
//   ~  しびれ床（触れている間しびれ、離れて 3 秒で回復）
//   ^  トゲ（スタートからやり直し）
//   J  バネ床
//   S  スポーン  >  スタート線  F  ゴール線
//   1-4 スイッチ  a-d 扉（1 を誰かが踏んでいる間 a が開く）
export interface MapDef {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  width: number;
  height: number;
  tiles: string[];
  hints: { x: number; y: number; text: string }[];
  /** 大部屋の入口・協力の台（タイル座標） */
  zones?: Zone[];
}

export interface Zone {
  id: string;
  kind: 'free' | 'party';
  stageId: string;
  x: number; y: number; w: number; h: number;
}

export function inZone(z: Zone, px: number, py: number): boolean {
  return px >= z.x * TILE && px < (z.x + z.w) * TILE && py >= z.y * TILE && py < (z.y + z.h) * TILE;
}

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  wire: boolean;
  fire: boolean;
  kill: boolean;
  aimX: number;
  aimY: number;
}

export const emptyInput = (): Input => ({
  left: false, right: false, up: false, down: false, jump: false, wire: false, fire: false, kill: false,
  aimX: 1, aimY: 0,
});

export const WIRE_IDLE = 0, WIRE_FLYING = 1, WIRE_ATTACHED = 2;

export interface Runner {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  grounded: boolean;
  dashed: boolean;
  wallSide: number; // -1 左の壁 / 1 右の壁 / 0 なし
  prevJump: boolean;
  prevWire: boolean;
  prevFire: boolean;
  wireState: number;
  wireX: number; wireY: number;
  wireDX: number; wireDY: number;
  wireLen: number;
  wireRunner: number; // -1 = 壁に刺さっている／なし
  stun: number;
  cannonCd: number;
  cannonTick: number; // 最後に撃った tick（演出用）
  aimX: number; aimY: number;
  raceStart: number; // -1 = 未スタート
  finishedTime: number; // -1 = 未ゴール（秒）
}

export interface World {
  map: MapDef;
  tick: number;
  runners: Runner[];
  doorsOpen: boolean[]; // a..d
}

export interface StepEvents {
  finished: { runnerId: number; time: number }[];
  killed: number[];
}

export function tileAt(map: MapDef, tx: number, ty: number): string {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return 'X';
  return map.tiles[ty][tx];
}

export function findSpawn(map: MapDef): { x: number; y: number } {
  for (let y = 0; y < map.height; y++) {
    const x = map.tiles[y].indexOf('S');
    if (x >= 0) return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
  }
  return { x: TILE * 2, y: TILE * 2 };
}

export function isSolidChar(c: string, doorsOpen: boolean[]): boolean {
  if (c === '#' || c === 'X') return true;
  if (c >= 'a' && c <= 'd') return !doorsOpen[c.charCodeAt(0) - 97];
  return false;
}

function charAtPx(w: World, px: number, py: number): string {
  return tileAt(w.map, Math.floor(px / TILE), Math.floor(py / TILE));
}

export function isSolid(w: World, px: number, py: number): boolean {
  return isSolidChar(charAtPx(w, px, py), w.doorsOpen);
}

function testBox(w: World, x: number, y: number): boolean {
  const h = R - 0.01;
  return isSolid(w, x - h, y - h) || isSolid(w, x + h, y - h) || isSolid(w, x - h, y + h) || isSolid(w, x + h, y + h);
}

function moveBox(w: World, t: Runner) {
  const dist = Math.max(Math.abs(t.vx), Math.abs(t.vy));
  const steps = Math.max(1, Math.ceil(dist));
  const f = 1 / steps;
  for (let i = 0; i < steps; i++) {
    let nx = t.x + t.vx * f;
    let ny = t.y + t.vy * f;
    if (testBox(w, nx, ny)) {
      let hits = 0;
      if (testBox(w, t.x, ny)) { ny = t.y; t.vy = 0; hits++; }
      if (testBox(w, nx, t.y)) { nx = t.x; t.vx = 0; hits++; }
      if (hits === 0) { nx = t.x; ny = t.y; t.vx = 0; t.vy = 0; }
    }
    t.x = nx; t.y = ny;
  }
}

/** 位置をずらす（壁にめり込むならできるところまで） */
function shiftTo(w: World, t: Runner, nx: number, ny: number) {
  if (!testBox(w, nx, ny)) { t.x = nx; t.y = ny; return; }
  if (!testBox(w, nx, t.y)) { t.x = nx; return; }
  if (!testBox(w, t.x, ny)) { t.y = ny; }
}

function saturatedAdd(min: number, max: number, cur: number, mod: number): number {
  if (mod < 0) {
    if (cur < min) return cur;
    return Math.max(min, cur + mod);
  }
  if (cur > max) return cur;
  return Math.min(max, cur + mod);
}

export function newRunner(id: number, map: MapDef): Runner {
  const s = findSpawn(map);
  return {
    id, x: s.x, y: s.y, vx: 0, vy: 0, grounded: false, dashed: false, wallSide: 0,
    prevJump: false, prevWire: false, prevFire: false,
    wireState: WIRE_IDLE, wireX: 0, wireY: 0, wireDX: 0, wireDY: 0, wireLen: 0, wireRunner: -1,
    stun: 0, cannonCd: 0, cannonTick: -100, aimX: 1, aimY: 0, raceStart: -1, finishedTime: -1,
  };
}

export function createWorld(map: MapDef): World {
  return { map, tick: 0, runners: [], doorsOpen: [false, false, false, false] };
}

export function respawn(w: World, t: Runner) {
  const s = findSpawn(w.map);
  t.x = s.x; t.y = s.y; t.vx = 0; t.vy = 0;
  releaseWire(t);
  t.stun = 0; t.dashed = false;
  t.raceStart = -1;
  t.finishedTime = -1;
  for (const o of w.runners) if (o.wireRunner === t.id) releaseWire(o);
}

function touchedTiles(w: World, t: Runner): string[] {
  const h = R - 1;
  const out: string[] = [];
  for (const [dx, dy] of [[-h, -h], [h, -h], [-h, h], [h, h], [0, 0]]) out.push(charAtPx(w, t.x + dx, t.y + dy));
  return out;
}

function checkGrounded(w: World, t: Runner): boolean {
  if (isSolid(w, t.x - R + 1, t.y + R + 3) || isSolid(w, t.x + R - 1, t.y + R + 3)) return true;
  for (const o of w.runners) {
    if (o === t) continue;
    const dy = o.y - t.y;
    if (Math.abs(o.x - t.x) < TEE_SIZE * 0.8 && dy > 0 && dy <= TEE_SIZE + 3) return true;
  }
  return false;
}

/** 壁キックできる岩壁に接しているか */
function wallContact(w: World, t: Runner): number {
  const kick = (px: number, py: number) => charAtPx(w, px, py) === '#';
  if (kick(t.x - R - 2, t.y - R + 3) || kick(t.x - R - 2, t.y + R - 3)) return -1;
  if (kick(t.x + R + 2, t.y - R + 3) || kick(t.x + R + 2, t.y + R - 3)) return 1;
  return 0;
}

function intersectLine(w: World, x0: number, y0: number, x1: number, y1: number) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(d / 4));
  let px = x0, py = y0;
  for (let i = 0; i <= n; i++) {
    const a = i / n;
    const x = x0 + (x1 - x0) * a, y = y0 + (y1 - y0) * a;
    if (isSolid(w, x, y)) return { x: px, y: py, hit: true, stick: charAtPx(w, x, y) === '#' };
    px = x; py = y;
  }
  return { x: x1, y: y1, hit: false, stick: false };
}

function closestPointOnSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let a = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  a = Math.max(0, Math.min(1, a));
  return { x: ax + dx * a, y: ay + dy * a };
}

function releaseWire(t: Runner) {
  t.wireState = WIRE_IDLE;
  t.wireRunner = -1;
}

const byId = (w: World, id: number) => w.runners.find((e) => e.id === id);

/** 1 tick 進める。inputs は runner.id -> Input */
export function stepWorld(w: World, inputs: Map<number, Input>): StepEvents {
  const ev: StepEvents = { finished: [], killed: [] };
  w.tick++;

  const pressed = [false, false, false, false];
  for (const t of w.runners) {
    for (const c of touchedTiles(w, t)) if (c >= '1' && c <= '4') pressed[c.charCodeAt(0) - 49] = true;
  }
  w.doorsOpen = pressed;

  for (const t of w.runners) {
    const inp = inputs.get(t.id) ?? emptyInput();
    if (inp.kill) {
      respawn(w, t);
      ev.killed.push(t.id);
      continue;
    }
    const al = Math.hypot(inp.aimX, inp.aimY);
    if (al > 0.0001) { t.aimX = inp.aimX / al; t.aimY = inp.aimY / al; }

    const stunned = t.stun > 0;
    const dir = stunned ? 0 : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    t.grounded = checkGrounded(w, t);
    t.wallSide = t.grounded ? 0 : wallContact(w, t);
    if (t.grounded) t.dashed = false;

    const maxSpeed = t.grounded ? PHYS.groundSpeed : PHYS.airSpeed;
    const accel = t.grounded ? PHYS.groundAccel : PHYS.airAccel;
    const friction = t.grounded ? PHYS.groundFriction : PHYS.airFriction;

    t.vy += PHYS.gravity;

    // ジャンプ / 壁キック / 空中ダッシュ
    const jumpPressed = inp.jump && !t.prevJump;
    if (!stunned && jumpPressed) {
      if (t.grounded) {
        t.vy = -PHYS.jump;
      } else if (t.wallSide !== 0) {
        t.vy = -PHYS.wallKickUp;
        t.vx = -t.wallSide * PHYS.wallKickSide;
      } else if (!t.dashed) {
        t.vx = t.aimX * PHYS.dashSpeed;
        t.vy = t.aimY * PHYS.dashSpeed;
        t.dashed = true;
      }
    }
    // 壁ずり
    if (!stunned && t.wallSide !== 0 && dir === t.wallSide && t.vy > PHYS.wallSlide) t.vy = PHYS.wallSlide;

    // ワイヤー発射・解除
    if (stunned || !inp.wire) {
      releaseWire(t);
    } else if (inp.wire && !t.prevWire && t.wireState === WIRE_IDLE) {
      t.wireState = WIRE_FLYING;
      t.wireX = t.x + t.aimX * R;
      t.wireY = t.y + t.aimY * R;
      t.wireDX = t.aimX; t.wireDY = t.aimY;
      t.wireRunner = -1;
    }

    if (dir !== 0) t.vx = saturatedAdd(-maxSpeed, maxSpeed, t.vx, accel * dir);
    else t.vx *= friction;

    if (t.wireState === WIRE_FLYING) {
      const nx = t.wireX + t.wireDX * PHYS.wireFireSpeed;
      const ny = t.wireY + t.wireDY * PHYS.wireFireSpeed;
      if (Math.hypot(nx - t.x, ny - t.y) > PHYS.wireLength) {
        releaseWire(t);
      } else {
        const hit = intersectLine(w, t.wireX, t.wireY, nx, ny);
        let best = -1, bestD = Infinity;
        for (const o of w.runners) {
          if (o === t) continue;
          const c = closestPointOnSegment(t.wireX, t.wireY, hit.x, hit.y, o.x, o.y);
          if (Math.hypot(c.x - o.x, c.y - o.y) < R + 2) {
            const d = Math.hypot(c.x - t.wireX, c.y - t.wireY);
            if (d < bestD) { bestD = d; best = o.id; }
          }
        }
        if (best >= 0) {
          const o = byId(w, best)!;
          t.wireState = WIRE_ATTACHED;
          t.wireRunner = best;
          t.wireLen = Math.max(PHYS.wireMinLength, Math.hypot(o.x - t.x, o.y - t.y));
        } else if (hit.hit) {
          if (hit.stick) {
            t.wireState = WIRE_ATTACHED;
            t.wireX = hit.x; t.wireY = hit.y;
            t.wireLen = Math.max(PHYS.wireMinLength, Math.hypot(hit.x - t.x, hit.y - t.y));
          } else releaseWire(t);
        } else {
          t.wireX = hit.x; t.wireY = hit.y;
        }
      }
    }

    // 巻き取り・繰り出し
    if (t.wireState === WIRE_ATTACHED && !stunned) {
      if (inp.up) t.wireLen = Math.max(PHYS.wireMinLength, t.wireLen - PHYS.wireReel);
      if (inp.down) t.wireLen = Math.min(PHYS.wireLength, t.wireLen + PHYS.wireReel);
    }

    // エアキャノン
    if (t.cannonCd > 0) t.cannonCd--;
    if (!stunned && inp.fire && !t.prevFire && t.cannonCd === 0) {
      t.cannonCd = PHYS.cannonCooldown;
      t.cannonTick = w.tick;
      for (const o of w.runners) {
        if (o === t) continue;
        const dx = o.x - t.x, dy = o.y - t.y;
        const d = Math.hypot(dx, dy);
        if (d > PHYS.cannonRange) continue;
        if (d > TEE_SIZE && (dx * t.aimX + dy * t.aimY) / d < 0.6) continue;
        o.vx += t.aimX * PHYS.cannonPower;
        o.vy += t.aimY * PHYS.cannonPower;
        o.stun = 0;
      }
      t.vx -= t.aimX * PHYS.cannonRecoil;
      t.vy -= t.aimY * PHYS.cannonRecoil;
    }

    t.prevJump = inp.jump;
    t.prevWire = inp.wire;
    t.prevFire = inp.fire;
  }

  for (const t of w.runners) {
    const m = PHYS.maxSpeed;
    t.vx = Math.max(-m, Math.min(m, t.vx));
    t.vy = Math.max(-m, Math.min(m, t.vy));
    moveBox(w, t);
  }

  // ワイヤーの長さ制約（ロープ）
  for (const t of w.runners) {
    if (t.wireState !== WIRE_ATTACHED) continue;
    if (t.wireRunner >= 0) {
      const o = byId(w, t.wireRunner);
      if (!o) { releaseWire(t); continue; }
      t.wireX = o.x; t.wireY = o.y;
      const dx = t.x - o.x, dy = t.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d <= t.wireLen || d === 0) continue;
      const nx = dx / d, ny = dy / d;
      // 撃った側が地面にいれば相手だけが動く（引き上げ）。空中なら相手が支点になる。
      const wt = t.grounded ? 0 : 1, wo = o.grounded && !t.grounded ? 0 : 1;
      const st = wt / (wt + wo), so = wo / (wt + wo);
      const ex = d - t.wireLen;
      shiftTo(w, t, t.x - nx * ex * st, t.y - ny * ex * st);
      shiftTo(w, o, o.x + nx * ex * so, o.y + ny * ex * so);
      const rel = (t.vx - o.vx) * nx + (t.vy - o.vy) * ny;
      if (rel > 0) {
        t.vx -= nx * rel * st; t.vy -= ny * rel * st;
        o.vx += nx * rel * so; o.vy += ny * rel * so;
      }
    } else {
      const dx = t.x - t.wireX, dy = t.y - t.wireY;
      const d = Math.hypot(dx, dy);
      if (d <= t.wireLen || d === 0) continue;
      const nx = dx / d, ny = dy / d;
      shiftTo(w, t, t.wireX + nx * t.wireLen, t.wireY + ny * t.wireLen);
      const vr = t.vx * nx + t.vy * ny;
      if (vr > 0) { t.vx -= nx * vr; t.vy -= ny * vr; }
    }
  }

  // ランナー同士の衝突（頭に乗れる）
  for (let i = 0; i < w.runners.length; i++) {
    for (let j = i + 1; j < w.runners.length; j++) {
      const a = w.runners[i], b = w.runners[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= TEE_SIZE || d === 0) continue;
      const overlap = TEE_SIZE - d;
      if (Math.abs(dy) > Math.abs(dx)) {
        const up = dy < 0 ? b : a, low = dy < 0 ? a : b;
        shiftTo(w, up, up.x, up.y - overlap);
        if (up.vy > low.vy) up.vy = low.vy;
      } else {
        const s = Math.sign(dx) || 1;
        shiftTo(w, a, a.x - (s * overlap) / 2, a.y);
        shiftTo(w, b, b.x + (s * overlap) / 2, b.y);
      }
    }
  }

  // タイル効果
  for (const t of w.runners) {
    const tiles = touchedTiles(w, t);
    if (tiles.includes('^')) {
      respawn(w, t);
      ev.killed.push(t.id);
      continue;
    }
    if (tiles.includes('~')) {
      t.stun = PHYS.stunTicks;
      releaseWire(t);
    } else if (t.stun > 0) {
      t.stun--;
    }
    if (tiles.includes('J') && t.vy > -PHYS.springSpeed) {
      t.vy = -PHYS.springSpeed;
      t.dashed = false;
    }
    if (tiles.includes('>') && t.finishedTime < 0) t.raceStart = w.tick;
    if (tiles.includes('F') && t.raceStart >= 0 && t.finishedTime < 0) {
      t.finishedTime = Math.round(((w.tick - t.raceStart) / TICK_RATE) * 1000) / 1000;
      ev.finished.push({ runnerId: t.id, time: t.finishedTime });
    }
  }
  return ev;
}

// サーバーとクライアントで共有する決定的な物理シミュレーション（50 tick/秒）。

export const TILE = 32;
export const TICK_RATE = 50;
export const TEE_SIZE = 28;
const R = TEE_SIZE / 2;

// 動きの数値は DDNet（DDRace）の標準値に合わせている
export const PHYS = {
  gravity: 0.5,
  groundSpeed: 10,
  groundAccel: 2,
  groundFriction: 0.5,
  airSpeed: 5,
  airAccel: 1.5,
  airFriction: 0.95,
  jump: 13.2,
  airJump: 12,
  hookLength: 380,
  hookFireSpeed: 80,
  hookDragAccel: 3,
  hookDragSpeed: 15,
  /** 仲間をつかんでいられる時間（tick） */
  hookPlayerTicks: 60,
  springSpeed: 18,
  stunTicks: 150,
  hammerCooldown: 6,
  maxSpeed: 40,
};

// タイル:
//   .  空
//   #  岩壁（フックが掛かる）
//   X  金属壁（フックが掛からない）
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
  /** 1 = ジャンプボタンを押しっぱなし、2 = 二段ジャンプを使った */
  jumped: number;
  prevJump: boolean;
  prevWire: boolean;
  prevFire: boolean;
  wireState: number;
  wireX: number; wireY: number;
  wireDX: number; wireDY: number;
  wireRunner: number; // -1 = 壁に掛かっている／なし
  /** フックを掛けてからの tick */
  wireTick: number;
  stun: number;
  hammerCd: number;
  hammerTick: number; // 最後に振った tick（演出用）
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
    id, x: s.x, y: s.y, vx: 0, vy: 0, grounded: false, jumped: 0,
    prevJump: false, prevWire: false, prevFire: false,
    wireState: WIRE_IDLE, wireX: 0, wireY: 0, wireDX: 0, wireDY: 0, wireRunner: -1, wireTick: 0,
    stun: 0, hammerCd: 0, hammerTick: -100, aimX: 1, aimY: 0, raceStart: -1, finishedTime: -1,
  };
}

export function createWorld(map: MapDef): World {
  return { map, tick: 0, runners: [], doorsOpen: [false, false, false, false] };
}

export function respawn(w: World, t: Runner) {
  const s = findSpawn(w.map);
  t.x = s.x; t.y = s.y; t.vx = 0; t.vy = 0;
  releaseWire(t);
  t.stun = 0; t.jumped = 0;
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

  const dirs = new Map<number, number>();
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
    dirs.set(t.id, dir);
    t.grounded = checkGrounded(w, t);

    const maxSpeed = t.grounded ? PHYS.groundSpeed : PHYS.airSpeed;
    const accel = t.grounded ? PHYS.groundAccel : PHYS.airAccel;
    const friction = t.grounded ? PHYS.groundFriction : PHYS.airFriction;

    t.vy += PHYS.gravity;

    // ジャンプ（押しっぱなしでは連続しない）と二段ジャンプ
    if (!stunned && inp.jump) {
      if (!(t.jumped & 1)) {
        if (t.grounded) { t.vy = -PHYS.jump; t.jumped |= 1; }
        else if (!(t.jumped & 2)) { t.vy = -PHYS.airJump; t.jumped |= 3; }
      }
    } else {
      t.jumped &= ~1;
    }
    if (t.grounded) t.jumped &= ~2;

    // フック：押している間だけ。外れたら一度離すまで撃てない
    if (stunned || !inp.wire) {
      releaseWire(t);
    } else if (!t.prevWire && t.wireState === WIRE_IDLE) {
      t.wireState = WIRE_FLYING;
      t.wireX = t.x + t.aimX * R * 1.5;
      t.wireY = t.y + t.aimY * R * 1.5;
      t.wireDX = t.aimX; t.wireDY = t.aimY;
      t.wireRunner = -1;
      t.wireTick = 0;
    }

    if (dir !== 0) t.vx = saturatedAdd(-maxSpeed, maxSpeed, t.vx, accel * dir);
    else t.vx *= friction;

    if (t.wireState === WIRE_FLYING) {
      const nx = t.wireX + t.wireDX * PHYS.hookFireSpeed;
      const ny = t.wireY + t.wireDY * PHYS.hookFireSpeed;
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
        t.wireState = WIRE_ATTACHED;
        t.wireRunner = best;
      } else if (hit.hit) {
        if (hit.stick) {
          t.wireState = WIRE_ATTACHED;
          t.wireX = hit.x; t.wireY = hit.y;
        } else releaseWire(t);
      } else if (Math.hypot(nx - t.x, ny - t.y) > PHYS.hookLength) {
        releaseWire(t);
      } else {
        t.wireX = hit.x; t.wireY = hit.y;
      }
    }

    if (t.wireState === WIRE_ATTACHED) {
      t.wireTick++;
      if (t.wireRunner >= 0) {
        const o = byId(w, t.wireRunner);
        // 仲間をつかめるのは少しの間だけ
        if (!o || t.wireTick > PHYS.hookPlayerTicks) releaseWire(t);
        else { t.wireX = o.x; t.wireY = o.y; }
      } else if (Math.hypot(t.wireX - t.x, t.wireY - t.y) > 46) {
        // 掛かった所へ引き寄せられる
        const d = Math.hypot(t.wireX - t.x, t.wireY - t.y);
        let hx = ((t.wireX - t.x) / d) * PHYS.hookDragAccel;
        let hy = ((t.wireY - t.y) / d) * PHYS.hookDragAccel;
        if (hy > 0) hy *= 0.3;
        if ((hx < 0 && dir < 0) || (hx > 0 && dir > 0)) hx *= 0.95;
        else hx *= 0.75;
        const nvx = t.vx + hx, nvy = t.vy + hy;
        const nl = Math.hypot(nvx, nvy);
        if (nl < PHYS.hookDragSpeed || nl < Math.hypot(t.vx, t.vy)) { t.vx = nvx; t.vy = nvy; }
      }
    }

    // ハンマー：すぐ前の仲間を叩いて飛ばし、しびれを解く
    if (t.hammerCd > 0) t.hammerCd--;
    if (!stunned && inp.fire && !t.prevFire && t.hammerCd === 0) {
      t.hammerCd = PHYS.hammerCooldown;
      t.hammerTick = w.tick;
      const hx = t.x + t.aimX * R * 1.5, hy = t.y + t.aimY * R * 1.5;
      for (const o of w.runners) {
        if (o === t || Math.hypot(o.x - hx, o.y - hy) >= R + TEE_SIZE / 2) continue;
        let dx = o.x - t.x, dy = o.y - t.y;
        const d = Math.hypot(dx, dy);
        if (d > 0) { dx /= d; dy /= d; } else { dx = 0; dy = -1; }
        dy -= 1.1;
        const n = Math.hypot(dx, dy);
        o.vx += (dx / n) * 10;
        o.vy += (dy / n) * 10 - 1;
        o.stun = 0;
      }
    }

    t.prevJump = inp.jump;
    t.prevWire = inp.wire;
    t.prevFire = inp.fire;
  }

  // 仲間を掛けたフック：相手を強く、自分を少し引き寄せる
  for (const t of w.runners) {
    if (t.wireState !== WIRE_ATTACHED || t.wireRunner < 0) continue;
    const o = byId(w, t.wireRunner);
    if (!o) continue;
    const d = Math.hypot(t.x - o.x, t.y - o.y);
    if (d <= TEE_SIZE * 1.5) continue;
    const dx = (t.x - o.x) / d, dy = (t.y - o.y) / d;
    const a = PHYS.hookDragAccel * (d / PHYS.hookLength);
    const sp = PHYS.hookDragSpeed;
    o.vx = saturatedAdd(-sp, sp, o.vx, a * dx * 1.5);
    o.vy = saturatedAdd(-sp, sp, o.vy, a * dy * 1.5);
    t.vx = saturatedAdd(-sp, sp, t.vx, -a * dx * 0.25);
    t.vy = saturatedAdd(-sp, sp, t.vy, -a * dy * 0.25);
  }

  for (const t of w.runners) {
    const m = PHYS.maxSpeed;
    t.vx = Math.max(-m, Math.min(m, t.vx));
    t.vy = Math.max(-m, Math.min(m, t.vy));
    moveBox(w, t);
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
      t.jumped &= ~2;
    }
    if (tiles.includes('>') && t.finishedTime < 0) t.raceStart = w.tick;
    if (tiles.includes('F') && t.raceStart >= 0 && t.finishedTime < 0) {
      t.finishedTime = Math.round(((w.tick - t.raceStart) / TICK_RATE) * 1000) / 1000;
      ev.finished.push({ runnerId: t.id, time: t.finishedTime });
    }
  }
  return ev;
}

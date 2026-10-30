import {drawCourseArea,drawPickupArt} from './course-art';
// 見た目の描画（背景・タイル・キャラ・フック）。ゲームの進行とは切り離してある。
import { CHANNELS, isSolidChar, LIFT_THICK, liftTop, SAW_THICK, TEE_SIZE, TILE, type MapDef } from '../shared/physics';
import { drawFace } from './face-editor';
import type { Ability } from '../shared/abilities';
import {drawThemeBackground} from './backgrounds';

const R = TEE_SIZE / 2;

export const COLORS = ['#ff7a59', '#4cc9f0', '#f9c74f', '#90be6d', '#c77dff', '#f15bb5', '#43aa8b', '#f8961e'];
export const colorOf = (id: number) => COLORS[id % COLORS.length];

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** 座標から決まる疑似乱数（同じ場所はいつも同じ模様になる） */
function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- 背景 ----------

export function drawBackground(
  g: CanvasRenderingContext2D, map: MapDef, W: number, H: number, camX: number, _camY: number, _zoom: number, now: number,
) {
  drawThemeBackground(g,map.background,W,H,camX);
}

// ---------- タイル ----------

const ROCK: Record<string, [string, string, string, string]> = {
  hill: ['#bd8063', '#96604d', '#6a453c', '#f0c979'],
  cave: ['#839eab', '#637b8d', '#40586d', '#c6eee2'],
  tower: ['#bf7c63', '#985342', '#703d35', '#f6cc7e'],
  factory: ['#b59a72', '#8c7356', '#66533f', '#edd39a'],
  lobby: ['#b8886b', '#90634e', '#674635', '#edcc8f'],
};

export function buildTileLayer(m: MapDef, x0 = 0, y0 = 0, width = m.width, height = m.height): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width * TILE;
  c.height = height * TILE;
  const g = c.getContext('2d')!;
  g.translate(-x0 * TILE, -y0 * TILE);
  const [rock, rockDark, rockEdge, grass]=['#344e6e','#273c59','#1c2d46','#98bda2'];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= m.width || y >= m.height ? 'X' : m.tiles[y][x]);
  const solid = (ch: string) => isSolidChar(ch, Array(CHANNELS).fill(false));

  for (let y = y0; y < Math.min(m.height, y0 + height); y++) {
    for (let x = x0; x < Math.min(m.width, x0 + width); x++) {
      const ch = m.tiles[y][x];
      const px = x * TILE, py = y * TILE;
      if (['~','U','O'].includes(ch)) continue; // Transparent areas are drawn once in the live pass.
      if (ch === '#' || ch === 'O') {
        const gr = g.createLinearGradient(px, py, px, py + TILE);
        gr.addColorStop(0, rock);
        gr.addColorStop(1, rockDark);
        g.fillStyle = gr;
        g.fillRect(px, py, TILE, TILE);
        g.strokeStyle='#506887';g.lineWidth=1;g.strokeRect(px+2,py+2,28,28);
        // 外に面した辺の影
        g.fillStyle = rockEdge;
        if (!solid(at(x, y + 1))) g.fillRect(px, py + TILE - 4, TILE, 4);
        if (!solid(at(x - 1, y))) g.fillRect(px, py, 3, TILE);
        if (!solid(at(x + 1, y))) g.fillRect(px + TILE - 3, py, 3, TILE);
        // The golden cap marks the exact collision edge, unlike scenery roofs.
        if (!solid(at(x, y - 1))) {
          g.fillStyle = grass;
          g.fillRect(px, py, TILE, 6);
          g.fillStyle = shade(grass, -0.25);
          g.fillRect(px, py + 6, TILE, 2);
          g.fillStyle = '#fff1cf';g.fillRect(px,py,TILE,2);
          g.fillStyle = shade(grass, -.35);for(let i=0;i<4;i++)g.fillRect(px+i*8,py+2,2,4);
          g.fillStyle = '#e9b661';g.fillRect(px,py+8,TILE,2);
        }
        // Light inner edges and a dark rim separate walls from any background.
        g.fillStyle='#f4dab0';
        if(!solid(at(x-1,y)))g.fillRect(px+2,py,1,TILE);
        if(!solid(at(x+1,y)))g.fillRect(px+TILE-3,py,1,TILE);
        if(!solid(at(x,y+1)))g.fillRect(px,py+TILE-3,TILE,1);
        g.fillStyle='#172034';
        if(!solid(at(x-1,y)))g.fillRect(px,py,2,TILE);
        if(!solid(at(x+1,y)))g.fillRect(px+TILE-2,py,2,TILE);
        if(!solid(at(x,y+1)))g.fillRect(px,py+TILE-2,TILE,2);
      } else if (ch === 'X') {
        const gr = g.createLinearGradient(px, py, px + TILE, py + TILE);
        gr.addColorStop(0, '#c4d8e4');
        gr.addColorStop(1, '#8097ac');
        g.fillStyle = gr;
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(px, py, TILE, 2);
        g.fillRect(px, py, 2, TILE);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(px, py + TILE - 2, TILE, 2);
        g.fillRect(px + TILE - 2, py, 2, TILE);
        g.strokeStyle='#17263f';g.lineWidth=2;g.strokeRect(px+1,py+1,TILE-2,TILE-2);
        g.strokeStyle='#51657a';g.lineWidth=2;g.beginPath();g.moveTo(px+9,py+24);g.lineTo(px+24,py+9);g.stroke();
        g.fillStyle = '#304158';
        for (const [rx, ry] of [[6, 6], [TILE - 6, 6], [6, TILE - 6], [TILE - 6, TILE - 6]]) {
          g.beginPath();
          g.arc(px + rx, py + ry, 2, 0, Math.PI * 2);
          g.fill();
        }
      } else if (ch === '~') {
        g.fillStyle = '#75551c';
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle='#bd8e2c';
        for(let i=0;i<4;i++){g.beginPath();g.moveTo(px+i*8,py);g.lineTo(px+i*8+4,py);g.lineTo(px,py+i*8+4);g.lineTo(px,py+i*8);g.fill();}
        g.fillStyle='#ffe481';
        if(at(x,y-1)!=='~')g.fillRect(px,py,TILE,3);
        if(at(x,y+1)!=='~')g.fillRect(px,py+TILE-3,TILE,3);
        if(at(x-1,y)!=='~')g.fillRect(px,py,2,TILE);
        if(at(x+1,y)!=='~')g.fillRect(px+TILE-2,py,2,TILE);
      } else if (ch === '^') {
        for (let i = 0; i < 2; i++) {
          const bx = px + i * 16;
          const gr = g.createLinearGradient(bx, py, bx + 16, py);
          gr.addColorStop(0, '#d9dde3');
          gr.addColorStop(1, '#7c838d');
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(bx, py + TILE);
          g.lineTo(bx + 8, py + 4);
          g.lineTo(bx + 16, py + TILE);
          g.closePath();
          g.fill();
          g.strokeStyle='#1c2334';g.lineWidth=2;g.stroke();
          g.fillStyle = '#e63946';
          g.beginPath();
          g.moveTo(bx + 5, py + 14);
          g.lineTo(bx + 8, py + 4);
          g.lineTo(bx + 11, py + 14);
          g.fill();
        }
      } else if (ch === 'J') {
        g.fillStyle = '#4a4f5c';
        g.fillRect(px + 2, py + TILE - 5, TILE - 4, 5);
        g.strokeStyle = '#c9ced8';
        g.lineWidth = 2.5;
        g.beginPath();
        for (let i = 0; i <= 4; i++) g.lineTo(px + (i % 2 ? 9 : 23), py + TILE - 6 - i * 3.5);
        g.stroke();
        g.fillStyle = '#ff6fb5';
        g.beginPath();
        g.roundRect(px + 3, py + TILE - 24, TILE - 6, 6, 3);
        g.fill();
      } else if (ch === 'F') {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          g.fillStyle = (i + j) % 2 ? '#ffffff' : '#17191e';
          g.fillRect(px + j * 8, py + i * 8, 8, 8);
        }
      } else if (ch === '>') {
        const gr = g.createLinearGradient(px, 0, px + TILE, 0);
        gr.addColorStop(0, 'rgba(90,170,255,0)');
        gr.addColorStop(0.5, 'rgba(90,170,255,0.45)');
        gr.addColorStop(1, 'rgba(90,170,255,0)');
        g.fillStyle = gr;
        g.fillRect(px, py, TILE, TILE);
      } else if (ch >= '1' && ch <= '5') {
        const heavy = (m.channels?.[ch.charCodeAt(0) - 49]?.need ?? 1) > 1;
        g.fillStyle = '#3d4250';
        g.fillRect(px + 1, py + TILE - (heavy ? 9 : 6), TILE - 2, heavy ? 9 : 6);
        if (heavy) {
          g.fillStyle = 'rgba(255,255,255,0.18)';
          g.fillRect(px + 1, py + TILE - 9, TILE - 2, 2);
          g.fillStyle = '#262a35';
          for (const bx of [5, TILE - 5]) {
            g.beginPath();
            g.arc(px + bx, py + TILE - 4, 1.6, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
  }
  return c;
}

const DOOR_COLORS = ['#ff9f1c', '#2ec4b6', '#5aa9ff', '#9b5de5', '#ff5d8f'];

/** 毎フレーム変わる仕掛けの状態 */
export interface LiveState {
  doors: boolean[];
  /** 離したあと開いている残り tick */
  timers: number[];
  /** スイッチを踏んでいる人数 */
  plates: number[];
  /** リフトの下がり量（px） */
  lifts: number[];
  /** シーソーの傾き（-1 / 1） */
  saws: number[];
}

/** 毎フレーム描く動くタイル（しびれ床の火花・スイッチ・扉・光の橋・リフト） */
export function drawLiveTiles(
  g: CanvasRenderingContext2D, m: MapDef, st: LiveState, x0: number, y0: number, x1: number, y1: number, now: number,
) {
  const doors = st.doors;
  drawLifts(g, m, st, now);
  drawSaws(g, m, st, now);
  for (let y = Math.max(0, y0); y <= Math.min(m.height - 1, y1); y++) {
    const row = m.tiles[y];
    for (let x = Math.max(0, x0); x <= Math.min(m.width - 1, x1); x++) {
      const ch = row[x];
      const px = x * TILE, py = y * TILE;
      if (['~','U','O'].includes(ch) && drawCourseArea(g,ch,px,py,TILE)) continue;
      if (ch === '~') {
        const k = Math.floor(now / 90);
        if (hash(x, y, k) < 0.35) {
          g.strokeStyle = `rgba(255,240,140,${0.5 + hash(x, y, k + 1) * 0.5})`;
          g.lineWidth = 2;
          g.beginPath();
          let lx = px + hash(x, y, k + 2) * 8, ly = py + 4 + hash(x, y, k + 3) * (TILE - 8);
          g.moveTo(lx, ly);
          for (let i = 0; i < 4; i++) { lx += 6; ly += (hash(x, y, k + 4 + i) - 0.5) * 14; g.lineTo(lx, ly); }
          g.stroke();
        }
      } else if (ch >= '1' && ch <= '5') {
        const idx = ch.charCodeAt(0) - 49;
        const heavy = (m.channels?.[idx]?.need ?? 1) > 1;
        const down = heavy ? st.plates[idx] > 0 : doors[idx];
        const lift = heavy ? 3 : 0;
        g.fillStyle = down ? shade(DOOR_COLORS[idx], 0.3) : DOOR_COLORS[idx];
        g.beginPath();
        g.roundRect(px + 4, py + TILE - (down ? 8 : 12) - lift, TILE - 8, down ? 3 : 7, 2);
        g.fill();
        // スイッチの一続きの左端で、人数の目印と残り時間を描く
        if (row[x - 1] !== ch) {
          let n = 1;
          while (row[x + n] === ch) n++;
          drawSwitchInfo(g, m, st, idx, px, py, n * TILE, now);
        }
      } else if (ch >= 'a' && ch <= 'e') {
        const idx = ch.charCodeAt(0) - 97;
        const open = doors[idx];
        const col = DOOR_COLORS[idx];
        // 時間切れが近いと点滅して知らせる
        const closing = open && st.plates[idx] < (m.channels?.[idx]?.need ?? 1) && st.timers[idx] > 0 && st.timers[idx] < 60;
        if (open && !(closing && Math.floor(now / 120) % 2 === 0)) {
          g.strokeStyle = col;
          g.globalAlpha = 0.35;
          g.lineWidth = 2;
          g.setLineDash([4, 4]);
          g.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
          g.setLineDash([]);
          g.globalAlpha = 1;
        } else {
          g.globalAlpha = open ? 0.5 : 1;
          g.fillStyle = shade(col, -0.35);
          g.fillRect(px, py, TILE, TILE);
          g.fillStyle = col;
          g.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(px + 3, py + 3, TILE - 6, 4);
          g.strokeStyle = 'rgba(0,0,0,0.25)';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(px + 6, py + TILE - 6);
          g.lineTo(px + TILE - 6, py + 6);
          g.stroke();
          g.globalAlpha = 1;
        }
      } else if (ch >= 'A' && ch <= 'E') {
        drawBridge(g, row, x, y, ch.charCodeAt(0) - 65, doors[ch.charCodeAt(0) - 65], now);
      }
    }
  }
}

/** 光の橋：現れている間は光る板、消えている間は輪郭の粒だけ */
function drawBridge(g: CanvasRenderingContext2D, row: string, x: number, y: number, idx: number, on: boolean, now: number) {
  const px = x * TILE, py = y * TILE;
  const col = DOOR_COLORS[idx];
  const left = row[x - 1] !== row[x], right = row[x + 1] !== row[x];
  if (on) {
    const gr = g.createLinearGradient(0, py, 0, py + TILE);
    gr.addColorStop(0, shade(col, 0.55));
    gr.addColorStop(0.25, col);
    gr.addColorStop(1, 'rgba(20,40,90,0.15)');
    g.globalAlpha = 0.85;
    g.fillStyle = gr;
    g.fillRect(px, py, TILE, TILE * 0.6);
    g.globalAlpha = 1;
    g.fillStyle = '#ffffff';
    g.fillRect(px, py, TILE, 2);
    // 流れる光の筋
    const t = (now / 6 + x * 9) % 96;
    if (t < TILE) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.moveTo(px + t, py + 2);
      g.lineTo(px + t + 8, py + 2);
      g.lineTo(px + t + 2, py + TILE * 0.6);
      g.lineTo(px + t - 6, py + TILE * 0.6);
      g.fill();
    }
    // 下にこぼれる光
    const glow = g.createLinearGradient(0, py + TILE * 0.6, 0, py + TILE * 1.6);
    glow.addColorStop(0, `${col}55`);
    glow.addColorStop(1, `${col}00`);
    g.fillStyle = glow;
    g.fillRect(px, py + TILE * 0.6, TILE, TILE);
    if (left || right) {
      g.fillStyle = shade(col, 0.6);
      g.fillRect(left ? px : px + TILE - 3, py - 2, 3, TILE * 0.6 + 4);
    }
  } else {
    g.fillStyle = `${col}66`;
    for (let i = 0; i < 4; i++) g.fillRect(px + 2 + i * 8, py, 4, 2);
    const k = (now / 1600 + hash(x, y, 3)) % 1;
    g.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`;
    g.beginPath();
    g.arc(px + 6 + hash(x, y, 4) * 20, py - k * 22, 1.6, 0, Math.PI * 2);
    g.fill();
  }
}

/** 二人スイッチの人数の目印と、離したあとの残り時間 */
function drawSwitchInfo(
  g: CanvasRenderingContext2D, m: MapDef, st: LiveState, idx: number, px: number, py: number, w: number, now: number,
) {
  const ch = m.channels?.[idx];
  const need = ch?.need ?? 1;
  const col = DOOR_COLORS[idx];
  const cx = px + w / 2, cy = py - 46;
  if (need > 1) {
    // 人の頭の形の目印を並べた札。踏んでいる人数ぶん光る
    const bw = need * 24 + 8;
    g.fillStyle = 'rgba(12,16,32,0.6)';
    g.beginPath();
    g.roundRect(cx - bw / 2, cy - 14, bw, 28, 14);
    g.fill();
    g.strokeStyle = `${col}aa`;
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = 'rgba(12,16,32,0.6)';
    g.fillRect(cx - 1.5, cy + 14, 3, py + TILE - 12 - cy - 14);
    for (let i = 0; i < need; i++) {
      const hx = cx + (i - (need - 1) / 2) * 24;
      const lit = i < st.plates[idx];
      if (lit) {
        const gl = g.createRadialGradient(hx, cy, 2, hx, cy, 16);
        gl.addColorStop(0, `${col}aa`);
        gl.addColorStop(1, `${col}00`);
        g.fillStyle = gl;
        g.beginPath();
        g.arc(hx, cy, 16, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = lit ? col : 'rgba(255,255,255,0.08)';
      g.strokeStyle = lit ? '#fff' : `${col}cc`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(hx, cy, 9, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = lit ? '#fff' : `${col}cc`;
      for (const ex of [-3, 3]) {
        g.beginPath();
        g.ellipse(hx + ex, cy - 1, 1.5, 2.5, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const hold = ch?.hold ?? 0;
  const t = st.timers[idx];
  if (hold > 0 && t > 0 && st.plates[idx] < need) {
    // 残り時間の輪（終わりが近いと点滅）
    const ry = cy - (need > 1 ? 32 : 18);
    if (t >= 60 || Math.floor(now / 120) % 2) {
      g.strokeStyle = 'rgba(10,14,30,0.6)';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(cx, ry, 10, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = col;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(cx, ry, 10, -Math.PI / 2, -Math.PI / 2 + (t / hold) * Math.PI * 2);
      g.stroke();
    }
  }
}

// シーソーの見た目の傾き（ゆっくり追いかけ、跳ね上げた直後は少し揺れる）
const sawAngle = new Map<string, { a: number; v: number; at: number }>();

function drawSaws(g: CanvasRenderingContext2D, m: MapDef, st: LiveState, now: number) {
  (m.saws ?? []).forEach((s, i) => {
    const key = `${m.id}:${i}`;
    const target = (st.saws[i] ?? -1) * 0.05;
    const cur = sawAngle.get(key) ?? { a: target, v: 0, at: now };
    const dt = Math.min(50, now - cur.at) / 16;
    // ばねのように追いかける
    cur.v += (target - cur.a) * 0.18 * dt;
    cur.v *= Math.pow(0.78, dt);
    cur.a += cur.v * dt;
    cur.at = now;
    sawAngle.set(key, cur);

    const cx = s.x * TILE, y0 = s.top * TILE, half = s.half * TILE;
    // 支点の台
    const baseY = (s.top + 2) * TILE;
    const gr = g.createLinearGradient(cx - 22, 0, cx + 22, 0);
    gr.addColorStop(0, '#5a4a3c');
    gr.addColorStop(0.5, '#9a7b5c');
    gr.addColorStop(1, '#4a3c30');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(cx, y0 + SAW_THICK / 2);
    g.lineTo(cx + 26, baseY - TILE);
    g.lineTo(cx - 26, baseY - TILE);
    g.closePath();
    g.fill();
    g.fillStyle = '#d7dce4';
    g.beginPath();
    g.arc(cx, y0 + SAW_THICK / 2, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3b424c';
    g.beginPath();
    g.arc(cx, y0 + SAW_THICK / 2, 2.5, 0, Math.PI * 2);
    g.fill();

    // 板（木の板に金具）
    g.save();
    g.translate(cx, y0 + SAW_THICK / 2);
    g.rotate(cur.a);
    const pg = g.createLinearGradient(0, -SAW_THICK / 2, 0, SAW_THICK / 2);
    pg.addColorStop(0, '#e2b07a');
    pg.addColorStop(0.5, '#b9824f');
    pg.addColorStop(1, '#7d5333');
    g.fillStyle = pg;
    g.beginPath();
    g.roundRect(-half, -SAW_THICK / 2, half * 2, SAW_THICK, 4);
    g.fill();
    g.strokeStyle = 'rgba(70,40,20,0.35)';
    g.lineWidth = 1;
    for (let k = 1; k < s.half * 2; k++) {
      g.beginPath();
      g.moveTo(-half + k * TILE, -SAW_THICK / 2 + 2);
      g.lineTo(-half + k * TILE, SAW_THICK / 2 - 2);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(-half + 3, -SAW_THICK / 2 + 1, half * 2 - 6, 2);
    // 両端の金具と、跳ばす側を示す矢印
    for (const sd of [-1, 1]) {
      g.fillStyle = '#9aa4b1';
      g.fillRect(sd < 0 ? -half : half - 8, -SAW_THICK / 2, 8, SAW_THICK);
      const up = (st.saws[i] ?? -1) !== sd;
      const bob = Math.sin(now / 200) * 2;
      if (up) {
        g.fillStyle = 'rgba(255,224,102,0.85)';
        const ax = sd * (half - 26);
        g.beginPath();
        g.moveTo(ax, -SAW_THICK / 2 - 22 + bob);
        g.lineTo(ax + 7, -SAW_THICK / 2 - 13 + bob);
        g.lineTo(ax - 7, -SAW_THICK / 2 - 13 + bob);
        g.closePath();
        g.fill();
      }
    }
    g.restore();
  });
}

/** 昇降リフト：滑車から吊った床。スイッチが入ると上がる */
function drawLifts(g: CanvasRenderingContext2D, m: MapDef, st: LiveState, now: number) {
  (m.lifts ?? []).forEach((l, i) => {
    const off = st.lifts[i] ?? 0;
    const x0 = l.x * TILE, x1 = (l.x + l.w) * TILE, w = x1 - x0;
    const top = liftTop(l, off);
    const col = DOOR_COLORS[l.ch - 1];
    const on = st.doors[l.ch - 1];
    const py = l.top * TILE - TILE * 2.5;
    // 案内の柱
    for (const rx of [x0 + 6, x1 - 6]) {
      const gr = g.createLinearGradient(rx - 3, 0, rx + 3, 0);
      gr.addColorStop(0, '#5b6470');
      gr.addColorStop(0.5, '#a9b3bf');
      gr.addColorStop(1, '#5b6470');
      g.fillStyle = gr;
      g.globalAlpha = 0.55;
      g.fillRect(rx - 3, py, 6, l.bottom * TILE - py);
      g.globalAlpha = 1;
    }
    g.fillStyle = '#4a525e';
    g.fillRect(x0, py - 6, w, 8);
    // 滑車
    const wx = (x0 + x1) / 2;
    g.strokeStyle = '#2b3038';
    g.lineWidth = 1.5;
    for (const sx of [x0 + 12, x1 - 12]) {
      g.beginPath();
      g.moveTo(sx, py + 10);
      g.lineTo(sx, top);
      g.stroke();
    }
    g.save();
    g.translate(wx, py + 4);
    g.rotate(-off / 14);
    g.fillStyle = '#c9d0d9';
    g.strokeStyle = '#3b424c';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, 13, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    for (let k = 0; k < 3; k++) {
      g.rotate(Math.PI / 3);
      g.fillRect(-11, -1.5, 22, 3);
    }
    g.fillStyle = col;
    g.beginPath();
    g.arc(0, 0, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.strokeStyle = '#2b3038';
    g.beginPath();
    g.moveTo(x0 + 12, py + 10);
    g.lineTo(wx - 10, py + 10);
    g.moveTo(wx + 10, py + 10);
    g.lineTo(x1 - 12, py + 10);
    g.stroke();

    // 床
    const gr = g.createLinearGradient(0, top, 0, top + LIFT_THICK);
    gr.addColorStop(0, '#d5dbe3');
    gr.addColorStop(0.4, '#9aa4b1');
    gr.addColorStop(1, '#5d6673');
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(x0, top, w, LIFT_THICK, 3);
    g.fill();
    g.save();
    g.beginPath();
    g.rect(x0 + 4, top + LIFT_THICK - 7, w - 8, 5);
    g.clip();
    for (let sx = x0 - 8; sx < x1; sx += 10) {
      g.fillStyle = '#f4c430';
      g.beginPath();
      g.moveTo(sx, top + LIFT_THICK);
      g.lineTo(sx + 5, top + LIFT_THICK);
      g.lineTo(sx + 10, top + LIFT_THICK - 8);
      g.lineTo(sx + 5, top + LIFT_THICK - 8);
      g.fill();
    }
    g.restore();
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.5;
    g.fillRect(x0 + 2, top, w - 4, 2);
    g.globalAlpha = 1;
    // 動いている間は色のランプが光る
    const blink = on && off > 0 ? 0.6 + 0.4 * Math.sin(now / 90) : on ? 1 : 0.35;
    for (const lx of [x0 + 8, x1 - 8]) {
      g.fillStyle = col;
      g.globalAlpha = blink;
      g.beginPath();
      g.arc(lx, top + 5, 3, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
  });
}

// ---------- キャラとフック ----------

export interface RunnerLook {
  hammerBrace?:boolean;wheelieAge?:number;gesture?:number;gestureAge?:number;
  ability?:Ability;ghostActive?:boolean;face?:string;shotAge?:number;
  id: number; x: number; y: number; vx: number; grounded: boolean;
  stun: number; aimX: number; aimY: number; hammerAge: number;
  name: string; me: boolean;
  spitCharge?:number; spitAge?:number;
}

export function drawHook(g: CanvasRenderingContext2D, id: number, x0: number, y0: number, x1: number, y1: number) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d < 1) return;
  const ux = (x1 - x0) / d, uy = (y1 - y0) / d;
  const col = colorOf(id);
  // 鎖の輪
  const n = Math.floor(d / 9);
  for (let i = 0; i < n; i++) {
    const cx = x0 + ux * (i * 9 + 4.5), cy = y0 + uy * (i * 9 + 4.5);
    g.strokeStyle = i % 2 ? '#d7dce4' : shade(col, 0.2);
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(cx, cy, 5, i % 2 ? 1.5 : 3, Math.atan2(uy, ux), 0, Math.PI * 2);
    g.stroke();
  }
  // 先端のかぎ爪
  g.save();
  g.translate(x1, y1);
  g.rotate(Math.atan2(uy, ux));
  g.fillStyle = '#e8ecf2';
  g.strokeStyle = '#59606b';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(6, 0);
  g.quadraticCurveTo(0, -9, -6, -6);
  g.lineTo(-2, -2);
  g.lineTo(-4, 0);
  g.lineTo(-2, 2);
  g.lineTo(-6, 6);
  g.quadraticCurveTo(0, 9, 6, 0);
  g.fill();
  g.stroke();
  g.restore();
}

export function drawRunner(g: CanvasRenderingContext2D, r: RunnerLook, now: number) {
  const color = colorOf(r.id);
  const stunned = r.stun > 0;
  const face = r.aimX >= 0 ? 1 : -1;
  const body = stunned ? '#a9b4c2' : '#f5c9a5';
  if(r.ability==='bicycle'){
    g.save();g.translate(r.x-19*face,r.y+28);g.rotate((r.wheelieAge??100)<30?-face*Math.sin((r.wheelieAge??0)/30*Math.PI)*.45:0);g.translate(-(r.x-19*face),-(r.y+28));
    g.strokeStyle='#23304b';g.lineWidth=4;for(const dx of [-19,19]){g.beginPath();g.arc(r.x+dx,r.y+28,11,0,Math.PI*2);g.stroke();}
    g.strokeStyle='#e94a5e';g.lineWidth=3;g.beginPath();g.moveTo(r.x-19,r.y+28);g.lineTo(r.x-5,r.y+10);g.lineTo(r.x+19,r.y+28);g.lineTo(r.x-19,r.y+28);g.lineTo(r.x+6,r.y+14);g.lineTo(r.x+19,r.y+28);g.lineTo(r.x+14,r.y+5);g.stroke();
    g.save();g.translate(r.x+14,r.y+5);g.rotate((r.shotAge??100)<12?Math.sin((r.shotAge??0)/12*Math.PI)*1.2:0);g.strokeStyle='#ffd578';g.beginPath();g.moveTo(-4,0);g.lineTo(10,-3);g.stroke();g.restore();
  }
  if(r.ability==='bicycle')g.restore();
  const puff=r.spitCharge?Math.sin((1-r.spitCharge/19)*Math.PI/2):0;

  // 足（歩くと交互に動く、空中では縮める）
  const walking = r.grounded && Math.abs(r.vx) > 0.6;
  const ph = walking ? Math.sin(r.x / 7) : 0;
  g.fillStyle = shade(body, -0.45);
  for (const s of [-1, 1]) {
    const fx = r.x + s * 6 + (walking ? s * ph * 4 : 0);
    const fy = r.y + R - (r.grounded ? 1 : 4) - (walking ? Math.max(0, s * ph) * 3 : 0);
    g.beginPath();
    g.ellipse(fx + face * 2, fy, 7, 4.5, 0, 0, Math.PI * 2);
    g.fill();
  }

  // ハンマー（ねらう方向に持つ。振った直後は大きく振り下ろす）
  if(['hammer','basic','ghost'].includes(r.ability??'')){
  const swing = r.hammerAge >= 0 && r.hammerAge < 8 ? Math.sin((r.hammerAge / 8) * Math.PI) * 1.4 : 0;
  const ha = r.hammerBrace?Math.PI/2:Math.atan2(r.aimY, r.aimX) - face * (0.9 - swing);
  g.save();
  g.translate(r.x, r.y);
  g.rotate(ha);
  g.fillStyle = '#8a5a3b';
  g.fillRect(6, -2, 20, 4);
  g.fillStyle = '#b8c0cc';
  g.fillRect(22, -8, 9, 16);
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.fillRect(22, -8, 9, 3);
  g.restore();

  }
  if(r.ability==='hand'){
    const gesture=(r.gestureAge??100)<65?(r.gesture??2):2;
    g.save();g.translate(r.x+r.aimX*48,r.y+r.aimY*48);g.rotate(Math.atan2(r.aimY,r.aimX)+Math.PI/2);
    g.fillStyle='#fff';g.strokeStyle='#9aacc0';g.lineWidth=2;
    // A 48px glove: the fingers themselves change for rock, scissors and paper.
    g.beginPath();g.roundRect(-15,-3,30,24,8);g.fill();g.stroke();
    const fingers=gesture===0?[8,8,8,8]:gesture===1?[28,31,8,8]:[22,29,31,24];
    for(let i=0;i<4;i++){g.beginPath();g.roundRect(-18+i*9,-fingers[i]+7,9,fingers[i],4);g.fill();g.stroke();}
    g.save();g.translate(-16,10);g.rotate(-.65);g.beginPath();g.roundRect(-5,-13,10,23,5);g.fill();g.stroke();g.restore();
    g.restore();
  }
  drawFace(g,r.face??'',r.x,r.y,34+puff*2);

  // 目
  const ex = r.x + r.aimX * 3, ey = r.y - 1 + r.aimY * 2;
  if (stunned) {
    g.strokeStyle = '#2b2d42';
    g.lineWidth = 2;
    for (const dx of [-5, 5]) {
      g.beginPath();
      g.moveTo(ex + dx - 3, ey - 3); g.lineTo(ex + dx + 3, ey + 3);
      g.moveTo(ex + dx + 3, ey - 3); g.lineTo(ex + dx - 3, ey + 3);
      g.stroke();
    }
    // しびれの火花
    g.strokeStyle = '#ffe14d';
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = now / 150 + i * 2.1;
      const sx = r.x + Math.cos(a) * (R + 5), sy = r.y + Math.sin(a) * (R + 5);
      g.beginPath();
      g.moveTo(sx - 4, sy - 4); g.lineTo(sx, sy); g.lineTo(sx - 2, sy + 2); g.lineTo(sx + 4, sy + 5);
      g.stroke();
    }
  } else {
    const blink = (Math.floor(now / 100) + r.id * 7) % 38 === 0;
    for (const dx of [-5, 5]) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(ex + dx, ey, 4, blink ? 0.8 : 5, 0, 0, Math.PI * 2);
      g.fill();
      if (!blink) {
        g.fillStyle = '#1f2233';
        g.beginPath();
        g.ellipse(ex + dx + r.aimX * 1.5, ey + r.aimY * 2, 2, 3, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  if(puff>0){
    g.fillStyle='#fff1c977';
    for(const side of [-1,1]){g.beginPath();g.ellipse(r.x+side*11,r.y+5,3+puff*3,4,0,0,Math.PI*2);g.fill();}
  }
  if(puff>0 || (r.spitAge!==undefined&&r.spitAge>=18&&r.spitAge<32)){
    g.fillStyle='#38202e';g.beginPath();g.ellipse(r.x+face*6,r.y+7,puff>0?2:4,puff>0?1:5,0,0,Math.PI*2);g.fill();
  }
  if(r.ability==='bun'){
    g.save();g.translate(r.x,r.y-12);g.fillStyle='#191b26';g.strokeStyle='#080b12';g.lineWidth=1.5;
    g.beginPath();g.ellipse(0,0,17,12,0,Math.PI,Math.PI*2);g.closePath();g.fill();g.stroke();
    g.strokeStyle='#d9474c';g.lineWidth=3;g.beginPath();g.moveTo(-16,0);g.lineTo(16,0);g.moveTo(0,-11);g.lineTo(0,-2);g.stroke();
    g.fillStyle='#e34b50';g.beginPath();g.arc(0,-13,3,0,Math.PI*2);g.fill();g.restore();
  }
  if(r.ability==='ghost'&&!r.ghostActive)drawPickupArt(g,'P',r.x-36,r.y-24+Math.sin(now/300)*3,20);
  // 名前の札
  if (r.name) {
    g.font = 'bold 12px system-ui, "Hiragino Sans", sans-serif';
    const w = g.measureText(r.name).width + 12;
    g.fillStyle = r.me ? 'rgba(255,255,255,0.9)' : 'rgba(10,14,30,0.55)';
    g.beginPath();
    g.roundRect(r.x - w / 2, r.y - R - 28, w, 17, 8);
    g.fill();
    g.fillStyle = r.me ? '#1b1b2b' : '#fff';
    g.textAlign = 'center';
    g.fillText(r.name, r.x, r.y - R - 15.5);
  }
}

/** ハンマーで叩いたときの衝撃 */
export function drawHammerHit(g: CanvasRenderingContext2D, x: number, y: number, ax: number, ay: number, age: number) {
  if (age < 0 || age >= 10) return;
  const hx = x + ax * R * 1.8, hy = y + ay * R * 1.8;
  g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - age / 10)})`;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(hx, hy, 6 + age * 3, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath();
    g.moveTo(hx + Math.cos(a) * (8 + age * 2), hy + Math.sin(a) * (8 + age * 2));
    g.lineTo(hx + Math.cos(a) * (12 + age * 3), hy + Math.sin(a) * (12 + age * 3));
    g.stroke();
  }
}

// 見た目の描画（背景・タイル・キャラ・フック）。ゲームの進行とは切り離してある。
import { isSolidChar, TEE_SIZE, TILE, type MapDef } from '../shared/physics';

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

interface Theme {
  sky: [string, string, string];
  far: string; mid: string; near: string;
  clouds: boolean; stars: boolean; cave: boolean;
  sun?: string;
}

const THEMES: Record<string, Theme> = {
  hill: { sky: ['#5fb6e8', '#a8dcf2', '#e6f6ef'], far: '#8fb9c9', mid: '#6fa77a', near: '#4f8a5b', clouds: true, stars: false, cave: false, sun: '#fff6c9' },
  cave: { sky: ['#140f26', '#231a3d', '#2d2248'], far: '#2b2145', mid: '#382a58', near: '#45346b', clouds: false, stars: false, cave: true },
  tower: { sky: ['#40275e', '#c4577a', '#f7a267'], far: '#7a4f78', mid: '#5b3a63', near: '#3f2a4d', clouds: true, stars: false, cave: false, sun: '#ffd9a0' },
  lobby: { sky: ['#0f1a3a', '#253a73', '#5a6fa8'], far: '#2f3f72', mid: '#263463', near: '#1d2950', clouds: false, stars: true, cave: false },
};

const ridge = (x: number, seed: number, amp: number) =>
  Math.sin(x * 0.0021 + seed) * amp * 0.5 + Math.sin(x * 0.0053 + seed * 2.1) * amp * 0.3 + Math.sin(x * 0.0127 + seed * 3.7) * amp * 0.2;

export function drawBackground(
  g: CanvasRenderingContext2D, mapId: string, W: number, H: number, camX: number, camY: number, zoom: number, now: number,
) {
  const th = THEMES[mapId] ?? THEMES.hill;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, th.sky[0]);
  sky.addColorStop(0.6, th.sky[1]);
  sky.addColorStop(1, th.sky[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (th.stars) {
    for (let i = 0; i < 90; i++) {
      const sx = ((hash(i, 1) * W * 1.5 - camX * zoom * 0.05) % W + W) % W;
      const sy = hash(i, 2) * H * 0.6;
      const tw = 0.5 + 0.5 * Math.sin(now / 600 + i);
      g.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.6})`;
      g.fillRect(sx, sy, 2, 2);
    }
  }
  if (th.sun) {
    const gr = g.createRadialGradient(W * 0.78, H * 0.22, 0, W * 0.78, H * 0.22, H * 0.35);
    gr.addColorStop(0, th.sun);
    gr.addColorStop(0.15, th.sun);
    gr.addColorStop(0.16, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  if (th.clouds) {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 7; i++) {
      const span = W + 400;
      const cx = (((hash(i, 7) * span + now * 0.006 * (1 + i % 3) - camX * zoom * 0.1) % span) + span) % span - 200;
      const cy = H * (0.1 + hash(i, 8) * 0.3);
      const s = 40 + hash(i, 9) * 50;
      g.beginPath();
      g.ellipse(cx, cy, s * 1.6, s * 0.45, 0, 0, Math.PI * 2);
      g.ellipse(cx - s * 0.6, cy + 4, s * 0.8, s * 0.35, 0, 0, Math.PI * 2);
      g.ellipse(cx + s * 0.5, cy - s * 0.2, s * 0.9, s * 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 遠い山・中くらいの丘・手前の丘（スクロールの速さを変えて奥行きを出す）
  const layers: [string, number, number, number, number][] = th.cave
    ? [[th.far, 0.15, 0.15, 60, 1], [th.mid, 0.3, 0.25, 70, 2], [th.near, 0.5, 0.35, 80, 3]]
    : [[th.far, 0.15, 0.55, 140, 1], [th.mid, 0.3, 0.68, 100, 2], [th.near, 0.5, 0.8, 70, 3]];
  for (const [color, par, base, amp, seed] of layers) {
    g.fillStyle = color;
    g.beginPath();
    const off = camX * zoom * par;
    const yoff = -camY * zoom * par * 0.3;
    if (th.cave) {
      // 天井から垂れる岩
      g.moveTo(0, 0);
      for (let x = 0; x <= W + 16; x += 16) {
        const wx = x + off;
        const spike = Math.max(0, Math.sin(wx * 0.02 + seed) * 0.5 + hash(Math.floor(wx / 48), seed) * 0.8 - 0.3);
        g.lineTo(x, H * base + ridge(wx, seed, amp) + spike * amp * 1.5 + yoff);
      }
      g.lineTo(W, 0);
    } else {
      g.moveTo(0, H);
      for (let x = 0; x <= W + 16; x += 16) g.lineTo(x, H * base + ridge(x + off, seed, amp) + yoff);
      g.lineTo(W, H);
    }
    g.closePath();
    g.fill();
  }
  if (th.cave) {
    // 光る結晶
    for (let i = 0; i < 14; i++) {
      const span = W + 200;
      const cx = (((hash(i, 21) * span * 3 - camX * zoom * 0.4) % span) + span) % span - 100;
      const cy = H * (0.75 + hash(i, 22) * 0.2);
      const glow = 0.5 + 0.5 * Math.sin(now / 900 + i * 1.7);
      g.fillStyle = `rgba(150,110,255,${0.15 + glow * 0.15})`;
      g.beginPath();
      g.arc(cx, cy, 26, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgba(190,160,255,${0.6 + glow * 0.3})`;
      g.beginPath();
      g.moveTo(cx, cy - 18);
      g.lineTo(cx + 6, cy);
      g.lineTo(cx, cy + 8);
      g.lineTo(cx - 6, cy);
      g.closePath();
      g.fill();
    }
  }
}

// ---------- タイル ----------

const ROCK: Record<string, [string, string, string, string]> = {
  hill: ['#8a6b4f', '#73573f', '#5c4532', '#6cc04a'],
  cave: ['#5b5170', '#4a4160', '#3a324d', '#8f7dd0'],
  tower: ['#9b6b55', '#7f5644', '#644235', '#e0a95c'],
  lobby: ['#6a6f8f', '#565b7a', '#444862', '#7fd1c2'],
};

export function buildTileLayer(m: MapDef): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = m.width * TILE;
  c.height = m.height * TILE;
  const g = c.getContext('2d')!;
  const [rock, rockDark, rockEdge, grass] = ROCK[m.id] ?? ROCK.hill;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= m.width || y >= m.height ? 'X' : m.tiles[y][x]);
  const solid = (ch: string) => isSolidChar(ch, [false, false, false, false]) || (ch >= 'a' && ch <= 'd');

  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const ch = m.tiles[y][x];
      const px = x * TILE, py = y * TILE;
      if (ch === '#') {
        const gr = g.createLinearGradient(px, py, px, py + TILE);
        gr.addColorStop(0, rock);
        gr.addColorStop(1, rockDark);
        g.fillStyle = gr;
        g.fillRect(px, py, TILE, TILE);
        // 石の粒
        for (let i = 0; i < 5; i++) {
          const sx = px + 3 + hash(x, y, i) * (TILE - 8), sy = py + 3 + hash(x, y, i + 9) * (TILE - 8);
          const s = 2 + hash(x, y, i + 20) * 4;
          g.fillStyle = hash(x, y, i + 30) > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
          g.beginPath();
          g.ellipse(sx, sy, s, s * 0.7, hash(x, y, i + 40) * 3, 0, Math.PI * 2);
          g.fill();
        }
        // 外に面した辺の影
        g.fillStyle = rockEdge;
        if (!solid(at(x, y + 1))) g.fillRect(px, py + TILE - 4, TILE, 4);
        if (!solid(at(x - 1, y))) g.fillRect(px, py, 3, TILE);
        if (!solid(at(x + 1, y))) g.fillRect(px + TILE - 3, py, 3, TILE);
        // 上が空いていれば草（または苔）
        if (!solid(at(x, y - 1))) {
          g.fillStyle = grass;
          g.fillRect(px, py, TILE, 6);
          g.fillStyle = shade(grass, -0.25);
          g.fillRect(px, py + 6, TILE, 2);
          g.fillStyle = shade(grass, 0.25);
          for (let i = 0; i < 6; i++) {
            const bx = px + 2 + i * 5 + hash(x, y, i + 50) * 3;
            g.fillRect(bx, py - 2 - hash(x, y, i + 60) * 3, 2, 4);
          }
        }
      } else if (ch === 'X') {
        const gr = g.createLinearGradient(px, py, px + TILE, py + TILE);
        gr.addColorStop(0, '#8d99a6');
        gr.addColorStop(1, '#55606b');
        g.fillStyle = gr;
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(px, py, TILE, 2);
        g.fillRect(px, py, 2, TILE);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(px, py + TILE - 2, TILE, 2);
        g.fillRect(px + TILE - 2, py, 2, TILE);
        g.fillStyle = '#3b434b';
        for (const [rx, ry] of [[6, 6], [TILE - 6, 6], [6, TILE - 6], [TILE - 6, TILE - 6]]) {
          g.beginPath();
          g.arc(px + rx, py + ry, 2, 0, Math.PI * 2);
          g.fill();
        }
      } else if (ch === '~') {
        g.fillStyle = 'rgba(255, 214, 64, 0.22)';
        g.fillRect(px, py, TILE, TILE);
        if (!(at(x, y - 1) === '~')) {
          g.fillStyle = 'rgba(255, 230, 120, 0.6)';
          g.fillRect(px, py, TILE, 3);
        }
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
          g.fill();
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
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
          g.fillStyle = (i + j + y) % 2 ? 'rgba(255,255,255,0.75)' : 'rgba(20,20,20,0.6)';
          g.fillRect(px + 8 + j * 8, py + i * 8, 8, 8);
        }
      } else if (ch === '>') {
        const gr = g.createLinearGradient(px, 0, px + TILE, 0);
        gr.addColorStop(0, 'rgba(90,170,255,0)');
        gr.addColorStop(0.5, 'rgba(90,170,255,0.45)');
        gr.addColorStop(1, 'rgba(90,170,255,0)');
        g.fillStyle = gr;
        g.fillRect(px, py, TILE, TILE);
      } else if (ch >= '1' && ch <= '4') {
        g.fillStyle = '#3d4250';
        g.fillRect(px + 1, py + TILE - 6, TILE - 2, 6);
      }
    }
  }
  // 案内の文字は、読みやすいよう縁取りする
  g.font = 'bold 18px system-ui, "Hiragino Sans", sans-serif';
  g.textAlign = 'left';
  g.lineJoin = 'round';
  for (const h of m.hints) {
    g.strokeStyle = 'rgba(10,14,30,0.7)';
    g.lineWidth = 5;
    g.strokeText(h.text, h.x * TILE, h.y * TILE);
    g.fillStyle = '#fff';
    g.fillText(h.text, h.x * TILE, h.y * TILE);
  }
  return c;
}

const DOOR_COLORS = ['#ff9f1c', '#2ec4b6', '#e71d36', '#9b5de5'];

/** 毎フレーム描く動くタイル（しびれ床の火花・スイッチ・扉） */
export function drawLiveTiles(
  g: CanvasRenderingContext2D, m: MapDef, doors: boolean[], x0: number, y0: number, x1: number, y1: number, now: number,
) {
  for (let y = Math.max(0, y0); y <= Math.min(m.height - 1, y1); y++) {
    const row = m.tiles[y];
    for (let x = Math.max(0, x0); x <= Math.min(m.width - 1, x1); x++) {
      const ch = row[x];
      const px = x * TILE, py = y * TILE;
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
      } else if (ch >= '1' && ch <= '4') {
        const idx = ch.charCodeAt(0) - 49;
        const on = doors[idx];
        g.fillStyle = on ? shade(DOOR_COLORS[idx], 0.3) : DOOR_COLORS[idx];
        g.beginPath();
        g.roundRect(px + 4, py + TILE - (on ? 8 : 12), TILE - 8, on ? 3 : 7, 2);
        g.fill();
      } else if (ch >= 'a' && ch <= 'd') {
        const idx = ch.charCodeAt(0) - 97;
        const open = doors[idx];
        const col = DOOR_COLORS[idx];
        if (open) {
          g.strokeStyle = col;
          g.globalAlpha = 0.35;
          g.lineWidth = 2;
          g.setLineDash([4, 4]);
          g.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
          g.setLineDash([]);
          g.globalAlpha = 1;
        } else {
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
        }
      }
    }
  }
}

// ---------- キャラとフック ----------

export interface RunnerLook {
  id: number; x: number; y: number; vx: number; grounded: boolean;
  stun: number; aimX: number; aimY: number; hammerAge: number;
  name: string; me: boolean;
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
  const body = stunned ? '#a9b4c2' : color;

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
  const swing = r.hammerAge >= 0 && r.hammerAge < 8 ? Math.sin((r.hammerAge / 8) * Math.PI) * 1.4 : 0;
  const ha = Math.atan2(r.aimY, r.aimX) - face * (0.9 - swing);
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

  // 体
  const grd = g.createRadialGradient(r.x - 5, r.y - 6, 2, r.x, r.y, R + 2);
  grd.addColorStop(0, shade(body, 0.45));
  grd.addColorStop(0.6, body);
  grd.addColorStop(1, shade(body, -0.25));
  g.fillStyle = grd;
  g.strokeStyle = shade(body, -0.5);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(r.x, r.y, R, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // はちまき（後ろになびく）
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(r.x, r.y, R - 0.5, Math.PI * 1.07, Math.PI * 1.93);
  g.arc(r.x, r.y, R - 5, Math.PI * 1.9, Math.PI * 1.1, true);
  g.closePath();
  g.fill();
  const tail = -face;
  const wav = Math.sin(now / 120 + r.id) * 3;
  g.beginPath();
  g.moveTo(r.x + tail * (R - 3), r.y - 9);
  g.quadraticCurveTo(r.x + tail * (R + 6), r.y - 12 + wav, r.x + tail * (R + 12), r.y - 6 + wav);
  g.lineTo(r.x + tail * (R + 10), r.y - 3 + wav);
  g.quadraticCurveTo(r.x + tail * (R + 4), r.y - 7, r.x + tail * (R - 3), r.y - 5);
  g.fill();

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

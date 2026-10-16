import {
  createWorld, emptyInput, inZone, isSolidChar, newRunner, stepWorld, TEE_SIZE, TICK_RATE, TILE, WIRE_ATTACHED,
  WIRE_FLYING, type Input, type MapDef, type Runner, type World,
} from '../shared/physics';
import { mapById as stageOrLobby, stageById } from '../shared/maps';
import { PARTY_CAPACITY, type RunnerView, type ServerMsg, type ZoneState } from '../shared/protocol';

type Snap = Extract<ServerMsg, { t: 'snap' }>;

const COLORS = ['#ff7a59', '#4cc9f0', '#f9c74f', '#90be6d', '#c77dff', '#f15bb5', '#43aa8b', '#f8961e'];
const colorOf = (id: number) => COLORS[id % COLORS.length];

export class ClientGame {
  readonly map: MapDef;
  private world: World;
  private me: Runner;
  private pending: { seq: number; input: Input }[] = [];
  private seq = 0;
  private others = new Map<number, { prev: RunnerView; cur: RunnerView; at: number }>();
  private names: Record<number, string> = {};
  private doors = [false, false, false, false];
  private ctx: CanvasRenderingContext2D;
  private staticLayer: HTMLCanvasElement;
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, left: false, right: false };
  private killQueued = false;
  private acc = 0;
  private last = performance.now();
  private raf = 0;
  private smoothX = 0;
  private smoothY = 0;
  private cam = { x: 0, y: 0, zoom: 1 };
  private snapInterval = 40;
  private lastSnapAt = 0;
  private stopped = false;
  private listeners: [EventTarget, string, (e: any) => void][] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    stageId: string,
    readonly youId: number,
    names: Record<number, string>,
    private send: (input: { seq: number; input: Input }) => void,
    private onHud: (timer: number, running: boolean) => void,
    private onInteract: () => void = () => {},
  ) {
    this.map = stageOrLobby(stageId)!;
    this.world = createWorld(this.map);
    this.me = newRunner(youId, this.map);
    this.world.runners.push(this.me);
    this.names = names;
    this.ctx = canvas.getContext('2d')!;
    this.staticLayer = this.buildStaticLayer();
    this.bindInput();
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  private zoneStates: ZoneState[] = [];
  private bubbles = new Map<number, { text: string; until: number }>();

  setNames(n: Record<number, string>) { this.names = n; }

  /** チャットの吹き出しを頭の上に出す */
  bubble(id: number, text: string) {
    this.bubbles.set(id, { text: text.length > 40 ? `${text.slice(0, 40)}…` : text, until: performance.now() + 5000 });
  }

  queueKill() { this.killQueued = true; }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    for (const [t, ev, fn] of this.listeners) t.removeEventListener(ev, fn);
  }

  onSnap(s: Snap) {
    const now = performance.now();
    if (this.lastSnapAt) this.snapInterval = this.snapInterval * 0.9 + (now - this.lastSnapAt) * 0.1;
    this.lastSnapAt = now;
    this.doors = s.doors;
    if (s.zones) this.zoneStates = s.zones;
    const seen = new Set<number>();
    for (const v of s.others) {
      seen.add(v.id);
      const o = this.others.get(v.id);
      this.others.set(v.id, { prev: o ? o.cur : v, cur: v, at: now });
    }
    for (const id of [...this.others.keys()]) if (!seen.has(id)) this.others.delete(id);
    if (!s.me) return;

    // サーバーの状態から未確認の入力をやり直す（クライアント予測の補正）
    const beforeX = this.me.x + this.smoothX, beforeY = this.me.y + this.smoothY;
    this.pending = this.pending.filter((p) => p.seq > s.lastSeq);
    this.me = { ...s.me };
    this.world = createWorld(this.map);
    this.world.tick = s.tick;
    this.world.doorsOpen = [...s.doors];
    this.world.runners = [this.me, ...s.others.map((v) => viewToRunner(v, this.map))];
    for (const p of this.pending) this.predictStep(p.input);
    this.smoothX = beforeX - this.me.x;
    this.smoothY = beforeY - this.me.y;
    if (Math.hypot(this.smoothX, this.smoothY) > TILE * 4) { this.smoothX = 0; this.smoothY = 0; }
  }

  private predictStep(input: Input) {
    const inputs = new Map<number, Input>([[this.me.id, input]]);
    // 他プレイヤーの入力は分からないので、ワイヤーだけは握ったままとみなす
    for (const r of this.world.runners) {
      if (r !== this.me) inputs.set(r.id, { ...emptyInput(), wire: r.wireState !== 0, aimX: r.aimX, aimY: r.aimY });
    }
    stepWorld(this.world, inputs);
  }

  private sampleInput(): Input {
    const k = this.keys;
    const i = emptyInput();
    i.left = k.has('KeyA') || k.has('ArrowLeft');
    i.right = k.has('KeyD') || k.has('ArrowRight');
    i.up = k.has('KeyW') || k.has('ArrowUp');
    i.down = k.has('KeyS') || k.has('ArrowDown');
    i.jump = k.has('Space');
    i.wire = this.mouse.right || k.has('KeyE') || k.has('ShiftLeft');
    i.fire = this.mouse.left || k.has('KeyQ');
    i.kill = this.killQueued;
    this.killQueued = false;
    const wx = this.mouse.x / this.cam.zoom + this.cam.x;
    const wy = this.mouse.y / this.cam.zoom + this.cam.y;
    i.aimX = wx - (this.me.x + this.smoothX);
    i.aimY = wy - (this.me.y + this.smoothY);
    if (Math.hypot(i.aimX, i.aimY) < 1) { i.aimX = 1; i.aimY = 0; }
    return i;
  }

  private frame = (now: number) => {
    if (this.stopped) return;
    const dt = Math.min(250, now - this.last);
    this.last = now;
    this.acc += dt;
    const step = 1000 / TICK_RATE;
    while (this.acc >= step) {
      this.acc -= step;
      const input = this.sampleInput();
      const seq = ++this.seq;
      this.pending.push({ seq, input });
      if (this.pending.length > 100) this.pending.shift();
      this.send({ seq, input });
      this.predictStep(input);
    }
    this.smoothX *= 0.85;
    this.smoothY *= 0.85;
    this.render(now);
    const running = this.me.raceStart >= 0 && this.me.finishedTime < 0;
    const t = this.me.finishedTime >= 0 ? this.me.finishedTime
      : running ? (this.world.tick - this.me.raceStart) / TICK_RATE : 0;
    this.onHud(t, running);
    this.raf = requestAnimationFrame(this.frame);
  };

  private on(t: EventTarget, ev: string, fn: (e: any) => void) {
    t.addEventListener(ev, fn);
    this.listeners.push([t, ev, fn]);
  }

  private bindInput() {
    this.on(window, 'keydown', (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyK' && !e.repeat) this.killQueued = true;
      if (e.code === 'KeyF' && !e.repeat) this.onInteract();
      this.keys.add(e.code);
    });
    this.on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    this.on(window, 'blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    this.on(window, 'resize', () => this.resize());
    this.on(this.canvas, 'contextmenu', (e) => e.preventDefault());
    this.on(this.canvas, 'mousemove', (e: MouseEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
    });
    this.on(this.canvas, 'mousedown', (e: MouseEvent) => {
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    this.on(window, 'mouseup', (e: MouseEvent) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
  }

  private resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.canvas.clientWidth * dpr);
    this.canvas.height = Math.floor(this.canvas.clientHeight * dpr);
    this.cam.zoom = this.canvas.height / (TILE * 20);
  }

  private buildStaticLayer(): HTMLCanvasElement {
    const m = this.map;
    const c = document.createElement('canvas');
    c.width = m.width * TILE;
    c.height = m.height * TILE;
    const g = c.getContext('2d')!;
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const ch = m.tiles[y][x];
        const px = x * TILE, py = y * TILE;
        if (ch === '#') {
          g.fillStyle = '#6b5a4b';
          g.fillRect(px, py, TILE, TILE);
          g.fillStyle = '#7d6a58';
          g.fillRect(px + 2, py + 2, TILE - 4, TILE / 2 - 2);
          if (y > 0 && !isSolidChar(m.tiles[y - 1][x], [true, true, true, true])) {
            g.fillStyle = '#7fb069';
            g.fillRect(px, py, TILE, 5);
          }
        } else if (ch === 'X') {
          g.fillStyle = '#5c6670';
          g.fillRect(px, py, TILE, TILE);
          g.strokeStyle = '#86919c';
          g.lineWidth = 2;
          g.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        } else if (ch === '~') {
          g.fillStyle = 'rgba(255, 221, 87, 0.35)';
          g.fillRect(px, py, TILE, TILE);
          g.strokeStyle = 'rgba(255, 221, 87, 0.9)';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(px, py + TILE / 2);
          for (let i = 1; i <= 4; i++) g.lineTo(px + (i * TILE) / 4, py + TILE / 2 + (i % 2 ? -6 : 6));
          g.stroke();
        } else if (ch === '^') {
          g.fillStyle = '#e63946';
          g.beginPath();
          for (let i = 0; i < 2; i++) {
            g.moveTo(px + i * 16, py + TILE);
            g.lineTo(px + i * 16 + 8, py + 6);
            g.lineTo(px + i * 16 + 16, py + TILE);
          }
          g.fill();
        } else if (ch === 'J') {
          g.fillStyle = '#ff6fb5';
          g.fillRect(px + 2, py + TILE - 10, TILE - 4, 10);
          g.strokeStyle = '#ffd1e8';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(px + 6, py + TILE - 12);
          g.lineTo(px + 16, py + TILE - 22);
          g.lineTo(px + 26, py + TILE - 12);
          g.stroke();
        } else if (ch === '>' || ch === 'F') {
          for (let i = 0; i < 4; i++) {
            g.fillStyle = (i + y) % 2 ? 'rgba(255,255,255,0.35)' : (ch === 'F' ? 'rgba(80,220,120,0.35)' : 'rgba(80,160,255,0.35)');
            g.fillRect(px + 8, py + i * 8, 16, 8);
          }
        } else if (ch >= '1' && ch <= '4') {
          g.fillStyle = '#ffb703';
          g.fillRect(px + 2, py + TILE - 8, TILE - 4, 8);
        }
      }
    }
    g.font = 'bold 18px system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.textAlign = 'left';
    for (const h of m.hints) g.fillText(h.text, h.x * TILE, h.y * TILE);
    return c;
  }

  private othersInterpolated(now: number): RunnerView[] {
    const out: RunnerView[] = [];
    for (const o of this.others.values()) {
      const a = Math.min(1, (now - o.at) / this.snapInterval);
      const l = (p: number, q: number) => p + (q - p) * a;
      out.push({ ...o.cur, x: l(o.prev.x, o.cur.x), y: l(o.prev.y, o.cur.y), wx: l(o.prev.wx, o.cur.wx), wy: l(o.prev.wy, o.cur.wy) });
    }
    return out;
  }

  private render(now: number) {
    const g = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const z = this.cam.zoom;
    const meX = this.me.x + this.smoothX, meY = this.me.y + this.smoothY;
    const vw = W / z, vh = H / z;
    const mw = this.map.width * TILE, mh = this.map.height * TILE;
    this.cam.x = Math.max(0, Math.min(mw - vw, meX - vw / 2));
    this.cam.y = Math.max(0, Math.min(mh - vh, meY - vh / 2));
    if (vw > mw) this.cam.x = (mw - vw) / 2;
    if (vh > mh) this.cam.y = (mh - vh) / 2;

    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1d2b53');
    sky.addColorStop(1, '#3a4f7a');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    g.save();
    g.scale(z, z);
    g.translate(-this.cam.x, -this.cam.y);
    g.drawImage(this.staticLayer, 0, 0);
    this.drawZones(g);

    // 扉
    for (let y = 0; y < this.map.height; y++) {
      const row = this.map.tiles[y];
      for (let x = 0; x < this.map.width; x++) {
        const ch = row[x];
        if (ch < 'a' || ch > 'd') continue;
        const open = this.doors[ch.charCodeAt(0) - 97];
        g.fillStyle = open ? 'rgba(255,183,3,0.15)' : '#e85d04';
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (!open) {
          g.fillStyle = '#ffb703';
          g.fillRect(x * TILE, y * TILE + 12, TILE, 8);
        }
      }
    }

    const views = this.othersInterpolated(now);
    const all: { id: number; x: number; y: number; ws: number; wx: number; wy: number; wr: number; st: number; ax: number; ay: number; ct: number; tick: number }[] = [
      ...views.map((v) => ({ ...v, tick: this.world.tick })),
      {
        id: this.me.id, x: meX, y: meY, ws: this.me.wireState, wx: this.me.wireX, wy: this.me.wireY, wr: this.me.wireRunner,
        st: this.me.stun, ax: this.me.aimX, ay: this.me.aimY, ct: this.me.cannonTick, tick: this.world.tick,
      },
    ];
    const pos = new Map(all.map((r) => [r.id, r]));

    // ワイヤー
    for (const r of all) {
      if (r.ws !== WIRE_FLYING && r.ws !== WIRE_ATTACHED) continue;
      let tx = r.wx, ty = r.wy;
      if (r.ws === WIRE_ATTACHED && r.wr >= 0) {
        const o = pos.get(r.wr);
        if (o) { tx = o.x; ty = o.y; }
      }
      g.strokeStyle = colorOf(r.id);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(r.x, r.y);
      g.lineTo(tx, ty);
      g.stroke();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(tx, ty, 4, 0, Math.PI * 2);
      g.fill();
    }

    for (const r of all) this.drawRunner(g, r);
    this.drawBubbles(g, all, now);
    this.drawZonePrompt(g, meX, meY);

    g.restore();
  }

  private drawZones(g: CanvasRenderingContext2D) {
    for (const z of this.map.zones ?? []) {
      const st = this.zoneStates.find((x) => x.id === z.id);
      const stage = stageById(z.stageId);
      const x = z.x * TILE, y = z.y * TILE, w = z.w * TILE, h = z.h * TILE;
      const party = z.kind === 'party';
      g.fillStyle = party ? 'rgba(255,122,89,0.18)' : 'rgba(76,201,240,0.18)';
      g.fillRect(x, y, w, h);
      g.strokeStyle = party ? '#ff7a59' : '#4cc9f0';
      g.lineWidth = 3;
      g.setLineDash(party ? [] : [10, 6]);
      g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      g.setLineDash([]);
      g.textAlign = 'center';
      g.fillStyle = '#fff';
      g.font = 'bold 18px system-ui, sans-serif';
      g.fillText(stage?.name ?? '', x + w / 2, y - 30);
      g.font = '14px system-ui, sans-serif';
      g.fillStyle = 'rgba(255,255,255,0.8)';
      const count = st?.count ?? 0;
      const label = party
        ? `協力の台 ${count}/${PARTY_CAPACITY}人${stage && stage.minPlayers > 1 ? `（${stage.minPlayers}人〜）` : ''}`
        : `フリー入口 ${count}人プレイ中`;
      g.fillText(label, x + w / 2, y - 10);
      if (party && st && st.countdown > 0) {
        g.font = 'bold 64px system-ui, sans-serif';
        g.fillStyle = '#ffe066';
        g.fillText(String(Math.ceil(st.countdown / TICK_RATE)), x + w / 2, y + h / 2 + 10);
      }
    }
  }

  private drawZonePrompt(g: CanvasRenderingContext2D, x: number, y: number) {
    const z = (this.map.zones ?? []).find((q) => inZone(q, this.me.x, this.me.y));
    if (!z) return;
    const counting = (this.zoneStates.find((q) => q.id === z.id)?.countdown ?? 0) > 0;
    const text = z.kind === 'free' ? 'F: このステージに入る' : counting ? '台の上にいる全員で出発します' : 'F: 台の上の全員で出発';
    g.font = 'bold 14px system-ui, sans-serif';
    const w = g.measureText(text).width + 16;
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillRect(x - w / 2, y + 22, w, 24);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.fillText(text, x, y + 39);
  }

  private drawBubbles(g: CanvasRenderingContext2D, all: { id: number; x: number; y: number }[], now: number) {
    for (const r of all) {
      const b = this.bubbles.get(r.id);
      if (!b) continue;
      if (b.until < now) { this.bubbles.delete(r.id); continue; }
      g.font = '14px system-ui, sans-serif';
      const w = Math.min(320, g.measureText(b.text).width + 18);
      const bx = r.x - w / 2, by = r.y - 72;
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.roundRect(bx, by, w, 26, 10);
      g.moveTo(r.x - 6, by + 26);
      g.lineTo(r.x, by + 34);
      g.lineTo(r.x + 6, by + 26);
      g.fill();
      g.fillStyle = '#1b1b1b';
      g.textAlign = 'center';
      g.fillText(b.text, r.x, by + 18, w - 12);
    }
  }

  private drawRunner(
    g: CanvasRenderingContext2D,
    r: { id: number; x: number; y: number; st: number; ax: number; ay: number; ct: number; tick: number },
  ) {
    const R = TEE_SIZE / 2;
    const color = colorOf(r.id);
    const stunned = r.st > 0;

    // エアキャノンの演出
    const age = r.tick - r.ct;
    if (age >= 0 && age < 10) {
      const a = Math.atan2(r.ay, r.ax);
      g.strokeStyle = `rgba(200,240,255,${1 - age / 10})`;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(r.x, r.y, 20 + age * 7, a - 0.6, a + 0.6);
      g.stroke();
    }

    // 体（しずく型のまるいキャラ）
    g.fillStyle = stunned ? '#9aa0a6' : color;
    g.beginPath();
    g.ellipse(r.x, r.y + 1, R, R - 1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.ellipse(r.x - 4, r.y - 5, 6, 4, -0.5, 0, Math.PI * 2);
    g.fill();
    // はちまき
    g.fillStyle = '#fff';
    g.fillRect(r.x - R + 1, r.y - 6, TEE_SIZE - 2, 4);
    const side = r.ax >= 0 ? -1 : 1;
    g.fillRect(r.x + side * (R - 2), r.y - 6, side * 8, 3);
    // 目
    const ex = r.ax * 4, ey = r.ay * 3;
    g.fillStyle = '#1b1b1b';
    if (stunned) {
      g.strokeStyle = '#1b1b1b';
      g.lineWidth = 2;
      for (const dx of [-5, 5]) {
        g.beginPath();
        g.moveTo(r.x + dx - 3, r.y + 1);
        g.lineTo(r.x + dx + 3, r.y + 5);
        g.moveTo(r.x + dx + 3, r.y + 1);
        g.lineTo(r.x + dx - 3, r.y + 5);
        g.stroke();
      }
      g.strokeStyle = '#ffdd57';
      g.beginPath();
      g.moveTo(r.x - 10, r.y - R - 4);
      g.lineTo(r.x - 4, r.y - R - 10);
      g.lineTo(r.x + 2, r.y - R - 4);
      g.lineTo(r.x + 8, r.y - R - 10);
      g.stroke();
    } else {
      for (const dx of [-5, 5]) {
        g.beginPath();
        g.ellipse(r.x + dx + ex, r.y + 3 + ey, 2.5, 3.5, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 名前
    const name = this.names[r.id] ?? '';
    g.font = 'bold 12px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = r.id === this.youId ? '#fff' : 'rgba(255,255,255,0.8)';
    g.fillText(name, r.x, r.y - R - 14);
  }
}

function viewToRunner(v: RunnerView, map: MapDef): Runner {
  const r = newRunner(v.id, map);
  r.x = v.x; r.y = v.y; r.vx = v.vx; r.vy = v.vy;
  r.wireState = v.ws; r.wireX = v.wx; r.wireY = v.wy; r.wireRunner = v.wr;
  r.stun = v.st; r.aimX = v.ax; r.aimY = v.ay; r.cannonTick = v.ct;
  r.finishedTime = v.ft; r.raceStart = v.rs; r.grounded = v.g;
  r.prevWire = v.ws !== 0;
  return r;
}

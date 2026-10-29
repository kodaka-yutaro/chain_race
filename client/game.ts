import {
  CHANNELS, createWorld, emptyInput, inZone, newRunner, stepWorld, TICK_RATE, TILE, WIRE_ATTACHED,
  WIRE_FLYING, type Input, type MapDef, type Runner, type World,
} from '../shared/physics';
import { mapById as stageOrLobby, stageById } from '../shared/maps';
import { PARTY_CAPACITY, type RunnerView, type ServerMsg, type ZoneState } from '../shared/protocol';
import { releaseAllTouch, touch } from './touch';
import { bindPress } from './press';
import { buildTileLayer, drawBackground, drawHammerHit, drawHook, drawLiveTiles, drawRunner } from './render';
import { WEAPON_NAMES } from '../shared/ddrace';
import { drawDD } from './dd-render';
import { drawWords } from './word-render';
import { ABILITY_NAMES, ITEM_ABILITIES } from '../shared/abilities';
import { MINI_LIMIT } from '../shared/word-blocks';

type Snap = Extract<ServerMsg, { t: 'snap' }>;

export class ClientGame {
  readonly map: MapDef;
  private world: World;
  private me: Runner;
  private pending: { seq: number; input: Input }[] = [];
  private seq = 0;
  private others = new Map<number, { prev: RunnerView; cur: RunnerView; at: number }>();
  private names: Record<number, string> = {};
  private faces:Record<number,string>={};
  setFaces(f:Record<number,string>){this.faces=f;}
  private doors = Array<boolean>(CHANNELS).fill(false);
  private ctx: CanvasRenderingContext2D;
  private staticLayer: HTMLCanvasElement | null;
  private chunks = new Map<string, HTMLCanvasElement>();
  private keys = new Set<string>();
  private tapped = new Set<string>();
  private clicked = { left: false, right: false };
  private mouse = { x: 0, y: 0, left: false, right: false };
  private killQueued = false;
  // スマホでフックをねらった向き。触っていない間も最後の向きでハンマーを振る
  private touchAim = { x: 1, y: 0 };
  private acc = 0;
  private last = performance.now();
  private raf = 0;
  private smoothX = 0;
  private smoothY = 0;
  private cam = { x: 0, y: 0, zoom: 1 };
  // 下に重ねた操作パネルで隠れる高さ（canvas の px）。自分はその上の真ん中に映す
  private bottomInset = 0;
  private snapInterval = 40;
  private lastSnapAt = 0;
  private stopped = false;
  private waitingForParty = false;
  private weaponPanel: HTMLElement | null = null;
  private weaponQueued: number | undefined;
  private spitQueued=false;
  private miniQueued=false;
  private clearWordQueued=false;
  private wordPanel:HTMLElement|null=null;
  private mouseAimed=false;
  private listeners: [EventTarget, string, (e: any) => void][] = [];
  private pressCleanup:(()=>void)[]=[];

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
    this.waitingForParty = false;
    this.world = createWorld(this.map);
    this.me = newRunner(youId, this.map);
    this.world.runners.push(this.me);
    this.names = names;
    this.ctx = canvas.getContext('2d')!;
    this.staticLayer = this.map.width * this.map.height > 24000 ? null : buildTileLayer(this.map);
    this.bindInput();
    if(this.map.dd&&!this.map.abilityMode) this.mountWeapons();
    this.canvas.parentElement?.classList.toggle('word-enabled',!!this.map.wordBlocks);
    if(this.map.wordBlocks)this.mountWordControls();
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
  queueSpit() { if(this.map.wordBlocks)this.spitQueued=true; }
  queueMini() { if(this.map.wordBlocks)this.miniQueued=true; }
  queueClearWord() { if(this.map.wordBlocks)this.clearWordQueued=true; }

  private mountWordControls(){
    const panel=document.createElement('div');panel.className='word-controls';
    const row=document.createElement('div');row.className='word-buttons';
    for(const [cls,label,key,run] of [
      ['word-spit','大中華','R',()=>this.queueSpit()],
      ['word-mini','ミニ中華','T',()=>this.queueMini()],
      ['word-clear','大を消す','X',()=>this.queueClearWord()],
    ] as const){
      const b=document.createElement('button');b.className=cls;
      b.append(document.createTextNode(label));const k=document.createElement('kbd');k.textContent=` [${key}]`;b.append(k);
      this.pressCleanup.push(bindPress(b,run));row.append(b);
    }
    panel.append(row);this.canvas.parentElement!.append(panel);this.wordPanel=panel;
  }

  private mountWeapons() {
    const panel=document.createElement('div');panel.className='dd-tools';
    const row=document.createElement('div');row.className='dd-weapons';
    for(let n=0;n<6;n++){
      const b=document.createElement('button');b.textContent=`${n+1} ${['鎚','銃','散','爆','光','忍'][n]}`;
      b.title=WEAPON_NAMES[n];b.setAttribute('aria-label',WEAPON_NAMES[n]);b.dataset.weapon=String(n);
      this.pressCleanup.push(bindPress(b,()=>{this.weaponQueued=n;}));row.append(b);
    }
    const status=document.createElement('div');status.className='dd-status';
    panel.append(row,status);
    if(touch.active){
      const toggle=document.createElement('button');toggle.className='dd-aim-toggle';toggle.textContent='右スティック: フック';
      this.pressCleanup.push(bindPress(toggle,()=>{releaseAllTouch();touch.hookTap=false;touch.aimOnly=!touch.aimOnly;toggle.textContent=`右スティック: ${touch.aimOnly?'照準だけ':'フック'}`;}));panel.append(toggle);
    }
    this.canvas.parentElement!.append(panel);this.weaponPanel=panel;
  }

  stop() {
    this.stopped = true;
    releaseAllTouch(); touch.jumpTap = touch.fireTap = touch.hookTap = touch.miniTap = false;
    for(const clean of this.pressCleanup)clean();
    touch.aimOnly=false;this.weaponPanel?.remove();
    this.wordPanel?.remove();this.canvas.parentElement?.classList.remove('word-enabled');
    cancelAnimationFrame(this.raf);
    for (const [t, ev, fn] of this.listeners) t.removeEventListener(ev, fn);
  }

  private lastSnapTick = -1;

  onSnap(s: Snap) {
    this.waitingForParty = !!s.waiting;
    // 届く順番が入れ替わることがあるので、古いものは捨てる
    if (s.tick <= this.lastSnapTick) return;
    this.lastSnapTick = s.tick;
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
    this.me = structuredClone(s.me);
    this.world = createWorld(this.map);
    this.world.tick = s.tick;
    this.world.doorsOpen = [...s.doors];
    this.world.timers = [...s.timers];
    this.world.lifts = [...s.lifts];
    this.world.saws = [...s.saws];
    if(s.dd) this.world.dd=structuredClone(s.dd);
    this.world.words=structuredClone(s.words??[]);this.world.wordSeq=s.wordSeq??0;
    this.world.balls=structuredClone(s.balls??[]);this.world.pickups={...s.pickups};
    this.world.runners = [this.me, ...s.others.map((v) => viewToRunner(v, this.map))];
    for (const p of this.pending) this.predictStep(p.input);
    this.smoothX = beforeX - this.me.x;
    this.smoothY = beforeY - this.me.y;
    if (Math.hypot(this.smoothX, this.smoothY) > TILE * 4) { this.smoothX = 0; this.smoothY = 0; }
  }

  private predictStep(input: Input) {
    if (this.waitingForParty) return;
    const inputs = new Map<number, Input>([[this.me.id, input]]);
    // 他プレイヤーの入力は分からないので、フックだけは握ったままとみなす
    for (const r of this.world.runners) {
      if (r !== this.me) inputs.set(r.id, { ...emptyInput(), wire:this.map.abilityMode?r.hammerBrace:r.wireState!==0,fire:!!this.map.abilityMode&&r.ability==='hook'&&r.wireState!==0, aimX: r.aimX, aimY: r.aimY });
    }
    stepWorld(this.world, inputs);
  }

  private sampleInput(): Input {
    // 1 tick より短いタップも取りこぼさないよう、押された直後のキーは一度だけ押下扱いにする
    const tapped = this.tapped;
    this.tapped = new Set();
    const k = { has: (c: string) => this.keys.has(c) || tapped.has(c) };
    const clicked = this.clicked;
    this.clicked = { left: false, right: false };
    const i = emptyInput();
    if (document.querySelector('dialog[open]')) { this.spitQueued=this.miniQueued=this.clearWordQueued=false; releaseAllTouch(); touch.jumpTap = touch.fireTap = touch.hookTap = touch.miniTap = false; return i; }
    i.left = k.has('KeyA') || k.has('ArrowLeft');
    i.right = k.has('KeyD') || k.has('ArrowRight');
    i.up = k.has('KeyW') || k.has('ArrowUp');
    i.down = k.has('KeyS') || k.has('ArrowDown');
    i.jump = k.has('Space');
    i.wire = this.mouse.right || clicked.right || k.has('KeyE') || k.has('ShiftLeft');
    i.fire = this.mouse.left || clicked.left || k.has('KeyQ');
    i.kill = this.killQueued;
    i.spit=this.spitQueued;this.spitQueued=false;
    i.miniSpit=this.miniQueued;this.miniQueued=false;
    i.clearWord=this.clearWordQueued;this.clearWordQueued=false;
    for(let n=0;n<6;n++)if(k.has(`Digit${n+1}`))this.weaponQueued=n;
    i.weapon=this.weaponQueued;this.weaponQueued=undefined;
    this.killQueued = false;
    const wx = this.mouse.x / this.cam.zoom + this.cam.x;
    const wy = this.mouse.y / this.cam.zoom + this.cam.y;
    i.aimX = wx - (this.me.x + this.smoothX);
    i.aimY = wy - (this.me.y + this.smoothY);
    if(!this.mouseAimed){i.aimX=this.me.aimX;i.aimY=this.me.aimY;}
    if (Math.hypot(i.aimX, i.aimY) < 1) { i.aimX = 1; i.aimY = 0; }
    if (touch.active) {
      i.left ||= touch.moveX < 0;
      i.right ||= touch.moveX > 0;
      i.jump ||= touch.jump || touch.jumpTap;
      i.wire ||= touch.hook || touch.hookTap;
      i.fire ||= touch.fire || touch.fireTap;
      i.miniSpit ||= touch.miniTap;
      if (touch.aimMode) this.touchAim = { x: touch.aimX, y: touch.aimY };
      else if (touch.hook || touch.hookTap) {
        // 触った場所を、マウスと同じようにマップの座標に直して自分からの向きにする
        const r = this.canvas.getBoundingClientRect();
        const tx = (touch.aimClientX - r.left) * (this.canvas.width / r.width) / this.cam.zoom + this.cam.x;
        const ty = (touch.aimClientY - r.top) * (this.canvas.height / r.height) / this.cam.zoom + this.cam.y;
        const ax = tx - (this.me.x + this.smoothX), ay = ty - (this.me.y + this.smoothY);
        if (Math.hypot(ax, ay) >= 1) this.touchAim = { x: ax, y: ay };
      }
      i.aimX = this.touchAim.x;
      i.aimY = this.touchAim.y;
      touch.jumpTap = touch.fireTap = touch.hookTap = touch.miniTap = false;
    }
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
    const abilityHud=document.querySelector('#hud-ability');if(abilityHud)abilityHud.textContent='能力：'+ABILITY_NAMES[this.me.ability]+(this.me.ability==='bicycle'?` ／ 威力 ${this.me.bikePower}/3 ／ ${this.me.held?'ボール所持':'ボールなし'}`:'');
    if(this.wordPanel)this.wordPanel.hidden=!!this.map.abilityMode&&this.me.ability!=='bun';
    if(this.wordPanel){
      const s=this.me.spit,owned=this.world.words.filter(b=>b.owner===this.youId),big=owned.some(b=>b.kind!=='mini');
      this.wordPanel.querySelector<HTMLButtonElement>('.word-spit')!.disabled=!!s.charge||!!s.cooldown||big||this.waitingForParty;
      this.wordPanel.querySelector<HTMLButtonElement>('.word-mini')!.disabled=!!s.miniCooldown||this.waitingForParty;
      const miniCount=owned.filter(b=>b.kind==='mini').length;
      this.wordPanel.querySelector<HTMLButtonElement>('.word-mini')!.firstChild!.textContent=`ミニ中華 ${miniCount}/${MINI_LIMIT}`;
      const miniButton=this.canvas.parentElement?.querySelector<HTMLButtonElement>('.tbtn.mini');
      if(miniButton){miniButton.textContent=`ミニ ${miniCount}/${MINI_LIMIT}`;miniButton.disabled=!!s.miniCooldown||this.waitingForParty;}
      this.wordPanel.querySelector<HTMLButtonElement>('.word-clear')!.disabled=(!big&&!s.charge)||this.waitingForParty;
    }
    if(this.me.dd&&this.weaponPanel){
      const d=this.me.dd;
      for(const b of this.weaponPanel.querySelectorAll<HTMLButtonElement>('[data-weapon]')){
        const n=Number(b.dataset.weapon);b.disabled=!(d.weapons&1<<n);b.setAttribute('aria-pressed',String(d.weapon===n));
      }
      this.weaponPanel.querySelector('.dd-status')!.textContent=`${WEAPON_NAMES[d.weapon]}${d.solo?' · SOLO':''}${d.jetpack?' · JET':''} · ${d.endlessJump?'∞':d.jumps<0?'地上のみ':d.jumps}段ジャンプ`;
    }
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
      if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyR' && !e.repeat) this.queueSpit();
      if (e.code === 'KeyT' && !e.repeat) this.queueMini();
      if (e.code === 'KeyX' && !e.repeat) this.queueClearWord();
      if (e.code === 'KeyF' && !e.repeat) this.onInteract();
      this.keys.add(e.code);
      if (!e.repeat) this.tapped.add(e.code);
    });
    this.on(window, 'keyup', (e: KeyboardEvent) => {
      this.keys.delete(e.code);
      // Mac では ⌘ を押している間に離したキーの keyup が来ないので、⌘ を離したら全部離したことにする
      if (e.key === 'Meta') this.keys.clear();
    });
    // 別のウィンドウやタブに移ると keyup が届かないので、押しっぱなしのまま固まらないよう離す
    const releaseAll = () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; releaseAllTouch(); };
    this.on(window, 'blur', releaseAll);
    this.on(document, 'visibilitychange', () => {
      if (!document.hidden) return;
      releaseAll();
      // 隠れている間は描画が止まって入力も送られず、主の側では最後の入力（右移動など）が続いてしまうので、
      // 何も押していない入力を一度送っておく
      const seq = ++this.seq;
      const input = this.sampleInput();
      this.pending.push({ seq, input });
      this.send({ seq, input });
    });
    this.on(window, 'resize', () => this.resize());
    // Safari のバーは出入りしても window の resize が来ないことがあるので、実際に見えている範囲の変化でも合わせ直す
    if (window.visualViewport) this.on(window.visualViewport, 'resize', () => this.resize());
    // 回転直後は clientWidth/Height がまだ古いことがあるので、少し遅れてもう一度合わせる
    this.on(window, 'orientationchange', () => {
      this.resize();
      setTimeout(() => this.resize(), 250);
    });
    // 全画面の開始・終了でも大きさが変わる
    this.on(document, 'fullscreenchange', () => {
      this.resize();
      requestAnimationFrame(() => this.resize());
    });
    this.on(this.canvas, 'contextmenu', (e) => e.preventDefault());
    this.on(this.canvas, 'mousemove', (e: MouseEvent) => {
      this.mouseAimed=true;
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
    });
    this.on(this.canvas, 'mousedown', (e: MouseEvent) => {
      if (e.button === 0) this.mouse.left = this.clicked.left = true;
      if (e.button === 2) this.mouse.right = this.clicked.right = true;
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
    // 縦長の画面（スマホ）でも横に12マスは見えるようにする
    this.cam.zoom = Math.min(this.canvas.height / (TILE * 20), this.canvas.width / (TILE * 12));
    const pad = this.canvas.parentElement?.querySelector('.touch-pad');
    const portrait = this.canvas.clientHeight > this.canvas.clientWidth;
    this.bottomInset = 0;
    if (pad && portrait && touch.active) {
      const c = this.canvas.getBoundingClientRect(), r = pad.getBoundingClientRect();
      this.bottomInset = Math.max(0, c.bottom - r.top) * 0.8 * dpr;
    }
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
    const ev = vh - this.bottomInset / z;
    this.cam.y = Math.max(0, Math.min(mh - ev, meY - ev / 2));
    if (vw > mw) this.cam.x = (mw - vw) / 2;
    if (ev > mh) this.cam.y = (mh - ev) / 2;

    drawBackground(g, this.map.id, W, H, this.cam.x, this.cam.y, z, now);

    g.save();
    g.scale(z, z);
    g.translate(-this.cam.x, -this.cam.y);
    if (this.staticLayer) g.drawImage(this.staticLayer, 0, 0);
    else {
      const used = new Set<string>();
      for (let y = Math.max(0, Math.floor(this.cam.y / TILE / 16)); y <= Math.min(Math.ceil(this.map.height / 16) - 1, Math.floor((this.cam.y + vh) / TILE / 16)); y++)
        for (let x = Math.max(0, Math.floor(this.cam.x / TILE / 16)); x <= Math.min(Math.ceil(this.map.width / 16) - 1, Math.floor((this.cam.x + vw) / TILE / 16)); x++) {
          const key = `${x},${y}`; used.add(key);
          let chunk = this.chunks.get(key);
          if (!chunk) { chunk = buildTileLayer(this.map, x * 16, y * 16, 16, 16); this.chunks.set(key, chunk); }
          g.drawImage(chunk, x * 16 * TILE, y * 16 * TILE);
        }
      for (const key of this.chunks.keys()) if (!used.has(key)) this.chunks.delete(key);
    }
    // 操作パネルの下に見えるマップの外は、いちばん下の段をくり返して地面が続いているように見せる
    if (this.staticLayer && this.cam.y + vh > mh) {
      const sh = this.staticLayer.height / this.map.height, sw = this.staticLayer.width;
      for (let y = mh; y < this.cam.y + vh; y += TILE) g.drawImage(this.staticLayer, 0, this.staticLayer.height - sh, sw, sh, 0, y, mw, TILE);
    }
    drawLiveTiles(g, this.map, { ...this.world, doors: this.doors }, Math.floor(this.cam.x / TILE) - 1, Math.floor(this.cam.y / TILE) - 1,
      Math.ceil((this.cam.x + vw) / TILE) + 1, Math.ceil((this.cam.y + vh) / TILE) + 1, now);
    drawDD(g,this.world,Math.floor(this.cam.x/TILE)-1,Math.floor(this.cam.y/TILE)-1,Math.ceil((this.cam.x+vw)/TILE)+1,Math.ceil((this.cam.y+vh)/TILE)+1);
    drawWords(g,this.world);
    if(this.map.abilityMode){
      const labels:Record<string,string>={G:'手',H:'鉤',M:'槌',V:'輪',N:'包'};
      for(let y=Math.max(0,Math.floor(this.cam.y/32));y<Math.min(this.map.height,Math.ceil((this.cam.y+vh)/32));y++)for(let x=Math.max(0,Math.floor(this.cam.x/32));x<Math.min(this.map.width,Math.ceil((this.cam.x+vw)/32));x++){
        const c=this.map.tiles[y][x];if(!ITEM_ABILITIES[c])continue;
        g.save();g.globalAlpha=(this.world.pickups[y*this.map.width+x]??0)>this.world.tick?.18:1;
        g.fillStyle='#ffd26c';g.beginPath();g.roundRect(x*32+3,y*32+3,26,26,7);g.fill();g.fillStyle='#7b1830';g.font='bold 18px sans-serif';g.textAlign='center';g.fillText(labels[c],x*32+16,y*32+23);g.restore();
      }
    }
    for(const b of this.world.balls){g.fillStyle='#ef334a';g.strokeStyle='#79152b';g.lineWidth=2;g.beginPath();g.arc(b.x,b.y,9,0,Math.PI*2);g.fill();g.stroke();g.fillStyle='#ffb2ab';g.beginPath();g.arc(b.x-3,b.y-3,3,0,Math.PI*2);g.fill();}
    for(const r of this.world.runners)if(r.held&&r.ability==='hand'){g.strokeStyle='#b1f6ed';g.lineWidth=3;g.beginPath();g.moveTo(r.x,r.y);g.lineTo(r.x+r.aimX*48,r.y+r.aimY*48);g.stroke();}

    this.drawZones(g);

    const views = this.othersInterpolated(now);
    const all = [
      ...views.map((v) => ({
        id: v.id, x: v.x, y: v.y, vx: v.vx, grounded: v.g, ws: v.ws, wx: v.wx, wy: v.wy, wr: v.wr,
        stun: v.st, aimX: v.ax, aimY: v.ay, hammerAge: this.world.tick - v.ct,
        spitCharge:v.spit?.charge??0,spitAge:v.spit?this.world.tick-v.spit.started:100,
      })),
      {
        id: this.me.id, x: meX, y: meY, vx: this.me.vx, grounded: this.me.grounded, ws: this.me.wireState,
        wx: this.me.wireX, wy: this.me.wireY, wr: this.me.wireRunner, stun: this.me.stun, aimX: this.me.aimX,
        aimY: this.me.aimY, hammerAge: this.world.tick - this.me.hammerTick,
        spitCharge:this.me.spit.charge,spitAge:this.world.tick-this.me.spit.started,
      },
    ];
    const pos = new Map(all.map((r) => [r.id, r]));

    // フック
    for (const r of all) {
      if (r.ws !== WIRE_FLYING && r.ws !== WIRE_ATTACHED) continue;
      let tx = r.wx, ty = r.wy;
      if (r.ws === WIRE_ATTACHED && r.wr >= 0) {
        const o = pos.get(r.wr);
        if (o) { tx = o.x; ty = o.y; }
      }
      drawHook(g, r.id, r.x, r.y, tx, ty);
    }

    for (const r of all) {
      const state=r.id===this.youId?this.me:views.find(v=>v.id===r.id);
      drawRunner(g, { ...r, hammerBrace:state?.hammerBrace,bikePower:state?.bikePower,wheelieAge:this.world.tick-(state?.wheelieTick??-100),gesture:state?.gesture,gestureAge:this.world.tick-(state?.gestureTick??-100), ability:r.id===this.youId?this.me.ability:views.find(v=>v.id===r.id)?.ability, face:this.faces[r.id], shotAge:this.world.tick-(r.id===this.youId?this.me.shotTick:views.find(v=>v.id===r.id)?.shotTick??-100), name: this.names[r.id] ?? '', me: r.id === this.youId }, now);
      drawHammerHit(g, r.x, r.y, r.aimX, r.aimY, r.hammerAge);
    }
    if (touch.active) {
      const len = Math.hypot(this.touchAim.x, this.touchAim.y) || 1;
      const ax = this.touchAim.x / len, ay = this.touchAim.y / len;
      g.strokeStyle = '#fff9'; g.lineWidth = 2; g.setLineDash([4, 5]);
      g.beginPath(); g.moveTo(meX + ax * 22, meY + ay * 22); g.lineTo(meX + ax * 105, meY + ay * 105); g.stroke(); g.setLineDash([]);
    }
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
      const col = party ? '255,122,89' : '76,201,240';
      // 光の柱（フリー入口）／旗の立つ台（協力の台）
      const glow = g.createLinearGradient(0, y, 0, y + h);
      glow.addColorStop(0, `rgba(${col},0)`);
      glow.addColorStop(1, `rgba(${col},0.35)`);
      g.fillStyle = glow;
      g.beginPath();
      g.roundRect(x + 4, y, w - 8, h, 12);
      g.fill();
      g.strokeStyle = `rgba(${col},0.9)`;
      g.lineWidth = 3;
      if (party) {
        g.fillStyle = `rgba(${col},0.9)`;
        g.beginPath();
        g.roundRect(x + 4, y + h - 8, w - 8, 8, 4);
        g.fill();
        for (const fx of [x + 10, x + w - 10]) {
          g.fillStyle = '#d7dce4';
          g.fillRect(fx - 1.5, y + 6, 3, h - 12);
          g.fillStyle = `rgb(${col})`;
          g.beginPath();
          g.moveTo(fx + 1.5, y + 6);
          g.lineTo(fx + 1.5 + (fx < x + w / 2 ? 18 : -18), y + 13);
          g.lineTo(fx + 1.5, y + 20);
          g.fill();
        }
      } else {
        g.beginPath();
        g.moveTo(x + 8, y + h);
        g.lineTo(x + 8, y + 22);
        g.arc(x + w / 2, y + 22, w / 2 - 8, Math.PI, 0);
        g.lineTo(x + w - 8, y + h);
        g.stroke();
        for (let i = 0; i < 5; i++) {
          const t = ((performance.now() / 1400 + i / 5) % 1);
          g.fillStyle = `rgba(${col},${0.8 * (1 - t)})`;
          g.beginPath();
          g.arc(x + 14 + ((i * 37) % (w - 28)), y + h - t * h, 2.5, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.textAlign = 'center';
      g.fillStyle = '#fff';
      g.font = 'bold 18px system-ui, sans-serif';
      g.fillText(stage?.name ?? '', x + w / 2, y - 30);
      g.font = '14px system-ui, sans-serif';
      g.fillStyle = 'rgba(255,255,255,0.8)';
      const count = st?.count ?? 0;
      const label = party
        ? `協力の台 ${count}/${PARTY_CAPACITY}人${stage && stage.minPlayers > 1 ? `（${stage.minPlayers}人〜）` : ''}`
        : stage?.solo?'1人用 · 自分だけで出発':`フリー入口 ${count}人プレイ中`;
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

}

function viewToRunner(v: RunnerView, map: MapDef): Runner {
  const r = newRunner(v.id, map);
  r.hammerBrace=v.hammerBrace??false;r.bikePower=v.bikePower??1;r.wheelieTick=v.wheelieTick??-100;r.gesture=v.gesture??0;r.gestureTick=v.gestureTick??-100;
  r.ability=v.ability??'hand';r.held=v.held??null;r.wireBall=v.wireBall??-1;r.shotTick=v.shotTick??-100;
  r.x = v.x; r.y = v.y; r.vx = v.vx; r.vy = v.vy;
  r.wireState = v.ws; r.wireX = v.wx; r.wireY = v.wy; r.wireRunner = v.wr;
  r.stun = v.st; r.aimX = v.ax; r.aimY = v.ay; r.hammerTick = v.ct;
  r.finishedTime = v.ft; r.raceStart = v.rs; r.grounded = v.g;
  r.prevWire = v.ws !== 0;
  if(v.dd)r.dd={...v.dd};
  if(v.spit)r.spit={...v.spit};r.wireWord=v.wg??-1;r.wireLocalX=v.wlx??0;r.wireLocalY=v.wly??0;
  return r;
}


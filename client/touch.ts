// 左スティックで移動、右スティックで照準とフック。専用ボタンでジャンプとハンマー。
// 画面の直接タップによるフックも利用できる。
import { bindPress, releasePresses } from './press';
import { toggleFullscreen } from './pwa';

export const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export const touch = {
  active: false,
  moveX: 0,
  aimMode: false,
  aimX: 1,
  aimY: 0,
  aimOnly: false,
  jumpFromStick: true,
  jump: false,
  // 短いタップを次の tick まで覚えておく
  jumpTap: false,
  fireTap: false,
  miniTap: false,
  hook: false,
  hookTap: false,
  fire: false,
  // フックで触った場所（画面の座標）
  aimClientX: 0,
  aimClientY: 0,
};

const DEAD = 0.3;
try { touch.jumpFromStick = localStorage.getItem('kd.stickJump') !== 'off'; } catch { /* optional preference */ }

// 指を離した知らせ（pointerup）が届かないことがある（画面の端からのスワイプ、通知、アプリ切り替えなど）。
// そのとき押しっぱなしのまま固まらないよう、全部の操作を離した状態に戻せるようにしておく
const releases: (() => void)[] = [];
export function releaseAllTouch() {
  for (const r of releases) r();
  releasePresses();
}

type AimSource={x:number;y:number;stick:boolean;hook:boolean};
const aimSources=new Map<object,AimSource>();
export function setTouchAim(owner:object,source?:AimSource){
  const hadHook=touch.hook;
  aimSources.delete(owner);if(source)aimSources.set(owner,source);
  const active=[...aimSources.values()].reverse();
  const aim=active.find(s=>s.hook)??active[0];
  touch.hook=active.some(s=>s.hook);
  if(!hadHook&&touch.hook)touch.hookTap=true;
  if(aim){
    touch.aimMode=aim.stick;
    if(aim.stick){touch.aimX=aim.x;touch.aimY=aim.y;}
    else{touch.aimClientX=aim.x;touch.aimClientY=aim.y;}
  }
}

function stick(el: HTMLElement, onMove: (x: number, y: number, held: boolean) => void) {
  const knob = el.querySelector<HTMLElement>('.knob')!;
  let id: number | null = null;
  const update = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    knob.style.transform = `translate(${dx * r.width * 0.32}px, ${dy * r.height * 0.32}px)`;
    onMove(dx, dy, true);
  };
  el.addEventListener('pointerdown', (e) => {
    // 前の指の離し忘れが残っていても、新しく触った指で操作できるようにする
    if (id !== null) return;
    id = e.pointerId;
    el.setPointerCapture(e.pointerId);
    el.classList.add('held');
    update(e);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) update(e); });
  const release = () => {
    id = null;
    el.classList.remove('held');
    knob.style.transform = '';
    onMove(0, 0, false);
  };
  const end = (e: PointerEvent) => { if (e.pointerId === id) release(); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
  releases.push(release);
}

/** 画面（canvas）に触ったら、その方向へフックを伸ばす */
function hookArea(el: HTMLElement) {
  let id: number | null = null;
  const owner={};
  const aim = (e: PointerEvent) => setTouchAim(owner,{x:e.clientX,y:e.clientY,stick:false,hook:true});
  el.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    id = e.pointerId;
    el.setPointerCapture(e.pointerId);
    aim(e);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) aim(e); });
  const release = () => { id = null; setTouchAim(owner); };
  const end = (e: PointerEvent) => { if (e.pointerId === id) release(); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
  releases.push(release);
}

/** 操作パネルを作って screen に入れる。actions はボタンの名前と押したときの処理 */
export function mountTouchControls(screen: HTMLElement, actions: { label: string; cls: string; run: () => void }[]) {
  if (!isTouch()) return;
  document.body.classList.add('touch');
  if (!touch.active) {
    // iOS Safari はピンチやダブルタップで拡大してしまうので止める
    for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    let lastEnd = 0;
    document.addEventListener('touchend', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select')) return;
      const now = Date.now();
      if (now - lastEnd < 350) e.preventDefault();
      lastEnd = now;
    }, { passive: false });
    // 画面に触れている指がなくなったら、どの操作も離れたはず
    const allUp = (e: TouchEvent) => { if (e.touches.length === 0) releaseAllTouch(); };
    document.addEventListener('touchend', allUp);
    document.addEventListener('touchcancel', allUp);
    const cancel = () => { releaseAllTouch(); touch.jumpTap = touch.fireTap = touch.hookTap = touch.miniTap = false; };
    window.addEventListener('blur', cancel);
    window.addEventListener('pagehide', cancel);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  }
  touch.active = true;
  const pad = document.createElement('div');
  pad.className = 'touch-pad';
  pad.innerHTML = `
    <div class="touch-row">${actions.map((a, i) => `<button class="tbtn small ${a.cls}" data-i="${i}">${a.label}</button>`).join('')}<button class="tbtn small stick-jump-toggle" aria-pressed="${touch.jumpFromStick}">左↑ジャンプ ${touch.jumpFromStick ? 'ON' : 'OFF'}</button><button class="tbtn small fs-toggle" type="button">全画面</button></div>
    <div class="stick move"><div class="knob"></div><span>移動</span></div>
    <div class="stick aim"><div class="knob"></div><span>倒してフック / 離して解除</span></div>
    <div class="touch-btns">
      <button class="tbtn fire">攻撃</button>
      <button class="tbtn mini" aria-label="ミニ中華を吐く">ミニ</button>
      <button class="tbtn jump">ジャンプ</button>
    </div>
    <div class="touch-hint">移動・フック・攻撃を同時押しできます</div>`;
  screen.append(pad);
  const canvas = screen.querySelector<HTMLElement>('canvas');
  if (canvas) hookArea(canvas);

  const aimOwner={};
  stick(pad.querySelector('.aim')!, (x, y, held) => {
    if(held&&Math.hypot(x,y)>.22)setTouchAim(aimOwner,{x,y,stick:true,hook:!touch.aimOnly});
    else setTouchAim(aimOwner);
  });
  let jumpedUp = false;
  stick(pad.querySelector('.move')!, (x, y, held) => {
    touch.moveX = Math.abs(x) > DEAD ? Math.sign(x) : 0;
    // Upper edge with hysteresis: normal steering stays below the trigger.
    if (held && touch.jumpFromStick && y < -.75 && !jumpedUp) { touch.jumpTap = true; jumpedUp = true; }
    if (!held || y > -.35) jumpedUp = false;
  });
  bindPress(pad.querySelector('.jump')!, () => { touch.jump = touch.jumpTap = true; }, () => { touch.jump = false; });
  bindPress(pad.querySelector('.fire')!, () => { touch.fire = touch.fireTap = true; }, () => { touch.fire = false; });
  bindPress(pad.querySelector('.mini')!, () => { touch.miniTap = true; });
  const fsToggle = pad.querySelector<HTMLButtonElement>('.fs-toggle')!;
  fsToggle.onclick = () => void toggleFullscreen();
  const jumpToggle = pad.querySelector<HTMLButtonElement>('.stick-jump-toggle')!;
  jumpToggle.onclick = () => {
    touch.jumpFromStick = !touch.jumpFromStick;
    try { localStorage.setItem('kd.stickJump', touch.jumpFromStick ? 'on' : 'off'); } catch { /* optional preference */ }
    document.querySelectorAll<HTMLButtonElement>('.stick-jump-toggle').forEach(b => { b.textContent = `左↑ジャンプ ${touch.jumpFromStick ? 'ON' : 'OFF'}`; b.setAttribute('aria-pressed', String(touch.jumpFromStick)); });
  };
  for (const b of pad.querySelectorAll<HTMLElement>('.touch-row .tbtn[data-i]')) {
    bindPress(b, () => actions[Number(b.dataset.i)].run());
  }
}

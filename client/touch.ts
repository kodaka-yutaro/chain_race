// スマホ用の操作。左のスティックで移動（上に倒すとジャンプ）、右のスティックでねらってフック、ボタンでハンマー。

export const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export const touch = {
  active: false,
  moveX: 0,
  jump: false,
  // 短いタップを次の tick まで覚えておく
  jumpTap: false,
  fireTap: false,
  hook: false,
  fire: false,
  aimX: 1,
  aimY: 0,
};

const DEAD = 0.3;

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
    if (id !== null) return;
    id = e.pointerId;
    el.setPointerCapture(e.pointerId);
    el.classList.add('held');
    update(e);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) update(e); });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = null;
    el.classList.remove('held');
    knob.style.transform = '';
    onMove(0, 0, false);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function button(el: HTMLElement, onDown: () => void, onUp: () => void = () => {}) {
  el.addEventListener('pointerdown', (e) => { el.classList.add('held'); el.setPointerCapture(e.pointerId); onDown(); e.preventDefault(); });
  const up = () => { el.classList.remove('held'); onUp(); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
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
  }
  touch.active = true;
  const pad = document.createElement('div');
  pad.className = 'touch-pad';
  pad.innerHTML = `
    <div class="touch-row">${actions.map((a, i) => `<button class="tbtn small ${a.cls}" data-i="${i}">${a.label}</button>`).join('')}</div>
    <div class="stick move"><div class="knob"></div><span>移動 / 上でジャンプ</span></div>
    <button class="tbtn jump">ジャンプ</button>
    <button class="tbtn fire">ハンマー</button>
    <div class="stick aim"><div class="knob"></div><span>ねらってフック</span></div>`;
  screen.append(pad);

  let up = false;
  stick(pad.querySelector('.move')!, (x, y) => {
    touch.moveX = Math.abs(x) > DEAD ? Math.sign(x) : 0;
    // 上に倒したらジャンプ。戻すまで押しっぱなし扱い
    const nowUp = y < -0.55;
    if (nowUp !== up) { up = nowUp; touch.jump = nowUp; if (nowUp) touch.jumpTap = true; }
  });
  stick(pad.querySelector('.aim')!, (x, y, held) => {
    if (Math.hypot(x, y) > DEAD) { touch.aimX = x; touch.aimY = y; }
    touch.hook = held && Math.hypot(x, y) > DEAD;
  });
  button(pad.querySelector('.jump')!, () => { touch.jump = touch.jumpTap = true; }, () => { touch.jump = false; });
  button(pad.querySelector('.fire')!, () => { touch.fire = touch.fireTap = true; }, () => { touch.fire = false; });
  for (const b of pad.querySelectorAll<HTMLElement>('.touch-row .tbtn')) {
    button(b, () => actions[Number(b.dataset.i)].run());
  }
}

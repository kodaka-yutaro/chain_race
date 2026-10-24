/** Original pentatonic night-market loop, synthesized locally after a user gesture. */
export function mountMusic(button: HTMLButtonElement, slider: HTMLInputElement) {
  let ctx: AudioContext | null = null, gain: GainNode | null = null;
  let timer = 0, next = 0, step = 0, enabled = false;
  let volume = .3;
  try { volume = Math.max(0, Math.min(1, Number(localStorage.getItem('kd.music.volume') ?? .3))); } catch { /* optional preference */ }
  if (!Number.isFinite(volume)) volume = .3;
  slider.value = String(Math.round(volume * 100));
  const melody = [74, 77, 79, 81, 79, 77, 74, 0, 72, 74, 77, 79, 77, 74, 72, 0,
    69, 72, 74, 77, 74, 72, 69, 0, 67, 69, 72, 74, 72, 69, 67, 0,
    74, 0, 81, 79, 77, 79, 74, 0, 77, 0, 84, 81, 79, 77, 74, 0,
    72, 74, 77, 74, 72, 69, 72, 0, 69, 72, 74, 72, 69, 67, 62, 0];
  function tone(note: number, at: number, duration: number, type: OscillatorType, level: number) {
    if (!ctx || !gain || !note) return;
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = type; osc.frequency.value = 440 * 2 ** ((note - 69) / 12);
    env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(level, at + .012);
    env.gain.exponentialRampToValueAtTime(.001, at + duration);
    osc.connect(env).connect(gain); osc.start(at); osc.stop(at + duration + .02);
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
  }
  function schedule() {
    if (!ctx || !enabled || document.hidden) return;
    if (next < ctx.currentTime) next = ctx.currentTime + .03;
    while (next < ctx.currentTime + .16) {
      const n = melody[step % melody.length];
      tone(n, next, .55, 'triangle', .22);
      if (n && step % 2 === 0) tone(n + 12, next + .025, .35, 'sine', .055);
      if (step % 4 === 0) tone([50, 48, 45, 43][Math.floor(step / 16) % 4], next, .8, 'sine', .20);
      if (step % 2 === 0) tone(38, next, .09, 'triangle', .13);
      if (step % 4 === 2) tone(86, next, .045, 'triangle', .035);
      step++; next += 60 / 100 / 2;
    }
  }
  function label() { button.textContent = enabled ? '♫ BGM ON' : '♫ BGM OFF'; button.setAttribute('aria-pressed', String(enabled)); }
  async function start() {
    try {
      if (!ctx) { ctx = new AudioContext(); gain = ctx.createGain(); gain.gain.value = volume * .48; gain.connect(ctx.destination); }
      await ctx.resume(); enabled = true; next = ctx.currentTime + .04; timer = window.setInterval(schedule, 70); schedule(); label();
    } catch { enabled = false; button.textContent = '音声を再試行'; button.setAttribute('aria-pressed', 'false'); }
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      if (enabled) { enabled = false; clearInterval(timer); await ctx?.suspend(); label(); }
      else await start();
    } finally { button.disabled = false; }
  });
  slider.addEventListener('input', () => {
    volume = Number(slider.value) / 100;
    if (gain && ctx) gain.gain.setTargetAtTime(volume * .48, ctx.currentTime, .04);
    try { localStorage.setItem('kd.music.volume', String(volume)); } catch { /* optional preference */ }
  });
  document.addEventListener('visibilitychange', () => {
    if (!enabled || !ctx) return;
    if (document.hidden) { clearInterval(timer); void ctx.suspend(); }
    else { void ctx.resume().then(() => { if (!enabled || document.hidden) return; clearInterval(timer); next = ctx!.currentTime + .04; timer = window.setInterval(schedule, 70); }).catch(() => { enabled = false; label(); }); }
  });
  label();
}

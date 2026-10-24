import './chinatown.css';
import { drawChinatown } from './chinatown';
import { mountMusic } from './music';

const canvas = document.querySelector<HTMLCanvasElement>('#title-city')!;
const g = canvas.getContext('2d')!;
const title = document.querySelector<HTMLElement>('#screen-title')!;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let frame = 0, last = -100;
function draw(now: number) {
  frame = 0;
  if (document.hidden || title.classList.contains('hidden')) return;
  if (now - last >= 48) {
    last = now;
    const w = Math.max(1, Math.ceil(title.clientWidth / 2)), h = Math.max(1, Math.ceil(title.clientHeight / 2));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    drawChinatown(g, w, h, reduced.matches ? 0 : now, 0, true);
  }
  if (!reduced.matches) frame = requestAnimationFrame(draw);
}
function restart() { if (frame) cancelAnimationFrame(frame); last = -100; frame = requestAnimationFrame(draw); }
new ResizeObserver(restart).observe(title);
new MutationObserver(() => {
  const dock = document.querySelector('.music-dock')!;
  (title.classList.contains('hidden') ? document.body : document.querySelector('.city-bottom')!).append(dock);
  restart();
}).observe(title, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('visibilitychange', restart);
reduced.addEventListener('change', restart);
restart();
mountMusic(document.querySelector<HTMLButtonElement>('#music-toggle')!, document.querySelector<HTMLInputElement>('#music-volume')!);
document.querySelector('#copy-invite')?.addEventListener('click', async () => {
  const button = document.querySelector<HTMLButtonElement>('#copy-invite')!;
  const url = new URL(location.pathname, location.origin).href;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'KDレース 中華街 パルクール大会', url });
    else await navigator.clipboard.writeText(url);
    button.textContent = 'リンクをコピーしました';
  } catch (err) { if ((err as Error).name !== 'AbortError') { button.textContent = 'URLを選んでコピー'; const input = document.querySelector<HTMLInputElement>('#invite-fallback')!; input.value = url; input.hidden = false; input.select(); } }
  setTimeout(() => { button.textContent = '招待リンクを共有 ↗'; }, 3000);
});

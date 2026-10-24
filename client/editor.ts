import { newCourseMap, TILE_TOOLS, validateCourseMap } from '../shared/courses';
import type { MapDef } from '../shared/physics';

const KEY = 'tsunagu.course-draft.v1';
const colors: Record<string, string> = { '.': '#11172b', '#': '#81b780', X: '#748397', '~': '#63b9ef', '^': '#f97583', J: '#e89d4b', S: '#ffdb79', '>': '#90dc9a', F: '#f6a1cf' };
export function mountEditor(root: HTMLElement, publish: (m: MapDef) => Promise<void>) {
  let map = newCourseMap(), tool = '#', mode = 'paint', history: string[][] = [], future: string[][] = [];
  try { const raw = localStorage.getItem(KEY); if (raw) { const draft = JSON.parse(raw); map = { ...validateCourseMap(draft, false), name: draft.name }; } } catch { /* 初期コース */ }
  root.innerHTML = `
    <div class="bar"><h2>コースをつくる</h2><button data-close>戻る</button></div>
    <p class="note">ひとりで作って、テストなしでプレリリース。2人以上で全員ゴールすると正式公開になります。</p>
    <div class="editor-meta"><label>コース名<input data-name maxlength="40"></label><label>説明<input data-desc maxlength="280"></label></div>
    <label class="editor-ability"><input type="checkbox" data-word-blocks>「中華」を吐き出す技を使えるようにする</label>
    <p class="note">文字の形をした動く足場に乗ったり、フックを掛けたりできます。PCは R、スマホは「中華を吐く」。1人2枚まで、18秒で消えます。</p>
    <div class="buttons"><button data-mode="paint" aria-pressed="true">描く</button><button data-mode="pan" aria-pressed="false">移動</button><button data-undo>元に戻す</button><button data-redo>やり直す</button><label>表示倍率<select data-zoom><option value="12">小</option><option value="24" selected>中</option><option value="36">大</option></select></label></div>
    <div class="tile-tools" role="group" aria-label="置くタイル"></div>
    <div class="editor-viewport" tabindex="0" aria-label="コース編集領域"><canvas aria-label="タイルを選んで描く"></canvas></div>
    <p class="note">スマホでは「移動」で画面をスクロール、「描く」で指を滑らせて配置。出現地点は1つです。下書きはこの端末に自動保存されます。</p>
    <details><summary>スイッチの設定</summary><div class="channels"></div></details>
    <div class="buttons"><button data-export>ファイルに保存</button><label class="file-button">ファイルを開く<input data-import type="file" accept="application/json,.json"></label><button data-new>新しいコース</button><button class="primary" data-publish>プレリリースする</button></div>
    <p data-status role="status"></p>`;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const name = q<HTMLInputElement>('[data-name]'), desc = q<HTMLInputElement>('[data-desc]'), canvas = q<HTMLCanvasElement>('canvas'), viewport = q('.editor-viewport');
  const status = (s: string) => { q('[data-status]').textContent = s; };
  let size = 24;
  const save = () => {
    map.name = name.value; map.description = desc.value;
    map.wordBlocks=q<HTMLInputElement>('[data-word-blocks]').checked;
    try { localStorage.setItem(KEY, JSON.stringify(map)); status('下書きを保存しました'); } catch { status('端末に保存できません。ファイルに保存してください'); }
  };
  function draw() {
    canvas.width = map.width * size; canvas.height = map.height * size;
    const g = canvas.getContext('2d')!;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const c = map.tiles[y][x]; g.fillStyle = colors[c] ?? '#af8ee6'; g.fillRect(x * size, y * size, size - 1, size - 1);
      if (c !== '.' && size >= 20) { g.fillStyle = '#10172a'; g.font = `bold ${size * .6}px system-ui`; g.textAlign = 'center'; g.fillText(c, (x + .5) * size, (y + .72) * size); }
    }
    q<HTMLButtonElement>('[data-undo]').disabled = !history.length; q<HTMLButtonElement>('[data-redo]').disabled = !future.length;
  }
  function load() {
    name.value = map.name; desc.value = map.description;
    q<HTMLInputElement>('[data-word-blocks]').checked=!!map.wordBlocks;
    q('.channels').replaceChildren(...Array.from({ length: 5 }, (_, i) => {
      const row = document.createElement('div'); row.className = 'buttons';
      row.innerHTML = `<span>スイッチ${i + 1}</span><label>必要人数<select><option value="1">1人</option><option value="2">2人</option></select></label><label>離した後の秒数<input type="number" min="0" max="10" step="0.5"></label>`;
      const select = row.querySelector('select')!, input = row.querySelector('input')!;
      select.value = String(map.channels?.[i]?.need ?? 1); input.value = String((map.channels?.[i]?.hold ?? 0) / 50);
      row.onchange = () => { map.channels ??= Array.from({ length: 5 }, () => ({})); map.channels[i] = { need: +select.value, hold: Math.max(0, Math.min(500, Math.round(+input.value * 50))) }; save(); };
      return row;
    })); draw(); viewport.scrollTop = canvas.height;
  }
  for (const [c, label] of TILE_TOOLS) {
    const b = document.createElement('button'); b.textContent = `${c} ${label}`; b.setAttribute('aria-pressed', String(c === tool));
    b.onclick = () => { tool = c; q('.tile-tools').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
    q('.tile-tools').append(b);
  }
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.onclick = () => {
    mode = b.dataset.mode!; viewport.style.touchAction = mode === 'pan' ? 'pan-x pan-y' : 'none';
    root.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  let pointer: number | null = null, lastCell: { x: number; y: number } | null = null;
  const paint = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / size), y = Math.floor((e.clientY - r.top) / size);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const start = lastCell ?? { x, y }, n = Math.max(Math.abs(x - start.x), Math.abs(y - start.y), 1);
    const rows = map.tiles.map(r => [...r]);
    if (tool === 'S') for (const row of rows) for (let i = 0; i < row.length; i++) if (row[i] === 'S') row[i] = '.';
    if (tool === 'S') rows[y][x] = tool;
    else for (let i = 0; i <= n; i++) rows[Math.round(start.y + (y - start.y) * i / n)][Math.round(start.x + (x - start.x) * i / n)] = tool;
    map.tiles = rows.map(r => r.join('')); lastCell = { x, y }; draw();
  };
  canvas.onpointerdown = e => { if (mode !== 'paint' || pointer !== null) return; history.push([...map.tiles]); if (history.length > 60) history.shift(); future = []; pointer = e.pointerId; lastCell = null; canvas.setPointerCapture(pointer); paint(e); e.preventDefault(); };
  canvas.onpointermove = e => { if (e.pointerId === pointer) paint(e); };
  const end = (e: PointerEvent) => { if (e.pointerId !== pointer) return; pointer = null; lastCell = null; save(); };
  canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = end;
  q('[data-undo]').onclick = () => { const rows = history.pop(); if (rows) { future.push(map.tiles); map.tiles = rows; save(); draw(); } };
  q('[data-redo]').onclick = () => { const rows = future.pop(); if (rows) { history.push(map.tiles); map.tiles = rows; save(); draw(); } };
  q<HTMLSelectElement>('[data-zoom]').onchange = e => { size = +(e.target as HTMLSelectElement).value; draw(); };
  name.oninput = desc.oninput = save;
  q<HTMLInputElement>('[data-word-blocks]').onchange=save;
  q('[data-new]').onclick = () => { if (!confirm('下書きを新しくします。必要なら先にファイルに保存してください。')) return; map = newCourseMap(); history = []; future = []; load(); save(); };
  q('[data-export]').onclick = () => { save(); const url = URL.createObjectURL(new Blob([JSON.stringify(map)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'tsunagu-course.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  q<HTMLInputElement>('[data-import]').onchange = async e => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    try { if (f.size > 100000) throw new Error('ファイルが大きすぎます'); const m = validateCourseMap(JSON.parse(await f.text())); map = m; history = []; future = []; load(); save(); } catch (e) { status((e as Error).message); }
    (e.target as HTMLInputElement).value = '';
  };
  q('[data-publish]').onclick = async () => {
    const b = q<HTMLButtonElement>('[data-publish]'); b.disabled = true;
    try { save(); await publish(validateCourseMap(map)); status('プレリリースしました！同じ大部屋の友だちとコース一覧から参加できます。'); }
    catch (e) { status((e as Error).message); } finally { b.disabled = false; }
  };
  load();
}

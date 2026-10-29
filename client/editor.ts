import {DD_PARTS,blankDD} from '../shared/dd-parts';
import { newCourseMap, TILE_TOOLS, validateCourseMap } from '../shared/courses';
import type { MapDef } from '../shared/physics';

const KEY = 'tsunagu.course-draft.v1';
const colors: Record<string, string> = { '.': '#11172b', '#': '#81b780', X: '#748397', '~': '#63b9ef', G:'#a6eee5', H:'#f5d582', M:'#c2cad6', V:'#84bece', N:'#ffd0b0', o:'#ef334a', '^': '#f97583', J: '#e89d4b', S: '#ffdb79', '>': '#90dc9a', F: '#f6a1cf' };
export function mountEditor(root: HTMLElement, publish: (m: MapDef) => Promise<void>, test?: (m:MapDef)=>void) {
  let map = newCourseMap(), tool = '#', mode = 'paint', history: MapDef[] = [], future: MapDef[] = [];
  try { const raw = localStorage.getItem(KEY); if (raw) { const draft = JSON.parse(raw); map = { ...validateCourseMap(draft, false), name: draft.name }; } } catch { /* 初期コース */ }
  root.innerHTML = `
    <div class="bar"><h2>コースをつくる</h2><button data-close>戻る</button></div>
    <p class="note">地形・能力アイテム・赤いボールを配置して、自分のコースを作ろう。テストは1人で動作確認できます。</p>
    <div class="editor-meta"><label>コース名<input data-name maxlength="40"></label><label>説明<input data-desc maxlength="280"></label></div>
    <div class="buttons"><label>幅<input data-width type="number" min="20" max="240"></label><label>高さ<input data-height type="number" min="16" max="100"></label><button data-resize>サイズを変更</button><label>開始に必要な人数<select data-players><option value="1">1人</option><option value="2">2人</option><option value="3">3人</option><option value="4">4人</option><option value="5">5人</option><option value="6">6人</option><option value="7">7人</option><option value="8">8人</option></select></label><button data-test class="primary">今のコースをテスト</button></div>
    <label class="editor-ability" hidden><input type="checkbox" data-word-blocks>「中華」を吐き出す技を使えるようにする</label>
    <p class="note">基本は左ハンマー・右フック。V 自転車・N 中華まん・P 幽霊・G 基本装備を配置できます。赤いボールは o（直径2マス）。赤い円が実際の大きさです。</p>
    <div class="buttons"><button data-mode="paint" aria-pressed="true">描く</button><button data-mode="pan" aria-pressed="false">移動</button><button data-undo>元に戻す</button><button data-redo>やり直す</button><label>表示倍率<select data-zoom><option value="12">小</option><option value="24" selected>中</option><option value="36">大</option></select></label></div>
    <div class="buttons"><label>接続番号<input data-number type="number" min="1" max="255" value="1"></label><label>角度<input data-angle type="number" min="0" max="359" value="0"></label><label>強さ / 回数<input data-force type="number" min="0" max="255" value="2"></label><label>秒数<input data-delay type="number" min="0" max="60" value="3"></label></div><p data-part-help class="note">パーツを選ぶと説明を表示します。</p><details><summary>パーツの説明一覧</summary><div data-parts-list></div></details><div class="tile-tools" role="group" aria-label="置くタイル"></div>
    <div class="editor-viewport" tabindex="0" aria-label="コース編集領域"><canvas aria-label="タイルを選んで描く"></canvas></div>
    <p class="note">マウスをドラッグして配置。スクロールで移動、倍率で拡大縮小。出現地点は1つです。下書きはこの端末に自動保存されます。</p>
    <details><summary>スイッチの設定</summary><div class="channels"></div></details>
    <div class="buttons"><button data-export>ファイルに保存</button><label class="file-button">ファイルを開く<input data-import type="file" accept="application/json,.json"></label><button data-new>新しいコース</button><button class="primary" data-publish>プレリリースする</button></div>
    <p data-status role="status"></p>`;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const name = q<HTMLInputElement>('[data-name]'), desc = q<HTMLInputElement>('[data-desc]'), canvas = q<HTMLCanvasElement>('canvas'), viewport = q('.editor-viewport');
  const status = (s: string) => { q('[data-status]').textContent = s; };
  let size = 24;
  const save = () => {
    map.name = name.value; map.description = desc.value;
    map.wordBlocks=true;map.abilityMode=true;map.minPlayers=+q<HTMLSelectElement>('[data-players]').value;
    try { localStorage.setItem(KEY, JSON.stringify(map)); status('下書きを保存しました'); } catch { status('端末に保存できません。ファイルに保存してください'); }
  };
  function draw() {
    canvas.width = map.width * size; canvas.height = map.height * size;
    const g = canvas.getContext('2d')!;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const c = map.tiles[y][x]; g.fillStyle = colors[c] ?? '#af8ee6'; g.fillRect(x * size, y * size, size - 1, size - 1);
      if (c !== '.' && size >= 20) { g.fillStyle = '#10172a'; g.font = `bold ${size * .6}px system-ui`; g.textAlign = 'center'; g.fillText(c, (x + .5) * size, (y + .72) * size); }
    }
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)if(map.tiles[y][x]==='o'){g.fillStyle='#ef334a99';g.strokeStyle='#ffb2ab';g.lineWidth=2;g.beginPath();g.arc((x+.5)*size,y*size,size,0,Math.PI*2);g.fill();g.stroke();}
    for(const key of ['game','front','tele','speed','switches','entities'] as const)for(const row of map.dd?.[key]??[]){const x=row[0]%map.width,y=Math.floor(row[0]/map.width),p=DD_PARTS.find(p=>p.layer===key&&(p.type===row[1]||key==='speed'));g.fillStyle='#28446a';g.fillRect(x*size,y*size,size-1,size-1);g.fillStyle='#bce8ff';g.font=`${Math.max(8,size*.35)}px sans-serif`;g.fillText(p?.name.slice(0,3)??String(row[1]),(x+.5)*size,(y+.65)*size,size-2);}
    for(const [x,y,dx,dy,length] of map.dd?.doors??[]){g.strokeStyle='#ffd48b';g.lineWidth=3;g.beginPath();g.moveTo(x/32*size,y/32*size);g.lineTo((x+dx*length)/32*size,(y+dy*length)/32*size);g.stroke();}
    q<HTMLButtonElement>('[data-undo]').disabled = !history.length; q<HTMLButtonElement>('[data-redo]').disabled = !future.length;
  }
  function load() {
    name.value = map.name; desc.value = map.description;
    q<HTMLInputElement>('[data-width]').value=String(map.width);q<HTMLInputElement>('[data-height]').value=String(map.height);q<HTMLSelectElement>('[data-players]').value=String(map.minPlayers);
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
  for (const [c, label] of [...TILE_TOOLS,...DD_PARTS.map(p=>[p.id,p.name])]) {
    const b = document.createElement('button'); b.textContent = c.startsWith('dd:')?label:`${c} ${label}`; b.setAttribute('aria-pressed', String(c === tool));
    b.onclick = () => { tool = c; q('[data-part-help]').textContent=DD_PARTS.find(p=>p.id===c)?.description??`${label}をマウスで配置します`; q('.tile-tools').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
    q('.tile-tools').append(b);
  }
  const descriptions:Record<string,string>={'.':'選択位置の地形とDDパーツを消去','#':'フックが掛かる岩壁',X:'フックが掛からない金属',S:'プレイヤーの出現位置（1つ）','>':'計測開始',F:'ゴール',V:'赤ボールを保持し、左で発射・右で自分の弾を爆破して回収',N:'毎回溜めて大中華を1発、単押しで操舵、右で小中華',P:'左長押しで幽体離脱・帰還。本体はフックで引ける。単押しハンマー、右フック',G:'ハンマーとフックの基本装備',o:'直径2マスの赤ボール','~':'凍結する床','^':'触れると出現位置に戻る',U:'凍結解除',O:'プレイヤーは通れずフックが通る',J:'上向きに跳ねる'};
  for(const [name,desc] of [...TILE_TOOLS.map(([c,n])=>[n,descriptions[c]??'同じ番号のスイッチ・扉・橋を接続']),...DD_PARTS.map(p=>[p.name,p.description])]){const row=document.createElement('p');row.textContent=`${name}：${desc}`;q('[data-parts-list]').append(row);}
  function placeDD(x:number,y:number){
    map.dd??=blankDD();const idx=y*map.width+x;
    for(const key of ['game','front','tele','speed','switches','entities'] as const)map.dd[key]=(map.dd[key]??[]).filter(r=>r[0]!==idx);
    map.dd.doors=map.dd.doors.filter(r=>Math.floor(r[0]/32)!==x||Math.floor(r[1]/32)!==y);
    const part=DD_PARTS.find(p=>p.id===tool);if(!part)return;
    const number=Math.max(1,Math.min(255,+q<HTMLInputElement>('[data-number]').value||1)),angle=+q<HTMLInputElement>('[data-angle]').value||0,force=Math.max(0,Math.min(255,+q<HTMLInputElement>('[data-force]').value||0)),delay=Math.max(0,Math.min(60,+q<HTMLInputElement>('[data-delay]').value||0));
    const row=part.layer==='tele'?[idx,part.type,number]:part.layer==='speed'?[idx,force,50,angle]:part.layer==='switches'?[idx,part.type,number,0,part.type===7?force:delay]:part.layer==='doors'?[x*32+16,y*32+16,Math.cos(angle*Math.PI/180),Math.sin(angle*Math.PI/180),32,number]:part.layer==='entities'?[idx,part.type,number,angle,force]:[idx,part.type,part.flags??0];
    (map.dd[part.layer]??=[]).push(row);
  }
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.onclick = () => {
    mode = b.dataset.mode!; viewport.style.touchAction = mode === 'pan' ? 'pan-x pan-y' : 'none';
    root.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  let panPoint:{x:number;y:number;left:number;top:number}|null=null;
  viewport.addEventListener('pointerdown',e=>{if(mode!=='pan')return;panPoint={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);e.preventDefault();});
  viewport.addEventListener('pointermove',e=>{if(!panPoint)return;viewport.scrollLeft=panPoint.left-e.clientX+panPoint.x;viewport.scrollTop=panPoint.top-e.clientY+panPoint.y;});
  viewport.addEventListener('pointerup',()=>panPoint=null);viewport.addEventListener('pointercancel',()=>panPoint=null);
  let pointer: number | null = null, lastCell: { x: number; y: number } | null = null;
  const paint = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / size), y = Math.floor((e.clientY - r.top) / size);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const start = lastCell ?? { x, y }, n = Math.max(Math.abs(x - start.x), Math.abs(y - start.y), 1);
    const rows = map.tiles.map(r => [...r]);
    if (tool === 'S') for (const row of rows) for (let i = 0; i < row.length; i++) if (row[i] === 'S') row[i] = '.';
    if (tool === 'S') rows[y][x] = tool;
    else for (let i = 0; i <= n; i++){const px=Math.round(start.x+(x-start.x)*i/n),py=Math.round(start.y+(y-start.y)*i/n);placeDD(px,py);rows[py][px]=tool.startsWith('dd:')?'.':tool;}
    map.tiles = rows.map(r => r.join('')); lastCell = { x, y }; draw();
  };
  canvas.onpointerdown = e => { if (mode !== 'paint' || pointer !== null) return; history.push(structuredClone(map)); if (history.length > 60) history.shift(); future = []; pointer = e.pointerId; lastCell = null; canvas.setPointerCapture(pointer); paint(e); e.preventDefault(); };
  canvas.onpointermove = e => { if (e.pointerId === pointer) paint(e); };
  const end = (e: PointerEvent) => { if (e.pointerId !== pointer) return; pointer = null; lastCell = null; save(); };
  canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = end;
  q('[data-undo]').onclick = () => { const rows = history.pop(); if (rows) { future.push(structuredClone(map)); map = rows; save(); draw(); } };
  q('[data-redo]').onclick = () => { const rows = future.pop(); if (rows) { history.push(structuredClone(map)); map = rows; save(); draw(); } };
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
    try { save(); await publish(validateCourseMap(map)); status('プレリリースしました！部屋のホストがコース一覧から選べます。'); }
    catch (e) { status((e as Error).message); } finally { b.disabled = false; }
  };
  q('[data-test]').onclick=()=>{try{save();test?.(validateCourseMap(map));}catch(e){status((e as Error).message);}};
  q('[data-players]').onchange=save;
  q('[data-resize]').onclick=()=>{const w=+q<HTMLInputElement>('[data-width]').value,h=+q<HTMLInputElement>('[data-height]').value;
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<20||w>240||h<16||h>100){status('幅20〜240、高さ16〜100の整数にしてください');return;}
    if((w<map.width||h<map.height)&&!confirm('外側のタイルが切り取られます。サイズを変更しますか？'))return;
    map.tiles=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>map.tiles[y]?.[x]??'.').join(''));if(map.dd){for(const key of ['game','front','tele','speed','switches','entities'] as const)map.dd[key]=(map.dd[key]??[]).filter(r=>r[0]%map.width<w&&Math.floor(r[0]/map.width)<h).map(r=>[Math.floor(r[0]/map.width)*w+r[0]%map.width,...r.slice(1)]);map.dd.doors=map.dd.doors.filter(r=>r[0]<w*32&&r[1]<h*32);}map.width=w;map.height=h;history=[];future=[];load();save();};
  load();
}

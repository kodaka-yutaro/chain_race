import {enclosedCells,extendCell} from '../shared/editor-fill';
import {drawPart} from './part-art';
import './part-art.css';
import './editor-layout.css';
import {DD_PARTS,blankDD} from '../shared/dd-parts';
import { COURSE_MAX_WIDTH, COURSE_MAX_HEIGHT, COURSE_FILE_MAX_BYTES, newCourseMap, TILE_TOOLS, validateCourseMap, validateCoursePreview } from '../shared/courses';
import type { MapDef } from '../shared/physics';

let editorResize:ResizeObserver|undefined;
const KEY = 'tsunagu.course-draft.v1';
const RECENT_KEY = 'tsunagu.editor-recent.v1', PAGE_SIZE = 18, RECENT_LIMIT = 30;
const ZOOMS=[.5,1,2,3,6,12,24,36,48];
const PARTS = [...TILE_TOOLS,...DD_PARTS.filter(p=>!['dd:game:9:0','dd:game:11:0'].includes(p.id)).map(p=>[p.id,p.name])];

export function mountEditor(root: HTMLElement, publish: (m: MapDef) => Promise<void>, test?: (m:MapDef)=>void) {
  let selected:{x:number;y:number}|null=null;
  let eraseRadius=0;
  let map = newCourseMap(), tool = '#', mode = 'paint', history: MapDef[] = [], future: MapDef[] = [];
  try { const raw = localStorage.getItem(KEY); if (raw) { const draft = JSON.parse(raw); map = { ...validateCourseMap(draft, false), name: draft.name }; } } catch { /* 初期コース */ }
  root.innerHTML = `
    <header class="ed-header"><button data-close title="部屋一覧に戻る">← 戻る</button><strong>コースエディタ</strong><input data-name aria-label="コース名" maxlength="40"><button data-settings>コース設定</button><button data-help>説明一覧</button><button data-test class="primary">テストプレイ ▶</button></header>
    <nav class="ed-toolbar" aria-label="編集ツール"><button data-mode="paint" aria-pressed="true">描く</button><button data-mode="select" aria-pressed="false">マス選択</button><button data-erase aria-pressed="false" title="Eキーで消去">消去 (E)</button><button data-big-erase aria-pressed="false" title="Shift+E：5×5マスを消去">大消去 (Shift+E)</button><button data-mode="pan" aria-pressed="false">移動</button><button data-undo title="R / Ctrl+Z">↶ 戻す (R)</button><button data-redo title="Ctrl+Shift+Z">↷ やり直す</button><label>倍率<select data-zoom>${ZOOMS.map(n=>`<option value="${n}" ${n===24?'selected':''}>${+(n/24*100).toFixed(1)}%</option>`).join('')}</select></label><button data-spawn>出現地点へ</button><button data-inspector-toggle>パーツ設定</button><span data-dimensions></span></nav>
    <p data-test-error role="alert" hidden></p><div data-erase-footprint hidden aria-hidden="true" style="position:fixed;pointer-events:none;z-index:25;border:2px solid #ffbdad;background:#ff78652a;box-sizing:border-box"></div><div data-brush-preview hidden aria-hidden="true"><canvas width="32" height="32"></canvas><span></span></div>
    <div class="ed-workspace">
      <aside class="ed-palette" aria-label="パーツを選ぶ"><input data-search type="search" placeholder="パーツを検索" aria-label="パーツを検索"><div data-categories class="ed-categories"></div><section class="ed-recent"><h3>最近使ったパーツ</h3><div data-recent role="group" aria-label="最近使ったパーツ"></div></section><div class="tile-tools" role="group" aria-label="置くタイル"></div><div class="ed-pages"><button data-page-prev aria-label="前のパーツ">←</button><span data-page-info></span><button data-page-next aria-label="次のパーツ">→</button></div></aside>
      <main class="ed-stage"><div class="editor-viewport" tabindex="0" aria-label="コース編集領域"><div class="ed-map-space"><canvas aria-label="タイルを選んで描く"></canvas></div></div><div class="ed-canvas-hint">右クリックでパーツを拾う · 矢印で延長 · Rで元に戻す · Pで塗る · Eで消す · Shift+Eで5×5消去 · ＋／−で倍率 · Spaceで移動<span data-cursor></span></div></main>
      <aside class="ed-inspector" aria-label="選択パーツの設定"><h3 data-selected-name>岩壁</h3><p data-part-help>フックが掛かる岩壁</p><div class="ed-fields"><label data-field="number">接続番号<input data-number type="number" min="1" max="255" value="1"></label><label data-field="angle">角度<input data-angle type="number" min="0" max="359" value="0"></label><label data-field="force">強さ / 回数<input data-force type="number" min="0" max="255" value="2"></label><label data-field="delay">秒数<input data-delay type="number" min="0" max="60" value="3"></label></div><p data-no-settings class="note">このパーツはそのまま配置できます。</p><section class="ed-channel"><h3>通常スイッチ</h3><label>接続グループ<select data-channel-select>${[1,2,3,4,5].map(n=>`<option value="${n-1}">${n} 番</option>`).join('')}</select></label><div class="channels"></div></section><p class="ed-tip">配置済みパーツは「マス選択」か右クリックで選ぶと設定を変更できます。</p></aside>
    </div>
    <footer class="ed-footer"><span data-status role="status">下書きはこの端末に自動保存</span><button data-export>ファイルに保存</button><label class="file-button">開く<input data-import type="file" accept="application/json,.json"></label><button data-publish>プレリリース</button></footer>
    <dialog class="ed-dialog" data-settings-dialog><div class="ed-dialog-head"><h2>コース設定</h2><button data-dismiss>閉じる</button></div><label>説明<input data-desc maxlength="280"></label><div class="ed-size"><label>幅（マス）<input data-width type="number" min="20" max="${COURSE_MAX_WIDTH}"></label><label>高さ（マス）<input data-height type="number" min="16" max="${COURSE_MAX_HEIGHT}"></label><button data-resize>サイズ変更</button></div><label>開始に必要な人数<select data-players>${[1,2,3,4,5,6,7,8].map(n=>`<option value="${n}">${n}人</option>`).join('')}</select></label><p class="note">テストプレイは設定人数にかかわらず1人で試せます。</p><button data-new>新しいコース</button><label hidden><input type="checkbox" data-word-blocks>中華</label></dialog>
    <dialog class="ed-dialog" data-help-dialog><div class="ed-dialog-head"><h2>パーツの説明一覧</h2><button data-dismiss>閉じる</button></div><p>出現地点を1つ置くとテストできます。公開にはスタートとゴールも必要です。数字はスイッチ・転送先の接続番号です。</p><div data-parts-list></div></dialog>`;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const name = q<HTMLInputElement>('[data-name]'), desc = q<HTMLInputElement>('[data-desc]'), canvas = q<HTMLCanvasElement>('.editor-viewport canvas'), viewport = q('.editor-viewport');
  const status = (s: string) => { q('[data-status]').textContent = s; };
  let size = 24, category='地形', page=0;
  for(const [button,dialog] of [['[data-settings]','[data-settings-dialog]'],['[data-help]','[data-help-dialog]']])q(button).onclick=()=>q<HTMLDialogElement>(dialog).showModal();
  root.querySelectorAll<HTMLButtonElement>('[data-dismiss]').forEach(b=>b.onclick=()=>b.closest('dialog')!.close());
  q('[data-inspector-toggle]').onclick=()=>q('.ed-inspector').classList.toggle('ed-open');
  q('[data-channel-select]').onchange=()=>root.querySelectorAll<HTMLElement>('.channels > div').forEach((row,i)=>row.hidden=i!==+q<HTMLSelectElement>('[data-channel-select]').value);
  function centreSpawn(){const y=map.tiles.findIndex(row=>row.includes('S')),x=map.tiles[y]?.indexOf('S')??0;viewport.scrollLeft=Math.max(0,(x+.5)*size-viewport.clientWidth/2);viewport.scrollTop=Math.max(0,(y+.5)*size-viewport.clientHeight/2);}
  q('[data-spawn]').onclick=centreSpawn;

  const save = () => {
    map.name = name.value; map.description = desc.value;
    map.wordBlocks=true;map.abilityMode=true;map.minPlayers=+q<HTMLSelectElement>('[data-players]').value;
    try { localStorage.setItem(KEY, JSON.stringify(map)); status('下書きを保存しました'); } catch { status('端末に保存できません。ファイルに保存してください'); }
  };
  function draw() {
    q('[data-dimensions]').textContent=`${map.width} × ${map.height} マス`;
    q('.ed-map-space').style.width=`${map.width*size}px`;q('.ed-map-space').style.height=`${map.height*size}px`;
    canvas.width=Math.min(map.width*size,viewport.clientWidth);canvas.height=Math.min(map.height*size,viewport.clientHeight);
    const left=viewport.scrollLeft,top=viewport.scrollTop;
    const x0=Math.max(0,Math.floor(left/size)),y0=Math.max(0,Math.floor(top/size)),x1=Math.min(map.width,Math.ceil((left+canvas.width)/size)),y1=Math.min(map.height,Math.ceil((top+canvas.height)/size));
    const g = canvas.getContext('2d')!;g.translate(-left,-top);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const c = map.tiles[y][x];
      if(c==='.') {g.fillStyle='#17283d';g.fillRect(x*size,y*size,Math.max(.5,size-1),Math.max(.5,size-1));} else drawPart(g,c,x*size,y*size,size);
    }
    for(let y=Math.max(0,y0-1);y<Math.min(map.height,y1+1);y++)for(let x=Math.max(0,x0-1);x<Math.min(map.width,x1+1);x++)if(map.tiles[y][x]==='o'){g.fillStyle='#ef334a99';g.strokeStyle='#ffb2ab';g.lineWidth=2;g.beginPath();g.arc((x+.5)*size,y*size,size,0,Math.PI*2);g.fill();g.stroke();}
    for(const key of ['game','front','tele','speed','switches','entities'] as const)for(const row of map.dd?.[key]??[]){
      const x=row[0]%map.width,y=Math.floor(row[0]/map.width);if(x<x0||x>=x1||y<y0||y>=y1)continue;
      const p=DD_PARTS.find(p=>p.layer===key&&(p.type===row[1]||key==='speed')&&(!['game','front'].includes(key)||(p.flags??0)===(row[2]??0)));
      const badge=['tele','switches','entities'].includes(key)?String(row[2]):undefined;
      drawPart(g,p?.id??String(row[1]),x*size,y*size,size,badge,key==='speed'?row[3]:0);
    }
    for(const [x,y,dx,dy,length,number] of map.dd?.doors??[]){g.strokeStyle='#ffd48b';g.lineWidth=3;g.beginPath();g.moveTo(x/32*size,y/32*size);g.lineTo((x+dx*length)/32*size,(y+dy*length)/32*size);g.stroke();drawPart(g,'dd:doors:49:0',Math.floor(x/32)*size,Math.floor(y/32)*size,size,String(number));}
    if(selected){g.strokeStyle='#ffe277';g.lineWidth=2;g.strokeRect(selected.x*size+1,selected.y*size+1,Math.max(1,size-2),Math.max(1,size-2));}
    q<HTMLButtonElement>('[data-undo]').disabled = !history.length; q<HTMLButtonElement>('[data-redo]').disabled = !future.length;
  }
  function load() {
    selected=null;
    name.value = map.name; desc.value = map.description;
    q<HTMLInputElement>('[data-width]').value=String(map.width);q<HTMLInputElement>('[data-height]').value=String(map.height);q<HTMLSelectElement>('[data-players]').value=String(map.minPlayers);
    q<HTMLInputElement>('[data-word-blocks]').checked=!!map.wordBlocks;
    q('.channels').replaceChildren(...Array.from({ length: 5 }, (_, i) => {
      const row = document.createElement('div'); row.className = 'ed-channel-row';row.hidden=i!==+q<HTMLSelectElement>('[data-channel-select]').value;
      row.innerHTML = `<span>スイッチ${i + 1}</span><label>必要人数<select><option value="1">1人</option><option value="2">2人</option></select></label><label>離した後の秒数<input type="number" min="0" max="10" step="0.5"></label>`;
      const select = row.querySelector('select')!, input = row.querySelector('input')!;
      select.value = String(map.channels?.[i]?.need ?? 1); input.value = String((map.channels?.[i]?.hold ?? 0) / 50);
      row.onchange = () => { map.channels ??= Array.from({ length: 5 }, () => ({})); map.channels[i] = { need: +select.value, hold: Math.max(0, Math.min(500, Math.round(+input.value * 50))) }; save(); };
      return row;
    })); draw();requestAnimationFrame(()=>{centreSpawn();draw();});
  }
  let recent:string[]=[];
  try {const saved=JSON.parse(localStorage.getItem(RECENT_KEY)??'[]');if(Array.isArray(saved))recent=[...new Set(saved)].filter((c):c is string=>typeof c==='string'&&c!=='.'&&PARTS.some(p=>p[0]===c)).slice(0,RECENT_LIMIT);}catch{/* 履歴がない場合 */}
  function choosePart(c:string){
    selected=null;eraseRadius=0;q('[data-big-erase]').setAttribute('aria-pressed','false');
    if(c==='dd:game:9:0')c='~';if(c==='dd:game:11:0')c='U';
    const part=PARTS.find(p=>p[0]===c);if(!part)return;
    tool=c;mode='paint';viewport.style.touchAction='none';selectPart(c,part[1]);
    root.querySelectorAll<HTMLElement>('[data-part]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===c)));
    root.querySelectorAll<HTMLElement>('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode==='paint'&&c!=='.')));
    q('[data-erase]').setAttribute('aria-pressed',String(c==='.'));draw();updatePreview();
  }
  function renderRecent(){
    q('[data-recent]').replaceChildren(...recent.slice(0,6).map(c=>{const b=q<HTMLButtonElement>(`.tile-tools [data-part="${c}"]`).cloneNode(true) as HTMLButtonElement;b.hidden=false;drawPart(b.querySelector('canvas')!.getContext('2d')!,c,0,0,64);b.title=PARTS.find(p=>p[0]===c)![1];b.onclick=()=>choosePart(c);return b;}));
    if(!recent.length)q('[data-recent]').textContent='配置したパーツがここに並びます';
  }
  function rememberPart(){if(tool==='.'||recent[0]===tool)return;recent=[tool,...recent.filter(c=>c!==tool)].slice(0,RECENT_LIMIT);renderRecent();try{localStorage.setItem(RECENT_KEY,JSON.stringify(recent));}catch{/* 配置は保存エラーに関係なく続行 */}}
  for (const [c, label] of PARTS) {
    const b = document.createElement('button'); b.className='part-button'; b.title=DD_PARTS.find(p=>p.id===c)?.description??label;
    const icon=document.createElement('canvas');icon.width=64;icon.height=64;icon.setAttribute('aria-hidden','true');drawPart(icon.getContext('2d')!,c,0,0,64);
    const caption=document.createElement('span');caption.textContent=label;b.append(icon,caption); b.setAttribute('aria-pressed', String(c === tool));
    b.dataset.part=c;b.onclick = () => choosePart(c);
    b.dataset.label=label;b.dataset.category=partCategory(c);q('.tile-tools').append(b);
  }
  const descriptions:Record<string,string>={'.':'選択位置の地形とDDパーツを消去','#':'フックが掛かる岩壁',X:'フックが掛からない金属',S:'プレイヤーの出現位置（1つ）','>':'計測開始',F:'ゴール',V:'赤ボールを保持し、左で発射・右で自分の弾を爆破して回収',N:'毎回溜めて大中華を1発、単押しで操舵、右で小中華',P:'左長押しで幽体離脱・帰還。本体はフックで引ける。単押しハンマー、右フック',G:'ハンマーとフックの基本装備',o:'直径2マスの赤ボール','~':'触れている間は凍結し、離れて3秒で回復。ハンマーでも解除','^':'触れると出現位置に戻る',U:'凍結解除',O:'プレイヤーは通れずフックが通る',J:'上向きに跳ねる'};
  for(const [name,desc] of [...TILE_TOOLS.map(([c,n])=>[n,descriptions[c]??'同じ番号のスイッチ・扉・橋を接続']),...DD_PARTS.filter(p=>!['dd:game:9:0','dd:game:11:0'].includes(p.id)).map(p=>[p.name,p.description])]){const row=document.createElement('p');row.textContent=`${name}：${desc}`;q('[data-parts-list]').append(row);}
  function partCategory(c:string){
    if(!c.startsWith('dd:'))return 'GHMPVNo'.includes(c)?'能力・物体':/^[1-5a-eA-E]$/.test(c)?'スイッチ':'地形';
    const p=DD_PARTS.find(p=>p.id===c)!;
    if(p.layer==='tele')return '転送';if(['switches','doors'].includes(p.layer))return 'スイッチ';
    if(p.layer==='entities')return '装置';if(p.layer==='speed'||[16,32,105,89,17,18,60,61,62].includes(p.type))return '移動';
    if([197,199,200,201,202,106,90].includes(p.type))return '能力・物体';return '状態';
  }
  const categories=['地形','能力・物体','移動','転送','スイッチ','状態','装置','すべて'];
  for(const c of categories){const b=document.createElement('button');b.textContent=c;b.onclick=()=>{category=c;page=0;filterParts();};q('[data-categories]').append(b);}
  function filterParts(){
    const search=q<HTMLInputElement>('[data-search]').value.trim();
    const buttons=[...root.querySelectorAll<HTMLButtonElement>('.tile-tools button')];
    const found=buttons.filter(b=>(search||category==='すべて'||b.dataset.category===category)&&(!search||(b.dataset.label+b.title).includes(search)));
    const pages=Math.max(1,Math.ceil(found.length/PAGE_SIZE));page=Math.min(page,pages-1);
    buttons.forEach(b=>b.hidden=true);found.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE).forEach(b=>b.hidden=false);
    q('[data-page-info]').textContent=found.length?`${page+1} / ${pages} · ${found.length}種類`:'該当なし';
    q<HTMLButtonElement>('[data-page-prev]').disabled=page===0;q<HTMLButtonElement>('[data-page-next]').disabled=page===pages-1;
    root.querySelectorAll<HTMLButtonElement>('[data-categories] button').forEach(b=>b.setAttribute('aria-pressed',String(!search&&b.textContent===category)));
  }
  q('[data-search]').oninput=()=>{page=0;filterParts();};
  q('[data-page-prev]').onclick=()=>{page--;filterParts();};q('[data-page-next]').onclick=()=>{page++;filterParts();};
  function selectPart(c:string,label:string){
    const p=DD_PARTS.find(p=>p.id===c);q('[data-selected-name]').textContent=label;q('[data-part-help]').textContent=(p?.layer==='tele'?`${p.description}。入口と出口の接続番号を揃えます。別の組には別番号（1〜255）を指定できます。`:p?.description)??descriptions[c]??'同じ番号のスイッチ・扉・橋を接続します。';
    const fields:string[]=[];
    if(p){if(['tele','switches','doors','entities'].includes(p.layer))fields.push('number');if(['speed','entities','doors'].includes(p.layer))fields.push('angle');if(['speed','entities'].includes(p.layer)||p.type===7)fields.push('force');if(p.layer==='switches'&&[22,23].includes(p.type))fields.push('delay');}
    root.querySelectorAll<HTMLElement>('[data-field]').forEach(e=>e.hidden=!fields.includes(e.dataset.field!));q('[data-no-settings]').hidden=fields.length>0;
    q('.ed-channel').hidden=!/^[1-5a-eA-E]$/.test(c);
    if(/^[1-5a-eA-E]$/.test(c)){const n=/[1-5]/.test(c)?+c-1:c.toLowerCase().charCodeAt(0)-97;q<HTMLSelectElement>('[data-channel-select]').value=String(n);q('[data-channel-select]').dispatchEvent(new Event('change'));}
  }
  filterParts();selectPart('#','岩壁');renderRecent();
  q('[data-erase]').onclick=()=>choosePart('.');
  function bigErase(){choosePart('.');eraseRadius=2;q('[data-big-erase]').setAttribute('aria-pressed','true');q('[data-selected-name]').textContent='大きな消しゴム（5×5）';updatePreview();}
  q('[data-big-erase]').onclick=bigErase;
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
    if(b.dataset.mode==='paint'&&tool==='.')choosePart('#');
    q('[data-erase]').setAttribute('aria-pressed','false');
    mode = b.dataset.mode!;updatePreview(); viewport.style.touchAction = mode === 'pan' ? 'pan-x pan-y' : 'none';
    root.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  let spacePan=false;
  let panPoint:{x:number;y:number;left:number;top:number}|null=null;
  viewport.addEventListener('pointerdown',e=>{if(mode!=='pan'&&!spacePan&&e.button!==1)return;panPoint={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);e.preventDefault();});
  viewport.addEventListener('pointermove',e=>{if(!panPoint)return;viewport.scrollLeft=panPoint.left-e.clientX+panPoint.x;viewport.scrollTop=panPoint.top-e.clientY+panPoint.y;});
  viewport.addEventListener('pointerup',()=>panPoint=null);viewport.addEventListener('pointercancel',()=>panPoint=null);
  let hover:{x:number;y:number}|null=null;
  function updatePreview(){
    const footprint=q('[data-erase-footprint]');footprint.hidden=!hover||mode!=='paint'||tool!=='.'||!eraseRadius;
    if(!footprint.hidden){const rect=canvas.getBoundingClientRect(),cx=Math.floor((hover!.x-rect.left+viewport.scrollLeft)/size),cy=Math.floor((hover!.y-rect.top+viewport.scrollTop)/size);const left=Math.max(rect.left,rect.left+Math.max(0,cx-eraseRadius)*size-viewport.scrollLeft),top=Math.max(rect.top,rect.top+Math.max(0,cy-eraseRadius)*size-viewport.scrollTop),right=Math.min(rect.right,rect.left+Math.min(map.width,cx+eraseRadius+1)*size-viewport.scrollLeft),bottom=Math.min(rect.bottom,rect.top+Math.min(map.height,cy+eraseRadius+1)*size-viewport.scrollTop);Object.assign(footprint.style,{left:left+'px',top:top+'px',width:Math.max(0,right-left)+'px',height:Math.max(0,bottom-top)+'px'});}
    const box=q('[data-brush-preview]');box.hidden=!hover||mode!=='paint';if(box.hidden)return;
    box.style.left=`${Math.min(hover!.x+18,window.innerWidth-180)}px`;box.style.top=`${Math.min(hover!.y+18,window.innerHeight-48)}px`;
    const icon=box.querySelector('canvas')!,g=icon.getContext('2d')!;g.clearRect(0,0,32,32);drawPart(g,tool,0,0,32);box.querySelector('span')!.textContent=PARTS.find(p=>p[0]===tool)?.[1]??tool;
    if(tool==='.'&&eraseRadius)box.querySelector('span')!.textContent='消去 5×5マス';
  }
  function fill(){
    if(!hover||pointer!==null)return;
    if(tool==='.'||tool==='S'){status('塗りつぶすパーツを選んでください（消去・出現地点は対象外）');return;}
    const rect=canvas.getBoundingClientRect(),x=Math.floor((hover.x-rect.left+viewport.scrollLeft)/size),y=Math.floor((hover.y-rect.top+viewport.scrollTop)/size);
    const cells=enclosedCells(map,x,y);
    if(!cells.length){status('枠で閉じた空白の内側にカーソルを合わせてPを押してください');return;}
    history.push(structuredClone(map));if(history.length>60)history.shift();future=[];
    const rows=map.tiles.map(row=>[...row]);
    for(const idx of cells){const cx=idx%map.width,cy=Math.floor(idx/map.width);if(tool.startsWith('dd:'))placeDD(cx,cy);else rows[cy][cx]=tool;}
    map.tiles=rows.map(row=>row.join(''));rememberPart();draw();save();status(`${cells.length}マスを塗りつぶしました（R / Ctrl+Zで戻す）`);
  }
  canvas.onpointerleave=()=>{hover=null;updatePreview();};
  let pointer: number | null = null, lastCell: { x: number; y: number } | null = null;
  const paint = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left + viewport.scrollLeft) / size), y = Math.floor((e.clientY - r.top + viewport.scrollTop) / size);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const start = lastCell ?? { x, y }, n = Math.max(Math.abs(x - start.x), Math.abs(y - start.y), 1);
    const rows = map.tiles.map(r => [...r]);
    if (tool === 'S') for (const row of rows) for (let i = 0; i < row.length; i++) if (row[i] === 'S') row[i] = '.';
    if (tool === 'S') rows[y][x] = tool;
    else for (let i = 0; i <= n; i++){const px=Math.round(start.x+(x-start.x)*i/n),py=Math.round(start.y+(y-start.y)*i/n);const radius=tool==='.'?eraseRadius:0;for(let yy=Math.max(0,py-radius);yy<=Math.min(map.height-1,py+radius);yy++)for(let xx=Math.max(0,px-radius);xx<=Math.min(map.width-1,px+radius);xx++){placeDD(xx,yy);rows[yy][xx]=tool.startsWith('dd:')?'.':tool;}}
    map.tiles = rows.map(r => r.join('')); selected={x,y};lastCell = { x, y }; rememberPart(); draw();
  };
  function selectCell(e:PointerEvent){
    const rect=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-rect.left+viewport.scrollLeft)/size),y=Math.floor((e.clientY-rect.top+viewport.scrollTop)/size);
    if(x<0||y<0||x>=map.width||y>=map.height)return;
    const idx=y*map.width+x;
    let code=map.tiles[y][x];
    for(const key of ['game','front','tele','speed','switches','entities'] as const){const row=map.dd?.[key]?.find(r=>r[0]===idx);if(!row)continue;const part=DD_PARTS.find(p=>p.layer===key&&(p.type===row[1]||key==='speed')&&(!['game','front'].includes(key)||(p.flags??0)===(row[2]??0)));if(part)code=part.id;
      if(['tele','switches','entities'].includes(key))q<HTMLInputElement>('[data-number]').value=String(row[2]);
      if(key==='speed'){q<HTMLInputElement>('[data-angle]').value=String(row[3]);q<HTMLInputElement>('[data-force]').value=String(row[1]);}
      if(key==='entities'){q<HTMLInputElement>('[data-angle]').value=String(row[3]);q<HTMLInputElement>('[data-force]').value=String(row[4]);}
      if(key==='switches')q<HTMLInputElement>(row[1]===7?'[data-force]':'[data-delay]').value=String(row[4]);
    }
    const door=map.dd?.doors.find(r=>Math.floor(r[0]/32)===x&&Math.floor(r[1]/32)===y);
    if(door){code='dd:doors:49:0';q<HTMLInputElement>('[data-number]').value=String(door[5]);q<HTMLInputElement>('[data-angle]').value=String((Math.atan2(door[3],door[2])*180/Math.PI+360)%360);}
    choosePart(code);selected={x,y};
    if(e.button!==2){mode='select';root.querySelectorAll<HTMLElement>('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode==='select')));q('[data-erase]').setAttribute('aria-pressed','false');}
    hover={x:e.clientX,y:e.clientY};viewport.focus({preventScroll:true});draw();updatePreview();
    status(e.button===2?'パーツを拾いました。左クリックで配置／矢印で延長':`${x}, ${y} を選択。矢印で延長／右の設定で変更`);
  }
  canvas.oncontextmenu=e=>e.preventDefault();
  for(const field of ['number','angle','force','delay'])q<HTMLInputElement>(`[data-${field}]`).oninput=()=>{
    const input=q<HTMLInputElement>(`[data-${field}]`);if(!input.value||!input.checkValidity())return;
    if(!selected||!tool.startsWith('dd:'))return;
    history.push(structuredClone(map));if(history.length>60)history.shift();future=[];
    placeDD(selected.x,selected.y);draw();save();
  };
  function extend(dx:number,dy:number){
    if(!selected||pointer!==null){status('延ばすマスを右クリック、または「マス選択」で選んでください');return;}
    const old=structuredClone(map),count=extendCell(map,selected.x,selected.y,dx,dy);
    if(!count){status('その方向には延ばせません（空白・出現地点・隣にパーツがある場合）');return;}
    history.push(old);if(history.length>60)history.shift();future=[];draw();save();status(`${count}マス延ばしました（R / Ctrl+Zで戻す）`);
  }
  canvas.onpointerdown = e => { if(!spacePan&&(e.button===2||mode==='select'&&e.button===0)){selectCell(e);e.preventDefault();return;}if (mode !== 'paint' || spacePan || e.button!==0 || pointer !== null) return; history.push(structuredClone(map)); if (history.length > 60) history.shift(); future = []; pointer = e.pointerId; viewport.focus({preventScroll:true}); lastCell = null; canvas.setPointerCapture(pointer); paint(e); e.preventDefault(); };
  canvas.onpointermove = e => { hover={x:e.clientX,y:e.clientY}; updatePreview();if (e.pointerId === pointer) paint(e);
    const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left+viewport.scrollLeft)/size),y=Math.floor((e.clientY-r.top+viewport.scrollTop)/size),idx=y*map.width+x;
    const names:string[]=[];const tile=map.tiles[y]?.[x];if(tile&&tile!=='.')names.push(TILE_TOOLS.find(t=>t[0]===tile)?.[1]??tile);
    for(const key of ['game','front','tele','speed','switches','entities'] as const)for(const row of map.dd?.[key]??[])if(row[0]===idx){const p=DD_PARTS.find(p=>p.layer===key&&(p.type===row[1]||key==='speed')&&(!['game','front'].includes(key)||(p.flags??0)===(row[2]??0)));names.push(p?.name??'特殊パーツ');}
    for(const row of map.dd?.doors??[])if(Math.floor(row[0]/32)===x&&Math.floor(row[1]/32)===y)names.push(`スイッチドア ${row[5]}`);
    canvas.title=names.join(' / ')||'空白';q('[data-cursor]').textContent=`${x}, ${y} · ${canvas.title}`;
  };
  const end = (e: PointerEvent) => { if (e.pointerId !== pointer) return; pointer = null; lastCell = null; save(); };
  canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = end;
  q('[data-undo]').onclick = () => { const rows = history.pop(); if (rows) { future.push(structuredClone(map)); map = rows; selected=null;save(); draw(); } };
  q('[data-redo]').onclick = () => { const rows = future.pop(); if (rows) { history.push(structuredClone(map)); map = rows; selected=null;save(); draw(); } };
  function zoom(next:number){const x=(viewport.scrollLeft+viewport.clientWidth/2)/size,y=(viewport.scrollTop+viewport.clientHeight/2)/size;size=next;q<HTMLSelectElement>('[data-zoom]').value=String(size);draw();viewport.scrollLeft=x*size-viewport.clientWidth/2;viewport.scrollTop=y*size-viewport.clientHeight/2;}
  function zoomStep(delta:number){zoom(ZOOMS[Math.max(0,Math.min(ZOOMS.length-1,ZOOMS.indexOf(size)+delta))]);}
  q<HTMLSelectElement>('[data-zoom]').onchange=e=>zoom(+(e.target as HTMLSelectElement).value);
  viewport.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();zoomStep(e.deltaY<0?1:-1);},{passive:false});
  root.onkeydown=e=>{if((e.target as HTMLElement).closest('input,select,textarea,dialog,[contenteditable]'))return;if(e.code==='KeyE'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(e.shiftKey)bigErase();else choosePart('.');}if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.repeat){const direction:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(direction[e.key]){e.preventDefault();extend(...direction[e.key]);}if(e.key==='+'||e.key==='='||e.code==='NumpadAdd'){e.preventDefault();zoomStep(1);}if(e.key==='-'||e.code==='NumpadSubtract'){e.preventDefault();zoomStep(-1);}if(e.code==='KeyP'){e.preventDefault();fill();}if(e.code==='KeyR'){e.preventDefault();if(pointer===null)q<HTMLButtonElement>('[data-undo]').click();}}if(e.code==='Space'){e.preventDefault();spacePan=true;viewport.style.cursor='grab';}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();q<HTMLButtonElement>(e.shiftKey?'[data-redo]':'[data-undo]').click();}};
  root.onkeyup=e=>{if(e.code==='Space'){spacePan=false;viewport.style.cursor='';}};
  viewport.onblur=()=>{spacePan=false;viewport.style.cursor='';};
  name.oninput = desc.oninput = save;
  q<HTMLInputElement>('[data-word-blocks]').onchange=save;
  q('[data-new]').onclick = () => { if (!confirm('下書きを新しくします。必要なら先にファイルに保存してください。')) return; map = newCourseMap(); history = []; future = []; load(); save(); };
  q('[data-export]').onclick = () => { save(); const url = URL.createObjectURL(new Blob([JSON.stringify(map)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'tsunagu-course.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  q<HTMLInputElement>('[data-import]').onchange = async e => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    try { if (f.size > COURSE_FILE_MAX_BYTES) throw new Error('ファイルが大きすぎます'); const m = validateCourseMap(JSON.parse(await f.text())); map = m; history = []; future = []; load(); save(); } catch (e) { status((e as Error).message); }
    (e.target as HTMLInputElement).value = '';
  };
  q('[data-publish]').onclick = async () => {
    const b = q<HTMLButtonElement>('[data-publish]'); b.disabled = true;
    try { save(); await publish(validateCourseMap(map)); status('プレリリースしました！部屋のホストがコース一覧から選べます。'); }
    catch (e) { status((e as Error).message); } finally { b.disabled = false; }
  };
  q('[data-test]').onclick=()=>{const error=q('[data-test-error]');error.hidden=true;try{save();if(!test)throw Error('テスト機能を読み込めませんでした。ページを再読み込みしてください。');test(validateCoursePreview(map));}catch(e){error.textContent=(e as Error).message;error.hidden=false;error.scrollIntoView({block:'nearest'});}};
  q('[data-players]').onchange=save;
  q('[data-resize]').onclick=()=>{const w=+q<HTMLInputElement>('[data-width]').value,h=+q<HTMLInputElement>('[data-height]').value;
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<20||w>COURSE_MAX_WIDTH||h<16||h>COURSE_MAX_HEIGHT){status(`幅20〜${COURSE_MAX_WIDTH}、高さ16〜${COURSE_MAX_HEIGHT}の整数にしてください`);return;}
    if((w<map.width||h<map.height)&&!confirm('外側のタイルが切り取られます。サイズを変更しますか？'))return;
    map.tiles=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>map.tiles[y]?.[x]??'.').join(''));if(map.dd){for(const key of ['game','front','tele','speed','switches','entities'] as const)map.dd[key]=(map.dd[key]??[]).filter(r=>r[0]%map.width<w&&Math.floor(r[0]/map.width)<h).map(r=>[Math.floor(r[0]/map.width)*w+r[0]%map.width,...r.slice(1)]);map.dd.doors=map.dd.doors.filter(r=>r[0]<w*32&&r[1]<h*32);}map.width=w;map.height=h;history=[];future=[];load();save();};
  viewport.onscroll=draw;editorResize?.disconnect();editorResize=new ResizeObserver(()=>draw());editorResize.observe(viewport);
  load();root.tabIndex=-1;root.focus({preventScroll:true});
}


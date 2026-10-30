import './release.css';
import './ability-guide';
import {listDrafts,saveDraft} from './drafts';
import {courseOverview} from './course-overview';
import {newCourseMap} from '../shared/courses';
import { validateCourseMap, COURSE_FILE_MAX_BYTES } from '../shared/courses';
import type { MapDef } from '../shared/physics';
import { mountEditor } from './editor';
import type { Course } from '../shared/courses';
import { registerCourse } from '../shared/maps';
import { mapById } from '../shared/maps';
import type { Input } from '../shared/physics';
import { validName, type ClientMsg, type GameMode, type HubState, type ServerMsg, type UserInfo } from '../shared/protocol';
import { fillAds } from './ads';
import { ClientGame } from './game';
import type { Backend, HubInfo } from './net/backend';
import { firebaseConfig } from './net/firebase-config';
import { firebaseBackend } from './net/firebase';
import { localBackend } from './net/local';
import { openFaceEditor, savedFace } from './face-editor';
import { HostHub } from './host/hub';
import { randomId } from './net/backend';

import { enterHub, type Connection } from './net/session';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...document.querySelectorAll(sel)] as T[];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids) e.append(k);
  return e;
}

const NAME_KEY = 'tsunagu.guestName';
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* 無視 */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* 無視 */ } },
};

const backend: Backend = firebaseConfig ? firebaseBackend(firebaseConfig) : localBackend();
let conn: Connection | null = null;
/** 部屋に入る前の自分（名前とゲストかどうか） */
let profile: { name: string; guest: boolean } | null = null;
let me: UserInfo | null = null;
let hub: HubState | null = null;
let game: ClientGame | null = null;
let gameMode: GameMode = 'free';
let gameId = '';
let gameStage = '';
let recentInputs: { seq: number; input: Input }[] = [];


type Screen = 'title' | 'hubs' | 'hub' | 'game' | 'editor' | 'saves';
function show(s: Screen) {
  for (const x of $$('.screen')) x.classList.add('hidden');
  const target = $(`#screen-${s}`);
  target.classList.remove('hidden');
  fillAds(target);
  clearInterval(hubListTimer);
  if (s === 'hubs') {
    refreshHubs();
    hubListTimer = window.setInterval(refreshHubs, 15_000);
  }
}
let hubListTimer = 0;

function send(msg: ClientMsg) {
  conn?.send(msg);
}

// ---------- タイトル / アカウント ----------

for (const t of $$('.tab')) {
  t.addEventListener('click', () => {
    for (const x of $$('.tab')) x.classList.toggle('active', x === t);
    for (const p of $$('.tab-pane')) p.classList.toggle('hidden', p.dataset.pane !== t.dataset.tab);
    $('#auth-error').textContent = '';
  });
}

const guestInput = $<HTMLInputElement>('#form-guest input[name=name]');
guestInput.value = store.get(NAME_KEY) ?? '';

function refreshTitle() {
  backend.account().then((a) => {
    $('#logged-in').classList.toggle('hidden', !a);
    $('#auth-forms').classList.toggle('hidden', !!a);
    if (a) $('#logged-name').textContent = a.name;
  }).catch(() => {});
}

function enterLobbyList(name: string, guest: boolean) {
  profile = { name, guest };
  for (const x of $$('.me-label')) x.textContent = `${name}${guest ? '（ゲスト）' : ''}`;
  show('hubs');
  const invite=new URL(location.href).searchParams.get('room');
  if(invite && /^[a-f0-9]{18}$/.test(invite)){history.replaceState(null,'',location.pathname);joinHub(invite,'招待された部屋');}
}

$('#form-guest').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = validName(guestInput.value);
  if (!name) { $('#auth-error').textContent = '名前は1〜16文字で入力してください'; return; }
  store.set(NAME_KEY, name);
  try { await backend.guest(); } catch { $('#auth-error').textContent = '通信に失敗しました'; return; }
  enterLobbyList(name, true);
});

async function auth(kind: 'login' | 'register', form: HTMLFormElement) {
  const fd = new FormData(form);
  const name = validName(String(fd.get('name') ?? ''));
  const password = String(fd.get('password') ?? '');
  if (!name) { $('#auth-error').textContent = '名前は1〜16文字にしてください'; return; }
  try {
    const a = kind === 'login' ? await backend.login(name, password) : await backend.register(name, password);
    form.reset();
    $('#auth-error').textContent = '';
    enterLobbyList(a.name, false);
  } catch (e) {
    $('#auth-error').textContent = (e as Error).message;
  }
}
$('#form-login').addEventListener('submit', (e) => { e.preventDefault(); auth('login', e.target as HTMLFormElement); });
$('#form-register').addEventListener('submit', (e) => { e.preventDefault(); auth('register', e.target as HTMLFormElement); });

$('#btn-play-account').addEventListener('click', async () => {
  const a = await backend.account();
  if (a) enterLobbyList(a.name, false);
  else refreshTitle();
});
$('#btn-logout').addEventListener('click', async () => {
  await backend.logout().catch(() => {});
  refreshTitle();
});
$('#btn-back-title').addEventListener('click', () => {
  leaveHub();
  profile = null;
  show('title');
  refreshTitle();
});

// ---------- 接続 ----------

let entering = false;
async function joinHub(id: string | null, name: string) {
  if (!profile || entering) return;
  entering = true;
  alertBar('部屋に入っています…');
  try {
    leaveHub();
    const c = await enterHub(backend, id, name, $('#room-visibility') ? $<HTMLSelectElement>('#room-visibility').value as 'public'|'invite' : 'public');
    conn = c;
    c.onMessage = onMessage;
    c.onClose = (reason) => {
      if (conn !== c) return;
      conn = null;
      afterLeave();
      alertBar(reason);
    };
    c.send({ t: 'hello', name: profile.name, guest: profile.guest, face:savedFace() });
  } catch (e) {
    alertBar((e as Error).message || '部屋に入れませんでした');
  } finally {
    entering = false;
  }
}

function leaveHub() {
  const c = conn;
  conn = null;
  c?.close();
  if (c) afterLeave();
}

function afterLeave() {
  me = null; hub = null;
  stopGame();
  if (profile) show('hubs');
}

function onMessage(m: ServerMsg) {
  switch (m.t) {
    case 'welcome':
      me = m.you;
      $('#chat-log').replaceChildren();
      return;
    case 'error':
      toast(m.message);
      return;
    case 'hubState':
      hub = m.hub;
      if(m.hub.members.find(p=>p.id===me?.id)?.status==='待機中'){stopGame();show('hub');}
      renderHub();
      return;
    case 'chat':
      addChat(m.from, m.text, !!m.system);
      if (m.fromId !== undefined && gameMode === 'lobby') game?.bubble(m.fromId, m.text);
      return;
    case 'control':
      if(m.gameId===gameId){recentInputs=[];game?.switchControl(m.runner,m.resetInput);hideResult();}return;
    case 'dummyState':
      if(m.gameId===gameId){dummyState=m;renderDummy();}return;
    case 'gameStart':
      startGame(m);
      return;
    case 'names':
      game?.setNames(m.names);game?.setFaces(m.faces??{});
      return;
    case 'snap':
      if (m.gameId === gameId) game?.onSnap(m);
      return;
    case 'finish':
      onFinish(m);
      return;
    case 'partyClear':
      if (m.gameId !== gameId || m.stageId !== gameStage) return;
      $('#result-title').textContent='パーティ全員ゴール！';
      $('#result-body').append(el('ul',{className:'list'},...m.results.map(r=>el('li',{},`${r.name}　${r.time.toFixed(2)} 秒`))));
      $('#result').classList.remove('hidden');
      return;
  }
}

// ---------- 部屋一覧 ----------

function refreshHubs() {
  backend.listHubs().then(renderHubList).catch(() => {});
}

function renderHubList(list: HubInfo[]) {
  const ul = $('#hub-list');
  ul.replaceChildren(...list.map((h) => {
    const btn = el('button', { textContent: h.count ? '入る' : '開く', disabled: h.count >= h.capacity });
    btn.addEventListener('click', () => joinHub(h.id, h.name));
    return el('li', {}, el('span', { className: 'grow', textContent: h.name + (h.members?.length ? ' — '+h.members.join('・') : '') }), el('span', { className: 'count', textContent: `${h.count}/${h.capacity}人` }), btn);
  }));
  if(!list.length)ul.append(el('li',{},'募集中の部屋はありません。最初の部屋を作ろう。'));
}

$('#form-create-hub').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!profile) return;
  const f = e.target as HTMLFormElement;
  const name = validName((f.elements.namedItem('name') as HTMLInputElement).value) ?? `${profile.name} の部屋`;
  joinHub(null, name);
  f.reset();
});

// ---------- 部屋の中 ----------

$('#btn-leave-hub').addEventListener('click', leaveHub);

function renderHub() {
  if (!hub) return;
  $('#hub-name').textContent = hub.name;
  $('#room-stage').textContent = 'コース：'+hub.stageName;
  $<HTMLButtonElement>('#room-start').disabled=!conn?.isHost||hub.playing||!hub.stageId;
  $<HTMLButtonElement>('#room-stop').disabled=!conn?.isHost||!hub.playing;
  $<HTMLButtonElement>('#room-resume').disabled=!hub.playing;
  $('#room-owner').textContent=conn?.isHost?'あなたがホストです。コースを選び、全員で開始できます。':'ホストがコースを選んで開始します。';
  $('#member-count').textContent = `${hub.members.length}人`;
  $('#member-list').replaceChildren(...hub.members.map((m) =>
    el('li', {}, el('span', { className: 'grow', textContent: m.name + (m.guest ? '（ゲスト）' : '') }), el('span', { className: 'count', textContent: m.status }))));
}

function addChat(from: string, text: string, system: boolean) {
  const log = $('#chat-log');
  const line = el('div', { className: system ? 'chat sys' : 'chat' });
  if (!system) line.append(el('b', { textContent: from }), ' ');
  line.append(text);
  log.append(line);
  while (log.children.length > 100) log.firstChild?.remove();
  log.scrollTop = log.scrollHeight;
}

$('#form-chat').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = (e.target as HTMLFormElement).elements.namedItem('text') as HTMLInputElement;
  if (input.value.trim()) send({ t: 'chat', text: input.value });
  input.value = '';
  input.blur();
});

// 広場では Enter でチャット入力へ、Esc で入力をやめる
window.addEventListener('keydown', (e) => {
  if ($('#screen-hub').classList.contains('hidden')) return;
  const input = $<HTMLInputElement>('#form-chat input');
  if (e.code === 'Enter' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  else if (e.code === 'Escape' && document.activeElement === input) input.blur();
});

// ---------- ゲーム ----------

let dummyState:Extract<ServerMsg,{t:'dummyState'}>|null=null;
function renderDummy(){
 const exists=dummyState?.dummyId!=null;
 $('#btn-dummy').textContent=exists?'ダミーを戻す':'ダミーを呼ぶ';
 $<HTMLButtonElement>('#btn-dummy-switch').disabled=!exists;
 $('#btn-dummy-switch').textContent=dummyState?.activeId===dummyState?.dummyId&&exists?'本体へ切替 [Tab]':'ダミーへ切替 [Tab]';
 $('#hud-dummy').textContent=exists?(dummyState!.activeId===dummyState!.dummyId?'操作中：ダミー':'操作中：本体'):'';
}
$('#btn-dummy').onclick=()=>send({t:'dummy',action:dummyState?.dummyId!=null?'remove':'add',face:savedFace(true)});
function switchDummy(){game?.flushControlInput();send({t:'dummy',action:'switch'});}
$('#btn-dummy-switch').onclick=switchDummy;
$('#btn-dummy-settings').onclick=()=>{
 const d=document.createElement('dialog');d.innerHTML='<h2>ダミー設定</h2><p>1人につき1体。Tabで操作を切り替えます。操作していない側は通常、入力を止めます。</p><label><input type="checkbox" data-copy>同時操作（操作していない側も同じ動き）</label><label><input type="checkbox" data-hammer>操作していない側が自動ハンマー</label><p>自動ハンマーは基本装備など、ハンマーが使える能力で動きます。</p><button data-face>ダミーの顔を描く</button><button data-close>閉じる</button>';document.body.append(d);
 for(const key of ['copy','hammer'] as const){const input=d.querySelector<HTMLInputElement>(`[data-${key}]`)!;input.checked=dummyState?.[key]??false;input.disabled=dummyState?.dummyId==null;input.onchange=()=>send({t:'dummy',action:'configure',[key]:input.checked});}
 d.querySelector<HTMLButtonElement>('[data-face]')!.onclick=()=>openFaceEditor(true,face=>send({t:'dummy',action:'configure',face}));
 d.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();
};

function startGame(m: Extract<ServerMsg, { t: 'gameStart' }>) {
  stopGame();
  if (m.map && m.map.id === m.stageId) registerCourse(m.map);
  gameMode = m.mode;
  gameId = m.gameId;
  gameStage = m.stageId;
  recentInputs = [];
  const lobby = m.mode === 'lobby';
  show(lobby ? 'hub' : 'game');
  const canvas = $<HTMLCanvasElement>(lobby ? '#lobby-canvas' : '#game-canvas');
  if (!lobby) {
    $('#hud-stage').textContent = (mapById(m.stageId)?.name ?? '') + (m.stageId.startsWith('dd-') ? '（移植プレリリース）' : '');
    $('#hud-mode').textContent = previewing?'エディタのテスト':'協力プレイ';
  }
  hideResult();
  $('#btn-game-lobby').textContent=previewing?'編集に戻る':'部屋へ戻る';
  $('#btn-leave-game').textContent=previewing?'編集に戻る':'部屋へ戻る';
  game = new ClientGame(canvas, m.stageId, m.youId, m.names, (i) => {
    // 取りこぼしに備えて直近3つをまとめて送る
    recentInputs.push(i);
    if (recentInputs.length > 3) recentInputs.shift();
    send({ t: 'input', gameId,controlledId:game?.youId, list: recentInputs });
  }, (t, running) => {
    if (lobby) return;
    const el = $('#hud-timer');
    el.textContent = t.toFixed(2);
    el.classList.toggle('running', running);
  }, () => send({ t: 'interact' }));
  game.setFaces(m.faces??{});dummyState=null;renderDummy();
}

function stopGame() {
  gameMenu.close();
  game?.stop();
  game = null;
  hideResult();
}

function onFinish(m: Extract<ServerMsg, { t: 'finish' }>) {
  if (!game) return;
  if (m.runnerId !== game.youId) { toast(`${m.name} さんがゴール！ ${m.time.toFixed(2)} 秒`); return; }
  const body: (Node | string)[] = [el('p', { className: 'big', textContent: `${m.time.toFixed(2)} 秒` })];
  const best=el('p',{className:'note',textContent:previewing?'テストプレイのクリアです':m.assisted?'ダミー使用の練習クリアです':profile?.guest?'ログインすると初クリア時にチェッカー名を登録できます。':'チェッカーを確認しています…'});
  body.push(best);
  if(!m.assisted&&!previewing&&!profile?.guest){
    backend.releaseCourse(gameStage,[{id:m.runnerId,name:m.name,time:m.time}]).then(checker=>{best.textContent=checker?`このコースのチェッカー：${checker}`:'クリアしました';}).catch(()=>{
      best.textContent='チェッカーを保存できませんでした。';const retry=el('button',{},'再試行');retry.onclick=()=>onFinish(m);best.append(retry);
    });
  }
  if (gameMode === 'party') body.push(el('p', { className: 'note', textContent: '仲間のゴールを待っています…' }));
  showResult('ゴール！', body);
}

function showResult(title: string, body: (Node | string)[]) {
  $('#result-title').textContent = title;
  $('#result-body').replaceChildren(...body);
  const r = $('#result');
  r.classList.remove('hidden');
  fillAds(r);
}
function hideResult() { $('#result').classList.add('hidden'); }

function restartFromStart() { game?.queueKill(); hideResult(); }
$('#btn-retry').addEventListener('click', restartFromStart);
$('#btn-respawn').addEventListener('click', restartFromStart);
$('#btn-close-result').addEventListener('click', hideResult);
$('#btn-leave-game').addEventListener('click', returnToRoom);
$('#btn-game-lobby').addEventListener('click', returnToRoom);
function returnToRoom(){if(previewing){leaveHub();previewing=false;show('editor');}else send({t:'leaveGame'});}
window.addEventListener('keydown', (e) => {
  if (!game || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  // Esc belongs to an open dialog or text field until it has been dismissed.
  if (document.querySelector('dialog[open]') || (e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')) return;
  if(e.code==='Tab'){e.preventDefault();if(dummyState?.dummyId)switchDummy();else send({t:'dummy',action:'add',face:savedFace(true)});return;}
  if(e.code==='Escape'&&gameMode!=='lobby'){e.preventDefault();openGameMenu();return;}
  if (e.code === 'KeyK') {
    e.preventDefault();
    restartFromStart();
  }
});

let toastTimer = 0;
function toast(text: string) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.add('hidden'), 3000);
  if (!game) alertBar(text);
}
function alertBar(text: string) {
  const bar = el('div', { className: 'alert', textContent: text });
  document.body.append(bar);
  setTimeout(() => bar.remove(), 3000);
}

let courses: Course[] = [];
const catalogue = document.createElement('dialog'); catalogue.className = 'course-dialog'; document.body.append(catalogue);
async function openCourses() {
  catalogue.replaceChildren(el('h2',{},'コースを選ぶ'));
  const close=el('button',{},'閉じる');close.onclick=()=>catalogue.close();catalogue.append(close);
  const note=el('p',{},conn?.isHost?'ホストが選んだコースで全員が遊びます。':'コースの選択はホストが行います。');catalogue.append(note);
  if(!catalogue.open)catalogue.showModal();
  const grid=el('div',{className:'course-grid'});catalogue.append(grid);
  const account=await backend.account();
  const add=(c:Course)=>{const map=c.map,b=el('button',{disabled:!conn?.isHost||hub?.playing},'このコースで遊ぶ');
    b.onclick=()=>{send({t:'courseJoin',map});catalogue.close();};
    const card=el('article',{className:'course-card'},courseOverview(map),el('strong',{},map.name),el('p',{},`${map.minPlayers}人〜 · 作者：${c.authorName}`),el('p',{},c.firstClear?`チェッカー：${c.firstClear.names.join('・')}`:'プレリリース · チェッカー募集中'),b);
    if(account?.uid===c.author){
      const remove=el('button',{className:'course-delete'},'投稿したコースを削除');
      remove.onclick=async()=>{
        if(!confirm(`「${map.name}」を削除しますか？公開一覧から消え、元には戻せません。端末の保存枠や保存したファイルは残ります。`))return;
        remove.disabled=true;
        try{await backend.deleteCourse(c.id);courses=courses.filter(item=>item.id!==c.id);card.remove();note.textContent='コースを削除しました。';if(!courses.length)grid.append(el('p',{},'投稿コースはありません。'));}
        catch(e){note.textContent=(e as Error).message;remove.disabled=false;}
      };card.append(remove);
    }
    grid.append(card);};
  try{courses=await backend.listCourses();for(const c of courses)add(c);if(!courses.length)grid.append(el('p',{},'プレリリースされたコースはまだありません。保存ページからコースを作って公開できます。'));}catch{note.textContent+=' 投稿コースは読み込めませんでした。';}
  const file=el('input',{type:'file',accept:'.json,application/json',disabled:!conn?.isHost||hub?.playing});
  file.onchange=async()=>{try{const f=file.files?.[0];if(!f)return;if(f.size>COURSE_FILE_MAX_BYTES)throw Error('ファイルが大きすぎます');const map=validateCourseMap(JSON.parse(await f.text()));send({t:'courseJoin',map:{...map,id:'user-'+randomId()}});catalogue.close();}catch(e){note.textContent=(e as Error).message;}};
  catalogue.append(el('p',{},'エディタで保存したコースファイルを使う（投稿不要）'),file);
}
for (const b of $$('[data-courses]')) b.onclick = openCourses;
let previewing=false;
$('#btn-face').onclick=()=>openFaceEditor();
$('#btn-dummy-face').onclick=()=>openFaceEditor(true);
$('#room-start').onclick=()=>{enterFullscreen();send({t:'roomStart',withDummy:$<HTMLInputElement>('#room-with-dummy').checked,dummyFace:savedFace(true)});};
$('#room-resume').onclick=()=>send({t:'roomResume'});
$('#room-stop').onclick=()=>send({t:'roomStop'});
$('#room-invite').onclick=async()=>{if(!conn)return;const url=new URL(location.pathname,location.origin);url.searchParams.set('room',conn.hubId);const input=$<HTMLInputElement>('#room-invite-url');input.value=url.href;input.hidden=false;try{await navigator.clipboard.writeText(url.href);toast('招待リンクをコピーしました');}catch{input.select();}};
$('#quick-join').onclick=async()=>{try{const rooms=(await backend.listHubs()).filter(r=>r.count<r.capacity).sort((a,b)=>b.count-a.count);if(rooms[0])joinHub(rooms[0].id,rooms[0].name);else toast('募集中の部屋はありません。部屋を作って仲間を待とう。');}catch{toast('部屋を読み込めませんでした');}};
async function editDraft(slot:number,map:MapDef){
  show('editor');
  const editor=mountEditor($('#screen-editor'),async map=>{const a=await backend.account();if(!a)throw Error('投稿するにはログインしてください。ファイル保存とテストはゲストでも使えます。');await backend.publishCourse(map,a.name);},map=>{
    enterFullscreen();leaveHub();previewing=true;
    const room=new HostHub('preview','コースのテスト',()=>{},true);
    const link={send:(m:ServerMsg)=>queueMicrotask(()=>onMessage(m)),close:()=>{},onMessage:(_:ClientMsg)=>{},onClose:()=>{}};
    room.connect(link,true);const timer=window.setInterval(()=>room.tick(),20);
    conn={hubId:'preview',hubName:'コースのテスト',isHost:true,send:m=>link.onMessage(m),close:()=>{clearInterval(timer);link.onClose();},onMessage:()=>{},onClose:()=>{}};
    link.onMessage({t:'hello',name:profile?.name??'テスト',guest:true,face:savedFace()});
    link.onMessage({t:'courseJoin',map:{...map,id:'user-'+randomId(),minPlayers:1}});link.onMessage({t:'roomStart'});
  },{initial:map,save:m=>saveDraft(slot,m)});
  $('#screen-editor [data-close]').onclick=async()=>{try{await editor.flush();await openSaves();}catch{toast('保存に失敗しました。ファイルに保存してください');}};
}
$('#btn-editor').onclick=openSaves;
async function openSaves(){
  show('saves');const root=$('#screen-saves');root.replaceChildren(el('h2',{},'コース保存'));
  const back=el('button',{},'← 部屋一覧へ');back.onclick=()=>show('hubs');root.append(back,el('p',{},'このブラウザに5コース保存できます。コースを選んで編集します。別の端末へ移すときはファイルに保存してください。'));
  try{const drafts=await listDrafts(),grid=el('div',{className:'course-grid'});root.append(grid);
    for(let slot=0;slot<5;slot++){const d=drafts.find(x=>x.slot===slot),b=el('button',{},d?'編集する':'新しいコースを作る');b.onclick=()=>editDraft(slot,d?.map??newCourseMap());
      const card=el('article',{className:'course-card'},el('strong',{},`${slot+1}. ${d?.map.name??'空き枠'}`));if(d)card.append(courseOverview(d.map),el('p',{},`${d.map.width} × ${d.map.height} マス`));card.append(b);grid.append(card);}
  }catch{root.append(el('p',{},'保存データを開けませんでした。ブラウザの保存設定を確認してください。'));}
}
refreshTitle();
show('title');
if (backend.local) console.info('Firebase 未設定のため、同じブラウザのタブ同士だけでつながるローカル動作です');

for(const button of $$('[data-fullscreen]'))button.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('全画面に切り替えられませんでした');}};

const gameMenu=$<HTMLDialogElement>('#game-menu');
function openGameMenu(){if(!gameMenu.open)gameMenu.showModal();}
$('#open-game-menu').onclick=openGameMenu;
$('#resume-game').onclick=()=>gameMenu.close();
for(const id of ['btn-respawn','btn-game-lobby'])$('#'+id).addEventListener('click',()=>gameMenu.close());
let wasFullscreen=false;
document.addEventListener('fullscreenchange',()=>{const active=!!document.fullscreenElement;if(wasFullscreen&&!active&&game&&gameMode!=='lobby')openGameMenu();wasFullscreen=active;});

function enterFullscreen(){if(!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});}

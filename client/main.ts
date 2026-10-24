import { mountEditor } from './editor';
import type { Course } from '../shared/courses';
import { registerCourse } from '../shared/maps';
import { MAPS, mapById } from '../shared/maps';
import type { Input } from '../shared/physics';
import { validName, type ClientMsg, type GameMode, type HubState, type ServerMsg, type UserInfo } from '../shared/protocol';
import { fillAds } from './ads';
import { ClientGame } from './game';
import type { Backend, HubInfo } from './net/backend';
import { firebaseConfig } from './net/firebase-config';
import { firebaseBackend } from './net/firebase';
import { localBackend } from './net/local';
import { mountTouchControls } from './touch';
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
/** 大部屋に入る前の自分（名前とゲストかどうか） */
let profile: { name: string; guest: boolean } | null = null;
let me: UserInfo | null = null;
let hub: HubState | null = null;
let game: ClientGame | null = null;
let gameMode: GameMode = 'free';
let gameId = '';
let gameStage = '';
let recentInputs: { seq: number; input: Input }[] = [];
let rankStage = MAPS[0].id;

type Screen = 'title' | 'hubs' | 'hub' | 'game' | 'editor';
function show(s: Screen) {
  for (const x of $$('.screen')) x.classList.add('hidden');
  const target = $(`#screen-${s}`);
  target.classList.remove('hidden');
  fillAds(target);
  clearInterval(hubListTimer);
  if (s === 'hubs') {
    loadRanking('hubs');
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
  alertBar('大部屋に入っています…');
  try {
    leaveHub();
    const c = await enterHub(backend, id, name);
    conn = c;
    c.onMessage = onMessage;
    c.onClose = (reason) => {
      if (conn !== c) return;
      conn = null;
      afterLeave();
      alertBar(reason);
    };
    c.send({ t: 'hello', name: profile.name, guest: profile.guest });
  } catch (e) {
    alertBar((e as Error).message || '大部屋に入れませんでした');
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
      renderHub();
      return;
    case 'chat':
      addChat(m.from, m.text, !!m.system);
      if (m.fromId !== undefined && gameMode === 'lobby') game?.bubble(m.fromId, m.text);
      return;
    case 'gameStart':
      startGame(m);
      return;
    case 'names':
      game?.setNames(m.names);
      return;
    case 'snap':
      if (m.gameId === gameId) game?.onSnap(m);
      return;
    case 'finish':
      onFinish(m);
      return;
    case 'partyClear':
      if (m.gameId !== gameId || m.stageId !== gameStage) return;
      if (gameStage.startsWith('user-')) promoteCourse(m);
      showResult('パーティ全員ゴール！', [
        el('ul', { className: 'list' }, ...m.results.map((r) => el('li', {}, `${r.name}　${r.time.toFixed(2)} 秒`))),
      ]);
      return;
  }
}

// ---------- 大部屋一覧 ----------

function refreshHubs() {
  backend.listHubs().then(renderHubList).catch(() => {});
}

function renderHubList(list: HubInfo[]) {
  const ul = $('#hub-list');
  ul.replaceChildren(...list.map((h) => {
    const btn = el('button', { textContent: h.count ? '入る' : '開く', disabled: h.count >= h.capacity });
    btn.addEventListener('click', () => joinHub(h.id, h.name));
    return el('li', {}, el('span', { className: 'grow', textContent: h.name }), el('span', { className: 'count', textContent: `${h.count}/${h.capacity}人` }), btn);
  }));
}

$('#form-create-hub').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!profile) return;
  const f = e.target as HTMLFormElement;
  const name = validName((f.elements.namedItem('name') as HTMLInputElement).value) ?? `${profile.name} の大部屋`;
  joinHub(null, name);
  f.reset();
});

// ---------- 大部屋の中 ----------

$('#btn-leave-hub').addEventListener('click', leaveHub);

function renderHub() {
  if (!hub) return;
  $('#hub-name').textContent = hub.name;
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
  if (gameMode !== 'lobby' || !game) return;
  const input = $<HTMLInputElement>('#form-chat input');
  if (e.code === 'Enter' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  else if (e.code === 'Escape' && document.activeElement === input) input.blur();
});

// ---------- ランキング ----------

function loadRanking(where: string) {
  const tabs = $(`[data-rank="${where}"]`);
  tabs.replaceChildren(...MAPS.map((m) => {
    const b = el('button', { className: `tab${m.id === rankStage ? ' active' : ''}`, textContent: m.name });
    b.addEventListener('click', () => { rankStage = m.id; loadRanking(where); });
    return b;
  }));
  const ol = $(`[data-rank-list="${where}"]`);
  backend.topRecords(rankStage).then((records) => {
    ol.replaceChildren(...records.map((r) =>
      el('li', {}, el('span', { className: 'grow', textContent: r.name }), el('span', { textContent: `${r.time.toFixed(2)} 秒` }))));
    if (!records.length) ol.replaceChildren(el('li', { className: 'note', textContent: 'まだ記録がありません' }));
  }).catch(() => {});
}

// ---------- ゲーム ----------

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
    $('#hud-mode').textContent = m.mode === 'party' ? 'パーティ' : 'フリー';
  }
  hideResult();
  if (m.stageId.startsWith('user-')) toast('同じ大部屋の友だちが「コース一覧」から参加すると動き出します');
  game = new ClientGame(canvas, m.stageId, m.youId, m.names, (i) => {
    // 取りこぼしに備えて直近3つをまとめて送る
    recentInputs.push(i);
    if (recentInputs.length > 3) recentInputs.shift();
    send({ t: 'input', gameId, list: recentInputs });
  }, (t, running) => {
    if (lobby) return;
    const el = $('#hud-timer');
    el.textContent = t.toFixed(2);
    el.classList.toggle('running', running);
  }, () => send({ t: 'interact' }));
}

function stopGame() {
  game?.stop();
  game = null;
  hideResult();
}

function onFinish(m: Extract<ServerMsg, { t: 'finish' }>) {
  if (!game) return;
  if (m.runnerId !== game.youId) { toast(`${m.name} さんがゴール！ ${m.time.toFixed(2)} 秒`); return; }
  const body: (Node | string)[] = [el('p', { className: 'big', textContent: `${m.time.toFixed(2)} 秒` })];
  const best = el('p', { className: 'note', textContent: profile?.guest ? 'アカウントを作ると記録がランキングに残ります。' : '記録を保存しています…' });
  body.push(best);
  if (!profile?.guest) {
    backend.saveBest(gameStage, m.time).then((b) => {
      if (b === null) return;
      best.className = '';
      best.textContent = b >= m.time ? '自己ベスト更新！' : `自己ベスト ${b.toFixed(2)} 秒`;
    }).catch(() => { best.textContent = '記録を保存できませんでした'; });
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

$('#btn-retry').addEventListener('click', () => { game?.queueKill(); hideResult(); });
$('#btn-close-result').addEventListener('click', hideResult);
$('#btn-leave-game').addEventListener('click', () => send({ t: 'leaveGame' }));
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && game && gameMode !== 'lobby') send({ t: 'leaveGame' });
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

mountTouchControls($('#screen-game'), [
  { label: '中華を吐く', cls: 'word-action accent', run: () => game?.queueSpit() },
  { label: 'やり直し', cls: '', run: () => game?.queueKill() },
  { label: '大部屋へ', cls: '', run: () => send({ t: 'leaveGame' }) },
]);
mountTouchControls($('#screen-hub'), [
  { label: '入る / 出発', cls: 'accent', run: () => send({ t: 'interact' }) },
  { label: 'チャット', cls: '', run: () => $('#screen-hub').classList.toggle('chat-open') },
]);


let courses: Course[] = [];
const catalogue = document.createElement('dialog'); catalogue.className = 'course-dialog'; document.body.append(catalogue);
async function openCourses() {
  catalogue.replaceChildren(el('h2', { textContent: 'みんなのコース' }));
  const close = el('button', { textContent: '閉じる' }); close.onclick = () => catalogue.close(); catalogue.append(close);
  if (!catalogue.open) catalogue.showModal();
  const presets=el('div',{className:'buttons'});
  catalogue.append(el('h3',{textContent:'大会コースへすぐ入る'}),el('p',{className:'note',textContent:'同じ大部屋で同じコースを選ぶと合流します。自由参加で練習もできます。'}),presets);
  for(const map of MAPS){
    const b=el('button',{textContent:map.name,disabled:!conn||gameMode!=='lobby'});
    b.onclick=()=>{send({t:'stageJoin',stageId:map.id});catalogue.close();};presets.append(b);
  }
  catalogue.append(el('h3',{textContent:'みんなが作ったコース'}));
  const note = el('p', { className: 'note', textContent: '読み込み中…' }); catalogue.append(note);
  try { courses = await backend.listCourses(); note.textContent = courses.length ? '同じ大部屋で同じコースに参加してください。2人揃うと動き出します。' : 'まだ投稿がありません。「コースをつくる」から最初のコースを投稿しよう。'; }
  catch { note.textContent = 'コースを読み込めません。通信状態または公開設定を確認してください。'; return; }
  const filters = el('div', { className: 'buttons' }), list = el('div', { className: 'cards' });
  const render = (filter: string) => {
    list.replaceChildren();
    for (const c of courses.filter(c => filter === 'all' || c.status === filter)) {
      const play = el('button', { textContent: 'このコースに参加', disabled: !conn || gameMode !== 'lobby' });
      play.onclick = () => { send({ t: 'courseJoin', map: c.map }); catalogue.close(); };
      const card = el('article', { className: 'card' },
        el('span', { className: 'course-badge', textContent: c.status === 'released' ? '正式公開' : 'プレリリース · 未クリア' }),
        el('h3', { textContent: c.map.name }), el('p', { textContent: c.map.description }),
        el('p', { className: 'note', textContent: `${c.authorName} · ${c.map.width} × ${c.map.height} · 2人〜` }), play);
      if (c.firstClear) card.append(el('p', { className: 'note', textContent: `初クリア: ${c.firstClear.names.join(' ＆ ')} · ${c.firstClear.time.toFixed(2)}秒` }));
      if (!conn) card.append(el('p', { className: 'note', textContent: '大部屋に入ると参加できます' }));
      list.append(card);
    }
    if (!list.children.length) list.append(el('p', { className: 'note', textContent: 'この分類のコースはまだありません' }));
    filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  };
  for (const [value, text] of [['all', 'すべて'], ['released', '正式公開'], ['prerelease', 'プレリリース']]) {
    const b = el('button', { textContent: text }); b.dataset.filter = value; b.onclick = () => render(value); filters.append(b);
  }
  catalogue.append(filters, list); render('all');
}
async function promoteCourse(m: Extract<ServerMsg, { t: 'partyClear' }>) {
  const line = el('p', { textContent: '初クリアを確認しています…' });
  // partyClear の結果パネルの描画後に追加する
  queueMicrotask(() => $('#result-body').append(line));
  try {
    await backend.releaseCourse(m.stageId, m.results);
    line.textContent = '協力クリア達成！このコースは正式公開になりました。';
  } catch {
    line.textContent = '正式公開の保存に失敗しました。';
    const retry = el('button', { textContent: '保存を再試行' }); retry.onclick = () => { retry.remove(); promoteCourse(m); }; line.append(retry);
  }
}
for (const b of $$('[data-courses]')) b.onclick = openCourses;
$('#btn-editor').onclick = () => {
  show('editor');
  mountEditor($('#screen-editor'), async map => {
    const a = await backend.account(); if (!a) throw new Error('投稿にはアカウントでログインしてください。下書きは残っています。');
    await backend.publishCourse(map, a.name);
  });
  $('#screen-editor [data-close]').onclick = () => show('hubs');
};
refreshTitle();
show('title');
if (backend.local) console.info('Firebase 未設定のため、同じブラウザのタブ同士だけでつながるローカル動作です');

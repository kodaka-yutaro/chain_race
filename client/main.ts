import { MAPS, mapById } from '../shared/maps';
import type { ClientMsg, GameMode, HubState, ServerMsg, UserInfo } from '../shared/protocol';
import { fillAds } from './ads';
import { ClientGame } from './game';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => [...document.querySelectorAll(sel)] as T[];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids) e.append(k);
  return e;
}

const TOKEN_KEY = 'tsunagu.token';
const NAME_KEY = 'tsunagu.guestName';
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* 無視 */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* 無視 */ } },
};

let ws: WebSocket | null = null;
let me: UserInfo | null = null;
let hub: HubState | null = null;
let game: ClientGame | null = null;
let gameMode: GameMode = 'free';
let rankStage = MAPS[0].id;

type Screen = 'title' | 'hubs' | 'hub' | 'game';
function show(s: Screen) {
  for (const x of $$('.screen')) x.classList.add('hidden');
  const target = $(`#screen-${s}`);
  target.classList.remove('hidden');
  fillAds(target);
  if (s === 'hubs') loadRanking('hubs');
}

function send(msg: ClientMsg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
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
  const token = store.get(TOKEN_KEY);
  $('#logged-in').classList.toggle('hidden', !token);
  $('#auth-forms').classList.toggle('hidden', !!token);
  if (!token) return;
  fetch('/api/me', { headers: { authorization: `Bearer ${token}` } })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => { $('#logged-name').textContent = d.account.name; })
    .catch(() => { store.del(TOKEN_KEY); refreshTitle(); });
}

$('#form-guest').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = guestInput.value.trim();
  if (!name) return;
  store.set(NAME_KEY, name);
  connect({ t: 'hello', guestName: name });
});

async function auth(kind: 'login' | 'register', form: HTMLFormElement) {
  const fd = new FormData(form);
  const r = await fetch(`/api/${kind}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: fd.get('name'), password: fd.get('password') }),
  });
  const d = await r.json().catch(() => ({ error: '通信に失敗しました' }));
  if (!r.ok) { $('#auth-error').textContent = d.error ?? 'エラーが発生しました'; return; }
  store.set(TOKEN_KEY, d.token);
  form.reset();
  connect({ t: 'hello', token: d.token });
}
$('#form-login').addEventListener('submit', (e) => { e.preventDefault(); auth('login', e.target as HTMLFormElement); });
$('#form-register').addEventListener('submit', (e) => { e.preventDefault(); auth('register', e.target as HTMLFormElement); });

$('#btn-play-account').addEventListener('click', () => {
  const token = store.get(TOKEN_KEY);
  if (token) connect({ t: 'hello', token });
});
$('#btn-logout').addEventListener('click', () => {
  const token = store.get(TOKEN_KEY);
  if (token) fetch('/api/logout', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
  store.del(TOKEN_KEY);
  refreshTitle();
});
$('#btn-back-title').addEventListener('click', () => { ws?.close(); });

// ---------- 接続 ----------

function connect(hello: ClientMsg) {
  ws?.close();
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const sock = new WebSocket(`${proto}://${location.host}/ws`);
  ws = sock;
  sock.onopen = () => sock.send(JSON.stringify(hello));
  sock.onmessage = (e) => onMessage(JSON.parse(e.data));
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null; me = null; hub = null;
    stopGame();
    show('title');
    refreshTitle();
  };
}

function onMessage(m: ServerMsg) {
  switch (m.t) {
    case 'welcome':
      me = m.you;
      for (const x of $$('.me-label')) x.textContent = `${me.name}${me.guest ? '（ゲスト）' : ''}`;
      show('hubs');
      return;
    case 'error':
      if (!me) { $('#auth-error').textContent = m.message; if (m.message.includes('ログイン')) store.del(TOKEN_KEY); refreshTitle(); }
      else toast(m.message);
      return;
    case 'hubs':
      renderHubList(m.list);
      return;
    case 'hubState':
      hub = m.hub;
      if (!hub) { show('hubs'); send({ t: 'listHubs' }); return; }
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
      game?.onSnap(m);
      return;
    case 'finish':
      onFinish(m);
      return;
    case 'partyClear':
      showResult('パーティ全員ゴール！', [
        el('ul', { className: 'list' }, ...m.results.map((r) => el('li', {}, `${r.name}　${r.time.toFixed(2)} 秒`))),
      ]);
      return;
    case 'gameEnd':
      stopGame();
      if (!hub) show('hubs');
      return;
  }
}

// ---------- 大部屋一覧 ----------

function renderHubList(list: { id: string; name: string; count: number; capacity: number }[]) {
  const ul = $('#hub-list');
  ul.replaceChildren(...list.map((h) => {
    const btn = el('button', { textContent: '入る', disabled: h.count >= h.capacity });
    btn.addEventListener('click', () => send({ t: 'joinHub', hubId: h.id }));
    return el('li', {}, el('span', { className: 'grow', textContent: h.name }), el('span', { className: 'count', textContent: `${h.count}/${h.capacity}人` }), btn);
  }));
}

$('#form-create-hub').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target as HTMLFormElement;
  const name = (f.elements.namedItem('name') as HTMLInputElement).value.trim();
  send({ t: 'createHub', name });
  f.reset();
});

// ---------- 大部屋の中 ----------

$('#btn-leave-hub').addEventListener('click', () => send({ t: 'leaveHub' }));

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
  fetch(`/api/records?stage=${rankStage}`).then((r) => r.json()).then((d) => {
    ol.replaceChildren(...(d.records as { name: string; time: number }[]).map((r) =>
      el('li', {}, el('span', { className: 'grow', textContent: r.name }), el('span', { textContent: `${r.time.toFixed(2)} 秒` }))));
    if (!d.records.length) ol.replaceChildren(el('li', { className: 'note', textContent: 'まだ記録がありません' }));
  }).catch(() => {});
}

// ---------- ゲーム ----------

function startGame(m: Extract<ServerMsg, { t: 'gameStart' }>) {
  stopGame();
  gameMode = m.mode;
  const lobby = m.mode === 'lobby';
  show(lobby ? 'hub' : 'game');
  const canvas = $<HTMLCanvasElement>(lobby ? '#lobby-canvas' : '#game-canvas');
  if (!lobby) {
    $('#hud-stage').textContent = mapById(m.stageId)?.name ?? '';
    $('#hud-mode').textContent = m.mode === 'party' ? 'パーティ' : 'フリー';
  }
  hideResult();
  game = new ClientGame(canvas, m.stageId, m.youId, m.names, (i) => send({ t: 'input', ...i }), (t, running) => {
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
  if (m.saved && m.best !== null) {
    body.push(el('p', { textContent: m.best >= m.time ? '自己ベスト更新！' : `自己ベスト ${m.best.toFixed(2)} 秒` }));
  } else {
    body.push(el('p', { className: 'note', textContent: 'アカウントを作ると記録がランキングに残ります。' }));
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

refreshTitle();
show('title');

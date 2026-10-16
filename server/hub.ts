import type { WebSocket } from 'ws';
import { LOBBY_MAP, MAPS, stageById } from '../shared/maps';
import { inZone, type Zone } from '../shared/physics';
import {
  HUB_CAPACITY, PARTY_CAPACITY, PARTY_COUNTDOWN_TICKS, type ClientMsg, type HubState, type ServerMsg, type ZoneState,
} from '../shared/protocol';
import { accountByToken, validName } from './db';
import { Game } from './game';

export interface Client {
  id: number;
  name: string;
  guest: boolean;
  accountId: number | null;
  hub: Hub | null;
  game: Game | null;
  lastChat: number;
  send(msg: ServerMsg): void;
}

interface Hub {
  id: string;
  name: string;
  permanent: boolean;
  members: Set<Client>;
  /** みんなが歩き回る広場 */
  lobby: Game;
  /** 協力の台ごとの出発までの残り tick */
  countdowns: Map<string, number>;
  free: Map<string, Game>;
}

let nextClientId = 1;
let nextHubId = 1;

const clients = new Set<Client>();
const hubs = new Map<string, Hub>();
export const games = new Set<Game>();
const ZONES: Zone[] = LOBBY_MAP.zones ?? [];

function makeHub(name: string, permanent: boolean): Hub {
  const h = { id: `h${nextHubId++}`, name, permanent, members: new Set(), countdowns: new Map(), free: new Map() } as unknown as Hub;
  h.lobby = new Game(LOBBY_MAP.id, 'lobby', () => {}, { afterTick: () => lobbyTick(h), zones: () => zoneStates(h) });
  games.add(h.lobby);
  hubs.set(h.id, h);
  return h;
}
makeHub('大部屋 1', true);
makeHub('大部屋 2', true);

function hubList() {
  return [...hubs.values()].map((h) => ({ id: h.id, name: h.name, count: h.members.size, capacity: HUB_CAPACITY }));
}

function pushHubList() {
  const msg: ServerMsg = { t: 'hubs', list: hubList() };
  for (const c of clients) if (!c.hub && c.name) c.send(msg);
}

function statusOf(c: Client): string {
  if (c.game && c.game.mode !== 'lobby') return `プレイ中: ${stageById(c.game.stageId)?.name ?? ''}`;
  return '大部屋';
}

function hubState(h: Hub): HubState {
  return {
    id: h.id,
    name: h.name,
    members: [...h.members].map((c) => ({ id: c.id, name: c.name, guest: c.guest, status: statusOf(c) })),
    free: MAPS.map((m) => ({ stageId: m.id, count: h.free.get(m.id)?.size ?? 0 })),
  };
}

function pushHubState(h: Hub) {
  const st = hubState(h);
  for (const c of h.members) c.send({ t: 'hubState', hub: st });
}

function systemChat(h: Hub, text: string) {
  for (const c of h.members) c.send({ t: 'chat', from: '', text, system: true });
}

function runnersIn(h: Hub, z: Zone): Client[] {
  const out: Client[] = [];
  for (const r of h.lobby.world.runners) {
    if (!inZone(z, r.x, r.y)) continue;
    const s = h.lobby.slots.get(r.id);
    if (s) out.push(s.client);
  }
  return out;
}

function zoneStates(h: Hub): ZoneState[] {
  return ZONES.map((z) => ({
    id: z.id,
    count: z.kind === 'party' ? runnersIn(h, z).length : h.free.get(z.stageId)?.size ?? 0,
    countdown: h.countdowns.get(z.id) ?? 0,
  }));
}

function lobbyTick(h: Hub) {
  for (const [id, left] of h.countdowns) {
    const z = ZONES.find((x) => x.id === id)!;
    const here = runnersIn(h, z);
    if (here.length === 0) { h.countdowns.delete(id); continue; }
    if (left > 1) { h.countdowns.set(id, left - 1); continue; }
    h.countdowns.delete(id);
    const map = stageById(z.stageId)!;
    const team = here.slice(0, PARTY_CAPACITY);
    if (team.length < map.minPlayers) {
      for (const c of here) c.send({ t: 'error', message: `「${map.name}」は${map.minPlayers}人以上で台に乗って出発します` });
      continue;
    }
    const g = new Game(z.stageId, 'party', (gg) => { games.delete(gg); pushHubState(h); });
    games.add(g);
    for (const c of team) moveTo(c, g);
    systemChat(h, `${team.map((c) => c.name).join('、')} が「${map.name}」に出発しました`);
    pushHubState(h);
  }
}

/** 広場から（または別のゲームから）ゲームへ移す */
function moveTo(c: Client, g: Game) {
  c.game?.remove(c, false);
  g.add(c);
}

function backToLobby(c: Client) {
  const g = c.game;
  if (!g || g.mode === 'lobby') return;
  g.remove(c, false);
  if (c.hub) {
    c.hub.lobby.add(c);
    pushHubState(c.hub);
  } else {
    c.send({ t: 'gameEnd' });
  }
}

function leaveHub(c: Client) {
  const h = c.hub;
  if (!h) return;
  c.hub = null;
  c.game?.remove(c, false);
  h.members.delete(c);
  if (h.members.size === 0 && !h.permanent) {
    games.delete(h.lobby);
    hubs.delete(h.id);
  } else {
    systemChat(h, `${c.name} さんが退出しました`);
    pushHubState(h);
  }
  pushHubList();
}

function joinHub(c: Client, h: Hub) {
  if (c.hub === h) return;
  if (h.members.size >= HUB_CAPACITY) return c.send({ t: 'error', message: 'この大部屋は満員です' });
  leaveHub(c);
  h.members.add(c);
  c.hub = h;
  h.lobby.add(c);
  systemChat(h, `${c.name} さんが入室しました`);
  pushHubState(h);
  pushHubList();
}

function interact(c: Client) {
  const h = c.hub;
  if (!h || c.game !== h.lobby) return;
  const r = h.lobby.world.runners.find((x) => x.id === c.id);
  if (!r) return;
  const z = ZONES.find((x) => inZone(x, r.x, r.y));
  if (!z) return;
  if (z.kind === 'free') {
    let g = h.free.get(z.stageId);
    if (!g) {
      g = new Game(z.stageId, 'free', (gg) => {
        games.delete(gg);
        if (h.free.get(gg.stageId) === gg) h.free.delete(gg.stageId);
        pushHubState(h);
      });
      games.add(g);
      h.free.set(z.stageId, g);
    }
    moveTo(c, g);
    pushHubState(h);
  } else if (!h.countdowns.has(z.id)) {
    h.countdowns.set(z.id, PARTY_COUNTDOWN_TICKS);
  }
}

export function handleConnection(ws: WebSocket) {
  const c: Client = {
    id: nextClientId++, name: '', guest: true, accountId: null, hub: null, game: null, lastChat: 0,
    send(msg) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); },
  };
  clients.add(c);

  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    try { handle(c, msg); } catch (e) { console.error(e); }
  });
  ws.on('close', () => {
    leaveHub(c);
    clients.delete(c);
  });
}

function handle(c: Client, msg: ClientMsg) {
  if (msg.t === 'hello') {
    if (msg.token) {
      const a = accountByToken(String(msg.token));
      if (!a) return c.send({ t: 'error', message: 'ログインの有効期限が切れました。もう一度ログインしてください' });
      c.name = a.name; c.guest = false; c.accountId = a.id;
    } else {
      const n = validName(String(msg.guestName ?? ''));
      if (!n) return c.send({ t: 'error', message: '名前は1〜16文字で入力してください' });
      c.name = n; c.guest = true; c.accountId = null;
    }
    c.send({ t: 'welcome', you: { id: c.id, name: c.name, guest: c.guest } });
    c.send({ t: 'hubs', list: hubList() });
    return;
  }
  if (!c.name) return;

  switch (msg.t) {
    case 'listHubs':
      return c.send({ t: 'hubs', list: hubList() });
    case 'createHub': {
      const n = validName(String(msg.name ?? '')) ?? `${c.name} の大部屋`;
      if (hubs.size >= 200) return c.send({ t: 'error', message: '大部屋が多すぎます。既存の大部屋に入ってください' });
      return joinHub(c, makeHub(n, false));
    }
    case 'joinHub': {
      const h = hubs.get(String(msg.hubId));
      if (!h) return c.send({ t: 'error', message: 'その大部屋は見つかりません' });
      return joinHub(c, h);
    }
    case 'leaveHub':
      leaveHub(c);
      c.send({ t: 'gameEnd' });
      c.send({ t: 'hubState', hub: null });
      return;
    case 'chat': {
      const h = c.hub;
      const text = String(msg.text ?? '').trim().slice(0, 200);
      if (!h || !text) return;
      const now = Date.now();
      if (now - c.lastChat < 500) return;
      c.lastChat = now;
      for (const m of h.members) m.send({ t: 'chat', from: c.name, fromId: c.id, text });
      return;
    }
    case 'interact':
      return interact(c);
    case 'leaveGame':
      return backToLobby(c);
    case 'input': {
      if (!c.game || typeof msg.seq !== 'number' || !msg.input) return;
      const i = msg.input;
      c.game.pushInput(c, msg.seq, {
        left: !!i.left, right: !!i.right, up: !!i.up, down: !!i.down, jump: !!i.jump, wire: !!i.wire,
        fire: !!i.fire, kill: !!i.kill, aimX: Number(i.aimX) || 0, aimY: Number(i.aimY) || 0,
      });
      return;
    }
  }
}

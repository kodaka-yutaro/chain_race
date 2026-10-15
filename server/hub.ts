import type { WebSocket } from 'ws';
import { MAPS, mapById } from '../shared/maps';
import { HUB_CAPACITY, PARTY_CAPACITY, type ClientMsg, type HubState, type ServerMsg } from '../shared/protocol';
import { accountByToken, validName } from './db';
import { Game } from './game';

export interface Client {
  id: number;
  name: string;
  guest: boolean;
  accountId: number | null;
  hub: Hub | null;
  party: Party | null;
  game: Game | null;
  lastChat: number;
  send(msg: ServerMsg): void;
}

interface Party {
  id: string;
  hub: Hub;
  leader: Client;
  members: Set<Client>;
  stageId: string;
  game: Game | null;
}

interface Hub {
  id: string;
  name: string;
  permanent: boolean;
  members: Set<Client>;
  parties: Map<string, Party>;
  free: Map<string, Game>;
}

let nextClientId = 1;
let nextHubId = 1;
let nextPartyId = 1;

const clients = new Set<Client>();
const hubs = new Map<string, Hub>();
export const games = new Set<Game>();

function makeHub(name: string, permanent: boolean): Hub {
  const h: Hub = { id: `h${nextHubId++}`, name, permanent, members: new Set(), parties: new Map(), free: new Map() };
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
  if (c.game) return `プレイ中: ${mapById(c.game.stageId)?.name ?? ''}`;
  if (c.party) return 'パーティ';
  return 'ロビー';
}

function hubState(h: Hub): HubState {
  return {
    id: h.id,
    name: h.name,
    members: [...h.members].map((c) => ({ id: c.id, name: c.name, guest: c.guest, status: statusOf(c) })),
    parties: [...h.parties.values()].map((p) => ({
      id: p.id, leaderId: p.leader.id, stageId: p.stageId, members: [...p.members].map((m) => m.id), playing: !!p.game,
    })),
    free: MAPS.map((m) => ({ stageId: m.id, count: h.free.get(m.id)?.size ?? 0 })),
  };
}

function pushHubState(h: Hub) {
  const st = hubState(h);
  for (const c of h.members) c.send({ t: 'hubState', hub: st, you: { partyId: c.party?.id ?? null } });
}

function systemChat(h: Hub, text: string) {
  for (const c of h.members) c.send({ t: 'chat', from: '', text, system: true });
}

function leaveGame(c: Client) {
  const g = c.game;
  if (!g) return;
  g.remove(c);
}

function leaveParty(c: Client) {
  const p = c.party;
  if (!p) return;
  if (p.game && c.game === p.game) leaveGame(c);
  p.members.delete(c);
  c.party = null;
  if (p.members.size === 0) {
    p.hub.parties.delete(p.id);
  } else if (p.leader === c) {
    p.leader = p.members.values().next().value!;
  }
}

function leaveHub(c: Client) {
  const h = c.hub;
  if (!h) return;
  leaveGame(c);
  leaveParty(c);
  h.members.delete(c);
  c.hub = null;
  if (h.members.size === 0 && !h.permanent) hubs.delete(h.id);
  else { systemChat(h, `${c.name} さんが退出しました`); pushHubState(h); }
  pushHubList();
}

function joinHub(c: Client, h: Hub) {
  if (c.hub === h) return;
  if (h.members.size >= HUB_CAPACITY) return c.send({ t: 'error', message: 'この大部屋は満員です' });
  leaveHub(c);
  h.members.add(c);
  c.hub = h;
  systemChat(h, `${c.name} さんが入室しました`);
  pushHubState(h);
  pushHubList();
}

function partyGameEnded(p: Party, g: Game) {
  games.delete(g);
  if (p.game === g) p.game = null;
  pushHubState(p.hub);
}

function freeGameEnded(h: Hub, g: Game) {
  games.delete(g);
  if (h.free.get(g.stageId) === g) h.free.delete(g.stageId);
  pushHubState(h);
}

export function handleConnection(ws: WebSocket) {
  const c: Client = {
    id: nextClientId++, name: '', guest: true, accountId: null, hub: null, party: null, game: null, lastChat: 0,
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
      return c.send({ t: 'hubState', hub: null, you: { partyId: null } });
    case 'chat': {
      const h = c.hub;
      const text = String(msg.text ?? '').trim().slice(0, 200);
      if (!h || !text) return;
      const now = Date.now();
      if (now - c.lastChat < 500) return;
      c.lastChat = now;
      for (const m of h.members) m.send({ t: 'chat', from: c.name, text });
      return;
    }
    case 'createParty': {
      const h = c.hub;
      if (!h) return;
      if (!mapById(String(msg.stageId))) return;
      leaveGame(c);
      leaveParty(c);
      const p: Party = { id: `p${nextPartyId++}`, hub: h, leader: c, members: new Set([c]), stageId: String(msg.stageId), game: null };
      h.parties.set(p.id, p);
      c.party = p;
      return pushHubState(h);
    }
    case 'joinParty': {
      const h = c.hub;
      const p = h?.parties.get(String(msg.partyId));
      if (!h || !p) return c.send({ t: 'error', message: 'そのパーティは見つかりません' });
      if (p.members.size >= PARTY_CAPACITY) return c.send({ t: 'error', message: 'パーティが満員です' });
      if (p.game) return c.send({ t: 'error', message: 'そのパーティはプレイ中です' });
      leaveGame(c);
      leaveParty(c);
      p.members.add(c);
      c.party = p;
      return pushHubState(h);
    }
    case 'leaveParty': {
      const h = c.hub;
      leaveParty(c);
      if (h) pushHubState(h);
      return;
    }
    case 'setPartyStage': {
      const p = c.party;
      if (!p || p.leader !== c || p.game || !mapById(String(msg.stageId))) return;
      p.stageId = String(msg.stageId);
      return pushHubState(p.hub);
    }
    case 'startParty': {
      const p = c.party;
      if (!p || p.leader !== c || p.game) return;
      const map = mapById(p.stageId)!;
      if (p.members.size < map.minPlayers) {
        return c.send({ t: 'error', message: `「${map.name}」は${map.minPlayers}人以上で遊ぶステージです` });
      }
      const g = new Game(p.stageId, 'party', (gg) => partyGameEnded(p, gg));
      games.add(g);
      p.game = g;
      for (const m of p.members) { leaveGame(m); g.add(m); }
      return pushHubState(p.hub);
    }
    case 'joinFree': {
      const h = c.hub;
      const stageId = String(msg.stageId);
      if (!h || !mapById(stageId)) return;
      leaveGame(c);
      leaveParty(c);
      let g = h.free.get(stageId);
      if (!g) {
        g = new Game(stageId, 'free', (gg) => freeGameEnded(h, gg));
        games.add(g);
        h.free.set(stageId, g);
      }
      g.add(c);
      return pushHubState(h);
    }
    case 'leaveGame': {
      leaveGame(c);
      if (c.hub) pushHubState(c.hub);
      return;
    }
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

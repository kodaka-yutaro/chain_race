import { validateCourseMap } from '../../shared/courses';
import { LOBBY_MAP, MAPS, registerCourse, stageById } from '../../shared/maps';
import { inZone, type Zone } from '../../shared/physics';
import {
  HUB_CAPACITY, PARTY_CAPACITY, PARTY_COUNTDOWN_TICKS, validName,
  type ClientMsg, type HubState, type ServerMsg, type ZoneState,
} from '../../shared/protocol';
import { Game } from './game';

/** 大部屋の主のブラウザから見た、つながっている1人 */
export interface Client {
  id: number;
  name: string;
  guest: boolean;
  game: Game | null;
  lastChat: number;
  send(msg: ServerMsg): void;
  /** 接続を切る（満員のときなど） */
  close(): void;
}

/** 通信路。WebRTC でも、主自身のための折り返しでもよい */
export interface Link {
  send(msg: ServerMsg): void;
  close(): void;
  onMessage: (msg: ClientMsg) => void;
  onClose: () => void;
}

const ZONES: Zone[] = LOBBY_MAP.zones ?? [];

/**
 * 大部屋1つぶんのゲーム進行。作った人のブラウザで動き、全員の物理を計算して配る。
 */
export class HostHub {
  readonly members = new Set<Client>();
  readonly lobby: Game;
  readonly games = new Set<Game>();
  /** 協力の台ごとの出発までの残り tick */
  private countdowns = new Map<string, number>();
  private free = new Map<string, Game>();
  private nextClientId = 1;
  private tickCount = 0;

  constructor(readonly id: string, readonly name: string, private onCount: (n: number) => void = () => {}) {
    this.lobby = new Game(LOBBY_MAP.id, 'lobby', () => {}, { afterTick: () => this.lobbyTick(), zones: () => this.zoneStates() });
    this.games.add(this.lobby);
  }

  /** 新しくつながった人。最初のメッセージ（hello）で名前が分かってから大部屋に入れる */
  connect(link: Link) {
    const c: Client = {
      id: this.nextClientId++, name: '', guest: true, game: null, lastChat: 0,
      send: (m) => link.send(m),
      close: () => link.close(),
    };
    link.onMessage = (msg) => {
      if (!msg || typeof msg !== 'object') return;
      try { this.handle(c, msg); } catch (e) { console.error(e); }
    };
    link.onClose = () => this.leave(c);
  }

  /** 50 tick/秒で呼ぶ */
  tick() {
    this.tickCount++;
    // 広場は人数が多いので送る回数を減らす
    for (const g of this.games) g.tick(g.mode === 'lobby' ? this.tickCount % 3 === 0 : this.tickCount % 2 === 0);
  }

  private handle(c: Client, msg: ClientMsg) {
    if (msg.t === 'hello') {
      if (c.name) return;
      const n = validName(msg.name);
      if (!n) { c.send({ t: 'error', message: '名前は1〜16文字で入力してください' }); c.close(); return; }
      if (this.members.size >= HUB_CAPACITY) { c.send({ t: 'error', message: 'この大部屋は満員です' }); c.close(); return; }
      c.name = n; c.guest = !!msg.guest;
      c.send({ t: 'welcome', you: { id: c.id, name: c.name, guest: c.guest } });
      this.members.add(c);
      this.lobby.add(c);
      this.systemChat(`${c.name} さんが入室しました`);
      this.pushState();
      this.onCount(this.members.size);
      return;
    }
    if (!c.name) return;

    switch (msg.t) {
      case 'chat': {
        const text = String(msg.text ?? '').trim().slice(0, 200);
        if (!text) return;
        const now = Date.now();
        if (now - c.lastChat < 500) return;
        c.lastChat = now;
        for (const m of this.members) m.send({ t: 'chat', from: c.name, fromId: c.id, text });
        return;
      }
      case 'courseJoin': {
        if (c.game !== this.lobby || !msg.map || !/^user-[a-f0-9]{18}$/.test(msg.map.id)) return;
        const map = { ...validateCourseMap(msg.map), id: msg.map.id };
        let g = [...this.games].find(g => g.stageId === map.id && g.mode === 'party');
        if (g && JSON.stringify(g.world.map) !== JSON.stringify(map)) { c.send({ t: 'error', message: 'コースの版が違います。一覧を更新してください' }); return; }
        if (g && (g.size >= PARTY_CAPACITY || g.world.runners.some(r => r.raceStart >= 0))) { c.send({ t: 'error', message: 'このコースは出発済みです。全員が大部屋に戻ってから参加してください' }); return; }
        if (!g) { registerCourse(map); g = new Game(map.id, 'party', gg => { this.games.delete(gg); this.pushState(); }); this.games.add(g); }
        this.moveTo(c, g); this.pushState(); return;
      }
      case 'interact':
        return this.interact(c);
      case 'leaveGame':
        return this.backToLobby(c);
      case 'input': {
        const g = c.game;
        if (!g || msg.gameId !== g.id || !Array.isArray(msg.list)) return;
        for (const e of msg.list.slice(-4)) {
          const i = e?.input;
          if (typeof e?.seq !== 'number' || !i) continue;
          g.pushInput(c, e.seq, {
            left: !!i.left, right: !!i.right, up: !!i.up, down: !!i.down, jump: !!i.jump, wire: !!i.wire,
            fire: !!i.fire, kill: !!i.kill, aimX: Number(i.aimX) || 0, aimY: Number(i.aimY) || 0,
          });
        }
        return;
      }
    }
  }

  private leave(c: Client) {
    c.game?.remove(c);
    if (!this.members.delete(c)) return;
    this.systemChat(`${c.name} さんが退出しました`);
    this.pushState();
    this.onCount(this.members.size);
  }

  private statusOf(c: Client): string {
    if (c.game && c.game.mode !== 'lobby') return `プレイ中: ${stageById(c.game.stageId)?.name ?? ''}`;
    return '大部屋';
  }

  private state(): HubState {
    return {
      id: this.id,
      name: this.name,
      members: [...this.members].map((c) => ({ id: c.id, name: c.name, guest: c.guest, status: this.statusOf(c) })),
      free: MAPS.map((m) => ({ stageId: m.id, count: this.free.get(m.id)?.size ?? 0 })),
    };
  }

  private pushState() {
    const st = this.state();
    for (const c of this.members) c.send({ t: 'hubState', hub: st });
  }

  private systemChat(text: string) {
    for (const c of this.members) c.send({ t: 'chat', from: '', text, system: true });
  }

  private runnersIn(z: Zone): Client[] {
    const out: Client[] = [];
    for (const r of this.lobby.world.runners) {
      if (!inZone(z, r.x, r.y)) continue;
      const s = this.lobby.slots.get(r.id);
      if (s) out.push(s.client);
    }
    return out;
  }

  private zoneStates(): ZoneState[] {
    return ZONES.map((z) => ({
      id: z.id,
      count: z.kind === 'party' ? this.runnersIn(z).length : this.free.get(z.stageId)?.size ?? 0,
      countdown: this.countdowns.get(z.id) ?? 0,
    }));
  }

  private lobbyTick() {
    for (const [id, left] of this.countdowns) {
      const z = ZONES.find((x) => x.id === id)!;
      const here = this.runnersIn(z);
      if (here.length === 0) { this.countdowns.delete(id); continue; }
      if (left > 1) { this.countdowns.set(id, left - 1); continue; }
      this.countdowns.delete(id);
      const map = stageById(z.stageId)!;
      const team = here.slice(0, PARTY_CAPACITY);
      if (team.length < map.minPlayers) {
        for (const c of here) c.send({ t: 'error', message: `「${map.name}」は${map.minPlayers}人以上で台に乗って出発します` });
        continue;
      }
      const g = new Game(z.stageId, 'party', (gg) => { this.games.delete(gg); this.pushState(); });
      this.games.add(g);
      for (const c of team) this.moveTo(c, g);
      this.systemChat(`${team.map((c) => c.name).join('、')} が「${map.name}」に出発しました`);
      this.pushState();
    }
  }

  /** 広場から（または別のゲームから）ゲームへ移す */
  private moveTo(c: Client, g: Game) {
    c.game?.remove(c);
    g.add(c);
  }

  private backToLobby(c: Client) {
    const g = c.game;
    if (!g || g.mode === 'lobby') return;
    g.remove(c);
    this.lobby.add(c);
    this.pushState();
  }

  private interact(c: Client) {
    if (c.game !== this.lobby) return;
    const r = this.lobby.world.runners.find((x) => x.id === c.id);
    if (!r) return;
    const z = ZONES.find((x) => inZone(x, r.x, r.y));
    if (!z) return;
    if (z.kind === 'free') {
      let g = this.free.get(z.stageId);
      if (!g) {
        g = new Game(z.stageId, 'free', (gg) => {
          this.games.delete(gg);
          if (this.free.get(gg.stageId) === gg) this.free.delete(gg.stageId);
          this.pushState();
        });
        this.games.add(g);
        this.free.set(z.stageId, g);
      }
      this.moveTo(c, g);
      this.pushState();
    } else if (!this.countdowns.has(z.id)) {
      this.countdowns.set(z.id, PARTY_COUNTDOWN_TICKS);
    }
  }
}

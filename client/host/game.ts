import { mapById } from '../../shared/maps';
import { createWorld, emptyInput, newRunner, stepWorld, TILE, type Input, type World } from '../../shared/physics';
import { toView, type GameMode, type ServerMsg, type ZoneState } from '../../shared/protocol';
import type { Client } from './hub';

const MAX_QUEUE = 6;

interface Slot {
  client: Client;
  queue: { seq: number; input: Input }[];
  last: Input;
  lastSeq: number;
  /** キューに入れた最大の seq（同じ入力が何度か届くので重複をはじく） */
  queuedSeq: number;
}

// ホストが替わっても前のゲームの id と重ならないようにする
const idPrefix = Date.now().toString(36);
let nextGameId = 1;

export class Game {
  readonly id = `g${idPrefix}${nextGameId++}`;
  readonly world: World;
  readonly slots = new Map<number, Slot>();
  private cleared = false;
  private starters = new Set<number>();
  private teamBroken = false;

  constructor(
    readonly stageId: string,
    readonly mode: GameMode,
    private onEmpty: (g: Game) => void,
    private hooks: { afterTick?: () => void; zones?: () => ZoneState[] } = {},
  ) {
    const map = mapById(stageId);
    if (!map) throw new Error(`unknown stage ${stageId}`);
    this.world = createWorld(map);
  }

  get size() { return this.slots.size; }

  names(): Record<number, string> {
    const out: Record<number, string> = {};
    for (const [id, s] of this.slots) out[id] = s.client.name;
    return out;
  }

  broadcast(msg: ServerMsg) {
    for (const s of this.slots.values()) s.client.send(msg);
  }

  add(c: Client) {
    const r = newRunner(c.id, this.world.map);
    // 同じ場所に重ならないよう、出現位置を少しずらす（ステージではスタート線より手前に収める）
    if (this.mode === 'lobby') r.x += Math.round((Math.random() * 8 - 4) * TILE);
    else r.x += (this.slots.size % 3) * TILE;
    this.world.runners.push(r);
    this.starters.add(c.id);
    this.slots.set(c.id, { client: c, queue: [], last: emptyInput(), lastSeq: 0, queuedSeq: 0 });
    c.game = this;
    c.send({ t: 'gameStart', gameId: this.id, stageId: this.stageId, mode: this.mode, youId: c.id, names: this.names(), map: this.stageId.startsWith('user-') ? this.world.map : undefined });
    this.broadcast({ t: 'names', names: this.names() });
  }

  remove(c: Client) {
    if (!this.slots.delete(c.id)) return;
    this.teamBroken = true;
    this.world.runners = this.world.runners.filter((r) => r.id !== c.id);
    for (const r of this.world.runners) if (r.wireRunner === c.id) { r.wireState = 0; r.wireRunner = -1; }
    c.game = null;
    if (this.slots.size === 0) this.onEmpty(this);
    else this.broadcast({ t: 'names', names: this.names() });
  }

  pushInput(c: Client, seq: number, input: Input) {
    const s = this.slots.get(c.id);
    if (!s || seq <= s.queuedSeq) return;
    s.queuedSeq = seq;
    s.queue.push({ seq, input });
    while (s.queue.length > MAX_QUEUE) s.queue.shift();
  }

  tick(sendSnapshot: boolean) {
    const inputs = new Map<number, Input>();
    for (const [id, s] of this.slots) {
      const next = s.queue.shift();
      if (next) { s.last = next.input; s.lastSeq = next.seq; }
      inputs.set(id, s.last);
      // kill は1回だけ効かせる
      if (s.last.kill) s.last = { ...s.last, kill: false };
    }
    if (this.stageId.startsWith('user-') && this.size < 2) inputs.forEach((_, id) => inputs.set(id, emptyInput()));
    const ev = this.stageId.startsWith('user-') && this.size < 2 ? { finished: [], killed: [] } : stepWorld(this.world, inputs);

    for (const f of ev.finished) {
      const s = this.slots.get(f.runnerId);
      if (!s) continue;
      // 記録の保存は各プレイヤーが自分のブラウザから行う
      this.broadcast({ t: 'finish', runnerId: f.runnerId, name: s.client.name, time: f.time });
    }
    if (this.mode === 'party' && !this.cleared && this.world.runners.length >= this.world.map.minPlayers && !this.teamBroken && this.starters.size === this.world.runners.length
      && this.world.runners.every((r) => r.finishedTime >= 0)) {
      this.cleared = true;
      this.broadcast({
        t: 'partyClear', stageId: this.stageId, gameId: this.id,
        results: this.world.runners.map((r) => ({ id: r.id, name: this.slots.get(r.id)!.client.name, time: r.finishedTime })),
      });
    }
    if (this.cleared && this.world.runners.some((r) => r.finishedTime < 0)) this.cleared = false;

    this.hooks.afterTick?.();

    if (!sendSnapshot) return;
    const zones = this.hooks.zones?.();
    const views = this.world.runners.map(toView);
    for (const [id, s] of this.slots) {
      const me = this.world.runners.find((r) => r.id === id) ?? null;
      s.client.send({
        t: 'snap', gameId: this.id, tick: this.world.tick, me, lastSeq: s.lastSeq,
        others: views.filter((v) => v.id !== id), doors: this.world.doorsOpen,
        timers: this.world.timers, lifts: this.world.lifts, saws: this.world.saws, zones,
        waiting: this.stageId.startsWith('user-') && this.size < this.world.map.minPlayers,
        dd: this.world.dd,
      });
    }
  }
}

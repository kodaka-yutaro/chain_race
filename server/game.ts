import { mapById } from '../shared/maps';
import { createWorld, emptyInput, newRunner, stepWorld, type Input, type World } from '../shared/physics';
import { toView, type ServerMsg } from '../shared/protocol';
import { saveRecord } from './db';
import type { Client } from './hub';

const MAX_QUEUE = 6;

interface Slot {
  client: Client;
  queue: { seq: number; input: Input }[];
  last: Input;
  lastSeq: number;
}

let nextGameId = 1;

export class Game {
  readonly id = `g${nextGameId++}`;
  readonly world: World;
  readonly slots = new Map<number, Slot>();
  private cleared = false;

  constructor(
    readonly stageId: string,
    readonly mode: 'party' | 'free',
    private onEmpty: (g: Game) => void,
  ) {
    const map = mapById(stageId);
    if (!map) throw new Error(`unknown stage ${stageId}`);
    this.world = createWorld(map);
  }

  get size() { return this.slots.size; }

  names(): Record<number, string> {
    const out: Record<number, string> = {};
    for (const [id, s] of this.slots) out[id] = s.client.guest ? `${s.client.name}` : s.client.name;
    return out;
  }

  broadcast(msg: ServerMsg) {
    for (const s of this.slots.values()) s.client.send(msg);
  }

  add(c: Client) {
    const r = newRunner(c.id, this.world.map);
    this.world.runners.push(r);
    this.slots.set(c.id, { client: c, queue: [], last: emptyInput(), lastSeq: 0 });
    c.game = this;
    c.send({ t: 'gameStart', gameId: this.id, stageId: this.stageId, mode: this.mode, youId: c.id, names: this.names() });
    this.broadcast({ t: 'names', names: this.names() });
  }

  remove(c: Client) {
    if (!this.slots.delete(c.id)) return;
    this.world.runners = this.world.runners.filter((r) => r.id !== c.id);
    for (const r of this.world.runners) if (r.wireRunner === c.id) { r.wireState = 0; r.wireRunner = -1; }
    c.game = null;
    c.send({ t: 'gameEnd' });
    if (this.slots.size === 0) this.onEmpty(this);
    else this.broadcast({ t: 'names', names: this.names() });
  }

  pushInput(c: Client, seq: number, input: Input) {
    const s = this.slots.get(c.id);
    if (!s || seq <= s.lastSeq) return;
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
    const ev = stepWorld(this.world, inputs);

    for (const f of ev.finished) {
      const s = this.slots.get(f.runnerId);
      if (!s) continue;
      let best: number | null = null;
      if (s.client.accountId !== null) best = saveRecord(s.client.accountId, this.stageId, this.mode, f.time);
      this.broadcast({ t: 'finish', runnerId: f.runnerId, name: s.client.name, time: f.time, best, saved: best !== null });
    }
    if (this.mode === 'party' && !this.cleared && this.world.runners.length > 0
      && this.world.runners.every((r) => r.finishedTime >= 0)) {
      this.cleared = true;
      this.broadcast({
        t: 'partyClear',
        results: this.world.runners.map((r) => ({ name: this.slots.get(r.id)!.client.name, time: r.finishedTime })),
      });
    }
    if (this.cleared && this.world.runners.some((r) => r.finishedTime < 0)) this.cleared = false;

    if (!sendSnapshot) return;
    const views = this.world.runners.map(toView);
    for (const [id, s] of this.slots) {
      const me = this.world.runners.find((r) => r.id === id) ?? null;
      s.client.send({
        t: 'snap', tick: this.world.tick, me, lastSeq: s.lastSeq,
        others: views.filter((v) => v.id !== id), doors: this.world.doorsOpen,
      });
    }
  }
}

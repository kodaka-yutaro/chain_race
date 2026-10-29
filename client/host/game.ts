import {validFace} from '../../shared/face';
import { mapById } from '../../shared/maps';
import { createWorld, emptyInput, newRunner, stepWorld, TILE, type Input, type World, type MapDef } from '../../shared/physics';
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
  private dummyUsed=false;
  private dummies=new Map<number,{id:number;face:string;active:boolean;copy:boolean;hammer:boolean}>();
  controlledId(c:Client){const d=this.dummies.get(c.id);return d?.active?d.id:c.id;}
  dummyState(c:Client){const d=this.dummies.get(c.id);c.send({t:'dummyState',gameId:this.id,dummyId:d?.id??null,activeId:this.controlledId(c),copy:d?.copy??false,hammer:d?.hammer??false});}
  dummy(c:Client,action:'add'|'remove'|'switch'|'configure',face?:string,copy?:boolean,hammer?:boolean){
    const slot=this.slots.get(c.id);if(!slot)return;
    let d=this.dummies.get(c.id);
    if(action==='add'&&!d){
      d={id:1000000+c.id,face:validFace(face)?face!:'',active:false,copy:false,hammer:false};this.dummies.set(c.id,d);
      this.world.runners.push(newRunner(d.id,this.world.map));this.starters.add(d.id);this.dummyUsed=true;
    }else if(action==='remove'&&d){
      this.world.runners=this.world.runners.filter(r=>r.id!==d!.id);this.starters.delete(d.id);
      for(const r of this.world.runners)if(r.wireRunner===d.id){r.wireState=0;r.wireRunner=-1;}
      this.dummies.delete(c.id);d=undefined;
    }else if(action==='switch'&&d)d.active=!d.active;
    else if(action==='configure'&&d){if(validFace(face))d.face=face!;if(typeof copy==='boolean')d.copy=copy;if(typeof hammer==='boolean')d.hammer=hammer;}
    if(action==='switch'||action==='remove'){
      slot.queue=[];slot.last=emptyInput();
      const runner=this.world.runners.find(r=>r.id===this.controlledId(c));if(runner)c.send({t:'control',gameId:this.id,runner:structuredClone(runner)});
    }
    this.broadcast({t:'names',names:this.names(),faces:this.faces()});this.dummyState(c);
  }
  private starters = new Set<number>();
  private teamBroken = false;

  constructor(
    readonly stageId: string,
    readonly mode: GameMode,
    private onEmpty: (g: Game) => void,
    private hooks: { afterTick?: () => void; zones?: () => ZoneState[] } = {},
    mapOverride?: MapDef,
  ) {
    const map = mapOverride ?? mapById(stageId);
    if (!map) throw new Error(`unknown stage ${stageId}`);
    this.world = createWorld(map);
  }

  get size() { return this.slots.size; }

  names(): Record<number, string> {
    const out: Record<number, string> = {};
    for (const [id, s] of this.slots) out[id] = s.client.name;
    for(const [owner,d] of this.dummies)out[d.id]=`${this.slots.get(owner)?.client.name??''} のダミー`;
    return out;
  }

  faces(): Record<number,string> { return {...Object.fromEntries([...this.slots].map(([id,s]) => [id,s.client.face ?? ''])),...Object.fromEntries([...this.dummies.values()].map(d=>[d.id,d.face]))}; }

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
    c.send({ t: 'gameStart', gameId: this.id, stageId: this.stageId, mode: this.mode, youId: c.id, names: this.names(), faces: this.faces(), map: this.world.map });
    this.broadcast({ t: 'names', names: this.names(), faces: this.faces() });this.dummyState(c);
  }

  remove(c: Client) {
    if(!this.slots.has(c.id))return;
    if(this.dummies.has(c.id))this.dummy(c,'remove');
    this.slots.delete(c.id);
    this.teamBroken = true;
    this.world.runners = this.world.runners.filter((r) => r.id !== c.id);
    for (const r of this.world.runners) if (r.wireRunner === c.id) { r.wireState = 0; r.wireRunner = -1; }
    c.game = null;
    if (this.slots.size === 0) this.onEmpty(this);
    else this.broadcast({ t: 'names', names: this.names(), faces: this.faces() });
  }

  pushInput(c: Client, seq: number, input: Input) {
    const s = this.slots.get(c.id);
    if (!s || seq <= s.queuedSeq) return;
    s.queuedSeq = seq;
    s.queue.push({ seq, input });
    while (s.queue.length > MAX_QUEUE) {
      const dropped=s.queue.shift()!;
      // Preserve one-shot actions even when a slow frame sends a burst of input.
      if(dropped.input.spit)s.queue[0].input={...s.queue[0].input,spit:true};
      if(dropped.input.miniSpit)s.queue[0].input={...s.queue[0].input,miniSpit:true};
      if(dropped.input.clearWord)s.queue[0].input={...s.queue[0].input,clearWord:true};
      if(dropped.input.kill)s.queue[0].input={...s.queue[0].input,kill:true};
      if(dropped.input.fire)s.queue[0].input={...s.queue[0].input,fire:true};
      if(dropped.input.jump)s.queue[0].input={...s.queue[0].input,jump:true};
    }
  }

  tick(sendSnapshot: boolean) {
    const inputs = new Map<number, Input>();
    for (const [id, s] of this.slots) {
      const next = s.queue.shift();
      if (next) { s.last = next.input; s.lastSeq = next.seq; }
      const d=this.dummies.get(id),active=d?.active?d.id:id;
      inputs.set(active,s.last);
      if(d){const passive=d.active?id:d.id;let idle=emptyInput();
        if(d.copy)idle={...s.last,kill:false,clearWord:false};
        if(d.hammer){const a=this.world.runners.find(r=>r.id===active),b=this.world.runners.find(r=>r.id===passive);if(a&&b&&['basic','hammer','ghost'].includes(b.ability)){idle={...idle,weapon:0,fire:true,aimX:a.x-b.x,aimY:a.y-b.y};if(b.ability==='ghost')idle.fire=this.world.tick%25===0;}}
        inputs.set(passive,idle);
      }
      // kill は1回だけ効かせる
      if (s.last.kill || s.last.clearWord) s.last = { ...s.last, kill: false, clearWord: false };
    }
    if (this.world.runners.length < this.world.map.minPlayers) inputs.forEach((_, id) => inputs.set(id, emptyInput()));
    const ev = this.world.runners.length < this.world.map.minPlayers ? { finished: [], killed: [] } : stepWorld(this.world, inputs);

    for (const f of ev.finished) {
      if (!this.names()[f.runnerId]) continue;
      // 記録の保存は各プレイヤーが自分のブラウザから行う
      this.broadcast({ t: 'finish', runnerId: f.runnerId, name: this.names()[f.runnerId], time: f.time,assisted:this.dummyUsed });
    }
    if (this.mode === 'party' && !this.cleared && this.world.runners.length >= this.world.map.minPlayers && !this.teamBroken && this.starters.size === this.world.runners.length
      && this.world.runners.every((r) => r.finishedTime >= 0)) {
      this.cleared = true;
      this.broadcast({
        t: 'partyClear',assisted:this.dummyUsed, stageId: this.stageId, gameId: this.id,
        results: this.world.runners.map((r) => ({ id: r.id, name: this.names()[r.id], time: r.finishedTime })),
      });
    }
    if (this.cleared && this.world.runners.some((r) => r.finishedTime < 0)) this.cleared = false;

    this.hooks.afterTick?.();

    if (!sendSnapshot) return;
    const zones = this.hooks.zones?.();
    const views = this.world.runners.map(toView);
    for (const [id, s] of this.slots) {
      const active=this.controlledId(s.client);const me = this.world.runners.find((r) => r.id === active) ?? null;
      s.client.send({
        t: 'snap', gameId: this.id, tick: this.world.tick, me, lastSeq: s.lastSeq,
        others: views.filter((v) => v.id !== active), doors: this.world.doorsOpen,
        timers: this.world.timers, lifts: this.world.lifts, saws: this.world.saws, zones,
        waiting: this.world.runners.length < this.world.map.minPlayers,
        dd: this.world.dd,
        words:this.world.words,wordSeq:this.world.wordSeq, blasts:this.world.blasts,balls:this.world.balls, pickups:this.world.pickups,
      });
    }
  }
}

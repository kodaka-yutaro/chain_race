import type { MapDef, Input, Runner } from './physics';

/** 大部屋の定員。作った人のブラウザが全員分の通信を受け持つので控えめにする */
export const HUB_CAPACITY = 16;
export const PARTY_CAPACITY = 8;
/** 協力の台で F を押してから出発するまで（tick） */
export const PARTY_COUNTDOWN_TICKS = 150;

export type GameMode = 'party' | 'free' | 'lobby';

/** 大部屋の各ゾーンにいる人数と、出発までの残り tick（0 = カウントなし） */
export interface ZoneState { id: string; count: number; countdown: number }

export interface UserInfo { id: number; name: string; guest: boolean }

export interface HubState {
  id: string;
  name: string;
  members: (UserInfo & { status: string })[];
  free: { stageId: string; count: number }[];
}

/** 他プレイヤーの描画用の軽量な状態 */
export interface RunnerView {
  id: number;
  x: number; y: number; vx: number; vy: number;
  ws: number; wx: number; wy: number; wr: number;
  st: number; ax: number; ay: number; ct: number;
  ft: number; rs: number; g: boolean;
}

/** 参加者 → 大部屋の主（ホスト） */
export type ClientMsg =
  | { t: 'hello'; name: string; guest: boolean }
  | { t: 'chat'; text: string }
  | { t: 'interact' }
  | { t: 'courseJoin'; map: MapDef }
  | { t: 'leaveGame' }
  /** 取りこぼしに備えて直近の入力をまとめて送る */
  | { t: 'input'; gameId: string; list: { seq: number; input: Input }[] };

/** 大部屋の主（ホスト） → 参加者 */
export type ServerMsg =
  | { t: 'welcome'; you: UserInfo }
  | { t: 'hubState'; hub: HubState }
  | { t: 'chat'; from: string; fromId?: number; text: string; system?: boolean }
  | { t: 'gameStart'; gameId: string; stageId: string; mode: GameMode; youId: number; names: Record<number, string>; map?: MapDef }
  | { t: 'names'; names: Record<number, string> }
  | { t: 'snap'; gameId: string; tick: number; me: Runner | null; lastSeq: number; others: RunnerView[]; doors: boolean[]; timers: number[]; lifts: number[]; saws: number[]; zones?: ZoneState[]; waiting?: boolean }
  | { t: 'finish'; runnerId: number; name: string; time: number }
  | { t: 'partyClear'; stageId: string; gameId: string; results: { id: number; name: string; time: number }[] }
  | { t: 'error'; message: string };

/** 届かなくてもよい（次のぶんで上書きされる）メッセージ */
export const isRealtime = (m: ClientMsg | ServerMsg) => m.t === 'snap' || m.t === 'input';

export function validName(name: string): string | null {
  const n = String(name ?? '').trim();
  if (n.length < 1 || n.length > 16) return null;
  if (/[\u0000-\u001f<>]/.test(n)) return null;
  return n;
}

export function toView(r: Runner): RunnerView {
  const q = (n: number) => Math.round(n * 100) / 100;
  return {
    id: r.id, x: q(r.x), y: q(r.y), vx: q(r.vx), vy: q(r.vy),
    ws: r.wireState, wx: q(r.wireX), wy: q(r.wireY), wr: r.wireRunner,
    st: r.stun, ax: q(r.aimX), ay: q(r.aimY), ct: r.hammerTick,
    ft: r.finishedTime, rs: r.raceStart, g: r.grounded,
  };
}

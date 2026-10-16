import type { Input, Runner } from './physics';

export const HUB_CAPACITY = 32;
export const PARTY_CAPACITY = 8;
/** 協力の台で F を押してから出発するまで（tick） */
export const PARTY_COUNTDOWN_TICKS = 150;

export type GameMode = 'party' | 'free' | 'lobby';

/** 大部屋の各ゾーンにいる人数と、出発までの残り tick（0 = カウントなし） */
export interface ZoneState { id: string; count: number; countdown: number }

export interface UserInfo { id: number; name: string; guest: boolean }

export interface HubSummary { id: string; name: string; count: number; capacity: number }

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

export type ClientMsg =
  | { t: 'hello'; token?: string; guestName?: string }
  | { t: 'listHubs' }
  | { t: 'createHub'; name: string }
  | { t: 'joinHub'; hubId: string }
  | { t: 'leaveHub' }
  | { t: 'chat'; text: string }
  | { t: 'interact' }
  | { t: 'leaveGame' }
  | { t: 'input'; seq: number; input: Input };

export type ServerMsg =
  | { t: 'welcome'; you: UserInfo }
  | { t: 'hubs'; list: HubSummary[] }
  | { t: 'hubState'; hub: HubState | null }
  | { t: 'chat'; from: string; fromId?: number; text: string; system?: boolean }
  | { t: 'gameStart'; gameId: string; stageId: string; mode: GameMode; youId: number; names: Record<number, string> }
  | { t: 'names'; names: Record<number, string> }
  | { t: 'snap'; tick: number; me: Runner | null; lastSeq: number; others: RunnerView[]; doors: boolean[]; zones?: ZoneState[] }
  | { t: 'finish'; runnerId: number; name: string; time: number; best: number | null; saved: boolean }
  | { t: 'partyClear'; results: { name: string; time: number }[] }
  | { t: 'gameEnd' }
  | { t: 'error'; message: string };

export function toView(r: Runner): RunnerView {
  const q = (n: number) => Math.round(n * 100) / 100;
  return {
    id: r.id, x: q(r.x), y: q(r.y), vx: q(r.vx), vy: q(r.vy),
    ws: r.wireState, wx: q(r.wireX), wy: q(r.wireY), wr: r.wireRunner,
    st: r.stun, ax: q(r.aimX), ay: q(r.aimY), ct: r.cannonTick,
    ft: r.finishedTime, rs: r.raceStart, g: r.grounded,
  };
}

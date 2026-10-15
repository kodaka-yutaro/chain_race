import type { Input, Runner } from './physics';

export const HUB_CAPACITY = 32;
export const PARTY_CAPACITY = 8;

export interface UserInfo { id: number; name: string; guest: boolean }

export interface HubSummary { id: string; name: string; count: number; capacity: number }

export interface PartyInfo { id: string; leaderId: number; stageId: string; members: number[]; playing: boolean }

export interface HubState {
  id: string;
  name: string;
  members: (UserInfo & { status: string })[];
  parties: PartyInfo[];
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
  | { t: 'createParty'; stageId: string }
  | { t: 'joinParty'; partyId: string }
  | { t: 'leaveParty' }
  | { t: 'setPartyStage'; stageId: string }
  | { t: 'startParty' }
  | { t: 'joinFree'; stageId: string }
  | { t: 'leaveGame' }
  | { t: 'input'; seq: number; input: Input };

export type ServerMsg =
  | { t: 'welcome'; you: UserInfo }
  | { t: 'hubs'; list: HubSummary[] }
  | { t: 'hubState'; hub: HubState | null; you: { partyId: string | null } }
  | { t: 'chat'; from: string; text: string; system?: boolean }
  | { t: 'gameStart'; gameId: string; stageId: string; mode: 'party' | 'free'; youId: number; names: Record<number, string> }
  | { t: 'names'; names: Record<number, string> }
  | { t: 'snap'; tick: number; me: Runner | null; lastSeq: number; others: RunnerView[]; doors: boolean[] }
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

import {writeRecovery, type Recovery} from './recovery';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { TICK_RATE } from '../../shared/physics';
import { HostHub, type Link } from '../host/hub';
import { HEARTBEAT_MS, randomId, type Backend } from './backend';
import { acceptAnswer, createAnswer, createOffer, PeerLink } from './rtc';

/** 部屋への接続。主（ホスト）でも参加者でも同じ形で扱う */
export interface Connection {
  readonly hubId: string;
  readonly hubName: string;
  readonly isHost: boolean;
  send(msg: ClientMsg): void;
  close(): void;
  onMessage: (msg: ServerMsg) => void;
  /** 相手から切られたとき（自分で close したときは呼ばれない） */
  onClose: (reason: string) => void;
}

const JOIN_TIMEOUT = 15_000;

export async function enterHub(backend: Backend, hubId: string | null, hubName: string, visibility: 'public' | 'invite' = 'public', recovery?: Recovery): Promise<Connection> {
  const hostId = recovery?.hostId ?? randomId();
  const claim = await backend.claimHub(hubId, hubName, hostId, visibility, !!recovery?.isHost);
  return claim.role === 'host' ? host(backend, claim.id, claim.name, recovery) : join(backend, claim.id, claim.name, recovery);
}

async function join(backend: Backend, hubId: string, hubName: string, recovery?: Recovery): Promise<Connection> {
  const p = await createOffer();
  let answer: string;
  try {
    answer = await backend.requestJoin(hubId, p.sdp, JOIN_TIMEOUT);
    await acceptAnswer(p, answer);
  } catch {
    p.pc.close();
    throw new Error('部屋につながりませんでした。少し待ってからもう一度試してください');
  }
  const link = new PeerLink<ServerMsg, ClientMsg>(p);
  try { await link.opened(JOIN_TIMEOUT); } catch {
    throw new Error('部屋につながりませんでした。通信環境によってはつながらないことがあります');
  }
  let closedByMe = false;
  const save=()=>{if(recovery)writeRecovery(recovery);};
  const suspend=()=>{save();link.send({t:'suspend'});};
  const timer=window.setInterval(save,30000);
  window.addEventListener('pagehide',suspend);
  const cleanup=()=>{clearInterval(timer);window.removeEventListener('pagehide',suspend);};
  const conn: Connection = {
    hubId, hubName, isHost: false,
    send: (m) => link.send(m),
    close: () => { closedByMe = true; cleanup();link.close(); },
    onMessage: () => {},
    onClose: () => {},
  };
  link.onMessage = (m) => conn.onMessage(m);
  link.onClose = () => { cleanup();if (!closedByMe) conn.onClose('部屋の主との接続が切れました'); };
  return conn;
}

/**
 * 自分が主になる。ゲーム進行（HostHub）をこのブラウザで動かし、参加者と WebRTC でつなぐ。
 * 主自身もふつうの参加者と同じく、折り返しの通信路で HostHub とやりとりする。
 */
function host(backend: Backend, hubId: string, hubName: string, recovery?: Recovery): Connection {
  let count = 1;
  let lastBeat = 0;
  const beat = () => { lastBeat = Date.now(); backend.heartbeat(hubId, count, [...hub.members].map(c => c.name)).catch((e) => console.warn('heartbeat', e)); };
  let beatTimer = 0;
  const hub = new HostHub(hubId, hubName, (n) => {
    count = n;
    // 人数の変化は一覧にすぐ出したいが、書き込みすぎないよう間を空ける
    if (Date.now() - lastBeat > 5000) beat();
    else if (!beatTimer) beatTimer = window.setTimeout(() => { beatTimer = 0; beat(); }, 5000);
  });

  if(recovery?.state)hub.restore(recovery.state);
  let storageWarned=false;
  const save=()=>{
    if(!recovery)return;
    recovery.hubId=hubId;recovery.hubName=hubName;recovery.isHost=true;recovery.state=hub.save();
    if(!writeRecovery(recovery)&&!storageWarned){storageWarned=true;conn.onMessage({t:'error',message:'進捗を保存できません。ブラウザの保存領域を確認してください。'});}
  };
  const saveTimer=window.setInterval(save,1000);
  const visibilitySave=()=>{if(document.hidden)save();};
  document.addEventListener('visibilitychange',visibilitySave);

  const peers = new Set<PeerLink<ClientMsg, ServerMsg>>();
  const unlisten = backend.listenJoins(hubId, async (req) => {
    try {
      const p = await createAnswer(req.offer);
      const link = new PeerLink<ClientMsg, ServerMsg>(p);
      await backend.answerJoin(hubId, req.id, p.sdp);
      await link.opened(JOIN_TIMEOUT);
      peers.add(link);
      const l: Link = { send: (m) => link.send(m), close: () => link.close(), onMessage: () => {}, onClose: () => {} };
      link.onMessage = (m) => l.onMessage(m);
      link.onClose = () => { peers.delete(link); l.onClose(); };
      hub.connect(l);
    } catch (e) {
      console.warn('join failed', e);
    }
  });

  // バックグラウンドのタブではタイマーが間引かれるので、Worker から合図を受けて進める
  const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 10)'], { type: 'text/javascript' })));
  const interval = 1000 / TICK_RATE;
  let next = performance.now();
  ticker.onmessage = () => {
    const now = performance.now();
    let n = 0;
    while (now >= next && n < 5) { hub.tick(); next += interval; n++; }
    if (now - next > 200) next = now;
  };
  const heartbeat = window.setInterval(beat, HEARTBEAT_MS);

  // 主自身の通信路（同じブラウザの中で折り返す）
  const self: Link = {
    send: (m) => { const c = structuredClone(m); queueMicrotask(() => conn.onMessage(c)); },
    close: () => {},
    onMessage: () => {},
    onClose: () => {},
  };
  hub.connect(self, true);

  const release = () => { backend.releaseHub(hubId).catch(() => {}); };
  window.addEventListener('pagehide', save);

  const conn: Connection = {
    hubId, hubName, isHost: true,
    send: (m) => { const c = structuredClone(m); queueMicrotask(() => self.onMessage(c)); },
    close: () => {
      unlisten();
      ticker.terminate();
      clearInterval(heartbeat);
      clearTimeout(beatTimer);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange',visibilitySave);clearInterval(saveTimer);
      for (const p of [...peers]) p.close();
      release();
    },
    onMessage: () => {},
    onClose: () => {},
  };
  return conn;
}

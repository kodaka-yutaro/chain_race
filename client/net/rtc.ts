import { isRealtime } from '../../shared/protocol';

const turnUrl = import.meta.env.VITE_TURN_URL;
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ...(turnUrl ? [{ urls: turnUrl.split(','), username: import.meta.env.VITE_TURN_USER, credential: import.meta.env.VITE_TURN_PASS }] : []),
];

/** 送る側と受け取る側で同じものを作る（negotiated）ので、ondatachannel を待たなくてよい */
function channels(pc: RTCPeerConnection) {
  return {
    ctl: pc.createDataChannel('ctl', { negotiated: true, id: 0, ordered: true }),
    rt: pc.createDataChannel('rt', { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 }),
  };
}

/** 経路の候補を集め終わるまで待つ（候補を小分けに送らず、まとめて1回で渡すため） */
function gathered(pc: RTCPeerConnection, ms = 3000): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); clearTimeout(timer); resolve(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, ms);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export interface Pending { pc: RTCPeerConnection; ctl: RTCDataChannel; rt: RTCDataChannel; sdp: string }

export async function createOffer(): Promise<Pending> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const ch = channels(pc);
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  return { pc, ...ch, sdp: JSON.stringify(pc.localDescription) };
}

export async function createAnswer(offer: string): Promise<Pending> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const ch = channels(pc);
  await pc.setRemoteDescription(JSON.parse(offer));
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  return { pc, ...ch, sdp: JSON.stringify(pc.localDescription) };
}

export async function acceptAnswer(p: Pending, answer: string) {
  await p.pc.setRemoteDescription(JSON.parse(answer));
}

/** つながった通信路。届かなくてよいもの（snap / input）は再送しない方の路で送る */
export class PeerLink<In, Out extends { t: string }> {
  onMessage: (msg: In) => void = () => {};
  onClose: () => void = () => {};
  private closed = false;

  constructor(private p: Pending) {
    const recv = (e: MessageEvent) => {
      let m: In;
      try { m = JSON.parse(e.data); } catch { return; }
      this.onMessage(m);
    };
    p.ctl.onmessage = recv;
    p.rt.onmessage = recv;
    p.ctl.onclose = () => this.close();
    let lost = 0;
    p.pc.onconnectionstatechange = () => {
      const s = p.pc.connectionState;
      clearTimeout(lost);
      if (s === 'failed' || s === 'closed') this.close();
      // 一時的な切断は少し待つ
      else if (s === 'disconnected') lost = window.setTimeout(() => this.close(), 6000);
    };
  }

  /** ctl が開くまで待つ */
  opened(ms: number): Promise<void> {
    if (this.p.ctl.readyState === 'open') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.close(); reject(new Error('timeout')); }, ms);
      this.p.ctl.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }

  send(msg: Out) {
    if (this.closed) return;
    const data = JSON.stringify(msg);
    try {
      if (isRealtime(msg as never)) {
        // 混んでいるときは捨てる（次のぶんが届けば足りる）
        if (this.p.rt.readyState === 'open' && this.p.rt.bufferedAmount < 256 * 1024) this.p.rt.send(data);
      } else if (this.p.ctl.readyState === 'open') {
        this.p.ctl.send(data);
      }
    } catch { /* 送れなければ切断の扱いに任せる */ }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try { this.p.pc.close(); } catch { /* 無視 */ }
    this.onClose();
  }
}

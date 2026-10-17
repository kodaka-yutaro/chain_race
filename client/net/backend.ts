/** アカウント・大部屋の一覧・接続の仲介・記録を受け持つ外部サービス */
export interface Account { uid: string; name: string }

export interface HubInfo { id: string; name: string; count: number; capacity: number }

export interface Backend {
  /** Firebase の設定がなく、同じブラウザの中だけで試す動作のとき true */
  readonly local: boolean;

  account(): Promise<Account | null>;
  register(name: string, password: string): Promise<Account>;
  login(name: string, password: string): Promise<Account>;
  logout(): Promise<void>;
  /** ゲストとして使う（記録は残らない） */
  guest(): Promise<void>;

  listHubs(): Promise<HubInfo[]>;
  /** 主のいない大部屋なら自分が主になる。id が null なら新しく作る */
  claimHub(id: string | null, name: string, hostId: string): Promise<{ id: string; name: string; role: 'host' | 'join' }>;
  heartbeat(id: string, count: number): Promise<void>;
  releaseHub(id: string): Promise<void>;

  /** 主: 参加したい人からの接続要求を受け取る */
  listenJoins(hubId: string, cb: (req: { id: string; offer: string }) => void): () => void;
  answerJoin(hubId: string, reqId: string, answer: string): Promise<void>;
  /** 参加者: 接続要求を出して、主の返事を待つ */
  requestJoin(hubId: string, offer: string, timeoutMs: number): Promise<string>;

  /** 自己ベストを更新して、更新後の自己ベストを返す（ゲストは null） */
  saveBest(stageId: string, time: number): Promise<number | null>;
  topRecords(stageId: string): Promise<{ name: string; time: number }[]>;
}

/** いつも一覧に出す大部屋。誰もいなければ、最初に入った人が主になる */
export const PERMANENT_HUBS = [
  { id: 'hub1', name: '大部屋 1' },
  { id: 'hub2', name: '大部屋 2' },
  { id: 'hub3', name: '大部屋 3' },
];

/** 主からの更新がこれより古い大部屋は、主がいないものとみなす */
export const HUB_STALE_MS = 75_000;
export const HEARTBEAT_MS = 25_000;

export function mergeHubs(live: HubInfo[], capacity: number): HubInfo[] {
  const byId = new Map(live.map((h) => [h.id, h]));
  const fixed = PERMANENT_HUBS.map((p) => byId.get(p.id) ?? { ...p, count: 0, capacity });
  const others = live.filter((h) => !PERMANENT_HUBS.some((p) => p.id === h.id)).sort((a, b) => b.count - a.count);
  return [...fixed, ...others];
}

export const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, '0')).join('');

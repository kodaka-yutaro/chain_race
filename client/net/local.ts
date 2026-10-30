import { validateCourseMap, type Course } from '../../shared/courses';
import { HUB_CAPACITY } from '../../shared/protocol';
import { HUB_STALE_MS, mergeHubs, randomId, type Account, type Backend, type HubInfo } from './backend';

/**
 * Firebase を設定していないときの代わり。同じブラウザのタブ同士だけでつながる（開発・確認用）。
 * 大部屋・アカウント・記録は localStorage、接続の仲介は BroadcastChannel で行う。
 */
export function localBackend(): Backend {
  const bc = new BroadcastChannel('chainrace-signal');
  const read = <T>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') as T; } catch { return d; } };
  const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
  type HubRow = HubInfo & { hostId: string; updatedAt: number };
  const hubs = () => read<Record<string, HubRow>>('cr.hubs', {});
  const accounts = () => read<Record<string, { name: string; password: string }>>('cr.accounts', {});
  const me = (): Account | null => { try { return JSON.parse(sessionStorage.getItem('cr.me') ?? 'null'); } catch { return null; } };
  const setMe = (a: Account | null) => sessionStorage.setItem('cr.me', JSON.stringify(a));

  return {
    local: true,
    async listCourses() { return read<Course[]>('cr.courses', []); },
    async publishCourse(map, authorName) {
      const id = 'user-' + randomId(), a = me();
      if (!a) throw new Error('コースの投稿にはログインしてください');
      const c: Course = { id, author: a.uid, authorName, createdAt: Date.now(), status: 'prerelease', map: { ...validateCourseMap(map), id } };
      write('cr.courses', [c, ...read<Course[]>('cr.courses', [])]); return c;
    },
    async releaseCourse(id, results) {
      const a=me();if(!a)throw Error('チェッカー登録にはログインしてください');
      const time=results[0]?.time;if(results.length!==1||!Number.isFinite(time)||time<0)throw Error('クリア記録が正しくありません');
      return navigator.locks.request('chainrace-checker',async()=>{
        const all=read<Course[]>('cr.courses',[]),c=all.find(c=>c.id===id);if(!c)return null;
        if(!c.firstClear){c.status='released';c.firstClear={uid:a.uid,names:[a.name],time,at:Date.now()};write('cr.courses',all);}
        return c.firstClear.names.join('・');
      });
    },
    async account() { return me(); },
    async register(name, password) {
      const all = accounts();
      const key = name.trim().toLowerCase();
      if (all[key]) throw new Error('その名前はすでに使われています');
      all[key] = { name, password };
      write('cr.accounts', all);
      const a = { uid: key, name };
      setMe(a);
      return a;
    },
    async login(name, password) {
      const key = name.trim().toLowerCase();
      const row = accounts()[key];
      if (!row || row.password !== password) throw new Error('名前かパスワードが違います');
      const a = { uid: key, name: row.name };
      setMe(a);
      return a;
    },
    async logout() { setMe(null); },
    async guest() { setMe(null); },

    async listHubs() {
      const now = Date.now();
      return mergeHubs(Object.values(hubs()).filter((h) => h.updatedAt > now - HUB_STALE_MS && h.visibility === 'public'), HUB_CAPACITY);
    },
    async claimHub(id, name, hostId, visibility = 'public') {
      const all = hubs();
      const key = id ?? randomId();
      const d = all[key];
      if (id) {
        if (!d || d.updatedAt <= Date.now() - HUB_STALE_MS) throw new Error('この部屋は終了しました');
        if (d.count >= d.capacity) throw new Error('この大部屋は満員です');
        return { id: key, name: d.name, role: 'join' };
      }
      all[key] = { id: key, name, hostId, visibility, members: [], count: 1, capacity: HUB_CAPACITY, updatedAt: Date.now() };
      write('cr.hubs', all);
      return { id: key, name, role: 'host' };
    },
    async heartbeat(id, count, members = []) {
      const all = hubs();
      if (all[id]) { all[id].count = count; all[id].members = members; all[id].updatedAt = Date.now(); write('cr.hubs', all); }
    },
    async releaseHub(id) {
      const all = hubs();
      delete all[id];
      write('cr.hubs', all);
    },

    listenJoins(hubId, cb) {
      const fn = (e: MessageEvent) => {
        const m = e.data;
        if (m?.type === 'offer' && m.hubId === hubId) cb({ id: m.reqId, offer: m.offer });
      };
      bc.addEventListener('message', fn);
      return () => bc.removeEventListener('message', fn);
    },
    async answerJoin(hubId, reqId, answer) { bc.postMessage({ type: 'answer', hubId, reqId, answer }); },
    requestJoin(hubId, offer, timeoutMs) {
      const reqId = randomId();
      return new Promise((resolve, reject) => {
        const fn = (e: MessageEvent) => {
          if (e.data?.type === 'answer' && e.data.reqId === reqId) { done(); resolve(e.data.answer); }
        };
        const timer = setTimeout(() => { done(); reject(new Error('timeout')); }, timeoutMs);
        const done = () => { clearTimeout(timer); bc.removeEventListener('message', fn); };
        bc.addEventListener('message', fn);
        bc.postMessage({ type: 'offer', hubId, reqId, offer });
      });
    },

    async saveBest(stageId, time) {
      const a = me();
      if (!a) return null;
      const all = read<Record<string, Record<string, { name: string; time: number }>>>('cr.records', {});
      const st = (all[stageId] ??= {});
      const old = st[a.uid]?.time ?? Infinity;
      if (time < old) st[a.uid] = { name: a.name, time };
      write('cr.records', all);
      return Math.min(old, time);
    },
    async topRecords(stageId) {
      const st = read<Record<string, Record<string, { name: string; time: number }>>>('cr.records', {})[stageId] ?? {};
      return Object.values(st).sort((a, b) => a.time - b.time).slice(0, 20);
    },
  };
}

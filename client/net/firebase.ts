import { validateCourseMap, type Course } from '../../shared/courses';
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, signInAnonymously, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query,
  runTransaction, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { HUB_CAPACITY } from '../../shared/protocol';
import { HUB_STALE_MS, mergeHubs, randomId, type Account, type Backend, type HubInfo } from './backend';

/** 名前からログイン用のメールアドレスを作る（実在しないアドレス。メールは送らない） */
async function emailFor(name: string): Promise<string> {
  const data = new TextEncoder().encode(name.trim().normalize('NFKC').toLowerCase());
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const hex = Array.from(hash.slice(0, 20), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex}@users.chainrace.kdking-tools.com`;
}

function authError(e: unknown): Error {
  const code = (e as { code?: string })?.code ?? '';
  const msg: Record<string, string> = {
    'auth/email-already-in-use': 'その名前はすでに使われています',
    'auth/invalid-credential': '名前かパスワードが違います',
    'auth/wrong-password': '名前かパスワードが違います',
    'auth/user-not-found': '名前かパスワードが違います',
    'auth/weak-password': 'パスワードは6文字以上にしてください',
    'auth/too-many-requests': 'しばらく待ってからもう一度試してください',
    'auth/network-request-failed': '通信に失敗しました',
  };
  return new Error(msg[code] ?? 'エラーが発生しました。少し待ってからもう一度試してください');
}

export function firebaseBackend(config: FirebaseOptions): Backend {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let cached: Account | null = null;

  async function ensureUser() {
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    return auth.currentUser!;
  }

  return {
    local: false,
    async listCourses() {
      const snap = await getDocs(query(collection(db, 'courses'), orderBy('createdAt', 'desc'), limit(100)));
      return snap.docs.flatMap(d => {try{const c=d.data();if(typeof c.map?.dd==='string')c.map.dd=JSON.parse(c.map.dd);return [c as Course];}catch{return [];}}).filter(c => {
        try { return c.map.id === c.id && !!validateCourseMap(c.map); } catch { return false; }
      });
    },
    async publishCourse(map, authorName) {
      const a = await this.account();
      if (!a) throw new Error('コースの投稿にはログインしてください');
      const id = 'user-' + randomId();
      const c: Course = { id, author: a.uid, authorName, createdAt: Date.now(), status: 'prerelease', map: { ...validateCourseMap(map), id } };
      if(new TextEncoder().encode(JSON.stringify(c)).length>900000)throw Error('公開できるデータ容量を超えています。コースを分割するか、ファイルで共有してください。');
      await setDoc(doc(db, 'courses', id), {...c,map:{...c.map,dd:JSON.stringify(c.map.dd)}}); return c;
    },
    async releaseCourse(id, results) {
      const a=await this.account();if(!a)throw Error('チェッカー登録にはログインしてください');
      const time=results[0]?.time;if(results.length!==1||!Number.isFinite(time)||time<0)throw Error('クリア記録が正しくありません');
      return runTransaction(db,async tx=>{
        const ref=doc(db,'courses',id),snap=await tx.get(ref);if(!snap.exists())return null;
        const previous=snap.get('firstClear') as Course['firstClear'];if(previous)return previous.names.join('・');
        tx.update(ref,{status:'released',firstClear:{uid:a.uid,names:[a.name],time,at:Date.now()}});
        return a.name;
      });
    },

    async account() {
      await auth.authStateReady();
      const u = auth.currentUser;
      if (!u || u.isAnonymous) return null;
      if (cached?.uid === u.uid) return cached;
      const d = await getDoc(doc(db, 'users', u.uid));
      cached = { uid: u.uid, name: String(d.data()?.name ?? '') };
      return cached.name ? cached : null;
    },

    async register(name, password) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, await emailFor(name), password);
        await setDoc(doc(db, 'users', cred.user.uid), { name, createdAt: Date.now() });
        return (cached = { uid: cred.user.uid, name });
      } catch (e) { throw authError(e); }
    },

    async login(name, password) {
      try {
        const cred = await signInWithEmailAndPassword(auth, await emailFor(name), password);
        const d = await getDoc(doc(db, 'users', cred.user.uid));
        return (cached = { uid: cred.user.uid, name: String(d.data()?.name ?? name) });
      } catch (e) { throw authError(e); }
    },

    async logout() { cached = null; await signOut(auth); },

    async guest() {
      await auth.authStateReady();
      if (auth.currentUser && !auth.currentUser.isAnonymous) await signOut(auth);
      await ensureUser();
    },

    async listHubs() {
      const snap = await getDocs(query(collection(db, 'hubs'), where('visibility', '==', 'public'), where('updatedAt', '>', Date.now() - HUB_STALE_MS)));
      const live: HubInfo[] = snap.docs.filter(d => d.get('updatedAt') > Date.now() - HUB_STALE_MS).map((d) => ({
        id: d.id, name: String(d.get('name')), members: d.get('members') ?? [], count: Number(d.get('count')) || 0, capacity: Number(d.get('capacity')) || HUB_CAPACITY,
      }));
      return mergeHubs(live, HUB_CAPACITY);
    },

    async claimHub(id, name, hostId, visibility = 'public') {
      const u = await ensureUser();
      const ref = doc(db, 'hubs', id ?? randomId());
      return runTransaction(db, async (tx) => {
        const cur = await tx.get(ref);
        const d = cur.data();
        const now = Date.now();
        if (id) {
          if (!d || d.updatedAt <= now - HUB_STALE_MS) throw new Error('この部屋は終了しました');
          if (d.count >= d.capacity) throw new Error('この大部屋は満員です');
          return { id: ref.id, name: String(d.name), role: 'join' as const };
        }
        tx.set(ref, { name, hostId, hostUid: u.uid, visibility, members: [], count: 1, capacity: HUB_CAPACITY, updatedAt: now });
        return { id: ref.id, name, role: 'host' as const };
      });
    },

    async heartbeat(id, count, members = []) {
      await updateDoc(doc(db, 'hubs', id), { count, members, updatedAt: Date.now() });
    },

    async releaseHub(id) {
      await deleteDoc(doc(db, 'hubs', id));
    },

    listenJoins(hubId, cb) {
      const q = query(collection(db, 'hubs', hubId, 'joins'), where('createdAt', '>', Date.now() - 30_000));
      return onSnapshot(q, (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type === 'added' && !ch.doc.get('answer')) cb({ id: ch.doc.id, offer: String(ch.doc.get('offer')) });
        }
      });
    },

    async answerJoin(hubId, reqId, answer) {
      await updateDoc(doc(db, 'hubs', hubId, 'joins', reqId), { answer });
    },

    async requestJoin(hubId, offer, timeoutMs) {
      const u = await ensureUser();
      const ref = await addDoc(collection(db, 'hubs', hubId, 'joins'), { offer, uid: u.uid, createdAt: Date.now() });
      try {
        return await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => { unsub(); reject(new Error('timeout')); }, timeoutMs);
          const unsub = onSnapshot(ref, (d) => {
            const a = d.get('answer');
            if (a) { clearTimeout(timer); unsub(); resolve(String(a)); }
          }, (e) => { clearTimeout(timer); reject(e); });
        });
      } finally {
        deleteDoc(ref).catch(() => {});
      }
    },

    async saveBest(stageId, time) {
      const a = await this.account();
      if (!a) return null;
      const ref = doc(db, 'stages', stageId, 'best', a.uid);
      return runTransaction(db, async (tx) => {
        const cur = await tx.get(ref);
        const old = cur.exists() ? Number(cur.get('time')) : Infinity;
        if (time < old) tx.set(ref, { name: a.name, time, updatedAt: Date.now() });
        return Math.min(old, time);
      });
    },

    async topRecords(stageId) {
      const snap = await getDocs(query(collection(db, 'stages', stageId, 'best'), orderBy('time'), limit(20)));
      return snap.docs.map((d) => ({ name: String(d.get('name')), time: Number(d.get('time')) }));
    },
  };
}

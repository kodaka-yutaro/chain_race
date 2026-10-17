import type { FirebaseOptions } from 'firebase/app';

/**
 * Firebase コンソールの「プロジェクトの設定 → マイアプリ」に出る firebaseConfig をここに貼る。
 * これらの値は公開されても問題ない（守りは firestore.rules で行う）。
 * null にすると、同じブラウザの中だけで試せるローカル動作になる。
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyB3JC_fBke5GTHpZGkr6I7OkZhWFVh9AKo',
  authDomain: 'chainrace-4fc4c.firebaseapp.com',
  projectId: 'chainrace-4fc4c',
  storageBucket: 'chainrace-4fc4c.firebasestorage.app',
  messagingSenderId: '183359192540',
  appId: '1:183359192540:web:4be608146fdd4145a96319',
};

import type { FirebaseOptions } from 'firebase/app';

/**
 * Firebase コンソールの「プロジェクトの設定 → マイアプリ」に出る firebaseConfig をここに貼る。
 * これらの値は公開されても問題ない（守りは firestore.rules で行う）。
 * null のままだと、同じブラウザの中だけで試せるローカル動作になる。
 */
export const firebaseConfig: FirebaseOptions | null = null;

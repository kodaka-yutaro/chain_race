/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_SLOT_LOBBY?: string;
  readonly VITE_ADSENSE_SLOT_RESULT?: string;
  /** 1 にすると Firebase を使わず、同じブラウザのタブ同士だけでつながる（開発・確認用） */
  readonly VITE_LOCAL_ONLY?: string;
  readonly VITE_TURN_URL?: string;
  readonly VITE_TURN_USER?: string;
  readonly VITE_TURN_PASS?: string;
}

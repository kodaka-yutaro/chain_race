// ホーム画面アプリ（PWA）として起動してもらうための案内と、全画面表示の切り替え。
// iPhone の Safari はタブで開く限りブラウザのバーを消せない（Fullscreen API が iPad のみ）ため、
// バーのない全画面で遊ぶには「ホーム画面に追加」からの起動が本命。対応端末では全画面ボタンも出す。

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

const DISMISS_KEY = 'kd.installHintDismissed';
let deferredPrompt: BeforeInstallPromptEvent | null = null;
/** 全画面にできなかったときなど、タイトル画面以外でも案内を一時的に出す期限 */
let forceHintUntil = 0;

export function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isCoarsePointer = () => matchMedia('(pointer: coarse)').matches;

function hintEl() {
  return document.querySelector<HTMLElement>('#install-hint');
}

function hintDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function onTitleScreen(): boolean {
  const title = document.querySelector('#screen-title');
  return !!title && !title.classList.contains('hidden');
}

function updateHint() {
  const hint = hintEl();
  if (!hint) return;
  const show =
    !isStandalone() &&
    isCoarsePointer() &&
    (Date.now() < forceHintUntil || (onTitleScreen() && !hintDismissed()));
  hint.classList.toggle('hidden', !show);
  if (!show) return;
  const text = hint.querySelector<HTMLElement>('#install-hint-text')!;
  const action = hint.querySelector<HTMLButtonElement>('#install-hint-action')!;
  if (deferredPrompt) {
    text.textContent =
      'ホーム画面に追加すると、ブラウザのバーがない全画面で遊べます。';
    action.classList.remove('hidden');
  } else if (isIos()) {
    text.textContent =
      '全画面で遊ぶには、共有ボタン（□↑）から「ホーム画面に追加」して、ホーム画面のアイコンから起動してください。';
    action.classList.add('hidden');
  } else {
    text.textContent =
      '全画面で遊ぶには、ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。';
    action.classList.add('hidden');
  }
}

/** 全画面に切り替えられなかったときに、代わりの案内を少しの間出す */
export function showInstallHint(force = false) {
  if (force) {
    forceHintUntil = Date.now() + 9000;
    setTimeout(updateHint, 9200);
  }
  updateHint();
}

function syncFullscreenLabels() {
  const label = document.fullscreenElement ? '全画面を終わる' : '全画面';
  document
    .querySelectorAll<HTMLElement>('[data-fullscreen], .fs-toggle')
    .forEach((b) => {
      b.textContent = b.closest('.game-actions') ? `⛶ ${label}` : label;
    });
}

/** 全画面の開始／終了。未対応の端末（iPhone の Safari 等）ではホーム画面への追加を案内する */
export async function toggleFullscreen() {
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      /* 終了できない場合はそのまま */
    }
    syncFullscreenLabels();
    return;
  }
  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const request =
    typeof root.requestFullscreen === 'function'
      ? () => root.requestFullscreen({ navigationUI: 'hide' })
      : root.webkitRequestFullscreen
        ? () => root.webkitRequestFullscreen!()
        : null;
  if (!request) {
    showInstallHint(true);
    return;
  }
  try {
    await request();
  } catch {
    // navigationUI 指定が通らないブラウザ向けに、指定なしでもう一度試す
    try {
      await root.requestFullscreen();
    } catch {
      showInstallHint(true);
      return;
    }
  }
  // スマホでは横画面に固定できると遊びやすい（失敗しても全画面自体は続ける）
  if (isCoarsePointer()) {
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      await orientation.lock?.('landscape');
    } catch {
      /* 向きの固定は端末まかせ */
    }
  }
  syncFullscreenLabels();
}

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    updateHint();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hintEl()?.classList.add('hidden');
  });
  document.addEventListener('fullscreenchange', syncFullscreenLabels);
  document
    .querySelectorAll<HTMLElement>('[data-fullscreen]')
    .forEach((b) => b.addEventListener('click', () => void toggleFullscreen()));

  const hint = hintEl();
  if (!hint) return;
  hint.querySelector('#install-hint-close')?.addEventListener('click', () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* 保存できなくても閉じる */
    }
    forceHintUntil = 0;
    hint.classList.add('hidden');
  });
  hint
    .querySelector('#install-hint-action')
    ?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      deferredPrompt = null;
      updateHint();
    });
  const title = document.querySelector('#screen-title');
  if (title) {
    new MutationObserver(updateHint).observe(title, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
  updateHint();
}

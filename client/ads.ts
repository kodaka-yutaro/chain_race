// 広告枠。VITE_ADSENSE_CLIENT が設定されているときだけ AdSense を読み込む。
// プレイ中の画面には出さず、ロビーとリザルトにだけ置く。

const client = import.meta.env.VITE_ADSENSE_CLIENT;
const slots: Record<string, string | undefined> = {
  lobby: import.meta.env.VITE_ADSENSE_SLOT_LOBBY,
  result: import.meta.env.VITE_ADSENSE_SLOT_RESULT,
};

let loaded = false;

function loadScript() {
  if (loaded || !client) return;
  loaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

/** 画面内の広告枠を初期化する（表示されたタイミングで呼ぶ） */
export function fillAds(root: ParentNode) {
  for (const el of root.querySelectorAll<HTMLElement>('.ad-slot')) {
    if (el.dataset.filled) continue;
    const slot = slots[el.dataset.slot ?? ''];
    if (client && slot) {
      loadScript();
      el.dataset.filled = '1';
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.dataset.adClient = client;
      ins.dataset.adSlot = slot;
      ins.dataset.adFormat = 'auto';
      ins.dataset.fullWidthResponsive = 'true';
      el.appendChild(ins);
      try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); } catch { /* 広告ブロック等 */ }
    } else if (import.meta.env.DEV) {
      el.dataset.filled = '1';
      el.classList.add('placeholder');
      el.textContent = `広告枠（${el.dataset.slot}）`;
    } else {
      el.classList.add('hidden');
    }
  }
}

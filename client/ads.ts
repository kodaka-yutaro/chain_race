// Friend-only tournament: no advertising is loaded.
export function fillAds(root: ParentNode) {
  for (const el of root.querySelectorAll<HTMLElement>('.ad-slot')) el.classList.add('hidden');
}

// 会話窓の中で焦点を移せる要素を集める。Tab の輪(use-modal-focus)と
// 押しっぱなしの焦点送り(use-held-scroll)が同じ並びを読むので、判定はここ1か所に置く
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])'

// この窓で焦点を移せる要素を DOM 順に並べる。操作ボタン(.actions)はパネルの外(.box の兄弟)に
// あるので、根はパネルではなくダイアログ全体
export const focusablesIn = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

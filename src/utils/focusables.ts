// 重ね表示の窓の中で焦点を移せる要素を集める。Tab の輪(use-dialog-focus)と
// 押しっぱなしの焦点送り(use-held-scroll・use-clock-modal)が同じ並びを読むので、判定はここ1か所に置く

// 会話窓。本文中のリンクと操作ボタン
export const STOP_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])'
// 卓上時計の窓で焦点を移せるのはボタンだけ。Tab の輪はこの並びで回す
export const CLOCK_FOCUSABLE_SELECTOR = 'button:not([disabled])'
// 拡大地図(WorldMap)の Tab の輪。並びの書き方は元の定義のまま(一致した要素は DOM 順に返る)
export const MAP_FOCUSABLE_SELECTOR = 'button:not([disabled]), a[href]'

// この窓で焦点を移せる要素を DOM 順に並べる。会話窓の操作ボタン(.actions)はパネルの外(.box の兄弟)に
// あるので、根はパネルではなくダイアログ全体
export const focusablesIn = (root: HTMLElement, selector: string): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(selector))

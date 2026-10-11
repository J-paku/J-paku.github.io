// 重ね表示の窓の Tab の輪で、端から反対の端へ回すかを決める。焦点を移す要素の並び・今の焦点は
// フック(hooks/use-dialog-focus.ts)が DOM から集め、ここは値を受けて答えるだけにする
// (React・DOM なしで端と向きの組み合わせを網羅的に確かめるため)

export type WrapFocusInput<T> = {
  // 輪に並ぶ要素(DOM 順)
  items: readonly T[]
  // 今焦点のある要素
  active: T | null
  // 並びの外で輪の先頭と同じに扱う要素(tabIndex -1 の見出しなど)。無い窓は undefined
  lead?: T | null
  // Shift+Tab(前へ)なら true
  shift: boolean
}

// 回す先の位置を返す。null なら回さず、ブラウザの既定の Tab に任せる。
// Shift+Tab は先頭(または lead)で末尾へ、Tab は末尾で先頭へ回す。並びが空なら回す先が無い
export const wrapFocusIndex = <T>({
  items,
  active,
  lead,
  shift,
}: WrapFocusInput<T>): number | null => {
  if (items.length === 0) return null
  const last = items.length - 1
  if (shift && (active === items[0] || active === lead)) return last
  if (!shift && active === items[last]) return 0
  return null
}

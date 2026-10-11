// 場面モーダルで、送った先が端(先頭/末尾)になって前へ/次へのボタンが disabled になる時、
// フォーカスをどのボタンへ逃がすかの判定。disabled のボタンはフォーカスを持てず、ブラウザが body へ落とすため、
// 送る前に先回りで移す。ボタンの要素と focus() はフック(hooks/use-scene-carousel.ts)が持ち、ここはどのボタンかだけを答える
import { sceneEdges } from './step-scene'

export type NavControl = 'prev' | 'next'
export type SceneControl = NavControl | 'close'

// 今フォーカスが乗っている前へ/次へのボタン。どちらでもなければ null。
// 要素の種類に依らず同じものかだけで比べる(ボタンの参照がまだ空なら、フォーカスが無くても一致させない)
export const focusedNav = <T>(
  active: T | null,
  prev: T | null,
  next: T | null
): NavControl | null => {
  if (active === null) return null
  if (active === prev) return 'prev'
  if (active === next) return 'next'
  return null
}

// 前へ/次へを押して target へ送る時の逃がし先。押したボタンが無効になる時だけ動かす。
// 先頭へ着いたら次へ、末尾へ着いたら前へ。場面が1つで両方が無効になるなら閉じるへ
export const focusAfterStep = (target: number, count: number): SceneControl | null => {
  const { isFirst, isLast } = sceneEdges(target, count)
  if (isFirst) return isLast ? 'close' : 'next'
  return isLast ? 'prev' : null
}

// 自動送りで target へ送る時の逃がし先。手で押した時と違い、無効になるボタンに今フォーカスが乗っている時だけ動かす
// (どこにフォーカスがあってもタイマーが奪うと、閉じるボタンなどを選んでいた人の位置が飛ぶ)。
// 末尾から先頭へ巡る時は閉じるへ逃がす — 次へのボタンは送りがまだ反映されず末尾のまま disabled なので、focus() が効かない。
// 末尾へ着く時の逃がし先の前へは、送る前から有効なので手で押した時と同じく前へ
export const focusOnAutoAdvance = (
  target: number,
  count: number,
  focused: NavControl | null
): SceneControl | null => {
  const { isFirst, isLast } = sceneEdges(target, count)
  if (isFirst) return focused === 'prev' ? 'close' : null
  return isLast && focused === 'next' ? 'prev' : null
}

// 縦スクロールする要素の位置を、自前で描く縦棒(トラック+つまみ)の割合に直す。
// 要素の寸法はフック(StopModal/hooks/use-scroll-thumb.ts)が DOM から読み、ここは値を受けて答えるだけにする
// (React・DOM なしで収まる・あふれるの境目とつまみの下限を網羅的に確かめるため)

export type ScrollThumb = {
  // 中身が収まっていれば false(棒を出さない)
  visible: boolean
  // トラックに対する割合(0〜1)。CSS 変数へ % にして渡す
  top: number
  size: number
}

// 縦の寸法だけを見る。要素(HTMLElement)をそのまま渡せる
export type ScrollBox = { scrollTop: number; scrollHeight: number; clientHeight: number }

// 棒を出さない時の値。収まっている間は毎回この同じ値を返すので、state に入れても再レンダーを起こさない
export const HIDDEN_THUMB: ScrollThumb = { visible: false, top: 0, size: 1 }

// 中身と窓の高さの差がこの px 以下なら収まっているとみなし、棒を出さない
const OVERFLOW_SLACK = 1
// つまみの長さの下限(トラックに対する割合)。本文がどれだけ長くても、つまみが見える長さを残す
const MIN_THUMB_SIZE = 0.08

export const measureScrollThumb = ({
  scrollTop,
  scrollHeight,
  clientHeight,
}: ScrollBox): ScrollThumb => {
  if (scrollHeight <= clientHeight + OVERFLOW_SLACK) return HIDDEN_THUMB
  const size = Math.max(clientHeight / scrollHeight, MIN_THUMB_SIZE)
  const top = (scrollTop / (scrollHeight - clientHeight)) * (1 - size)
  return { visible: true, top, size }
}

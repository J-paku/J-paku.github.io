// 吹き出しが村の枠(data-village)の左右からはみ出す分だけ、横へ押し戻す量を決める。
// 枠と吹き出しの箱はコンポーネント(TalkBubble/container.tsx)が DOM から測り、ここは値を受けて答えるだけにする
// (React・DOM なしで左右の端と境目を網羅的に確かめるため)

// 横の範囲だけを見る。DOMRect をそのまま渡せる
export type HorizontalSpan = { left: number; right: number }

// 枠の左右の端から内側へ空ける余白(px)
export const FRAME_PADDING = 8

// 要素に書いた --shift の値(「18px」の形)を px の数に直す。まだ書いていない(空)時は 0
export const readShift = (value: string): number => {
  const px = Number.parseFloat(value)
  return Number.isNaN(px) ? 0 : px
}

// 押し戻す量(px)。左へはみ出せば正(右へ押す)、右へはみ出せば負(左へ押す)、収まっていれば 0。
// 枠より広く両側へはみ出す時は左のはみ出しを押し戻す(左を先に見る)。
// 測った吹き出しの箱には今書いてある --shift(current)が乗っている。それを引いた押し戻す前の位置で測るので、
// 押し戻した後に測り直しても同じ量を返す(引かずに測ると、押し戻し済みの箱をはみ出していないと見て 0 へ戻してしまう)
export const shiftBubble = (
  frame: HorizontalSpan,
  bubble: HorizontalSpan,
  current: number
): number => {
  const left = bubble.left - current
  const right = bubble.right - current
  const overflowLeft = frame.left + FRAME_PADDING - left
  const overflowRight = right - (frame.right - FRAME_PADDING)
  return overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0
}

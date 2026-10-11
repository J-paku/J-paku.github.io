// 吹き出しが村の枠(data-village)の左右からはみ出す分だけ、横へ押し戻す量を決める。
// 枠と吹き出しの箱はコンポーネント(TalkBubble/index.tsx)が DOM から測り、ここは値を受けて答えるだけにする
// (React・DOM なしで左右の端と境目を網羅的に確かめるため)

// 横の範囲だけを見る。DOMRect をそのまま渡せる
export type HorizontalSpan = { left: number; right: number }

// 枠の左右の端から内側へ空ける余白(px)
export const FRAME_PADDING = 8

// 押し戻す量(px)。左へはみ出せば正(右へ押す)、右へはみ出せば負(左へ押す)、収まっていれば 0。
// 枠より広く両側へはみ出す時は左のはみ出しを押し戻す(左を先に見る)
export const shiftBubble = (frame: HorizontalSpan, bubble: HorizontalSpan): number => {
  const overflowLeft = frame.left + FRAME_PADDING - bubble.left
  const overflowRight = bubble.right - (frame.right - FRAME_PADDING)
  return overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0
}

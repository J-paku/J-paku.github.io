// 拡大地図で重なった地点の印(✓/? の字 + 番号の札)を実測でずらして離す

// 印(✓/? の字 + 右上の番号の札)どうしに空ける最小の隙間(px)
const BADGE_GAP = 6

type BadgeBox = {
  left: number
  right: number
  top: number
  bottom: number
}

const badgesTouch = (a: BadgeBox, b: BadgeBox) =>
  a.left < b.right + BADGE_GAP &&
  b.left < a.right + BADGE_GAP &&
  a.top < b.bottom + BADGE_GAP &&
  b.top < a.bottom + BADGE_GAP

const centerOf = (box: BadgeBox) => ({
  x: (box.left + box.right) / 2,
  y: (box.top + box.bottom) / 2,
})

// 向き(-1 / +1)へ、a に触れなくなるまで b を動かす量。0 の差は +1(右・下)とみなす
const clearance = (a: BadgeBox, b: BadgeBox, axis: 'x' | 'y', sign: number) => {
  if (axis === 'x') return sign > 0 ? a.right + BADGE_GAP - b.left : a.left - BADGE_GAP - b.right
  return sign > 0 ? a.bottom + BADGE_GAP - b.top : a.top - BADGE_GAP - b.bottom
}

const shifted = (box: BadgeBox, axis: 'x' | 'y', amount: number): BadgeBox =>
  axis === 'x'
    ? { ...box, left: box.left + amount, right: box.right + amount }
    : { ...box, top: box.top + amount, bottom: box.bottom + amount }

const insideBox = (box: BadgeBox, frame: BadgeBox) =>
  box.left >= frame.left &&
  box.right <= frame.right &&
  box.top >= frame.top &&
  box.bottom <= frame.bottom

// 隣り合うマスの地点(AIロボと焚き火など)は印が重なるので、実測で後の番号の印をずらす。
// 印は字と札を合わせた範囲(ボタンの子の外接矩形。札はボタンの外へはみ出す)で測る。
// 印は番号の順(= entries の順)に置き、前の印 a に触れる印 b は a から b へ向かう向きへ押し出す
// (池のように左下にある地点は左下へ逃げ、元の場所の近くに残る)。中心の差の大きい軸を先に試し、
// 地図の外へ出るなら他方の軸へ。どちらも外なら先の軸のまま置く。
// ずらした量はボタンの --nudge-x / --nudge-y へ DOM で直接書く。字・札・押せる範囲がボタンごと一緒に動く
export const arrangeBadges = (canvas: HTMLElement) => {
  const spots = Array.from(canvas.querySelectorAll<HTMLElement>('[data-spot-id]'))
  for (const spot of spots) {
    spot.style.removeProperty('--nudge-x')
    spot.style.removeProperty('--nudge-y')
  }

  // ずらしを外した後に測る(getBoundingClientRect が同期でレイアウトを確定させる)
  const canvasRect = canvas.getBoundingClientRect()
  const frame: BadgeBox = {
    left: canvasRect.left,
    right: canvasRect.right,
    top: canvasRect.top,
    bottom: canvasRect.bottom,
  }
  const placed: BadgeBox[] = []
  for (const spot of spots) {
    const rects = Array.from(spot.children).map(child => child.getBoundingClientRect())
    if (rects.length === 0) continue
    const origin: BadgeBox = {
      left: Math.min(...rects.map(rect => rect.left)),
      right: Math.max(...rects.map(rect => rect.right)),
      top: Math.min(...rects.map(rect => rect.top)),
      bottom: Math.max(...rects.map(rect => rect.bottom)),
    }
    let box = origin
    // ずらす回数は置いた印の数 + 1 までで打ち切る(行き場が無い時に回り続けないため)
    let steps = placed.length + 1
    while (steps > 0) {
      steps -= 1
      const hit = placed.find(other => badgesTouch(other, box))
      if (hit === undefined) break
      const from = centerOf(hit)
      const to = centerOf(box)
      const dx = to.x - from.x
      const dy = to.y - from.y
      const signX = dx < 0 ? -1 : 1
      const signY = dy < 0 ? -1 : 1
      const first = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      const second = first === 'x' ? 'y' : 'x'
      const sign = (axis: 'x' | 'y') => (axis === 'x' ? signX : signY)
      const tryFirst = shifted(box, first, clearance(hit, box, first, sign(first)))
      const trySecond = shifted(box, second, clearance(hit, box, second, sign(second)))
      box = insideBox(tryFirst, frame) || !insideBox(trySecond, frame) ? tryFirst : trySecond
    }
    placed.push(box)
    const nudgeX = box.left - origin.left
    const nudgeY = box.top - origin.top
    if (nudgeX !== 0) spot.style.setProperty('--nudge-x', `${nudgeX}px`)
    if (nudgeY !== 0) spot.style.setProperty('--nudge-y', `${nudgeY}px`)
  }
}

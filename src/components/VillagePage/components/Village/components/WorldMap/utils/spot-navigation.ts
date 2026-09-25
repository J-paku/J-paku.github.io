// 地図の中で方向キーを押した時に、次に焦点を移す地点を決める(空間移動)。
// 画面ではなくマスの座標で比べるので、地図の拡大率に左右されない。
// 地点は id とマスだけを見る(地図の番号付きの一覧 MapEntry も、ワールドの Spot もそのまま渡せる)
import type { Cell, Direction } from '@content/types/world'

type SpotLike = {
  id: string
  cell: Cell
}

type Axis = {
  // 押した向きへ進んだ量。正の地点だけが候補になる
  main: (dx: number, dy: number) => number
  // 押した向きと直交する方向のずれの大きさ
  cross: (dx: number, dy: number) => number
}

const AXES: Record<Direction, Axis> = {
  right: { main: dx => dx, cross: (_dx, dy) => Math.abs(dy) },
  left: { main: dx => -dx, cross: (_dx, dy) => Math.abs(dy) },
  down: { main: (_dx, dy) => dy, cross: dx => Math.abs(dx) },
  up: { main: (_dx, dy) => -dy, cross: dx => Math.abs(dx) },
}

// 直交方向のずれは進む向きの距離の 2 倍で数える。斜めに外れた近い地点より、
// 押した向きへ真っすぐ並んだ地点を選ぶため
const CROSS_WEIGHT = 2

export const spotToward = <T extends SpotLike>(
  spots: readonly T[],
  currentId: string | null,
  direction: Direction
): T | null => {
  const current = spots.find(spot => spot.id === currentId)
  // 地点に焦点が無い(閉じるボタンなど)時は、Tab と同じく最初の地点から始める
  if (current === undefined) return spots[0] ?? null
  const axis = AXES[direction]
  let best: T | null = null
  let bestScore = Infinity
  for (const spot of spots) {
    if (spot.id === current.id) continue
    const dx = spot.cell.x - current.cell.x
    const dy = spot.cell.y - current.cell.y
    const main = axis.main(dx, dy)
    if (main <= 0) continue
    const score = main + axis.cross(dx, dy) * CROSS_WEIGHT
    if (score < bestScore) {
      best = spot
      bestScore = score
    }
  }
  return best
}

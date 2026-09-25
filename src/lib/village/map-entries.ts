// 地図に載せる印の一覧と番号の単一の出どころ。ミニマップ・拡大地図・地図からの移動が同じ番号を使う
import type { Cell, World, WorldSet } from '@content/types/world'

import { doorMarkers, isDoorVisited } from './door-marker'

// id は地点の id(扉の印なら扉の先にある最初のコース地点の id)。number は地図に出す 1 始まりの番号。
// order はコース地点(扉の印を含む)だけが持ち、コース外の地点では undefined
export type MapEntry = { id: string; number: number; cell: Cell; visited: boolean; order?: number }

type Draft = Omit<MapEntry, 'number'>

// 1. この world の order 付き地点と、屋内へ通じる扉の印(扉の先のコース地点の最小 order)を order 昇順で並べる
// 2. その後ろへ、この world の order 無しの地点(池など)を spots の並び順のまま付け足す
// 番号は 1 から通しで振る。扉の印の判定は doorMarkers と同じ基準
export const mapEntries = (
  worldSet: WorldSet,
  world: World,
  visited: ReadonlySet<string>
): MapEntry[] => {
  const spotOrder = new Map(
    Object.values(worldSet.worlds)
      .flatMap(w => w.spots)
      .map(spot => [spot.id, spot.order] as const)
  )
  const doors: Draft[] = doorMarkers(worldSet, world).flatMap(marker => {
    const ordered = marker.spotIds
      .map(id => ({ id, order: spotOrder.get(id) }))
      .filter((ref): ref is { id: string; order: number } => ref.order !== undefined)
      .sort((a, b) => a.order - b.order)
    const first = ordered[0]
    if (first === undefined) return []
    return [
      {
        id: first.id,
        cell: marker.cell,
        visited: isDoorVisited(marker, visited),
        order: first.order,
      },
    ]
  })
  const courseSpots: Draft[] = world.spots.flatMap(spot =>
    spot.order === undefined
      ? []
      : [{ id: spot.id, cell: spot.cell, visited: visited.has(spot.id), order: spot.order }]
  )
  const course = [...courseSpots, ...doors].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const extras: Draft[] = world.spots
    .filter(spot => spot.order === undefined)
    .map(spot => ({ id: spot.id, cell: spot.cell, visited: visited.has(spot.id) }))
  return [...course, ...extras].map((entry, i) => ({ ...entry, number: i + 1 }))
}

// 地図の扉の印。屋内の地点は屋外の地図に載らないので、そこへ通じる扉に地点と同じ ?/v の印を置く
import type { Cell, World, WorldSet } from '@content/types/world'

// id はワープの id。spotIds は扉の先の屋内にあるコース地点(order 付き)
export type DoorMarker = { id: string; cell: Cell; spotIds: readonly string[] }

// 屋内ワールドへ通じるワープのうち、行き先にコース地点が 1 つ以上あるものを印にする。
// 時計のようなコース外の地点は数えない(訪問数・完走判定と同じ基準にそろえる)
export const doorMarkers = (worldSet: WorldSet, world: World): DoorMarker[] =>
  world.warps.flatMap(warp => {
    const target = worldSet.worlds[warp.target.worldId]
    if (target === undefined || target.kind !== 'interior') return []
    const spotIds = target.spots.filter(spot => spot.order !== undefined).map(spot => spot.id)
    return spotIds.length === 0 ? [] : [{ id: warp.id, cell: warp.cell, spotIds }]
  })

// 扉の先のコース地点をすべて訪ねていれば訪問済み
export const isDoorVisited = (marker: DoorMarker, visited: ReadonlySet<string>): boolean =>
  marker.spotIds.every(id => visited.has(id))

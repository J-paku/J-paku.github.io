// 村の統合テストが、地点の並びを差し替えた版の村(worldSet)を組む手と、ワールドから地点を引く手。
// 描く道具(@testing-library/react)は import しない(npm run test:boundary)ので、その版で村を描く手(openAt)は各ファイルの describe に置く
import type { Cell, Spot, World, WorldSet } from '@content/types/world'
import { villageJa } from './village.test-helper'

// 地点の並びを差し替えた版の村。実際のコンテンツでは作れない配置(次の地点が同じマス・歩いて届かない地点・地点の無い町)を作る
export const withSpots = (
  worldId: 'room' | 'town',
  edit: (spots: readonly Spot[]) => Spot[]
): WorldSet => {
  const { worlds } = villageJa.worldSet
  return {
    ...villageJa.worldSet,
    worlds: {
      ...worlds,
      [worldId]: { ...worlds[worldId], spots: edit(worlds[worldId].spots) },
    },
  }
}
// 地点 id の立ち位置だけを cell へ動かした並び
export const moveSpot = (spots: readonly Spot[], id: string, cell: Cell): Spot[] =>
  spots.map(spot => (spot.id === id ? { ...spot, cell } : spot))
// ワールドの地点 id。無ければ投げる
export const spotOf = (world: World, id: string): Spot => {
  const spot = world.spots.find(candidate => candidate.id === id)
  if (spot === undefined) throw new Error(`${world.id} に ${id} の地点が無い`)
  return spot
}

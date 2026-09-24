// 今いるワールドと移動状態を持つ。rAFループからも読めるよう runtime の ref にも書き、出入りはenterWorldに集める
import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Cell, Direction, World, WorldSet } from '@content/types/world'
import { createMoveState } from '@/lib/village/movement'
import type { VillageRuntime } from './village-runtime'

// 添字の型は常に World だが、保存値や移動先 id は実在しないことがあるので存在を確かめる
export const findWorld = (set: WorldSet, id: string): World | null =>
  Object.prototype.hasOwnProperty.call(set.worlds, id) ? set.worlds[id] : null

export type EnterWorld = (id: string, next: World, cell: Cell, facing: Direction) => void

type UseVillageWorld = {
  world: World
  destination: Cell | null
  setDestination: Dispatch<SetStateAction<Cell | null>>
  playerCell: Cell
  setPlayerCell: Dispatch<SetStateAction<Cell>>
  enterWorld: EnterWorld
}

// runtime の world・worldKey・state などは rAF ループが再レンダーを待たずに読む写し。
// ワールドを移ったら runtime.wake で眠っている歩行ループを起こし、新しい場面を描き直させる
export function useVillageWorld(worldSet: WorldSet, runtime: VillageRuntime): UseVillageWorld {
  const startWorld = worldSet.worlds[worldSet.startWorldId]
  const [worldId, setWorldId] = useState<string>(worldSet.startWorldId)
  const world = findWorld(worldSet, worldId) ?? startWorld

  const [destination, setDestination] = useState<Cell | null>(null)
  const [playerCell, setPlayerCell] = useState<Cell>(startWorld.start)

  // ワールドの移動は ref と state を同時に置き換える。持ち越した経路と目的地は捨てる。
  // 歩行ループは新しいタイルが DOM に載るのを待って描き直すので、眠っていれば起こす
  const enterWorld = useCallback(
    (id: string, next: World, cell: Cell, facing: Direction) => {
      runtime.world.current = next
      runtime.worldKey.current = id
      runtime.state.current = { ...createMoveState(next), cell, facing }
      runtime.pendingRoute.current = null
      runtime.pendingFast.current = false
      runtime.destination.current = null
      setDestination(null)
      setWorldId(id)
      setPlayerCell(cell)
      runtime.wake.current()
    },
    [runtime]
  )

  return {
    world,
    destination,
    setDestination,
    playerCell,
    setPlayerCell,
    enterWorld,
  }
}

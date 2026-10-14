// 今いるワールドと移動状態を持つ。rAFループからも読めるよう runtime の ref にも書き、出入りはenterWorldに集める
import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Cell, Direction, World, WorldSet } from '@content/types/world'
import { enterRuntimeWorld, resolveWorld } from '../components/Village/utils/enter-world'
import type { VillageRuntime } from './use-village-runtime'

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
  const world = resolveWorld(worldSet, worldId)

  const [destination, setDestination] = useState<Cell | null>(null)
  const [playerCell, setPlayerCell] = useState<Cell>(startWorld.start)

  // ワールドの移動は ref と state を同時に置き換える。ref の置き換え方は utils/enter-world.ts。
  // 歩行ループは新しいタイルが DOM に載るのを待って描き直すので、眠っていれば起こす
  const enterWorld = useCallback(
    (id: string, next: World, cell: Cell, facing: Direction) => {
      enterRuntimeWorld(runtime, id, next, cell, facing)
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

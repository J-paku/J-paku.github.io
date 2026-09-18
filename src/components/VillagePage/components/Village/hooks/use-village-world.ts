// 今いるワールドと移動状態を持つ。rAFループからも読めるようrefでも保持し、出入りはenterWorldに集める
import { useCallback, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Cell, Direction, World, WorldSet } from '@content/types/world'
import { createMoveState, type MoveState } from '@/lib/village/movement'
import type { SpotRef } from '@/lib/village/spot'

// 添字の型は常に World だが、保存値や移動先 id は実在しないことがあるので存在を確かめる
export const findWorld = (set: WorldSet, id: string): World | null =>
  Object.prototype.hasOwnProperty.call(set.worlds, id) ? set.worlds[id] : null

export type EnterWorld = (id: string, next: World, cell: Cell, facing: Direction) => void

type UseVillageWorld = {
  startWorld: World
  world: World
  worldRef: RefObject<World>
  worldKeyRef: RefObject<string>
  stateRef: RefObject<MoveState>
  destinationRef: RefObject<Cell | null>
  pendingRouteRef: RefObject<Cell[] | null>
  pendingFastRef: RefObject<boolean>
  // 別ワールドの地点へ向かう途中。扉を出た所で目的地と案内を立て直すまで持つ
  pendingGoalRef: RefObject<SpotRef | null>
  // 次へボタンで出発した時だけ true。到着で会話窓を自動で開く
  autoTalkRef: RefObject<boolean>
  destination: Cell | null
  setDestination: Dispatch<SetStateAction<Cell | null>>
  playerCell: Cell
  setPlayerCell: Dispatch<SetStateAction<Cell>>
  enterWorld: EnterWorld
}

export function useVillageWorld(worldSet: WorldSet): UseVillageWorld {
  const startWorld = worldSet.worlds[worldSet.startWorldId]
  const [worldId, setWorldId] = useState<string>(worldSet.startWorldId)
  const world = findWorld(worldSet, worldId) ?? startWorld

  // rAF ループは再レンダーを待たずに今のワールドを見る必要があるので ref でも持つ。
  // id ではなく worlds の鍵で覚える(保存・復元はこの鍵で引く)
  const worldRef = useRef<World>(startWorld)
  const worldKeyRef = useRef<string>(worldSet.startWorldId)
  const stateRef = useRef<MoveState>(createMoveState(startWorld))
  const destinationRef = useRef<Cell | null>(null)
  const pendingRouteRef = useRef<Cell[] | null>(null)
  const pendingFastRef = useRef(false)
  const pendingGoalRef = useRef<SpotRef | null>(null)
  const autoTalkRef = useRef(false)

  const [destination, setDestination] = useState<Cell | null>(null)
  const [playerCell, setPlayerCell] = useState<Cell>(startWorld.start)

  // ワールドの移動は ref と state を同時に置き換える。持ち越した経路と目的地は捨てる
  const enterWorld = useCallback((id: string, next: World, cell: Cell, facing: Direction) => {
    worldRef.current = next
    worldKeyRef.current = id
    stateRef.current = { ...createMoveState(next), cell, facing }
    pendingRouteRef.current = null
    pendingFastRef.current = false
    destinationRef.current = null
    setDestination(null)
    setWorldId(id)
    setPlayerCell(cell)
  }, [])

  return {
    startWorld,
    world,
    worldRef,
    worldKeyRef,
    stateRef,
    destinationRef,
    pendingRouteRef,
    pendingFastRef,
    pendingGoalRef,
    autoTalkRef,
    destination,
    setDestination,
    playerCell,
    setPlayerCell,
    enterWorld,
  }
}

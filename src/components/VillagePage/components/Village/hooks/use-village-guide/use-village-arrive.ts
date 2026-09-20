// 到着マスと衝突の後始末。ワープ・会話地点・目的地を判定し、位置の保存と案内文の差し替えまでを持つ。
// 会話地点・案内文・目印の入れ物は入口フックの持ち物で、ここは受け取った ref と setState へ書くだけ
import { useCallback, useRef } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Cell, Spot, VillageText, World, WorldSet } from '@content/types/world'
import type { MoveState } from '@/lib/village/movement'
import { findPath } from '@/lib/village/path'
import { spotAt } from '@/lib/village/spot'
import { warpAt } from '@/lib/village/warp'
import { writePosition } from '@/lib/preferences'
import type { SpotRef } from '@/lib/village/spot'
import { findWorld, type EnterWorld } from '../use-village-world'
import type { VillageActions } from '../use-village-input'
import { defaultSpeech } from './default-speech'

type VillageArriveOptions = {
  worldSet: WorldSet
  text: VillageText
  worldRef: RefObject<World>
  worldKeyRef: RefObject<string>
  stateRef: RefObject<MoveState>
  destinationRef: RefObject<Cell | null>
  pendingGoalRef: RefObject<SpotRef | null>
  pendingRouteRef: RefObject<Cell[] | null>
  pendingFastRef: RefObject<boolean>
  autoTalkRef: RefObject<boolean>
  actionsRef: RefObject<VillageActions>
  activeSpotRef: RefObject<Spot | null>
  coarseRef: RefObject<boolean>
  setDestination: Dispatch<SetStateAction<Cell | null>>
  setPlayerCell: Dispatch<SetStateAction<Cell>>
  setActiveSpot: Dispatch<SetStateAction<Spot | null>>
  setSpeech: Dispatch<SetStateAction<string>>
  setLocatorVisible: Dispatch<SetStateAction<boolean>>
  enterWorld: EnterWorld
}

type UseVillageArrive = {
  arrive: (cell: Cell) => void
  bump: (cell: Cell) => void
}

export function useVillageArrive({
  worldSet,
  text,
  worldRef,
  worldKeyRef,
  stateRef,
  destinationRef,
  pendingGoalRef,
  pendingRouteRef,
  pendingFastRef,
  autoTalkRef,
  actionsRef,
  activeSpotRef,
  coarseRef,
  setDestination,
  setPlayerCell,
  setActiveSpot,
  setSpeech,
  setLocatorVisible,
  enterWorld,
}: VillageArriveOptions): UseVillageArrive {
  const locatorHiddenRef = useRef(false)

  // 到着マスでワープ・会話地点・目的地を判定し、位置を保存する
  const arrive = useCallback(
    (cell: Cell) => {
      // 最初の到着で目印は役目を終える(以後は出さない)
      if (!locatorHiddenRef.current) {
        locatorHiddenRef.current = true
        setLocatorVisible(false)
      }
      const here = worldRef.current
      const warp = warpAt(here, cell)
      const target = warp === null ? null : findWorld(worldSet, warp.target.worldId)
      if (warp !== null && target !== null) {
        // ワープした先では地点判定をしない(降り立つマスは通路として扱う)
        enterWorld(warp.target.worldId, target, warp.target.cell, warp.target.facing)
        activeSpotRef.current = null
        setActiveSpot(null)
        writePosition(worldSet.id, {
          worldId: warp.target.worldId,
          cell: warp.target.cell,
          facing: warp.target.facing,
        })
        // 別ワールドの地点へ向かう途中なら、扉を出た所で目的地と案内を立て直す
        const goal = pendingGoalRef.current
        if (goal !== null && goal.worldId === warp.target.worldId) {
          pendingGoalRef.current = null
          destinationRef.current = goal.spot.cell
          setDestination(goal.spot.cell)
          setSpeech(text.headTo.replace('{place}', text.stops[goal.spot.id].place))
          // 次へボタンの自動歩行が続いている時だけ、到着ワールドの経路を作り直す(利用者が途中で割り込んだら目的地の印と案内だけ残す)
          if (autoTalkRef.current) {
            const route = findPath(target, warp.target.cell, goal.spot.cell)
            if (route !== null && route.length > 0) {
              pendingRouteRef.current = route
              pendingFastRef.current = true
            }
          }
          return
        }
        setSpeech(defaultSpeech(target, text, coarseRef.current))
        return
      }
      writePosition(worldSet.id, {
        worldId: worldKeyRef.current,
        cell,
        facing: stateRef.current.facing,
      })
      setPlayerCell(cell)
      const goal = destinationRef.current
      if (goal !== null && goal.x === cell.x && goal.y === cell.y) {
        destinationRef.current = null
        setDestination(null)
      }
      const spot = spotAt(here, cell)
      activeSpotRef.current = spot
      setActiveSpot(spot)
      // 地点への呼びかけは物の上の吹き出しが出す。会話窓は目的地の案内か既定文
      // 目的地の地点。別ワールドの地点へ扉を目指して歩いている間も、その案内を保つ
      const goalSpot =
        (destinationRef.current === null ? null : spotAt(here, destinationRef.current)) ??
        pendingGoalRef.current?.spot ??
        null
      setSpeech(
        goalSpot === null
          ? defaultSpeech(here, text, coarseRef.current)
          : text.headTo.replace('{place}', text.stops[goalSpot.id].place)
      )
      // 次へボタンで歩いてきた到着なら、会話窓を自動で開く。利用者が自分で歩いた到着では開かない
      if (autoTalkRef.current && goal !== null && goal.x === cell.x && goal.y === cell.y) {
        autoTalkRef.current = false
        if (spot !== null) actionsRef.current.onTalk()
      }
      // 追加の依存は入口フックが持つ ref と setState で、描画をまたいでも同じ実体。作り直す回数は分割前と同じ
    },
    [
      worldSet,
      text,
      enterWorld,
      worldRef,
      worldKeyRef,
      stateRef,
      setPlayerCell,
      destinationRef,
      pendingGoalRef,
      pendingRouteRef,
      pendingFastRef,
      autoTalkRef,
      actionsRef,
      activeSpotRef,
      coarseRef,
      setDestination,
      setActiveSpot,
      setSpeech,
      setLocatorVisible,
    ]
  )

  // 通れないマスへぶつかっても向きが変わるだけ。会話地点に立っていれば地点を立て直す
  const bump = useCallback(
    (cell: Cell) => {
      // 壁の扉へぶつかったらワープ(到着扱いにする)
      if (warpAt(worldRef.current, cell) !== null) {
        arrive(cell)
        return
      }
      const spot = spotAt(worldRef.current, stateRef.current.cell)
      if (spot === null) return
      activeSpotRef.current = spot
      setActiveSpot(spot)
    },
    [arrive, worldRef, stateRef, activeSpotRef, setActiveSpot]
  )

  return { arrive, bump }
}

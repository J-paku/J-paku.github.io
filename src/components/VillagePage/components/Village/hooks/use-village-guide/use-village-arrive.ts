// 到着マスと衝突の後始末。ワープ・会話地点・目的地を判定し、位置の保存と案内文の差し替えまでを持つ。
// 会話地点・案内文・目印の入れ物は入口フックと runtime の持ち物で、ここは受け取った ref と setState へ書くだけ
import { useCallback, useRef } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Cell, Spot, VillageText, WorldSet } from '@content/types/world'
import { findPath } from '@/lib/village/path'
import { spotAt } from '@/lib/village/spot'
import { warpAt } from '@/lib/village/warp'
import { writePosition } from '@/lib/preferences'
import { findWorld, type EnterWorld } from '../use-village-world'
import type { VillageRuntime } from '../use-village-runtime'
import { pickDefaultSpeech } from '../../utils/pick-default-speech'

type VillageArriveOptions = {
  worldSet: WorldSet
  text: VillageText
  runtime: VillageRuntime
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
  runtime,
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
      const here = runtime.world.current
      const warp = warpAt(here, cell)
      const target = warp === null ? null : findWorld(worldSet, warp.target.worldId)
      if (warp !== null && target !== null) {
        // ワープした先では地点判定をしない(降り立つマスは通路として扱う)
        enterWorld(warp.target.worldId, target, warp.target.cell, warp.target.facing)
        runtime.activeSpot.current = null
        setActiveSpot(null)
        writePosition(worldSet.id, {
          worldId: warp.target.worldId,
          cell: warp.target.cell,
          facing: warp.target.facing,
        })
        // 別ワールドの地点へ向かう途中なら、扉を出た所で目的地と案内を立て直す
        const goal = runtime.pendingGoal.current
        if (goal !== null && goal.worldId === warp.target.worldId) {
          runtime.pendingGoal.current = null
          runtime.destination.current = goal.spot.cell
          setDestination(goal.spot.cell)
          setSpeech(text.headTo.replace('{place}', text.stops[goal.spot.id].place))
          // 次へボタンの自動歩行が続いている時だけ、到着ワールドの経路を作り直す(利用者が途中で割り込んだら目的地の印と案内だけ残す)
          if (runtime.autoTalk.current) {
            const route = findPath(target, warp.target.cell, goal.spot.cell)
            if (route !== null && route.length > 0) {
              runtime.pendingRoute.current = route
              runtime.pendingFast.current = true
            }
          }
          return
        }
        setSpeech(pickDefaultSpeech(target, text, coarseRef.current))
        return
      }
      writePosition(worldSet.id, {
        worldId: runtime.worldKey.current,
        cell,
        facing: runtime.state.current.facing,
      })
      setPlayerCell(cell)
      const goal = runtime.destination.current
      if (goal !== null && goal.x === cell.x && goal.y === cell.y) {
        runtime.destination.current = null
        setDestination(null)
      }
      const spot = spotAt(here, cell)
      const previousSpot = runtime.activeSpot.current
      runtime.activeSpot.current = spot
      setActiveSpot(spot)
      // 地点への呼びかけは物の上の吹き出しが出す。会話窓は目的地の案内か既定文
      // 目的地の地点。別ワールドの地点へ扉を目指して歩いている間も、その案内を保つ
      const goalSpot =
        (runtime.destination.current === null ? null : spotAt(here, runtime.destination.current)) ??
        runtime.pendingGoal.current?.spot ??
        null
      setSpeech(
        goalSpot === null
          ? pickDefaultSpeech(here, text, coarseRef.current)
          : text.headTo.replace('{place}', text.stops[goalSpot.id].place)
      )
      // 出口の範囲に入った時、または次へで目的地に着いた時に開く。
      // 閉じた後に同じ出口内で横へ動いても繰り返し開かない
      if (
        (spot?.arrivalArea !== undefined && previousSpot?.id !== spot.id) ||
        (runtime.autoTalk.current && goal !== null && goal.x === cell.x && goal.y === cell.y)
      ) {
        runtime.autoTalk.current = false
        if (spot !== null) runtime.actions.current.onTalk()
      }
      // 追加の依存は runtime と入口フックが持つ ref・setState で、描画をまたいでも同じ実体。作り直す回数は分割前と同じ
    },
    [
      worldSet,
      text,
      enterWorld,
      runtime,
      setPlayerCell,
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
      if (warpAt(runtime.world.current, cell) !== null) {
        arrive(cell)
        return
      }
      const spot = spotAt(runtime.world.current, runtime.state.current.cell)
      if (spot === null) return
      runtime.activeSpot.current = spot
      setActiveSpot(spot)
    },
    [arrive, runtime, setActiveSpot]
  )

  return { arrive, bump }
}

// 到着・衝突の結果を会話地点・案内文・訪問済みへ反映する。保存した位置と訪問はマウント後にここで戻す
// ただし再読み込み(本当のページ読み込み)では最初からやり直す
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Cell, Spot, VillageText, World, WorldSet } from '@content/types/world'
import type { MoveState } from '@/lib/village/movement'
import { isWalkable } from '@/lib/village/collision'
import { spotAt } from '@/lib/village/spot'
import { warpAt } from '@/lib/village/warp'
import { clearVillageProgress, readPosition, readVisited, writePosition } from '@/lib/preferences'
import type { SpotRef } from '@/lib/village/spot'
import { findWorld, type EnterWorld } from './use-village-world'

const EMPTY_VISITED: ReadonlySet<string> = new Set<string>()

// モジュール変数。ページを読み込み直すと false から始まるので、その回の最初のマウントだけ保存を捨てられる。
// アプリ内の画面移動では JS の文脈が残り true のままなので、作品ページから村へ戻った時は復元される
let restoredThisLoad = false

// 会話地点でも目的地でもない時の既定文。屋内は出口案内、屋外は操作案内
const defaultSpeech = (world: World, text: VillageText): string =>
  world.kind === 'interior' ? text.exitHint : text.hint

export type VillageGuideOptions = {
  worldSet: WorldSet
  text: VillageText
  startWorld: World
  worldRef: RefObject<World>
  worldKeyRef: RefObject<string>
  stateRef: RefObject<MoveState>
  destinationRef: RefObject<Cell | null>
  pendingGoalRef: RefObject<SpotRef | null>
  setDestination: Dispatch<SetStateAction<Cell | null>>
  setPlayerCell: Dispatch<SetStateAction<Cell>>
  enterWorld: EnterWorld
}

type UseVillageGuide = {
  visitedRef: RefObject<ReadonlySet<string>>
  activeSpotRef: RefObject<Spot | null>
  visited: ReadonlySet<string>
  setVisited: Dispatch<SetStateAction<ReadonlySet<string>>>
  activeSpot: Spot | null
  speech: string
  setSpeech: Dispatch<SetStateAction<string>>
  reduceMotion: boolean
  locatorVisible: boolean
  arrive: (cell: Cell) => void
  bump: (cell: Cell) => void
}

export function useVillageGuide({
  worldSet,
  text,
  startWorld,
  worldRef,
  worldKeyRef,
  stateRef,
  destinationRef,
  pendingGoalRef,
  setDestination,
  setPlayerCell,
  enterWorld,
}: VillageGuideOptions): UseVillageGuide {
  const visitedRef = useRef<ReadonlySet<string>>(EMPTY_VISITED)
  const activeSpotRef = useRef<Spot | null>(null)
  const locatorHiddenRef = useRef(false)

  const [visited, setVisited] = useState<ReadonlySet<string>>(EMPTY_VISITED)
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null)
  const [speech, setSpeech] = useState<string>(defaultSpeech(startWorld, text))
  const [reduceMotion, setReduceMotion] = useState(false)
  const [locatorVisible, setLocatorVisible] = useState(true)

  // 位置と訪問はマウント後に読む。サーバ描画は常に開始ワールドの start で、ずれを起こさない
  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    // 読み込み直後の最初のマウントは保存を捨て、開始地点からやり直す
    const isFirstMountOfLoad = !restoredThisLoad
    restoredThisLoad = true
    if (isFirstMountOfLoad) clearVillageProgress(worldSet.id)
    const saved = isFirstMountOfLoad ? null : readPosition(worldSet.id)
    const savedWorld = saved === null ? null : findWorld(worldSet, saved.worldId)
    const restore =
      saved !== null && savedWorld !== null && isWalkable(savedWorld, saved.cell)
        ? { id: saved.worldId, world: savedWorld, cell: saved.cell, facing: saved.facing }
        : {
            id: worldSet.startWorldId,
            world: startWorld,
            cell: startWorld.start,
            facing: startWorld.startFacing,
          }
    enterWorld(restore.id, restore.world, restore.cell, restore.facing)
    const restored: ReadonlySet<string> = isFirstMountOfLoad
      ? EMPTY_VISITED
      : new Set(readVisited(worldSet.id))
    visitedRef.current = restored
    setVisited(restored)
    const spot = spotAt(restore.world, restore.cell)
    activeSpotRef.current = spot
    setActiveSpot(spot)
    setSpeech(defaultSpeech(restore.world, text))
  }, [worldSet, startWorld, text, enterWorld])

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
          return
        }
        setSpeech(defaultSpeech(target, text))
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
          ? defaultSpeech(here, text)
          : text.headTo.replace('{place}', text.stops[goalSpot.id].place)
      )
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
      setDestination,
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
    [arrive, worldRef, stateRef]
  )

  return {
    visitedRef,
    activeSpotRef,
    visited,
    setVisited,
    activeSpot,
    speech,
    setSpeech,
    reduceMotion,
    locatorVisible,
    arrive,
    bump,
  }
}

// 保存した位置と訪問をマウント後に戻す。ただし再読み込み(本当のページ読み込み)では最初からやり直す。
// 呼ぶ順は入力と rAF の間(AGENTS.md 2)。この effect が歩行ループより先に登録されることが前提
import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Spot, VillageText, World, WorldSet } from '@content/types/world'
import { isWalkable } from '@/lib/village/collision'
import { spotAt } from '@/lib/village/spot'
import { clearVillageProgress, readPosition, readVisited } from '@/lib/preferences'
import { findWorld, type EnterWorld } from '../use-village-world'
import type { VillageRuntime } from '../use-village-runtime'
import { pickDefaultSpeech } from '../../utils/pick-default-speech'

// 空の訪問済み。初期値と「読み込み直後」で同じ実体を使い、無駄な再描画を起こさない
export const EMPTY_VISITED: ReadonlySet<string> = new Set<string>()

// モジュール変数。ページを読み込み直すと false から始まるので、その回の最初のマウントだけ保存を捨てられる。
// アプリ内の画面移動では JS の文脈が残り true のままなので、作品ページから村へ戻った時は復元される。
// この旗はこのモジュールだけが持つ。写しを別ファイルへ作ると1回の読み込みに旗が2つ並び、
// どちらもまだ false なせいで「その回の最初のマウント」が二度成立して、戻すべき保存を捨ててしまう
let restoredThisLoad = false

type VillageRestoreOptions = {
  worldSet: WorldSet
  text: VillageText
  startWorld: World
  // 戻した訪問済みと会話地点を runtime の visited・activeSpot にも書く
  runtime: VillageRuntime
  coarseRef: RefObject<boolean>
  setVisited: Dispatch<SetStateAction<ReadonlySet<string>>>
  setActiveSpot: Dispatch<SetStateAction<Spot | null>>
  setSpeech: Dispatch<SetStateAction<string>>
  setCoarse: Dispatch<SetStateAction<boolean>>
  setReduceMotion: Dispatch<SetStateAction<boolean>>
  enterWorld: EnterWorld
}

export function useVillageRestore({
  worldSet,
  text,
  startWorld,
  runtime,
  coarseRef,
  setVisited,
  setActiveSpot,
  setSpeech,
  setCoarse,
  setReduceMotion,
  enterWorld,
}: VillageRestoreOptions): void {
  // 位置と訪問はマウント後に読む。サーバ描画は常に開始ワールドの start で、ずれを起こさない
  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const isCoarse = window.matchMedia('(pointer: coarse)').matches
    coarseRef.current = isCoarse
    setCoarse(isCoarse)
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
    runtime.visited.current = restored
    setVisited(restored)
    const spot = spotAt(restore.world, restore.cell)
    runtime.activeSpot.current = spot
    setActiveSpot(spot)
    setSpeech(pickDefaultSpeech(restore.world, text, coarseRef.current))
    // 追加の依存は runtime と入口フックが持つ ref・setState で、描画をまたいでも同じ実体。走る回数は分割前と同じ
  }, [
    worldSet,
    startWorld,
    text,
    enterWorld,
    runtime,
    coarseRef,
    setVisited,
    setActiveSpot,
    setSpeech,
    setCoarse,
    setReduceMotion,
  ])
}

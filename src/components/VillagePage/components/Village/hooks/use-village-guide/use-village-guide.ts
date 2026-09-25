// 到着・衝突の結果を会話地点・案内文・訪問済みへ反映する。この入口は入れ物(state と coarse の ref)を持つだけで、
// 訪問済み・会話地点の ref は runtime にある。保存からの復元は use-village-restore、到着と衝突の判定は use-village-arrive が受け持つ
import { useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Cell, Spot, VillageText, World, WorldSet } from '@content/types/world'
import type { EnterWorld } from '../use-village-world'
import type { VillageRuntime } from '../use-village-runtime'
import { pickDefaultSpeech } from '../../utils/pick-default-speech'
import { useVillageArrive } from './use-village-arrive'
import { EMPTY_VISITED, useVillageRestore } from './use-village-restore'

export type VillageGuideOptions = {
  worldSet: WorldSet
  text: VillageText
  startWorld: World
  runtime: VillageRuntime
  setDestination: Dispatch<SetStateAction<Cell | null>>
  setPlayerCell: Dispatch<SetStateAction<Cell>>
  enterWorld: EnterWorld
}

type UseVillageGuide = {
  visited: ReadonlySet<string>
  setVisited: Dispatch<SetStateAction<ReadonlySet<string>>>
  // タッチ端末か(pointer: coarse)。枠の aria-label の案内文を切り替える
  coarse: boolean
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
  runtime,
  setDestination,
  setPlayerCell,
  enterWorld,
}: VillageGuideOptions): UseVillageGuide {
  const [visited, setVisited] = useState<ReadonlySet<string>>(EMPTY_VISITED)
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null)
  // サーバ描画はキーボード向けの案内。タッチ判定は window が要るのでマウント後に立てる
  const coarseRef = useRef(false)
  const [coarse, setCoarse] = useState(false)
  const [speech, setSpeech] = useState<string>(pickDefaultSpeech(startWorld, text, false))
  const [reduceMotion, setReduceMotion] = useState(false)
  const [locatorVisible, setLocatorVisible] = useState(true)

  // 復元は必ずここで(条件を付けず)呼ぶ。入力と rAF の間に effect を登録する約束を崩さない(AGENTS.md 2)
  useVillageRestore({
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
  })

  const { arrive, bump } = useVillageArrive({
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
  })

  return {
    visited,
    setVisited,
    // タッチ端末か。枠の aria-label の案内文を切り替える
    coarse,
    activeSpot,
    speech,
    setSpeech,
    reduceMotion,
    locatorVisible,
    arrive,
    bump,
  }
}

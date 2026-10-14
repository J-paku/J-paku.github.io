// A/B ボタンの行き先を決める。画面の A/B・キーボードの Z/X・窓の次へボタンが同じ手を読む
import { useCallback, useEffect } from 'react'
import type { Spot, WorldSet } from '@content/types/world'
import { nextSpot } from '@/lib/village/spot'
import type { VillageRuntime } from './use-village-runtime'

export type VillageButtonsOptions = {
  mode: 'walk' | 'talk' | 'map' | 'clock' | 'fishing'
  activeSpot: Spot | null
  worldSet: WorldSet
  openTalk: () => void
  goNext: () => void
  closeOverlay: () => void
  // キーボードの Z/X が ref 越しに呼ぶ A/B をここへ書く
  runtime: VillageRuntime
}

type UseVillageButtons = {
  hasNext: boolean
  onNext: () => void
  pressA: () => void
  pressB: () => void
}

export function useVillageButtons({
  mode,
  activeSpot,
  worldSet,
  openTalk,
  goNext,
  closeOverlay,
  runtime,
}: VillageButtonsOptions): UseVillageButtons {
  // A/B は重ね表示の手(openTalk・goNext・closeOverlay)を使うので、その後に置く。
  // 画面の A・キーボードの Z・窓の次へボタンが同じ行き先を読む
  const hasNext = mode === 'talk' && activeSpot !== null && nextSpot(worldSet, activeSpot) !== null
  const onNext = goNext
  const pressA = useCallback(() => {
    // 話せる相手がいない時は openTalk 自身が「考え事」の一言を出す
    if (mode === 'walk') {
      openTalk()
      return
    }
    // 会話窓・時計の設定窓・釣りの窓の中のボタン・リンクへ焦点が移っていれば、そこを押す。
    // 地図も同じ窓(role='dialog')なので、スティックで焦点を移した地点のボタンをここで押す。
    // スティックで本文を送り切った先(次へ・閉じる・本文のリンク)を A で決定できるようにする。
    // 画面の A/B ボタン自身は押下でフォーカスを奪わない(preventFocusSteal)ので、ここには入らない
    const active = document.activeElement
    if (
      (active instanceof HTMLButtonElement || active instanceof HTMLAnchorElement) &&
      active.closest('[role="dialog"]') !== null
    ) {
      active.click()
      return
    }
    if (hasNext) onNext()
  }, [mode, hasNext, onNext, openTalk])

  // 歩いている時以外は重ね表示が開いているので、B はそれを閉じる。
  // 釣りは窓が出ていない間(投げてからかかるまで)も mode が fishing のままなので、B で中断できる
  const pressB = useCallback(() => {
    if (mode !== 'walk') closeOverlay()
  }, [mode, closeOverlay])

  // キーボードの Z/X は ref 越しに呼ぶので、A/B が作り直されたら入れ替える
  useEffect(() => {
    runtime.buttons.current = { onA: pressA, onB: pressB }
  }, [pressA, pressB, runtime])

  return { hasNext, onNext, pressA, pressB }
}

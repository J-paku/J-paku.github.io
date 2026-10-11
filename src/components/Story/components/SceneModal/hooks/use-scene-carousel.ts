// SceneModalの場面送り(表示中index・一時停止・合図パルス・自動送り・境界でのフォーカス退避)を担う。
// 端・送り先・自動送りの待ち・フォーカスの逃がし先の判定は utils(step-scene・rescue-focus)と
// @/utils/cycle-scenes に置き、ここは state・タイマー・ボタンの要素を持つ配線だけにする
import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { WorkStoryScene } from '@content/types/content'
import { nextSceneIndex } from '@/utils/cycle-scenes'
import { focusAfterStep, focusedNav, focusOnAutoAdvance } from '../utils/rescue-focus'
import type { SceneControl } from '../utils/rescue-focus'
import {
  autoAdvanceDelayMs,
  nextSceneTarget,
  prevSceneTarget,
  sceneEdges,
} from '../utils/step-scene'

type UseSceneCarouselParams = {
  scenes: WorkStoryScene[]
  initialIndex: number
  closeButtonRef: RefObject<HTMLButtonElement | null>
  prevButtonRef: RefObject<HTMLButtonElement | null>
  nextButtonRef: RefObject<HTMLButtonElement | null>
}

export function useSceneCarousel({
  scenes,
  initialIndex,
  closeButtonRef,
  prevButtonRef,
  nextButtonRef,
}: UseSceneCarouselParams) {
  // 開始場面から先はこのコンポーネント内部の状態として持つ。呼び出し側が毎回モーダルを
  // 再マウントする構成(WorkStory側の条件レンダリング)のため、初期値としてのみ使えばよい
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const scene = scenes[activeIndex]
  const { isFirst, isLast } = sceneEdges(activeIndex, scenes.length)

  // 一時停止フラグ(WCAG 2.2.2 対応)。場面の自動送りと、場面SVG内部のアニメーションの
  // 両方を止める — 送りだけ止めても絵が動き続けると「止まっていない」としか見えないため。
  // activeIndex とは独立した state なので、手動での場面送り(handlePrev/handleNext)を
  // 挟んでも一時停止状態はそのまま保持される
  const [isAutoAdvancePaused, setIsAutoAdvancePaused] = useState(false)

  // タップのたびに「今の操作」を短く出すための鍵。key を変えて要素を作り直すことで
  // 同じアニメーションを毎回頭から再生させる(CSSアニメーションは再代入では再生されない)
  const [pulseKey, setPulseKey] = useState(0)

  // 逃がし先の判定(utils/rescue-focus.ts)が答えたボタンへフォーカスを移す。null なら動かさない。
  // 遷移先の境界(先頭/末尾)でクリック元のボタンが disabled になる場合に先回りで移すためのもの。
  // disabled 化はレンダーの DOM 反映と同期してブラウザが行うため、useEffect で
  // 事後に document.activeElement を見て検知しようとしても、その時点で既に
  // フォーカスは document.body へ落ちた後で判定条件に一致せず検知できない
  // (disabled要素はフォーカスを保持できない)。そのため click ハンドラ・自動送りのタイマーの中で
  // 遷移前に判定してフォーカスを動かす
  const focusControl = useCallback(
    (control: SceneControl | null) => {
      if (control === null) return
      const refs = { prev: prevButtonRef, next: nextButtonRef, close: closeButtonRef }
      refs[control].current?.focus()
    },
    [closeButtonRef, nextButtonRef, prevButtonRef]
  )

  // 今の場面のアニメーション周期が経過したら次の場面へ自動送りする。
  // activeIndex を effect の依存にしているため、手動prev/nextでactiveIndexが変わった時も
  // 同じ effect が発火し直し、新しい場面の周期でタイマーが再設定される
  // (手動操作用に別途タイマーをリセットする処理は不要)。
  // ScenePlayer 側は活性化のたびにSVGを組み直すため(該当コンポーネントのコメント参照)、
  // 表示され始めた場面のアニメーションは常に0から再生される — このタイマーの周期と自然に同期する
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // reduced motion環境と、ユーザーが一時停止トグルを操作している間(WCAG 2.2.2 の停止手段)は送らない
    const delayMs = autoAdvanceDelayMs(scene.id, prefersReducedMotion, isAutoAdvancePaused)
    if (delayMs === null) return

    const timerId = window.setTimeout(() => {
      const nextIndex = nextSceneIndex(activeIndex, scenes.length)
      const focused = focusedNav(
        document.activeElement,
        prevButtonRef.current,
        nextButtonRef.current
      )
      focusControl(focusOnAutoAdvance(nextIndex, scenes.length, focused))
      setActiveIndex(nextIndex)
    }, delayMs)

    return () => window.clearTimeout(timerId)
  }, [
    activeIndex,
    scene.id,
    scenes.length,
    isAutoAdvancePaused,
    focusControl,
    prevButtonRef,
    nextButtonRef,
  ])

  function handlePrev() {
    const target = prevSceneTarget(activeIndex)
    if (target === null) return
    focusControl(focusAfterStep(target, scenes.length))
    setActiveIndex(target)
  }

  function handleNext() {
    const target = nextSceneTarget(activeIndex, scenes.length)
    if (target === null) return
    focusControl(focusAfterStep(target, scenes.length))
    setActiveIndex(target)
  }

  function handleToggleAutoAdvance() {
    setIsAutoAdvancePaused(prev => !prev)
    setPulseKey(prev => prev + 1)
  }

  return {
    activeIndex,
    scene,
    isFirst,
    isLast,
    isAutoAdvancePaused,
    pulseKey,
    handlePrev,
    handleNext,
    handleToggleAutoAdvance,
  }
}

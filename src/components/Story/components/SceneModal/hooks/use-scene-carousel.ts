// SceneModalの場面送り(表示中index・一時停止・合図パルス・自動送り・境界でのフォーカス退避)を担う
import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { WorkStoryScene } from '@content/types/content'
import {
  SCENE_ANIMATION_DURATIONS_MS,
  DEFAULT_SCENE_ANIMATION_DURATION_MS,
} from '@/utils/scene-durations'

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
  const isFirst = activeIndex === 0
  const isLast = activeIndex === scenes.length - 1

  // 一時停止フラグ(WCAG 2.2.2 対応)。場面の自動送りと、場面SVG内部のアニメーションの
  // 両方を止める — 送りだけ止めても絵が動き続けると「止まっていない」としか見えないため。
  // activeIndex とは独立した state なので、手動での場面送り(handlePrev/handleNext)を
  // 挟んでも一時停止状態はそのまま保持される
  const [isAutoAdvancePaused, setIsAutoAdvancePaused] = useState(false)

  // タップのたびに「今の操作」を短く出すための鍵。key を変えて要素を作り直すことで
  // 同じアニメーションを毎回頭から再生させる(CSSアニメーションは再代入では再生されない)
  const [pulseKey, setPulseKey] = useState(0)

  // 遷移先の境界(先頭/末尾)でクリック元のボタンが disabled になる場合、
  // フォーカスを有効な別のナビゲーションボタン→閉じるボタンの順で先回りして移す。
  // disabled 化はレンダーの DOM 反映と同期してブラウザが行うため、useEffect で
  // 事後に document.activeElement を見て検知しようとしても、その時点で既に
  // フォーカスは document.body へ落ちた後で判定条件に一致せず検知できない
  // (disabled要素はフォーカスを保持できない)。そのため click ハンドラ内で
  // 遷移前に判定してフォーカスを動かす
  const focusAwayFromDisabledNav = useCallback(
    (nextIsFirst: boolean, nextIsLast: boolean) => {
      if (nextIsFirst) {
        if (nextIsLast) closeButtonRef.current?.focus()
        else nextButtonRef.current?.focus()
      } else if (nextIsLast) {
        prevButtonRef.current?.focus()
      }
    },
    [closeButtonRef, nextButtonRef, prevButtonRef]
  )

  // 自動送りタイマー起点のフォーカス退避。手動クリック(focusAwayFromDisabledNav)と違い、
  // 遷移直前に disabled 化されるボタンへ実際にフォーカスが乗っている場合だけ動かす。
  // 無条件に動かすと、閉じるボタン等どこにフォーカスがあってもタイマーが奪ってしまう。
  // nextIsFirst(末尾→先頭への折り返し)のときだけ closeButtonRef へ直接逃がす —
  // 逃避先の次へボタンは、この時点ではまだ状態未コミットで末尾のまま disabled のため
  // focus() が無視される(常に有効な閉じるボタンなら確実に受け取れる)。
  // nextIsLast(先頭→末尾側)の逃避先(前へボタン)は遷移前から有効なので従来どおり委譲する
  const focusAwayFromDisabledNavOnAutoAdvance = useCallback(
    (nextIsFirst: boolean, nextIsLast: boolean) => {
      const disablingButton = nextIsFirst
        ? prevButtonRef.current
        : nextIsLast
          ? nextButtonRef.current
          : null
      if (disablingButton === null || document.activeElement !== disablingButton) return
      if (nextIsFirst) closeButtonRef.current?.focus()
      else focusAwayFromDisabledNav(nextIsFirst, nextIsLast)
    },
    [focusAwayFromDisabledNav, prevButtonRef, nextButtonRef, closeButtonRef]
  )

  // 今の場面のアニメーション周期が経過したら次の場面へ自動送りする。
  // activeIndex を effect の依存にしているため、手動prev/nextでactiveIndexが変わった時も
  // 同じ effect が発火し直し、新しい場面の周期でタイマーが再設定される
  // (手動操作用に別途タイマーをリセットする処理は不要)。
  // ScenePlayer 側は活性化のたびにSVGを組み直すため(該当コンポーネントのコメント参照)、
  // 表示され始めた場面のアニメーションは常に0から再生される — このタイマーの周期と自然に同期する
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // reduced motion環境ではSVGアニメーション自体が停止しているため、時間経過での自動送りに意味がない
    if (prefersReducedMotion) return
    // ユーザーが一時停止トグルを操作している間は自動送りを止める(WCAG 2.2.2 の停止手段)
    if (isAutoAdvancePaused) return

    const duration = SCENE_ANIMATION_DURATIONS_MS[scene.id] ?? DEFAULT_SCENE_ANIMATION_DURATION_MS
    const timerId = window.setTimeout(() => {
      const nextIndex = (activeIndex + 1) % scenes.length
      focusAwayFromDisabledNavOnAutoAdvance(nextIndex === 0, nextIndex === scenes.length - 1)
      setActiveIndex(nextIndex)
    }, duration)

    return () => window.clearTimeout(timerId)
  }, [
    activeIndex,
    scene.id,
    scenes.length,
    isAutoAdvancePaused,
    focusAwayFromDisabledNavOnAutoAdvance,
  ])

  function handlePrev() {
    if (isFirst) return
    const targetIndex = activeIndex - 1
    focusAwayFromDisabledNav(targetIndex === 0, targetIndex === scenes.length - 1)
    setActiveIndex(targetIndex)
  }

  function handleNext() {
    if (isLast) return
    const targetIndex = activeIndex + 1
    focusAwayFromDisabledNav(targetIndex === 0, targetIndex === scenes.length - 1)
    setActiveIndex(targetIndex)
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

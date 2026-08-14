// 場面(scene)のうちどれがアクティブかを IntersectionObserver で追う。
// 画面中央の帯(上下45%を除いた中央10%)を通過した場面をアクティブとみなす。
// 観察対象が可変本数のため、useFullyVisible/useReveal と違い単一 ref ではなく
// index ごとの ref コールバックを Map で束ね、Observer 自体は1個だけ生成して使い回す
import { useCallback, useEffect, useRef, useState } from 'react'

// 中央だけを判定帯にする。上下45%を除外し、中央10%の帯を通過した場面をアクティブにする
const ROOT_MARGIN = '-45% 0px -45% 0px'

export function useActiveScene(count: number): {
  activeIndex: number
  setSectionRef: (index: number) => (el: HTMLElement | null) => void
} {
  const [activeIndex, setActiveIndex] = useState(0)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const elementsRef = useRef(new Map<number, HTMLElement>())
  // index ごとの ref コールバックを保持する。毎レンダーで新しい関数を渡すと
  // React が旧要素を unobserve → 新要素を observe し直すだけの無駄な処理が走るため、識別子を固定する
  const callbacksRef = useRef(new Map<number, (el: HTMLElement | null) => void>())

  useEffect(() => {
    // IntersectionObserver が無い環境(テスト環境など)では先頭の場面を出したまま何もしない
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (!(entry.target instanceof HTMLElement)) continue
          const index = Number(entry.target.dataset.sceneIndex)
          if (Number.isNaN(index)) continue
          setActiveIndex(index)
        }
      },
      { rootMargin: ROOT_MARGIN },
    )
    observerRef.current = observer

    // マウント時点で既に登録済みの要素(ref コールバックがこの effect より先に走った分)を観察する
    for (const element of elementsRef.current.values()) {
      observer.observe(element)
    }

    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [])

  // 場面数が変わった(=別の作品のストーリーへ遷移した)ら、古いインデックスを引きずらないよう先頭へ戻す
  useEffect(() => {
    setActiveIndex(0)
  }, [count])

  const setSectionRef = useCallback((index: number) => {
    const cached = callbacksRef.current.get(index)
    if (cached !== undefined) return cached

    const callback = (el: HTMLElement | null) => {
      const prevElement = elementsRef.current.get(index)
      if (prevElement !== undefined && prevElement !== el) {
        observerRef.current?.unobserve(prevElement)
        elementsRef.current.delete(index)
      }
      if (el === null) return
      el.dataset.sceneIndex = String(index)
      elementsRef.current.set(index, el)
      observerRef.current?.observe(el)
    }

    callbacksRef.current.set(index, callback)
    return callback
  }, [])

  return { activeIndex, setSectionRef }
}

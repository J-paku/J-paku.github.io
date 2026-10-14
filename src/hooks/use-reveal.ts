// スクロール連動リビール。要素が視界に入ったら一度だけ表示状態へ切り替える。
// 初期状態(opacity/translateY)と遷移そのものは呼び出し側の CSS が持ち、
// このフックは「表示してよいか」の真偽値だけを返す
import { useEffect, useRef, useState } from 'react'
import { canObserveIntersection, shouldRevealAtOnce } from '@/utils/observe-fallback'

// 交差判定のしきい値。原案スクリプトと同じ 0.1(要素の1割が入ったら表示)
const REVEAL_THRESHOLD = 0.1

export function useReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)
  const [isRevealed, setIsRevealed] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (element === null) return

    // モーション抑制設定と、IntersectionObserver が無い環境(古いブラウザ・テスト環境)では観察せず即時表示する。
    // ここで表示しないと初期状態の opacity: 0 のまま止まり、内容が見えなくなる(判定は utils/observe-fallback.ts)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (shouldRevealAtOnce(prefersReducedMotion, canObserveIntersection())) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount 時に一度だけ読み、一度出したら戻さない状態のため(useSyncExternalStore ではクライアント遷移の初回描画と途中の設定変更後の表示が変わる)
      setIsRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          setIsRevealed(true)
          // 一度出したら戻さない。再入場のたびに再生されるのを防ぐため観察を解除する
          observer.unobserve(entry.target)
        }
      },
      { threshold: REVEAL_THRESHOLD }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return { ref, isRevealed }
}

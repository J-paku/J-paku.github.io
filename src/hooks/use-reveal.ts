// スクロール連動リビール。要素が視界に入ったら一度だけ表示状態へ切り替える。
// 初期状態(opacity/translateY)と遷移そのものは呼び出し側の CSS が持ち、
// このフックは「表示してよいか」の真偽値だけを返す
import { useCallback, useEffect, useRef, useState } from 'react'
import { canObserveIntersection, shouldRevealAtOnce } from '@/utils/observe-fallback'

// 交差判定のしきい値。原案スクリプトと同じ 0.1(要素の1割が入ったら表示)
const REVEAL_THRESHOLD = 0.1

export function useReveal<T extends HTMLElement = HTMLElement>() {
  const [isRevealed, setIsRevealed] = useState(false)
  // 付いている要素。ref のコールバックが付け外しの時に出し入れし、mount 後の effect がまとめて観察する。
  // ref のコールバックは要素を受け取って呼ばれ、片付けを返すので外れる時に null で呼ばれない(要素が無い場合は来ない)。
  // 呼び出し側は要素を常に描き、ref は effect より先に付くので、effect の時点で中身はちょうど1つになる。
  // 観察を始める時機は今までどおり mount 後の effect にする(下の即時表示を mount 後の描き直しで行うため。
  // ref のコールバックの中で表示へ切り替えると、mount と同じ commit の中で描き直し、まだ動きの設定を読む前の動画に src を付ける)
  const elementsRef = useRef(new Set<T>())
  const ref = useCallback((element: T) => {
    elementsRef.current.add(element)
    return () => {
      elementsRef.current.delete(element)
    }
  }, [])

  useEffect(() => {
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

    for (const element of elementsRef.current) observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return { ref, isRevealed }
}

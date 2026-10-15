// 要素が「画面に丸ごと収まっているか」を返す。画面の縁に掛かっている間は false。
// 一度きりの use-reveal と違い、出入りのたびに真偽が入れ替わる
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { canObserveIntersection, resolveFullyVisible } from '@/utils/observe-fallback'

// 交差比のしきい値。1 ちょうどは小数誤差で取り逃すため、実質全面の 0.99 を全面とみなす
const FULL_RATIO = 0.99

// IntersectionObserver の有無はページの寿命のあいだ変わらないため、購読するものが無い
const subscribeNothing = () => () => {}
// サーバ(Node)には IntersectionObserver が無いが、書き出す HTML は観察できる前提(初期値 false)で描く。
// 観察できる環境ではハイドレーション後も値が変わらず、再描画も起きない
const getServerCanObserve = () => true

export function useFullyVisible<T extends HTMLElement = HTMLElement>() {
  // 付いている要素。下の ref のコールバックが付け外しの時に書く。枠の外の押下を見るフック(use-links-overlay)も読む
  const elementRef = useRef<T>(null)
  // 観察する要素。ref のコールバックが付け外しの時に出し入れし、mount 後の effect がまとめて観察する(use-reveal と同じ形)。
  // ref のコールバックは要素を受け取って呼ばれ、片付けを返すので外れる時に null で呼ばれない(要素が無い場合は来ない)。
  // 呼び出し側は要素を常に描き、ref は effect より先に付くので、effect の時点で中身はちょうど1つになる。
  // 観察を始める時機は今までどおり mount 後の effect にする
  const elementsRef = useRef(new Set<T>())
  const ref = useCallback((element: T) => {
    elementRef.current = element
    elementsRef.current.add(element)
    return () => {
      elementRef.current = null
      elementsRef.current.delete(element)
    }
  }, [])
  const [isFullyVisible, setIsFullyVisible] = useState(false)
  // IntersectionObserver が無い環境では判定できない。永久に false のまま沈めると
  // 「常に灰色」になってしまうため、判定できないときは表示側(true)へ倒す(戻り値で合成する。判定は utils/observe-fallback.ts)
  const canObserve = useSyncExternalStore(
    subscribeNothing,
    canObserveIntersection,
    getServerCanObserve
  )

  useEffect(() => {
    // 観察できない環境では何もしない。表示側へ倒すのは canObserve が受け持つ
    /* v8 ignore next -- e2e: tests/observer-missing.spec.ts > IntersectionObserver が無くても、スクロールせずに画面の外のカードまで現れ、写真も色付きで出る */
    if (!canObserveIntersection()) return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          setIsFullyVisible(entry.intersectionRatio >= FULL_RATIO)
        }
      },
      // 0 も渡す。全面から一気に画面外へ抜けた場合、しきい値が1つだけだと通知が来ない
      { threshold: [0, FULL_RATIO, 1] }
    )

    for (const element of elementsRef.current) observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return { ref, elementRef, isFullyVisible: resolveFullyVisible(canObserve, isFullyVisible) }
}

// 要素が「画面に丸ごと収まっているか」を返す。画面の縁に掛かっている間は false。
// 一度きりの use-reveal と違い、出入りのたびに真偽が入れ替わる
import { useEffect, useRef, useState } from 'react'

// 交差比のしきい値。1 ちょうどは小数誤差で取り逃すため、実質全面の 0.99 を全面とみなす
const FULL_RATIO = 0.99

export function useFullyVisible<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)
  const [isFullyVisible, setIsFullyVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (element === null) return

    // IntersectionObserver が無い環境では判定できない。永久に false のまま沈めると
    // 「常に灰色」になってしまうため、判定できないときは表示側(true)へ倒す
    if (typeof IntersectionObserver === 'undefined') {
      setIsFullyVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsFullyVisible(entry.intersectionRatio >= FULL_RATIO)
        }
      },
      // 0 も渡す。全面から一気に画面外へ抜けた場合、しきい値が1つだけだと通知が来ない
      { threshold: [0, FULL_RATIO, 1] },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return { ref, isFullyVisible }
}

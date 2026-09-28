// 要素が「画面に丸ごと収まっているか」を返す。画面の縁に掛かっている間は false。
// 一度きりの use-reveal と違い、出入りのたびに真偽が入れ替わる
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

// 交差比のしきい値。1 ちょうどは小数誤差で取り逃すため、実質全面の 0.99 を全面とみなす
const FULL_RATIO = 0.99

// IntersectionObserver の有無はページの寿命のあいだ変わらないため、購読するものが無い
const subscribeNothing = () => () => {}
const getCanObserve = () => typeof IntersectionObserver !== 'undefined'
// サーバ(Node)には IntersectionObserver が無いが、書き出す HTML は観察できる前提(初期値 false)で描く。
// 観察できる環境ではハイドレーション後も値が変わらず、再描画も起きない
const getServerCanObserve = () => true

export function useFullyVisible<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)
  const [isFullyVisible, setIsFullyVisible] = useState(false)
  // IntersectionObserver が無い環境では判定できない。永久に false のまま沈めると
  // 「常に灰色」になってしまうため、判定できないときは表示側(true)へ倒す(戻り値で合成する)
  const canObserve = useSyncExternalStore(subscribeNothing, getCanObserve, getServerCanObserve)

  useEffect(() => {
    const element = ref.current
    if (element === null) return

    // 観察できない環境では何もしない。表示側へ倒すのは canObserve が受け持つ
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          setIsFullyVisible(entry.intersectionRatio >= FULL_RATIO)
        }
      },
      // 0 も渡す。全面から一気に画面外へ抜けた場合、しきい値が1つだけだと通知が来ない
      { threshold: [0, FULL_RATIO, 1] }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return { ref, isFullyVisible: canObserve ? isFullyVisible : true }
}

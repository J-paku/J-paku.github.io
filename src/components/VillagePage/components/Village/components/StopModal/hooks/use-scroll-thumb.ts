// 縦スクロールする要素の位置を、自前で描く縦棒(トラック+つまみ)の割合に直す。
// OS のスクロールバーは端末ごとに出方が違い、iOS は動かした時しか見えないので、常に見える棒を自分で描く
import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'

export type ScrollThumb = {
  // 中身が収まっていれば false(棒を出さない)
  visible: boolean
  // トラックに対する割合(0〜1)。CSS 変数へ % にして渡す
  top: number
  size: number
}

const HIDDEN: ScrollThumb = { visible: false, top: 0, size: 1 }

export function useScrollThumb(target: RefObject<HTMLElement | null>): ScrollThumb {
  const [thumb, setThumb] = useState<ScrollThumb>(HIDDEN)

  const measure = useCallback(() => {
    const el = target.current
    if (el === null) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight <= clientHeight + 1) {
      setThumb(HIDDEN)
      return
    }
    const size = Math.max(clientHeight / scrollHeight, 0.08)
    const top = (scrollTop / (scrollHeight - clientHeight)) * (1 - size)
    setThumb({ visible: true, top, size })
  }, [target])

  useEffect(() => {
    const el = target.current
    if (el === null) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    // 本文の高さや枠の大きさが変わった時も測り直す(画像の読み込み・回転)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => {
      el.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [target, measure])

  return thumb
}

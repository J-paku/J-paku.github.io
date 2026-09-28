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

// 引数名の末尾を Ref にしておく。React Compiler 系の lint(react-hooks)は ref を型ではなく名前で見分け、
// 末尾が Ref の名前(と ref そのもの)の current だけを ref の読み取りとして扱う。既定で有効な
// enableAllowSetStateFromRefsInEffects により、ref から読んだ値を渡す setState と、その値で分岐した先の setState は
// effect から同期で呼んでも咎めない。名前が target だと ref と見なされず、effect が同期で呼ぶ measure の
// setThumb が set-state-in-effect(連鎖レンダー)として落ちる
export function useScrollThumb(targetRef: RefObject<HTMLElement | null>): ScrollThumb {
  const [thumb, setThumb] = useState<ScrollThumb>(HIDDEN)

  const measure = useCallback(() => {
    const el = targetRef.current
    if (el === null) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight <= clientHeight + 1) {
      setThumb(HIDDEN)
      return
    }
    const size = Math.max(clientHeight / scrollHeight, 0.08)
    const top = (scrollTop / (scrollHeight - clientHeight)) * (1 - size)
    setThumb({ visible: true, top, size })
  }, [targetRef])

  useEffect(() => {
    const el = targetRef.current
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
  }, [targetRef, measure])

  return thumb
}

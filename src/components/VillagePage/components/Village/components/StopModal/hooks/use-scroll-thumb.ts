// 縦スクロールする要素の位置を、自前で描く縦棒(トラック+つまみ)の割合に直す。
// OS のスクロールバーは端末ごとに出方が違い、iOS は動かした時しか見えないので、常に見える棒を自分で描く。
// 割合の計算は StopModal/utils/measure-scroll-thumb.ts が決め、ここは測り直す時機と state を持つだけ
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

import { HIDDEN_THUMB, measureScrollThumb } from '../utils/measure-scroll-thumb'
import type { ScrollThumb } from '../utils/measure-scroll-thumb'

// 引数名の末尾を Ref にしておく。React Compiler 系の lint(react-hooks)は ref を型ではなく名前で見分け、
// 末尾が Ref の名前(と ref そのもの)の current だけを ref の読み取りとして扱う。既定で有効な
// enableAllowSetStateFromRefsInEffects により、ref から読んだ値を渡す setState と、その値で分岐した先の setState は
// effect から同期で呼んでも咎めない。名前が target だと ref と見なされず、effect が同期で呼ぶ measure の
// setThumb が set-state-in-effect(連鎖レンダー)として落ちる
export function useScrollThumb(targetRef: RefObject<HTMLElement | null>): ScrollThumb {
  const [thumb, setThumb] = useState<ScrollThumb>(HIDDEN_THUMB)

  useEffect(() => {
    // 本文は会話窓がいつも描き、ref は effect より先に付くので、ここでは必ずある
    const el = targetRef.current!
    // 測るのはこの effect で掴んだ要素。窓が外れた後、片付けより先に届いた通知(外れて大きさが 0 になった知らせなど)でも
    // 外れた要素を測るだけで、外した部品への setState は React が捨てる
    const measure = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      setThumb(measureScrollThumb({ scrollTop, scrollHeight, clientHeight }))
    }
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
  }, [targetRef])

  return thumb
}

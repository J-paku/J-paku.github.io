// 話しかける物の上に出す吹き出し。world 層の中に置くのでカメラと一緒に動き、物から離れない
'use client'

import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Locale } from '@content/types/content'
import styles from './talk-bubble.module.css'

export type TalkBubbleProps = {
  text: string
  lang: Locale
  // 吹き出しを付ける位置(ワールド座標・マス単位)。x は中央、y は上辺。尾はこの点を指す
  at: { x: number; y: number }
  actionLabel?: string
  onAction?: () => void
  // speech は台詞(尾・ボタンあり)、thought は考え中の一言(点線・丸い点・ボタン無し)
  kind?: 'speech' | 'thought'
}

// CSS 変数は CSSProperties に含まれないので、使う分だけを足した形で渡す
type BubbleStyle = CSSProperties & { '--bx': number; '--by': number }

// 枠(data-village)の左右をはみ出す分だけ横へ押し戻す余白
const FRAME_PADDING = 8
// カメラが動いた直後は原点がまだ収まっていないことがあるので、落ち着いた頃にもう一度測る
const SETTLE_DELAY = 350

export function TalkBubble({
  text,
  lang,
  at,
  actionLabel,
  onAction,
  kind = 'speech',
}: TalkBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const bubble = bubbleRef.current
    if (bubble === null) return

    // 枠からはみ出した分を --shift に入れて吹き出し本体を押し戻す。尾は逆向きに戻し、元の位置を指し続ける
    const clamp = () => {
      const frame = bubble.closest('[data-village]')
      if (frame === null) return
      const frameRect = frame.getBoundingClientRect()
      const bubbleRect = bubble.getBoundingClientRect()
      const overflowLeft = frameRect.left + FRAME_PADDING - bubbleRect.left
      const overflowRight = bubbleRect.right - (frameRect.right - FRAME_PADDING)
      const shift = overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0
      bubble.style.setProperty('--shift', `${shift}px`)
    }

    // 初回は土台(アンカー)がまだ transform: translate(0,0) のままなので、rAF を2回挟んで
    // rAF側が実座標を書き込んだ後に測る(でないと世界の原点を基準に --shift を計算してしまう)
    let raf1 = 0
    let raf2 = 0
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(clamp)
    })
    const settle = window.setTimeout(clamp, SETTLE_DELAY)
    window.addEventListener('resize', clamp)
    return () => {
      window.cancelAnimationFrame(raf1)
      window.cancelAnimationFrame(raf2)
      window.clearTimeout(settle)
      window.removeEventListener('resize', clamp)
    }
  }, [text, at.x, at.y, kind])

  const style: BubbleStyle = { '--bx': at.x, '--by': at.y }
  return (
    <div
      ref={bubbleRef}
      className={styles.bubble}
      style={style}
      lang={lang}
      data-village-bubble
      data-village-bubble-kind={kind}
    >
      <span className={styles.text}>{text}</span>
      {kind === 'speech' && actionLabel ? (
        <button type='button' className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export default TalkBubble

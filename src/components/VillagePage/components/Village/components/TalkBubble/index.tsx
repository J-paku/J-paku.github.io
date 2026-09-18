// 話しかける物の上に出す吹き出し。world 層の中に置くのでカメラと一緒に動き、物から離れない
'use client'

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
}

// CSS 変数は CSSProperties に含まれないので、使う分だけを足した形で渡す
type BubbleStyle = CSSProperties & { '--bx': number; '--by': number }

export function TalkBubble({ text, lang, at, actionLabel, onAction }: TalkBubbleProps) {
  const style: BubbleStyle = { '--bx': at.x, '--by': at.y }
  return (
    <div className={styles.bubble} style={style} lang={lang} data-village-bubble>
      <span className={styles.text}>{text}</span>
      {actionLabel ? (
        <button type='button' className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export default TalkBubble

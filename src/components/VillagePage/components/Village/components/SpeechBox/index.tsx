// マップ内で現在の案内と任意の行動を示す会話窓
'use client'

import type { Locale } from '@content/types/content'
import styles from './speech-box.module.css'

export type SpeechBoxProps = {
  text: string
  lang: Locale
  actionLabel?: string
  onAction?: () => void
}

export function SpeechBox({ text, lang, actionLabel, onAction }: SpeechBoxProps) {
  return (
    <div className={styles.speechBox} lang={lang} role='status' aria-live='polite'>
      <span className={styles.text}>{text}</span>
      {actionLabel ? (
        <button type='button' className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export default SpeechBox

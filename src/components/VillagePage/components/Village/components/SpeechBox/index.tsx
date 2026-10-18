// マップ内で現在の案内を示す、枠の下端の案内文。
// global.css の keep-all で日本語は <wbr> の位置でしか折り返せないので、文は PhraseText で文節に区切る
'use client'

import type { Locale } from '@content/types/content'
import PhraseText from '@/components/ui/PhraseText'
import styles from './speech-box.module.css'

// 押す手(ボタン)は持たない。描くのは FrameOverlays の 1 か所だけで、そこは一言と言語しか渡さない
export type SpeechBoxProps = {
  text: string
  lang: Locale
}

export function SpeechBox({ text, lang }: SpeechBoxProps) {
  return (
    <div className={styles.speechBox} lang={lang} role='status' aria-live='polite'>
      <span className={styles.text}>
        <PhraseText text={text} locale={lang} />
      </span>
    </div>
  )
}

export default SpeechBox

// ゲームボーイ風の A/B ボタン。A は話す/次へ、B は閉じる — 状態(mode)で行き先を切り替える
'use client'

import type { PointerEvent } from 'react'

import styles from './action-buttons.module.css'

export type ActionButtonsProps = {
  mode: 'walk' | 'talk' | 'map'
  hasNext: boolean
  labels: { a: string; b: string }
  onTalk: () => void
  onNext: () => void
  onClose: () => void
}

// マップのblurが押下を消さないよう、ポインターによるフォーカス移動を防ぐ(DPad と同じ理由)
const preventFocusSteal = (event: PointerEvent<HTMLButtonElement>) => event.preventDefault()

export function ActionButtons({
  mode,
  hasNext,
  labels,
  onTalk,
  onNext,
  onClose,
}: ActionButtonsProps) {
  const handleA = () => {
    // 話せる相手がいない時は onTalk 自身が「考え事」の一言を出す(openTalk が処理)
    if (mode === 'walk') {
      onTalk()
      return
    }
    if (mode === 'talk' && hasNext) onNext()
  }

  const handleB = () => {
    if (mode === 'talk' || mode === 'map') onClose()
  }

  return (
    <div className={styles.buttons} role='group'>
      <button
        type='button'
        className={`${styles.button} ${styles.b}`}
        aria-label={labels.b}
        data-village-action='b'
        onPointerDown={preventFocusSteal}
        onClick={handleB}
      >
        <span aria-hidden='true'>B</span>
      </button>
      <button
        type='button'
        className={`${styles.button} ${styles.a}`}
        aria-label={labels.a}
        data-village-action='a'
        onPointerDown={preventFocusSteal}
        onClick={handleA}
      >
        <span aria-hidden='true'>A</span>
      </button>
    </div>
  )
}

export default ActionButtons

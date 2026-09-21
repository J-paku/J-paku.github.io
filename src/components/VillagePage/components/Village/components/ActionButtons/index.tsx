// ゲームボーイ風の A/B ボタン。A は話す/次へ、B は閉じる — 行き先は use-village の A/B が状態(mode)から決め、ここは呼ぶだけ
'use client'

import type { PointerEvent } from 'react'

import styles from './action-buttons.module.css'

export type ActionButtonsProps = {
  labels: { a: string; b: string }
  onA: () => void
  onB: () => void
}

// マップのblurが押下を消さないよう、ポインターによるフォーカス移動を防ぐ(DPad と同じ理由)
const preventFocusSteal = (event: PointerEvent<HTMLButtonElement>) => event.preventDefault()

export function ActionButtons({ labels, onA, onB }: ActionButtonsProps) {
  return (
    <div className={styles.buttons} role='group'>
      <button
        type='button'
        className={`${styles.button} ${styles.b}`}
        aria-label={labels.b}
        data-village-action='b'
        onPointerDown={preventFocusSteal}
        onClick={onB}
      >
        <span aria-hidden='true'>B</span>
      </button>
      <button
        type='button'
        className={`${styles.button} ${styles.a}`}
        aria-label={labels.a}
        data-village-action='a'
        onPointerDown={preventFocusSteal}
        onClick={onA}
      >
        <span aria-hidden='true'>A</span>
      </button>
    </div>
  )
}

export default ActionButtons

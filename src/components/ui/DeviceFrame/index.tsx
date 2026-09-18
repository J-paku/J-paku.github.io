// iPhone 17 Pro を想起させる端末フレーム。画像資産は使わず、チタン風のグラデーション枠・
// Dynamic Island・側面ボタンのヒントを CSS だけで組む。装飾要素は情報を持たないため全て aria-hidden
// — 画面内の実際の情報は children(呼び出し側が渡すスクリーンショット等)だけが担う
import type { ReactNode } from 'react'
import styles from './device-frame.module.css'

type DeviceFrameProps = {
  children: ReactNode
}

function DeviceFrame({ children }: DeviceFrameProps) {
  return (
    <div className={styles.frame}>
      {/* 側面ボタン(左: アクション+音量上下、右: 電源)は可動部を主張しない程度の陰影のみ */}
      <span className={styles.buttonAction} aria-hidden='true' />
      <span className={styles.buttonVolumeUp} aria-hidden='true' />
      <span className={styles.buttonVolumeDown} aria-hidden='true' />
      <span className={styles.buttonPower} aria-hidden='true' />

      <div className={styles.screen}>
        {/* Dynamic Island は画面内の装飾。position: absolute なので children より後に描く必要は無い */}
        <span className={styles.island} aria-hidden='true' />
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}

export default DeviceFrame

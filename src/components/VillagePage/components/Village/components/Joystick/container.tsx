// 村をタッチ操作するための仮想ジョイスティック
'use client'

import type { CSSProperties } from 'react'

import type { Direction } from '@content/types/world'

import { useJoystickDrag } from './hooks/use-joystick-drag'
import styles from './joystick.module.css'
import { CENTER, knobTransform } from './utils/stick-vector'

export type JoystickProps = {
  label: string
  onHold: (dir: Direction | null) => void
}

// 初回描画の土台。以後の位置は pointer の処理が DOM へ直接書く。
// 同じ参照を渡し続けるので、親の再レンダーで React が書いた位置を中央へ戻すことはない
const KNOB_START_STYLE: CSSProperties = { transform: knobTransform(CENTER) }

export function Joystick({ label, onHold }: JoystickProps) {
  const { baseRef, knobRef, handlePointerDown, handlePointerMove, handlePointerEnd } =
    useJoystickDrag(onHold)

  return (
    <div
      ref={baseRef}
      className={styles.base}
      role='application'
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
    >
      <div ref={knobRef} className={styles.knob} aria-hidden='true' style={KNOB_START_STYLE} />
    </div>
  )
}

export default Joystick

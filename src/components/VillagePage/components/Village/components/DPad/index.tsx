// 村の移動方向を押下中だけ親へ伝える十字キー
'use client'

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'

import type { Direction } from '@content/types/world'

import styles from './dpad.module.css'

export type DPadProps = {
  labels: Record<Direction, string>
  onHold: (dir: Direction | null) => void
}

const DIRECTIONS: readonly Direction[] = ['up', 'left', 'down', 'right']

const GLYPHS: Record<Direction, string> = {
  up: '▲',
  down: '▼',
  left: '◀',
  right: '▶',
}

// 短いタップは「向きを変えるだけ」(movement の TURN_MS)に吸われて動かないので、
// 十字キーだけは押下から最短でもこの時間は押しっぱなし扱いにして 1 マス進める
const MIN_HOLD_MS = 90

export function DPad({ labels, onHold }: DPadProps) {
  const pressedAtRef = useRef(0)
  const releaseTimerRef = useRef<number | null>(null)

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>, direction: Direction) => {
    // マップのblurが新しい押下を消さないよう、ポインターによるフォーカス移動を防ぐ
    event.preventDefault()
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = null
    }
    pressedAtRef.current = performance.now()
    onHold(direction)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerEnd = () => {
    const rest = MIN_HOLD_MS - (performance.now() - pressedAtRef.current)
    if (rest > 0) {
      if (releaseTimerRef.current !== null) return
      releaseTimerRef.current = window.setTimeout(() => {
        releaseTimerRef.current = null
        onHold(null)
      }, rest)
      return
    }
    onHold(null)
  }

  useEffect(
    () => () => {
      if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current)
    },
    []
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, direction: Direction) => {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onHold(direction)
  }

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onHold(null)
  }

  return (
    <div className={styles.dpad} role='group'>
      {DIRECTIONS.map(direction => (
        <button
          key={direction}
          type='button'
          className={`${styles.button} ${styles[direction]}`}
          aria-label={labels[direction]}
          onPointerDown={event => handlePointerDown(event, direction)}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
          onBlur={handlePointerEnd}
          onKeyDown={event => handleKeyDown(event, direction)}
          onKeyUp={handleKeyUp}
        >
          <span aria-hidden='true'>{GLYPHS[direction]}</span>
        </button>
      ))}
    </div>
  )
}

export default DPad

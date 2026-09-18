// 村をタッチ操作するための仮想ジョイスティック
'use client'

import { useRef, useState, type PointerEvent } from 'react'

import type { Direction } from '@content/types/world'

import styles from './joystick.module.css'

export type JoystickProps = {
  label: string
  onHold: (dir: Direction | null) => void
}

type Position = {
  x: number
  y: number
}

const CENTER: Position = { x: 0, y: 0 }
// 土台の幅に対する倒せる距離の比。joystick.module.css の既定(base 88px・MAX_RADIUS 28px)から算出し、
// 縦持ちタッチで base が120pxへ広がっても(同ファイル)実測幅から自動で追従させる(数値の二重管理を避ける)
const RADIUS_RATIO = 28 / 88
const DEAD_ZONE = 10

export function Joystick({ label, onHold }: JoystickProps) {
  const [position, setPosition] = useState<Position>(CENTER)
  const originRef = useRef<Position | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const lastDirectionRef = useRef<Direction | null>(null)
  const maxRadiusRef = useRef<number>(88 * RADIUS_RATIO)

  const updateDirection = (direction: Direction | null) => {
    if (lastDirectionRef.current === direction) return

    lastDirectionRef.current = direction
    onHold(direction)
  }

  const reset = () => {
    originRef.current = null
    activePointerIdRef.current = null
    setPosition(CENTER)
    updateDirection(null)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null) return

    event.preventDefault()
    originRef.current = { x: event.clientX, y: event.clientY }
    activePointerIdRef.current = event.pointerId
    // 縦持ちタッチは CSS で base が120pxへ広がるため、押した瞬間の実測幅から倒せる距離を出し直す
    maxRadiusRef.current = event.currentTarget.clientWidth * RADIUS_RATIO
    setPosition(CENTER)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const origin = originRef.current

    if (origin === null || activePointerIdRef.current !== event.pointerId) return

    const maxRadius = maxRadiusRef.current
    const deltaX = event.clientX - origin.x
    const deltaY = event.clientY - origin.y
    const distance = Math.hypot(deltaX, deltaY)
    const scale = distance > maxRadius ? maxRadius / distance : 1

    setPosition({ x: deltaX * scale, y: deltaY * scale })

    if (distance < DEAD_ZONE) {
      updateDirection(null)
      return
    }

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      updateDirection(deltaX < 0 ? 'left' : 'right')
      return
    }

    updateDirection(deltaY < 0 ? 'up' : 'down')
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return

    reset()
  }

  return (
    <div
      className={styles.base}
      role='application'
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
    >
      <div
        className={styles.knob}
        aria-hidden='true'
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      />
    </div>
  )
}

export default Joystick

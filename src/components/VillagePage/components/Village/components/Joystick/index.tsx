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
const MAX_RADIUS = 28
const DEAD_ZONE = 10

export function Joystick({ label, onHold }: JoystickProps) {
  const [position, setPosition] = useState<Position>(CENTER)
  const originRef = useRef<Position | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const lastDirectionRef = useRef<Direction | null>(null)

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
    setPosition(CENTER)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const origin = originRef.current

    if (origin === null || activePointerIdRef.current !== event.pointerId) return

    const deltaX = event.clientX - origin.x
    const deltaY = event.clientY - origin.y
    const distance = Math.hypot(deltaX, deltaY)
    const scale = distance > MAX_RADIUS ? MAX_RADIUS / distance : 1

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

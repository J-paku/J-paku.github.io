// 村をタッチ操作するための仮想ジョイスティック
'use client'

import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'

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

const knobTransform = ({ x, y }: Position): string => `translate(${x}px, ${y}px)`
// 初回描画の土台。以後の位置は pointer の処理が DOM へ直接書く。
// 同じ参照を渡し続けるので、親の再レンダーで React が書いた位置を中央へ戻すことはない
const KNOB_START_STYLE: CSSProperties = { transform: knobTransform(CENTER) }

export function Joystick({ label, onHold }: JoystickProps) {
  // 倒した位置は pointermove ごとに変わるので state にせず、つまみの transform を ref で直接書く
  // (指が動くたびに React のコミットを起こさない。親への向きの通知は変わった時だけ)
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const originRef = useRef<Position | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const lastDirectionRef = useRef<Direction | null>(null)
  const maxRadiusRef = useRef<number>(88 * RADIUS_RATIO)

  // React の onTouchStart は passive 登録なので preventDefault が効かず、iOS の長押しで拡大鏡(テキスト選択)が出る。
  // CSS の user-select・touch-callout だけでは止まらないため、passive: false で直接登録して既定動作を止める。
  // touchstart の preventDefault は pointer イベントを止めないので、倒す処理は下の pointer ハンドラのまま
  useEffect(() => {
    const base = baseRef.current
    if (base === null) return

    const preventTouchDefault = (event: TouchEvent) => {
      event.preventDefault()
    }
    base.addEventListener('touchstart', preventTouchDefault, { passive: false })

    return () => {
      base.removeEventListener('touchstart', preventTouchDefault)
    }
  }, [])

  const moveKnob = (position: Position) => {
    const knob = knobRef.current
    if (knob === null) return

    knob.style.transform = knobTransform(position)
  }

  const updateDirection = (direction: Direction | null) => {
    if (lastDirectionRef.current === direction) return

    lastDirectionRef.current = direction
    onHold(direction)
  }

  // 指を離す・取り消し・捕捉喪失はすべてここを通り、つまみを必ず中央へ戻す
  const reset = () => {
    originRef.current = null
    activePointerIdRef.current = null
    moveKnob(CENTER)
    updateDirection(null)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null) return

    event.preventDefault()
    originRef.current = { x: event.clientX, y: event.clientY }
    activePointerIdRef.current = event.pointerId
    // 縦持ちタッチは CSS で base が120pxへ広がるため、押した瞬間の実測幅から倒せる距離を出し直す
    maxRadiusRef.current = event.currentTarget.clientWidth * RADIUS_RATIO
    moveKnob(CENTER)
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

    moveKnob({ x: deltaX * scale, y: deltaY * scale })

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

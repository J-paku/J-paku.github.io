// スティックを倒す操作。pointer の捕捉・つまみの DOM 直書き・向きの通知と、iOS の長押し抑止をここに集める
import { useEffect, useRef, type PointerEvent } from 'react'

import type { Direction } from '@content/types/world'

import {
  CENTER,
  knobTransform,
  RADIUS_RATIO,
  readStickVector,
  type Position,
} from '../utils/stick-vector'

export function useJoystickDrag(onHold: (dir: Direction | null) => void) {
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

    const { knob, direction } = readStickVector(
      event.clientX - origin.x,
      event.clientY - origin.y,
      maxRadiusRef.current
    )

    moveKnob(knob)
    updateDirection(direction)
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return

    reset()
  }

  return { baseRef, knobRef, handlePointerDown, handlePointerMove, handlePointerEnd }
}

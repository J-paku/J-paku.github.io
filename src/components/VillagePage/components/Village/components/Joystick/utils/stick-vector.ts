// 指のずれ(delta)から、つまみの位置と倒した向きを出す純粋な計算と、その寸法の定数
import type { Direction } from '@content/types/world'

export type Position = {
  x: number
  y: number
}

export type StickVector = {
  knob: Position
  direction: Direction | null
}

export const CENTER: Position = { x: 0, y: 0 }
// 土台の幅に対する倒せる距離の比。joystick.module.css の既定(base 88px・MAX_RADIUS 28px)から算出し、
// 縦持ちタッチで base が120pxへ広がっても(同ファイル)実測幅から自動で追従させる(数値の二重管理を避ける)
export const RADIUS_RATIO = 28 / 88
export const DEAD_ZONE = 10

export const knobTransform = ({ x, y }: Position): string => `translate(${x}px, ${y}px)`

// 倒せる距離を超えたずれは縁へ縮め、DEAD_ZONE 未満は向きなし。縦横は大きい方の軸で決め、同じ大きさなら横を採る
export const readStickVector = (deltaX: number, deltaY: number, maxRadius: number): StickVector => {
  const distance = Math.hypot(deltaX, deltaY)
  const scale = distance > maxRadius ? maxRadius / distance : 1
  const knob: Position = { x: deltaX * scale, y: deltaY * scale }

  if (distance < DEAD_ZONE) {
    return { knob, direction: null }
  }

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return { knob, direction: deltaX < 0 ? 'left' : 'right' }
  }

  return { knob, direction: deltaY < 0 ? 'up' : 'down' }
}

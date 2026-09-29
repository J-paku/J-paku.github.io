// 指のずれからつまみの位置と倒した向きを出す計算(readStickVector)と、つまみのtransform・寸法の定数のテスト
import { describe, expect, it } from 'vitest'
import { CENTER, DEAD_ZONE, RADIUS_RATIO, knobTransform, readStickVector } from './stick-vector'

// 既定の土台(88px)で倒せる距離
const MAX = 28

describe('knobTransform', () => {
  it('中央はずれ0のtranslateになる', () => {
    expect(knobTransform(CENTER)).toBe('translate(0px, 0px)')
  })

  it('負の値・小数もそのままpxで書く', () => {
    expect(knobTransform({ x: -3.5, y: 12 })).toBe('translate(-3.5px, 12px)')
  })
})

describe('RADIUS_RATIO', () => {
  it('既定の土台88pxでは倒せる距離が28pxになる', () => {
    expect(88 * RADIUS_RATIO).toBeCloseTo(28, 10)
  })

  it('縦持ちタッチで土台が120pxへ広がると、倒せる距離も同じ比で広がる', () => {
    expect(120 * RADIUS_RATIO).toBeCloseTo((28 * 120) / 88, 10)
  })
})

describe('readStickVector', () => {
  it('ずれが無ければつまみは中央で、向きはなし', () => {
    expect(readStickVector(0, 0, MAX)).toEqual({ knob: { x: 0, y: 0 }, direction: null })
  })

  it('DEAD_ZONE未満のずれはつまみだけ動かし、向きはなし', () => {
    expect(readStickVector(3, -4, MAX)).toEqual({ knob: { x: 3, y: -4 }, direction: null })
  })

  it('境目のすぐ内側(距離9.99…)は向きなし', () => {
    const inside = readStickVector(DEAD_ZONE - 0.01, 0, MAX)
    expect(inside.direction).toBeNull()
  })

  it('境目ちょうど(距離10)から向きが出る', () => {
    // hypot(6, 8)はちょうど10。縦の方が大きいので下
    expect(Math.hypot(6, 8)).toBe(DEAD_ZONE)
    expect(readStickVector(6, 8, MAX).direction).toBe('down')
    expect(readStickVector(DEAD_ZONE, 0, MAX).direction).toBe('right')
  })

  it('横の方が大きければ左右、縦の方が大きければ上下を採る', () => {
    expect(readStickVector(-20, 5, MAX).direction).toBe('left')
    expect(readStickVector(20, -5, MAX).direction).toBe('right')
    expect(readStickVector(5, -20, MAX).direction).toBe('up')
    expect(readStickVector(-5, 20, MAX).direction).toBe('down')
  })

  it('縦横が同じ大きさ(斜め45度)なら横を採る', () => {
    expect(readStickVector(15, 15, MAX).direction).toBe('right')
    expect(readStickVector(15, -15, MAX).direction).toBe('right')
    expect(readStickVector(-15, 15, MAX).direction).toBe('left')
    expect(readStickVector(-15, -15, MAX).direction).toBe('left')
  })

  it('倒せる距離の内側ではつまみは指のずれそのまま', () => {
    expect(readStickVector(0, -20, MAX)).toEqual({ knob: { x: 0, y: -20 }, direction: 'up' })
  })

  it('倒せる距離ちょうどは縮めない', () => {
    expect(readStickVector(MAX, 0, MAX).knob).toEqual({ x: MAX, y: 0 })
  })

  it('倒せる距離を超えたずれは、向きを保ったまま縁まで縮める', () => {
    // 距離50を25へ縮めるので、両軸とも半分になる
    expect(readStickVector(30, 40, 25)).toEqual({ knob: { x: 15, y: 20 }, direction: 'down' })
    expect(readStickVector(-56, 0, MAX)).toEqual({ knob: { x: -MAX, y: 0 }, direction: 'left' })
  })

  it('向きは縮めた後のつまみではなく指のずれの距離で決める', () => {
    // 倒せる距離がDEAD_ZONEより小さくても、指が十分動いていれば向きを出す
    expect(readStickVector(20, 0, 5)).toEqual({ knob: { x: 5, y: 0 }, direction: 'right' })
  })
})

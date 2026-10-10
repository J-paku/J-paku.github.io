// 動いている最中かの判定(isMoving)のテスト。歩いている間と飛んでいる間のどちらも動いていると数え、
// どちらでもない時だけ止まっているとする
import type { Flight } from './flight'
import { isMoving } from './is-moving'
import type { Motion } from './movement'

const motion: Motion = { from: { x: 3, y: 3 }, to: { x: 3, y: 4 }, progress: 0.5 }
const flight: Flight = { from: { x: 3, y: 3 }, to: { x: 3, y: 7 }, durationMs: 608, elapsedMs: 100 }

describe('isMoving', () => {
  it('歩いてもおらず飛んでもいなければ止まっている', () => {
    expect(isMoving({ motion: null, flight: null })).toBe(false)
  })

  it('次のマスへ歩いている間は動いている', () => {
    expect(isMoving({ motion, flight: null })).toBe(true)
  })

  it('飛んでいる間は motion が null でも動いている', () => {
    expect(isMoving({ motion: null, flight })).toBe(true)
  })

  it('歩き始めたばかり(進捗0)でも動いている', () => {
    expect(isMoving({ motion: { ...motion, progress: 0 }, flight: null })).toBe(true)
  })
})

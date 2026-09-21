import { describe, expect, it } from 'vitest'
import { wrapWithin } from './wrap-within'

// タプル: [説明, 入力, 一周の幅, 期待値]
const cases: Array<[string, number, number, number]> = [
  ['幅を越えたら先頭へ回る', 25, 24, 1],
  ['負の値は末尾から数える', -1, 24, 23],
  ['幅の中の値はそのまま', 30, 60, 30],
]

describe('wrapWithin', () => {
  it.each(cases)('%s', (_label, value, span, expected) => {
    expect(wrapWithin(value, span)).toBe(expected)
  })
})

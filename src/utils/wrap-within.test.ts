import { describe, expect, it } from 'vitest'
import { wrapWithin } from './wrap-within'

// タプル: [説明, 入力, 一周の幅, 期待値]
const cases: Array<[string, number, number, number]> = [
  ['幅を越えたら先頭へ回る', 25, 24, 1],
  ['負の値は末尾から数える', -1, 24, 23],
  ['幅の中の値はそのまま', 30, 60, 30],
  // 一周以内の値しか無いと、剰余を 1 回の加減算で代用した実装(49→25・-25→-1)でも通ってしまう
  ['二周ぶん越えても先頭から数え直す', 49, 24, 1],
  ['負の二周ぶんも末尾から数え直す', -25, 24, 23],
  ['幅ちょうどは0へ戻る', 24, 24, 0],
  ['幅の負数ちょうども0へ戻る(-0 にしない)', -24, 24, 0],
  ['0はそのまま0', 0, 24, 0],
]

describe('wrapWithin', () => {
  it.each(cases)('%s', (_label, value, span, expected) => {
    expect(wrapWithin(value, span)).toBe(expected)
  })
})

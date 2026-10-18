// 数の並び range のテスト
import { range } from './range'

describe('range', () => {
  it('start から 1 ずつ増える数を length 個、小さい順に並べる', () => {
    expect(range(3, 4)).toEqual([3, 4, 5, 6])
  })
  it('start が負でも 1 ずつ増える', () => {
    expect(range(-2, 3)).toEqual([-2, -1, 0])
  })
  it('length が 0 以下なら空', () => {
    expect(range(5, 0)).toEqual([])
    expect(range(5, -2)).toEqual([])
  })
})

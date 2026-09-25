// 地図の方向キーによる地点間の移動 spotToward のテスト
import type { Cell } from '@content/types/world'
import { spotToward } from './spot-navigation'

type Entry = {
  id: string
  cell: Cell
}

// 地図の一覧と同じく id とマスだけを持つ地点
const spot = (id: string, cell: Cell): Entry => ({ id, cell })

// 中央 c から見て、右に near(2 マス)と far(5 マス)、上に above、下に below を置く
const spots: readonly Entry[] = [
  spot('c', { x: 5, y: 5 }),
  spot('far', { x: 10, y: 5 }),
  spot('near', { x: 7, y: 5 }),
  spot('above', { x: 6, y: 2 }),
  spot('below', { x: 5, y: 9 }),
]

describe('spotToward', () => {
  it('右に 2 つあれば近い方へ移る', () => {
    expect(spotToward(spots, 'c', 'right')?.id).toBe('near')
  })
  it('斜めに外れた近い地点より、押した向きへ真っすぐ並んだ地点を選ぶ', () => {
    // diag は右 2・下 2(直線距離は約 2.8)、straight は右 4。直交のずれを 2 倍で数えるので
    // diag は 2 + 2×2 = 6、straight は 4 で straight が勝つ。等倍だと 4 同士で先の diag になる
    const pair = [
      spot('o', { x: 0, y: 0 }),
      spot('diag', { x: 2, y: 2 }),
      spot('straight', { x: 4, y: 0 }),
    ]
    expect(spotToward(pair, 'o', 'right')?.id).toBe('straight')
    // その向きに 1 つしか無ければ、外れていてもそこへ移る
    expect(spotToward(spots, 'c', 'up')?.id).toBe('above')
  })
  it('その向きに地点が無ければ null(焦点を動かさない)', () => {
    expect(spotToward(spots, 'c', 'left')).toBeNull()
    expect(spotToward(spots, 'far', 'right')).toBeNull()
  })
  it('今の焦点が地点でなければ最初の地点', () => {
    expect(spotToward(spots, null, 'down')?.id).toBe('c')
    expect(spotToward(spots, 'close', 'down')?.id).toBe('c')
  })
  it('地点が 1 つも無ければ null', () => {
    expect(spotToward([], null, 'right')).toBeNull()
  })
})

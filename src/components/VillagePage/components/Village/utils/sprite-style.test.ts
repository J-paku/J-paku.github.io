// スプライト1枚ぶんの添字(spriteIndex)と表示位置(spriteStyle)のテスト
import { describe, expect, it } from 'vitest'
import type { SheetLayout } from '@/lib/pixel/art'
import { spriteIndex, spriteStyle } from './sprite-style'

// 添字0の鍵と0以外の鍵を持つ小さなシート。画像本体は配置計算に要らない
const sheet: SheetLayout = {
  index: { 'player-down-0': 0, 'player-right-1': 5, locator: 11 },
  count: 12,
  tile: 16,
  height: 16,
}

describe('spriteIndex', () => {
  it('シートにある鍵はその添字を返す', () => {
    expect(spriteIndex(sheet, 'player-right-1')).toBe(5)
    expect(spriteIndex(sheet, 'locator')).toBe(11)
  })

  it('添字0の鍵は0のまま返す', () => {
    expect(spriteIndex(sheet, 'player-down-0')).toBe(0)
  })

  it('シートに無い鍵は先頭のスプライト(0)へ逃がす', () => {
    expect(spriteIndex(sheet, 'player-left-0')).toBe(0)
  })

  it('空の鍵や大文字違いも無い鍵として0を返す', () => {
    expect(spriteIndex(sheet, '')).toBe(0)
    expect(spriteIndex(sheet, 'Locator')).toBe(0)
  })
})

describe('spriteStyle', () => {
  it('マスの座標をleft・topの--cell倍へ、添字を--iへ入れる', () => {
    expect(spriteStyle(3, 7, 5)).toStrictEqual({
      left: 'calc(var(--cell) * 3)',
      top: 'calc(var(--cell) * 7)',
      '--i': 5,
    })
  })

  it('原点(0,0)と添字0でもそのまま書く', () => {
    expect(spriteStyle(0, 0, 0)).toStrictEqual({
      left: 'calc(var(--cell) * 0)',
      top: 'calc(var(--cell) * 0)',
      '--i': 0,
    })
  })

  it('負の座標もそのまま書く', () => {
    // 釣り糸は主人公のマスからずらして置くので、端のマスでは座標が負になりうる
    expect(spriteStyle(-1, 4, 3)).toStrictEqual({
      left: 'calc(var(--cell) * -1)',
      top: 'calc(var(--cell) * 4)',
      '--i': 3,
    })
  })
})

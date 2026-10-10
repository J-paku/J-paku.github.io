// 飛行6コマの画布・配色・風の差分を検証する。
import { describe, expect, it } from 'vitest'
import { PLAYER_FRAME_HEIGHT, PLAYER_FRAME_WIDTH } from './actors'
import { validateArt } from './art'
import { flightArt } from './flight-art'
import { palette } from './palette'
import { LIGHT_KEYS } from './palette-phase'

const KEYS = [
  'player-fly-down-0',
  'player-fly-down-1',
  'player-fly-up-0',
  'player-fly-up-1',
  'player-fly-right-0',
  'player-fly-right-1',
] as const
const DIRECTIONS = ['down', 'up', 'right'] as const
const FRAMES = [0, 1] as const

describe('飛行の絵', () => {
  it('約束した3方向2コマだけを持ち、左向きや傘の別コマを増やさない', () => {
    expect(Object.keys(flightArt).sort()).toEqual([...KEYS].sort())
  })

  it.each(KEYS)('%sは32×32で、主人公の既存の配色だけを使う', key => {
    const art = flightArt[key]
    expect([PLAYER_FRAME_WIDTH, PLAYER_FRAME_HEIGHT]).toEqual([32, 32])
    expect(validateArt(art, palette, 32, 32)).toEqual([])
    expect(art.join('')).toMatch(/^[.xqQjLIJAZKVMBYz]+$/)
    expect([...LIGHT_KEYS, 'm'].filter(char => art.join('').includes(char))).toEqual([])
    expect(art.join('')).toContain('A')
    expect(art.join('')).toContain('M')
    expect(art.join('')).toContain('B')
    expect(art.join('')).toContain('K')
    // 接地した歩行姿勢と区別し、枠の端で切れずに反転できる余白を残す
    expect(art[0]).toBe('.'.repeat(32))
    expect(art[31]).toBe('.'.repeat(32))
    expect(art.every(row => row[0] === '.' && row[31] === '.')).toBe(true)
    expect(art.some(row => /[^.]/.test(row.slice(0, 8) + row.slice(24)))).toBe(true)
  })

  it.each(DIRECTIONS)('%sの0と1は平行移動ではなく、髪・脚・裾の形が変わる', direction => {
    const first = flightArt[`player-fly-${direction}-0`]
    const second = flightArt[`player-fly-${direction}-1`]
    const changes = first.flatMap((row, y) =>
      [...row].flatMap((char, x) => (char === second[y][x] ? [] : [char, second[y][x]]))
    )
    expect(changes.length).toBeGreaterThan(12)
    expect(changes).toContain('A')
    expect(changes).toContain('z')
    // 帽子の上部を固定し、体全体の上下動に置き換わるのを防ぐ
    const top = { down: 8, up: 7, right: 6 }[direction]
    expect(first.slice(top, top + 3)).toEqual(second.slice(top, top + 3))
  })

  it('6コマはすべて異なり、背面に顔のレンズを描かない', () => {
    expect(new Set(KEYS.map(key => flightArt[key].join(''))).size).toBe(6)
    for (const frame of FRAMES) {
      expect(flightArt[`player-fly-up-${frame}`].join('')).not.toMatch(/[LI]/)
      expect(flightArt[`player-fly-down-${frame}`].join('')).toMatch(/[LI]/)
      expect(flightArt[`player-fly-right-${frame}`].join('')).toMatch(/[LI]/)
    }
  })
})

// 飛行6コマの画布・配色・雲の差分と、夜の灯り・シートへの登録を検証する。
import { describe, expect, it } from 'vitest'
import { PLAYER_FRAME_HEIGHT, PLAYER_FRAME_WIDTH, playerArt, playerNightArt } from './actors'
import { mirrorX, validateArt } from './art'
import type { PixelArt } from './art'
import { flightArt } from './flight-art'
import { frontLantern, LANTERN_GLASS, LANTERN_SHINE } from './lantern'
import { palette } from './palette'
import { LIGHT_KEYS, phasePalette } from './palette-phase'
import { buildPlayerSprites, PLAYER_ARTS, PLAYER_NIGHT_ARTS } from './sprites'
import { lanternStencil, pixelSampler } from './sprites.fixture'
import { DAY_PHASES } from '@/utils/day-phase'

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
type Direction = (typeof DIRECTIONS)[number]
type Box = { top: number; bottom: number; left: number; right: number }
// 雲の文字(palette.tsの黄・淡い金・褐色の金・白・渦の橙茶・陰の中間の金)
const CLOUD = 'FpPh&@'
// 主人公の文字
const BODY = 'qQjLIJAZKVMBYz'
// 頭(立ち姿の体の0〜12行を16列ごと)を置いた画布の位置。横向きは尾を画布へ収めるため4列右へ寄せた
const HEAD: Record<Direction, { top: number; left: number }> = {
  down: { top: 1, left: 8 },
  up: { top: 2, left: 8 },
  right: { top: 3, left: 12 },
}
const HEAD_ROWS = 13
// 雲の上に載せた灯りの外枠。正面は画面の右、背面は画面の左、横向きは顔の前。
// 受け皿を雲の上の輪郭のすぐ上へ置くので、膨らみの低いコマ(背面と横向きの1)は同じ列のまま2行下がる
const LAMP: Record<(typeof KEYS)[number], Box> = {
  'player-fly-down-0': { top: 10, bottom: 15, left: 24, right: 26 },
  'player-fly-down-1': { top: 10, bottom: 15, left: 24, right: 26 },
  'player-fly-up-0': { top: 10, bottom: 15, left: 4, right: 6 },
  'player-fly-up-1': { top: 12, bottom: 17, left: 4, right: 6 },
  'player-fly-right-0': { top: 12, bottom: 17, left: 27, right: 29 },
  'player-fly-right-1': { top: 14, bottom: 19, left: 27, right: 29 },
}

// 絵の中でcharsのどれかが置かれた升の座標
const cellsOf = (art: PixelArt, chars: string): { x: number; y: number }[] =>
  art.flatMap((row, y) => [...row].flatMap((cell, x) => (chars.includes(cell) ? [{ x, y }] : [])))
const directionOf = (key: string): Direction => key.split('-')[2] as Direction
// 頭の13行・16列の窓
const headOf = (art: PixelArt, direction: Direction): PixelArt => {
  const { top, left } = HEAD[direction]
  return art.slice(top, top + HEAD_ROWS).map(row => row.slice(left, left + 16))
}
// 夜に灯りとして足された升
const lampOf = (day: PixelArt, night: PixelArt) =>
  night.flatMap((row, y) =>
    [...row].flatMap((char, x) => (char === day[y][x] ? [] : [{ x, y, char }]))
  )

describe('飛行の絵', () => {
  it('約束した3方向2コマだけを持ち、左向きや傘の別コマを増やさない', () => {
    expect(Object.keys(flightArt).sort()).toEqual([...KEYS].sort())
    expect(Object.keys(PLAYER_ARTS).filter(key => key.startsWith('player-fly-'))).toEqual(KEYS)
  })

  it.each(KEYS)('%sは32×32で、主人公と雲の既存の配色だけを使う', key => {
    const art = flightArt[key]
    expect([PLAYER_FRAME_WIDTH, PLAYER_FRAME_HEIGHT]).toEqual([32, 32])
    expect(validateArt(art, palette, 32, 32)).toEqual([])
    expect(art.join('')).toMatch(/^[.xqQjLIJAZKVMBYzFpPh&@]+$/)
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

  it.each(DIRECTIONS)(
    '%sの0と1は雲の形・渦・尾だけが変わり、頭と体は1ドットも動かない',
    direction => {
      const first = flightArt[`player-fly-${direction}-0`]
      const second = flightArt[`player-fly-${direction}-1`]
      const changes = first.flatMap((row, y) =>
        [...row].flatMap((char, x) => (char === second[y][x] ? [] : [char, second[y][x]]))
      )
      expect(changes.length).toBeGreaterThan(12)
      expect(changes).toContain('F')
      expect(changes).toContain('&')
      expect(changes.every(char => `.x${CLOUD}`.includes(char))).toBe(true)
      // 主人公の全ドットを固定し、雲の違いを体の上下動や手足の振りに置き換えない
      for (const char of BODY) {
        expect(cellsOf(first, char)).toEqual(cellsOf(second, char))
      }
      expect(headOf(first, direction)).toEqual(headOf(second, direction))
      const cloud = (art: PixelArt) => cellsOf(art, 'F').length
      expect(cloud(first)).toBeGreaterThan(90)
      expect(cloud(second)).toBeGreaterThan(90)
    }
  )

  it.each(DIRECTIONS)('%sは昼夜の2コマとも立ち姿と同じ帽子・髪・顔を保つ', direction => {
    const standingFace = PLAYER_ARTS[`player-${direction}-0`]
      .slice(12, 25)
      .map(row => row.slice(8, 24))
    for (const arts of [PLAYER_ARTS, PLAYER_NIGHT_ARTS]) {
      for (const frame of FRAMES) {
        expect(headOf(arts[`player-fly-${direction}-${frame}`], direction)).toEqual(standingFace)
      }
    }
  })

  it('6コマはすべて異なり、背面に顔のレンズを描かない', () => {
    expect(new Set(KEYS.map(key => flightArt[key].join(''))).size).toBe(6)
    for (const frame of FRAMES) {
      expect(flightArt[`player-fly-up-${frame}`].join('')).not.toMatch(/[LI]/)
      expect(flightArt[`player-fly-down-${frame}`].join('')).toMatch(/[LI]/)
      expect(flightArt[`player-fly-right-${frame}`].join('')).toMatch(/[LI]/)
    }
  })

  it.each(FRAMES)('右向き%dは画布の中央で反転すると左を向き、昼夜とも切れない', frame => {
    const key = `player-fly-right-${frame}` as const
    for (const art of [PLAYER_ARTS[key], PLAYER_NIGHT_ARTS[key]]) {
      const left = mirrorX(art)
      expect(mirrorX(left)).toEqual(art)
      expect(left).not.toEqual(art)
      expect(left.every(row => row[0] === '.' && row[31] === '.')).toBe(true)
      expect(left.join('').indexOf('L')).toBeGreaterThanOrEqual(0)
    }
  })

  it('actorsの各向きに対応する昼夜の2コマが入る', () => {
    for (const [name, direction] of [
      ['flyDown', 'down'],
      ['flyUp', 'up'],
      ['flyRight', 'right'],
    ] as const) {
      expect(playerArt[name]).toEqual(
        FRAMES.map(frame => flightArt[`player-fly-${direction}-${frame}`])
      )
      expect(playerNightArt[name]).toEqual(
        FRAMES.map(frame => PLAYER_NIGHT_ARTS[`player-fly-${direction}-${frame}`])
      )
    }
  })
})

describe('飛行の夜のランタン', () => {
  it.each(KEYS)('%sは体を1ドットも削らず、正本のランタンを全体で重ねる', key => {
    const day = flightArt[key]
    const night = PLAYER_NIGHT_ARTS[key]
    expect(PLAYER_ARTS[key]).toEqual(day)
    expect(validateArt(night, palette, 32, 32)).toEqual([])
    expect(night).not.toEqual(day)
    expect(night.join('')).toContain(LANTERN_GLASS)
    expect(night.join('')).toContain(LANTERN_SHINE)
    const overwritten = day.flatMap((row, y) =>
      [...row].flatMap((char, x) => (char !== '.' && char !== night[y][x] ? [[x, y]] : []))
    )
    expect(overwritten).toEqual([])
    // 背面は立ち姿と同じく画面の左に置くので、正面の面を左右に反転して使う
    const face = directionOf(key) === 'up' ? mirrorX(frontLantern) : frontLantern
    expect(lanternStencil(day, night)).toEqual(
      lanternStencil(
        face.map(row => '.'.repeat(row.length)),
        face
      )
    )
    expect(night.join('').split(LANTERN_GLASS)).toHaveLength(9)
    // 体の箱の余白検査から外した飛行も、夜の灯りごと画布の外周を空ける
    expect(night[0]).toBe('.'.repeat(32))
    expect(night[31]).toBe('.'.repeat(32))
    expect(night.every(row => row[0] === '.' && row[31] === '.')).toBe(true)
    expect([...LIGHT_KEYS, 'm'].filter(char => night.join('').includes(char)).sort()).toEqual([
      LANTERN_SHINE,
      LANTERN_GLASS,
    ])
  })

  it.each(DIRECTIONS)('%sの2コマで灯りは同じ列に立ち、雲の高さの差だけ縦に動く', direction => {
    const keys = FRAMES.map(frame => `player-fly-${direction}-${frame}` as const)
    const [first, second] = keys.map(key => lampOf(flightArt[key], PLAYER_NIGHT_ARTS[key]))
    const shift = LAMP[keys[1]].top - LAMP[keys[0]].top
    expect(second).toEqual(first.map(dot => ({ ...dot, y: dot.y + shift })))
    // 横へは動かさない。縦の差は雲の膨らみの高さの差(0か2行)だけ
    expect([0, 2]).toContain(shift)
  })
})

describe('飛行のPNGシート', () => {
  it.each(DAY_PHASES)('%sは既存55コマの後ろに6コマを同じ順序で焼く', phase => {
    const sheet = buildPlayerSprites(phase)
    expect(sheet.count).toBe(61)
    expect(KEYS.map(key => sheet.index[key])).toEqual([55, 56, 57, 58, 59, 60])
    expect(Object.keys(sheet.index).slice(-6)).toEqual(KEYS)
    expect(sheet.index['player-up-0']).toBe(0)
    expect(sheet.index['player-umbrella-left-1']).toBe(54)
    const read = pixelSampler(sheet)
    const colors = phasePalette(palette, phase)
    for (const key of KEYS) {
      const art = phase === 'night' ? PLAYER_NIGHT_ARTS[key] : flightArt[key]
      const actual = art.flatMap((row, y) => [...row].map((_, x) => read(key, x, y)))
      const expected = art.flatMap(row =>
        [...row].map(char =>
          char === '.' ? { hex: '#000000', alpha: 0 } : { hex: colors[char], alpha: 255 }
        )
      )
      expect(actual, key).toEqual(expected)
    }
  })
})

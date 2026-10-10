// 飛行6コマの画布・配色・風の差分と、夜の灯り・シートへの登録を検証する。
import { describe, expect, it } from 'vitest'
import { PLAYER_FRAME_HEIGHT, PLAYER_FRAME_WIDTH, playerArt, playerNightArt } from './actors'
import { mirrorX, validateArt } from './art'
import type { PixelArt } from './art'
import { flightArt } from './flight-art'
import { frontLantern, LANTERN_GLASS, LANTERN_SHINE, sideLantern } from './lantern'
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
// 手の色の文字(palette.tsのV)
const HAND = 'V'

// 絵の中でcharが置かれた升の座標
const cellsOf = (art: PixelArt, char: string): { x: number; y: number }[] =>
  art.flatMap((row, y) => [...row].flatMap((cell, x) => (cell === char ? [{ x, y }] : [])))

describe('飛行の絵', () => {
  it('約束した3方向2コマだけを持ち、左向きや傘の別コマを増やさない', () => {
    expect(Object.keys(flightArt).sort()).toEqual([...KEYS].sort())
    expect(Object.keys(PLAYER_ARTS).filter(key => key.startsWith('player-fly-'))).toEqual(KEYS)
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

  it.each(FRAMES)('正面%dは立ち姿と同じ向きの帽子・前髪・顔を保つ', frame => {
    const standingFace = PLAYER_ARTS['player-down-0'].slice(12, 25).map(row => row.slice(8, 24))
    for (const arts of [PLAYER_ARTS, PLAYER_NIGHT_ARTS]) {
      const flyingFace = arts[`player-fly-down-${frame}`].slice(8, 21).map(row => row.slice(8, 24))
      expect(flyingFace).toEqual(standingFace)
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
    const face = key.includes('-right-') ? sideLantern : frontLantern
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

  it.each(DIRECTIONS)('%sの灯りの上端は顔ではなく伸ばした手につながる', direction => {
    // 正面は手の真下、横向きは吊り手が手の真横、背面は手の輪郭1升を挟んだ斜め下。
    // 灯りのどこかが体に近いだけでは、手を離れて浮いた描き方を検出できない。
    const grip = {
      down: { x: 24, y: 18, lampX: 24, lampY: 19 },
      up: { x: 25, y: 6, lampX: 26, lampY: 7 },
      right: { x: 26, y: 20, lampX: 27, lampY: 20 },
    }[direction]
    for (const frame of FRAMES) {
      const key = `player-fly-${direction}-${frame}` as const
      const day = flightArt[key]
      const night = PLAYER_NIGHT_ARTS[key]
      expect(day[grip.y][grip.x]).toMatch(/^[KV]$/)
      expect(day[grip.lampY][grip.lampX]).toBe('.')
      expect(night[grip.lampY][grip.lampX]).toBe(direction === 'right' ? 'i' : LANTERN_SHINE)
      if (direction === 'up') expect(day[grip.lampY][grip.x]).toBe('x')
      const addedRows = night.flatMap((row, y) =>
        [...row].flatMap((char, x) => (char === day[y][x] ? [] : [y]))
      )
      expect(Math.min(...addedRows)).toBe(grip.lampY)
    }
  })

  it.each(KEYS)('%sの灯りのガラスは手の下へ縦横とも2升以内に提がる', key => {
    // 手はpalette.tsで頬と手の色にしたV。Kは顔や腕の肌にも使うので数えない。
    // 手より下のガラスだけを数え、手の横や上へ浮いた灯りを手元とみなさない
    const hands = cellsOf(flightArt[key], HAND)
    const glass = cellsOf(PLAYER_NIGHT_ARTS[key], LANTERN_GLASS)
    const reach = Math.min(
      ...hands.flatMap(hand =>
        glass
          .filter(dot => dot.y > hand.y)
          .map(dot => Math.max(Math.abs(dot.x - hand.x), dot.y - hand.y))
      )
    )
    expect(reach).toBeLessThanOrEqual(2)
  })

  it.each(DIRECTIONS)('%sの2コマで手元の灯りの位置を保つ', direction => {
    const positions = FRAMES.map(frame => {
      const key = `player-fly-${direction}-${frame}` as const
      return PLAYER_NIGHT_ARTS[key].flatMap((row, y) =>
        [...row].flatMap((char, x) => (char === flightArt[key][y][x] ? [] : [`${x},${y}:${char}`]))
      )
    })
    expect(positions[0]).toEqual(positions[1])
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

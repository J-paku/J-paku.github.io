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
// どのコマにも必ずある雲の文字。褐色の金(P)は境目の混色にだけ残るので、無いコマもある
const CLOUD_REQUIRED = 'F@&hp'
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
// GPT画の渦。正面0だけ左右に2つ、ほかは1つ。枠の左上の行・列と、枠の中の橙茶(&)の並び(GPT画から採った形のまま)
type Swirl = { top: number; left: number; shape: string[] }
const SWIRLS: Record<(typeof KEYS)[number], Swirl[]> = {
  'player-fly-down-0': [
    { top: 23, left: 10, shape: ['.&&..', '&&&&.', '&....', '&.&.&', '&&..&'] },
    { top: 22, left: 19, shape: ['.&&&&', '&....', '&.&..', '&&&..'] },
  ],
  'player-fly-down-1': [
    { top: 23, left: 11, shape: ['&&&&..', '&..&&.', '&.&.&.', '&&&.&.', '.&..&.'] },
  ],
  'player-fly-up-0': [
    { top: 23, left: 10, shape: ['.&&&..', '&&..&&', '&.&..&', '&..&.&', '.&&..&'] },
  ],
  'player-fly-up-1': [{ top: 23, left: 12, shape: ['.&&&.', '&...&', '&.&.&', '&.&.&', '&&&.&'] }],
  'player-fly-right-0': [
    {
      top: 23,
      left: 12,
      shape: ['...&&&...', '..&...&..', '..&.&.&&.', '..&.&..&.', '&.&&&..&.', '&.....&&&'],
    },
  ],
  'player-fly-right-1': [
    {
      top: 23,
      left: 12,
      shape: ['.&&&&...', '.&...&..', '&&.&..&.', '.&.&..&.', '.&&&..&.', '.....&.&'],
    },
  ],
}
const swirlBox = ({ top, left, shape }: Swirl): Box => ({
  top,
  bottom: top + shape.length - 1,
  left,
  right: left + shape[0].length - 1,
})

// 絵の中でcharsのどれかが置かれた升の座標
const cellsOf = (art: PixelArt, chars: string): { x: number; y: number }[] =>
  art.flatMap((row, y) => [...row].flatMap((cell, x) => (chars.includes(cell) ? [{ x, y }] : [])))
const inBox = (box: Box) => (dot: { x: number; y: number }) =>
  dot.y >= box.top && dot.y <= box.bottom && dot.x >= box.left && dot.x <= box.right
const directionOf = (key: string): Direction => key.split('-')[2] as Direction
// 頭の13行・16列の窓
const headOf = (art: PixelArt, direction: Direction): PixelArt => {
  const { top, left } = HEAD[direction]
  return art.slice(top, top + HEAD_ROWS).map(row => row.slice(left, left + 16))
}
// 頭の窓より下にある主人公の升(手・上着・脚)
const bodyBelowHead = (art: PixelArt, direction: Direction, chars: string) =>
  cellsOf(art, chars).filter(dot => dot.y >= HEAD[direction].top + HEAD_ROWS)
// 夜に灯りとして足された升
const lampOf = (day: PixelArt, night: PixelArt) =>
  night.flatMap((row, y) =>
    [...row].flatMap((char, x) => (char === day[y][x] ? [] : [{ x, y, char }]))
  )
const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

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

  it.each(KEYS)('%sは雲の底を画布の30行目に置き、地面から浮かせる高さを絵に持たない', key => {
    const art = flightArt[key]
    const lowest = Math.max(...cellsOf(art, `x${CLOUD}`).map(dot => dot.y))
    expect(lowest).toBe(30)
    expect(art[30]).toMatch(/^\.+x+(\.+x+)?\.+$/)
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

  it.each(KEYS)('%sは金色の全外周を黒い輪郭で閉じ、GPT画の位置に渦を描く', key => {
    const art = flightArt[key]
    for (const char of CLOUD) {
      const dots = cellsOf(art, char)
      if (CLOUD_REQUIRED.includes(char)) expect(dots.length, `${key} ${char}`).toBeGreaterThan(0)
      expect(dots.every(dot => dot.y >= 14 && dot.y <= 29)).toBe(true)
      for (const { x, y } of dots) {
        // 斜めの角は階段状に接してよいが、上下左右のどこからも背景へ金色が漏れない
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          expect(art[y + dy]?.[x + dx], `${key} (${x},${y})`).not.toBe('.')
          expect(art[y + dy]?.[x + dx]).toBeDefined()
        }
      }
    }
    expect(cellsOf(art, 'F').length).toBeGreaterThan(cellsOf(art, 'p').length)
    expect(cellsOf(art, 'F').length).toBeGreaterThan(cellsOf(art, '&').length)
    // 渦は橙茶(&)の線で、GPT画から採った巻きの形を1升も崩さない
    for (const swirl of SWIRLS[key]) {
      const { top, bottom, left, right } = swirlBox(swirl)
      const window = art.slice(top, bottom + 1).map(row => row.slice(left, right + 1))
      const drawn = window.map(row => [...row].map(char => (char === '&' ? '&' : '.')).join(''))
      expect(drawn, key).toEqual(swirl.shape)
      // 渦の枠の中に背景の穴を開けない
      expect(window.every(row => !row.includes('.'))).toBe(true)
    }
  })

  it.each(KEYS)('%sは陰の金を面で塗り、光は塊か渦の目にだけ置く', key => {
    const art = flightArt[key]
    const at = (x: number, y: number) => art[y]?.[x] ?? '.'
    // 陰(@)は地の黄より少なく、ほとんどが上下左右に陰と続く面になる(1升ずつ散らさない)
    const shade = cellsOf(art, '@')
    expect(shade.length).toBeGreaterThanOrEqual(50)
    expect(shade.length).toBeLessThan(cellsOf(art, 'F').length)
    const joined = shade.filter(({ x, y }) =>
      [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ].some(([dx, dy]) => at(x + dx, y + dy) === '@')
    )
    expect(joined.length / shade.length).toBeGreaterThanOrEqual(0.7)
    // 光(h)は、隣(斜めを含む)に光か淡い金(p)がある塊の一部か、渦の枠の中(渦の目の光)にだけ置く
    const swirls = SWIRLS[key].map(swirlBox)
    for (const dot of cellsOf(art, 'h')) {
      const around = [-1, 0, 1].flatMap(dy =>
        [-1, 0, 1].flatMap(dx => (dx || dy ? [at(dot.x + dx, dot.y + dy)] : []))
      )
      const inBlob = around.some(char => char === 'h' || char === 'p')
      const allowed = inBlob || swirls.some(box => inBox(box)(dot))
      expect(allowed, `${key} (${dot.x},${dot.y})`).toBe(true)
    }
  })

  it('正面0の2つの渦は、橙茶の無い列で左右に分かれる', () => {
    const art = flightArt['player-fly-down-0']
    const [left, right] = SWIRLS['player-fly-down-0'].map(swirlBox)
    const between = { top: 22, bottom: 27, left: left.right + 1, right: right.left - 1 }
    expect(between.right).toBeGreaterThanOrEqual(between.left)
    expect(cellsOf(art, '&').filter(inBox(between))).toEqual([])
  })

  it.each(KEYS)('%sの体は頭の幅に収まり、雲の下の縁より下へ出ない', key => {
    const art = flightArt[key]
    const direction = directionOf(key)
    const { left } = HEAD[direction]
    const head = cellsOf(headOf(art, direction), BODY + 'x').map(dot => dot.x + left)
    const body = bodyBelowHead(art, direction, BODY)
    expect(body.length).toBeGreaterThan(20)
    for (const { x } of body) {
      expect(x).toBeGreaterThanOrEqual(Math.min(...head))
      expect(x).toBeLessThanOrEqual(Math.max(...head))
    }
    // 雲の下の縁より下へ体を出さない(脚は雲の上で組む)
    expect(Math.max(...body.map(dot => dot.y))).toBeLessThanOrEqual(21)
    expect(bodyBelowHead(art, direction, 'KV').length).toBeGreaterThan(0)
  })

  it.each(['down', 'up'] as const)('%sは左右の手のすぐ外側に雲の膨らみがある', direction => {
    for (const frame of FRAMES) {
      const art = flightArt[`player-fly-${direction}-${frame}`]
      const hands = bodyBelowHead(art, direction, direction === 'down' ? 'V' : 'K').filter(
        dot => dot.y === 17
      )
      expect(hands.map(dot => dot.x)).toEqual(direction === 'down' ? [10, 20] : [10, 21])
      const [leftHand, rightHand] = hands
      expect(art[17].slice(leftHand.x - 2, leftHand.x)).toMatch(new RegExp(`^[${CLOUD}]x$`))
      expect(art[17].slice(rightHand.x + 1, rightHand.x + 3)).toMatch(new RegExp(`^x[${CLOUD}]$`))
    }
  })

  it('正面だけ組んだ脚(灰のズボン)が見え、背面と横向きは脚を雲の縁に隠す', () => {
    for (const frame of FRAMES) {
      const front = flightArt[`player-fly-down-${frame}`]
      expect(cellsOf(front, 'z').every(dot => dot.y >= 18 && dot.y <= 19)).toBe(true)
      expect(cellsOf(front, 'z').length).toBeGreaterThanOrEqual(6)
      expect(flightArt[`player-fly-up-${frame}`].join('')).not.toContain('z')
      expect(flightArt[`player-fly-right-${frame}`].join('')).not.toContain('z')
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

  it('横向きは尾の離れた小玉も画布に収め、0は尾の先の横、1は尾の先の上に置く', () => {
    const puffs = {
      0: { top: 20, bottom: 23, left: 1, right: 4 },
      1: { top: 14, bottom: 18, left: 1, right: 5 },
    }
    for (const frame of FRAMES) {
      const art = flightArt[`player-fly-right-${frame}`]
      const puff = puffs[frame]
      const inside = cellsOf(art, `x${CLOUD}`).filter(inBox(puff))
      expect(inside.length).toBeGreaterThanOrEqual(10)
      // 小玉の金色は黒い輪郭で閉じた1つの塊で、上下左右へたどっても尾の金色へつながらない
      const start = cellsOf(art, 'F').find(inBox(puff))
      expect(start).toBeDefined()
      const seen = new Set<string>()
      const stack = start ? [start] : []
      while (stack.length) {
        const dot = stack.pop()
        if (!dot || seen.has(`${dot.x},${dot.y}`)) continue
        seen.add(`${dot.x},${dot.y}`)
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const next = { x: dot.x + dx, y: dot.y + dy }
          if (CLOUD.includes(art[next.y]?.[next.x] ?? '.')) stack.push(next)
        }
      }
      const blob = [...seen].map(cell => {
        const [x, y] = cell.split(',').map(Number)
        return { x, y }
      })
      expect(blob.length).toBeGreaterThanOrEqual(4)
      expect(blob.every(inBox(puff))).toBe(true)
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

  it.each(KEYS)('%sの灯りは手の外側の雲の膨らみに載り、頭とは1列以上空ける', key => {
    // 膝に置いた手の周りは雲で埋まっているので、灯りは手から5升以内の雲の上へ立てる。
    // 顔の真横に浮かせたり、雲から離して宙に置いたりした描き方を検出する
    const direction = directionOf(key)
    const day = flightArt[key]
    const lamp = lampOf(day, PLAYER_NIGHT_ARTS[key])
    const box = LAMP[key]
    expect(lamp.every(inBox(box))).toBe(true)
    expect(Math.min(...lamp.map(dot => dot.y))).toBe(box.top)
    expect(Math.max(...lamp.map(dot => dot.y))).toBe(box.bottom)
    // 受け皿は雲の上の輪郭のすぐ上に置く。受け皿のどこかの真下1行が雲で、受け皿の下に宙の隙間を空けない
    const base = lamp.filter(dot => dot.y === box.bottom)
    expect(base.length).toBe(3)
    const underBase = base.map(dot => day[dot.y + 1][dot.x])
    expect(underBase.some(char => `x${CLOUD}`.includes(char))).toBe(true)
    // 頭の升とは縦横斜めとも1升以上空ける
    const { top, left } = HEAD[direction]
    const head = cellsOf(headOf(day, direction), BODY + 'x').map(dot => ({
      x: dot.x + left,
      y: dot.y + top,
    }))
    const gap = Math.min(...lamp.flatMap(dot => head.map(cell => chebyshev(dot, cell))))
    expect(gap).toBeGreaterThanOrEqual(2)
    // ガラスは手(頭より下の肌)から縦横とも5升以内
    const hands = bodyBelowHead(day, direction, 'KV')
    const glass = lamp.filter(dot => dot.char === LANTERN_GLASS)
    const reach = Math.min(...glass.flatMap(dot => hands.map(hand => chebyshev(dot, hand))))
    expect(reach).toBeLessThanOrEqual(5)
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

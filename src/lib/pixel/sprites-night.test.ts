// 夜だけ差し替える素材を検証する。鍵の集合と並び順が昼と揃っていること、
// 主人公のランタンとポストの LED が夜にだけ灯ること
import { describe, expect, it } from 'vitest'
import { LANTERN_GLASS, LANTERN_SHINE } from './lantern'
import { palette } from './palette'
import { phasePalette } from './palette-phase'
import {
  buildPlayerSprites,
  buildSprites,
  PLAYER_ARTS,
  PLAYER_NIGHT_ARTS,
  SPRITE_ARTS,
  SPRITE_NIGHT_ARTS,
} from './sprites'
import {
  changedKeys,
  lanternPoints,
  lanternStencil,
  lightChars,
  pixelSampler,
  WARM_GLASS,
  WHITE_METAL,
} from './sprites.fixture'
import type { Pixel } from './sprites.fixture'
import type { DayPhase } from '@/utils/day-phase'

describe('夜だけ差し替える素材', () => {
  // 夜にできるのは差し替えだけ。鍵が増減・前後すると、UI が昼の index で夜の画像を引くため町中の絵がずれる
  it('夜の素材は昼と同じ鍵を同じ順序で持つ', () => {
    expect(Object.keys(SPRITE_NIGHT_ARTS)).toEqual(Object.keys(SPRITE_ARTS))
    expect(Object.keys(PLAYER_NIGHT_ARTS)).toEqual(Object.keys(PLAYER_ARTS))
  })

  it('焼き上がった夜のシートも昼と同じ index を同じ順序で持つ', () => {
    // toEqual は鍵の順序を見ないので、並び順は Object.keys の配列にして比べる
    expect(Object.keys(buildSprites('night').index)).toEqual(Object.keys(buildSprites('day').index))
    expect(Object.keys(buildPlayerSprites('night').index)).toEqual(
      Object.keys(buildPlayerSprites('day').index)
    )
  })

  it('主人公の夜のシートはコマ数も高さも昼と同じ', () => {
    const night = buildPlayerSprites('night')
    const day = buildPlayerSprites('day')

    expect(night.count).toBe(day.count)
    expect(night.count).toBe(Object.keys(PLAYER_ARTS).length)
    expect(night.height).toBe(day.height)
  })

  it('夜に絵が変わるのは LED の付くポストだけ', () => {
    // 地形や建物まで夜だけ別の絵になっていないかの見張り。ポストの中で何が変わるかは
    // 「上辺に 5 粒」の検査が持つので、ここは素材の数だけを見る。増やすときは意図的に更新する
    expect(changedKeys(SPRITE_ARTS, SPRITE_NIGHT_ARTS)).toEqual(['mailbox'])
  })

  it('主人公のランタンは夜だけ灯り、昼・明け方・夕方には無い', () => {
    const points = lanternPoints(PLAYER_ARTS, PLAYER_NIGHT_ARTS)
    // 夜だけ灯る点が 1 つも無ければ、夜の絵がランタンを持っていない(差し替えが効いていない)
    expect(points.length, '主人公に「昼は灯り文字でなく夜だけ灯る」点が無い').toBeGreaterThan(0)

    const point = points[0]
    // その座標に昼の絵が何を描くかは昼の素材だけで決まる。'.'(透明)ならアルファ 0、
    // 色付きならその文字を各段階のパレットへ通した色。夜の期待値だけが発光色になる
    const fromDayArt = (phase: DayPhase): Pixel =>
      point.dayChar === '.'
        ? { hex: '#000000', alpha: 0 }
        : { hex: phasePalette(palette, phase)[point.dayChar], alpha: 255 }
    const read = (phase: DayPhase): Pixel =>
      pixelSampler(buildPlayerSprites(phase))(point.key, point.x, point.y)

    // 1 段階ずつ expect すると最初の不一致で打ち切られ、後ろの段階の誤りが隠れる。まとめて 1 回で比べる
    expect({
      night: read('night'),
      day: read('day'),
      dawn: read('dawn'),
      dusk: read('dusk'),
    }).toEqual({
      night: { hex: phasePalette(palette, 'night')[point.nightChar], alpha: 255 },
      day: fromDayArt('day'),
      dawn: fromDayArt('dawn'),
      dusk: fromDayArt('dusk'),
    })
  })

  it('ポストの LED も夜だけ灯る', () => {
    const points = lanternPoints(SPRITE_ARTS, SPRITE_NIGHT_ARTS)
    // 上辺の 5 粒。昼のその場所は輪郭(x)と胴の赤(r)で灯り文字ではないので、5 つとも数えられる
    expect(points, 'ポストに「昼は灯り文字でなく夜だけ灯る」点が無い').toHaveLength(5)

    // 先頭の粒(上辺のいちばん左)で 4 段階ぶんの色を見る
    const point = points[0]
    const fromDayArt = (phase: DayPhase): Pixel =>
      point.dayChar === '.'
        ? { hex: '#000000', alpha: 0 }
        : { hex: phasePalette(palette, phase)[point.dayChar], alpha: 255 }
    const read = (phase: DayPhase): Pixel =>
      pixelSampler(buildSprites(phase))(point.key, point.x, point.y)

    expect({
      night: read('night'),
      day: read('day'),
      dawn: read('dawn'),
      dusk: read('dusk'),
    }).toEqual({
      night: { hex: phasePalette(palette, 'night')[point.nightChar], alpha: 255 },
      day: fromDayArt('day'),
      dawn: fromDayArt('dawn'),
      dusk: fromDayArt('dusk'),
    })
  })

  it('主人公のランタンは正本が決めた 2 文字だけで描く', () => {
    // 別々に描き直されると、灯り色だけが片方でずれても気付けない。
    // ガラスは暖かい黄(9)、笠と受け皿は自分の光を受ける明るい金属(7)
    const player = lightChars(lanternPoints(PLAYER_ARTS, PLAYER_NIGHT_ARTS))
    expect(player).toEqual([LANTERN_GLASS, LANTERN_SHINE].sort())
    expect(player).toEqual(['7', '9'])
  })

  it('夜のランタンは明るい笠・ガラス・明るい受け皿の 3 段になる', () => {
    // 夜は光源以外の色が #101c38 へ 0.68 混ざって闇に沈むので、読めるのは灯り用の文字のドットだけ。
    // その形が縦一様の長方形だと「手に提げた灯り」ではなく「体に付いた黄色い四角」に見える
    // (4 倍の夜の画面で実測した失敗)。上下の段を明るい金物にし、受け皿をガラスより広く
    // 張り出させて初めて手提げの輪郭になる。
    //
    // 期待値は文字ではなく焼き上がりの色で書く。LANTERN_SHINE のような定数で比べると、
    // 定数の中身を暗い金物へ差し替えたとき型紙の形は変わらないまま灯りだけが消え、素通りする
    const stencil = lanternStencil(PLAYER_ARTS['player-down-0'], PLAYER_NIGHT_ARTS['player-down-0'])
    const night = phasePalette(palette, 'night')
    const colorsOf = (row: string): string[] =>
      [...row].filter(ch => ch !== '.').map(ch => night[ch])

    expect({
      rows: stencil.length,
      cap: colorsOf(stencil[0]),
      glass: stencil.slice(1, -1).map(colorsOf),
      base: colorsOf(stencil[stencil.length - 1]),
    }).toEqual({
      rows: 6,
      cap: [WHITE_METAL, WHITE_METAL],
      glass: Array.from({ length: 4 }, () => [WARM_GLASS, WARM_GLASS]),
      base: [WHITE_METAL, WHITE_METAL, WHITE_METAL],
    })
  })

  it('横向きの笠はガラスより広く張り出す', () => {
    // 横向きは体の脇が空くぶん笠を広く取れる面。ここで笠のふちを暗い金物(i)に戻すと、
    // 夜は見えている笠がガラスと同じ幅まで縮み、灯りがまた 1 本の棒に潰れる
    const stencil = lanternStencil(
      PLAYER_ARTS['player-right-0'],
      PLAYER_NIGHT_ARTS['player-right-0']
    )
    const night = phasePalette(palette, 'night')
    const widest = (hex: string): number =>
      Math.max(...stencil.map(row => [...row].filter(ch => ch !== '.' && night[ch] === hex).length))

    expect({ cap: widest(WHITE_METAL), glass: widest(WARM_GLASS) }).toEqual({ cap: 4, glass: 2 })
  })

  it('ポストの LED は上辺に 5 粒だけ並び、赤・緑・紫の順に光る', () => {
    // 昼との差分がそのまま LED の粒になる。縁を 1 周させていた頃はポストの輪郭が丸ごと
    // 虹色へ置き換わり、4 倍表示で丸型ポストの形が読めなくなった。上辺の 5 粒なら
    // 輪郭も赤い胴も昼のまま残るので、粒だけが電飾として浮く
    const dayArt = SPRITE_ARTS.mailbox
    const nightArt = SPRITE_NIGHT_ARTS.mailbox
    const changed = dayArt.flatMap((row, y) =>
      [...row].flatMap((dayChar, x) =>
        nightArt[y][x] === dayChar ? [] : [{ y, x, char: nightArt[y][x] }]
      )
    )

    // 粒の座標と色。ここ以外のマスが 1 つでも動けば置き換え過ぎで、夜だけポストの形が変わる
    expect(changed).toEqual([
      { y: 6, x: 3, char: '+' },
      { y: 6, x: 5, char: '*' },
      { y: 6, x: 7, char: '#' },
      { y: 6, x: 9, char: '+' },
      { y: 6, x: 11, char: '*' },
    ])

    // どの粒も夜には発光色になる(1 つでも普通の色だと、そこだけ消えた粒に見える)
    const night = phasePalette(palette, 'night')
    const day = phasePalette(palette, 'day')
    expect(changed.every(({ char }) => night[char] !== day[char])).toBe(true)
  })

  it('横向きの夜のコマも反転してずれないよう 1〜14 列に収まる', () => {
    for (const key of ['player-right-0', 'player-right-1'] as const) {
      for (const row of PLAYER_NIGHT_ARTS[key]) {
        expect(row[0], key).toBe('.')
        expect(row[15], key).toBe('.')
      }
    }
  })
})

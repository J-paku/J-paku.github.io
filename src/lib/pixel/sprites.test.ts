// スプライト素材の寸法と生成結果を検証する
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { buildSheet, recolor, TILE, validateArt } from './art'
import type { PixelArt, Sheet } from './art'
import { PLAYER_HEIGHT } from './actors'
import { LANTERN_GLASS, LANTERN_SHINE } from './lantern'
import { palette } from './palette'
import { LIGHT_KEYS, phasePalette } from './palette-phase'
import {
  buildPlayerSprites,
  buildSprites,
  buildWeatherSprites,
  PLAYER_ARTS,
  PLAYER_NIGHT_ARTS,
  SPRITE_ARTS,
  SPRITE_NIGHT_ARTS,
} from './sprites'
import type { SpriteKey } from './sprites'
import { weatherArt } from './weather-art'
import { DAY_PHASES } from '@/utils/day-phase'
import type { DayPhase } from '@/utils/day-phase'

// 複数マスに跨る素材を 1 枚の下絵へ戻す。行優先で並べたキーを受け取る
const stitch = (keys: readonly SpriteKey[], columns: number): PixelArt => {
  const rows: string[] = []
  for (let row = 0; row * columns < keys.length; row += 1) {
    for (let y = 0; y < TILE; y += 1) {
      let line = ''
      for (let col = 0; col < columns; col += 1) line += SPRITE_ARTS[keys[row * columns + col]][y]
      rows.push(line)
    }
  }
  return rows
}

const charsOf = (art: PixelArt): Set<string> => new Set(art.join(''))

// 灯り用の文字を 1 つでも含む素材のキーを昇順で返す。予約文字の漏れを見張るのに使う
const litKeys = (arts: Record<string, PixelArt>): string[] =>
  Object.entries(arts)
    .filter(([, art]) => LIGHT_KEYS.some(key => art.join('').includes(key)))
    .map(([key]) => key)
    .sort()

// 自前の PNG は必ずカラータイプ 6・フィルタ 0 なので、IDAT を展開して行頭 1 バイトを捨てれば RGBA に戻る
const decode = (uri: string): { width: number; height: number; data: Uint8Array } => {
  const bytes = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64')
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  const parts: Buffer[] = []
  let at = 8
  while (at + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(at)
    if (bytes.toString('latin1', at + 4, at + 8) === 'IDAT') {
      parts.push(bytes.subarray(at + 8, at + 8 + length))
    }
    at += length + 12
  }
  const raw = inflateSync(Buffer.concat(parts))
  const stride = width * 4
  const data = new Uint8Array(stride * height)
  for (let y = 0; y < height; y += 1) {
    data.set(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), y * stride)
  }
  return { width, height, data }
}

// シートを 1 度だけ展開し、マスの中の座標を指定して #rrggbb を読む
const sampler = (sheet: Sheet): ((key: string, x: number, y: number) => string) => {
  const image = decode(sheet.uri)
  return (key, x, y) => {
    const at = (y * image.width + sheet.index[key] * TILE + x) * 4
    return `#${[0, 1, 2].map(i => image.data[at + i].toString(16).padStart(2, '0')).join('')}`
  }
}

type Pixel = { hex: string; alpha: number }

// sampler と同じ読み方にアルファを足したもの。透明('.')はパレットの文字ではないので、
// 時刻で色を混ぜてもアルファは動かない。つまりアルファの差は色替えでは作れず、
// 「絵そのものが夜だけ違う」ことの証拠になる(シート全体のハッシュ比較と違い、差の中身まで特定できる)
const pixelSampler = (sheet: Sheet): ((key: string, x: number, y: number) => Pixel) => {
  const image = decode(sheet.uri)
  return (key, x, y) => {
    const at = (y * image.width + sheet.index[key] * TILE + x) * 4
    return {
      hex: `#${[0, 1, 2].map(i => image.data[at + i].toString(16).padStart(2, '0')).join('')}`,
      alpha: image.data[at + 3],
    }
  }
}

type LanternPoint = { key: string; x: number; y: number; dayChar: string; nightChar: string }

// 昼は灯り文字でないのに夜だけ灯り文字になる点を集める。これが「昼には無かったランタンのガラス」。
// 灯り文字('4'〜'9')は palette-phase が夜に発光色へ差し替える予約文字で、主人公の昼の絵は 1 つも持たない
const lanternPoints = (
  base: Record<string, PixelArt>,
  night: Record<string, PixelArt>
): LanternPoint[] => {
  const isLit = (ch: string): boolean => LIGHT_KEYS.some(light => light === ch)
  const points: LanternPoint[] = []
  for (const [key, art] of Object.entries(base)) {
    art.forEach((row, y) => {
      Array.from(row).forEach((dayChar, x) => {
        const nightChar = night[key][y][x]
        if (isLit(nightChar) && !isLit(dayChar)) points.push({ key, x, y, dayChar, nightChar })
      })
    })
  }
  return points
}

// 夜に絵が変わった素材のキーを昇順で返す
const changedKeys = (base: Record<string, PixelArt>, night: Record<string, PixelArt>): string[] =>
  Object.keys(base)
    .filter(key => base[key].join('') !== night[key].join(''))
    .sort()

// 灯り文字の集合を昇順で返す。主人公とロボットで比べると「同じ灯りか」が分かる
const lightChars = (points: readonly LanternPoint[]): string[] =>
  [...new Set(points.map(point => point.nightChar))].sort()

// 夜のランタンが実際に出す 2 色。palette-phase.ts の NIGHT_LIGHTS から来る値をここへ書き写すのは、
// 「文字が何であれこの明るさで出ているか」を見たいため(文字の定数を辿ると差し替えに追従してしまう)
const WHITE_METAL = '#ffffff'
const WARM_GLASS = '#fff0a0'

// 昼と夜で違うドットだけを残し、周りの余白を落とす。差分はそのマスへ重ねたランタンそのものなので、
// 「同じ物を提げている」なら主人公の正面とロボットでこの型紙が 1 ドットも違わず一致する
const lanternStencil = (base: PixelArt, night: PixelArt): string[] => {
  const drawn = night
    .map((row, y) => [...row].map((ch, x) => (ch === base[y][x] ? '.' : ch)).join(''))
    .filter(row => /[^.]/.test(row))
  const left = Math.min(...drawn.map(row => row.search(/[^.]/)))
  const right = Math.max(...drawn.map(row => row.replace(/\.+$/, '').length))
  return drawn.map(row => row.slice(left, right))
}

// 文字マトリクスをトーラス状にずらす。天気の 2 コマが平行移動の関係にあることを確かめるのに使う
const shift = (art: PixelArt, dx: number, dy: number): PixelArt =>
  Array.from({ length: TILE }, (_, y) => {
    const row = art[(((y - dy) % TILE) + TILE) % TILE]
    return Array.from({ length: TILE }, (_, x) => row[(((x - dx) % TILE) + TILE) % TILE]).join('')
  })

describe('SPRITE_ARTS', () => {
  it('地形・建物はすべて十六行十六列である', () => {
    for (const art of Object.values(SPRITE_ARTS)) {
      expect(art).toHaveLength(16)
      for (const row of art) expect(row).toHaveLength(16)
    }
  })

  it('すべて登録済みの色だけを使う', () => {
    for (const [key, art] of Object.entries(SPRITE_ARTS)) {
      expect(validateArt(art, palette, TILE), key).toEqual([])
    }
  })

  it('全素材をデータURIのシートへ変換する', () => {
    const sheet = buildSprites()

    expect(sheet.uri.startsWith('data:image/png;base64,')).toBe(true)
    expect(sheet.count).toBe(Object.keys(SPRITE_ARTS).length)
    expect(sheet.height).toBe(TILE)
  })

  it('目印の背景が透明である', () => {
    expect(SPRITE_ARTS.marker.join('')).toContain('.')
  })

  it('経歴碑 2×2 は 32×32 の 1 枚に戻り、下辺が輪郭で接地する', () => {
    const art = stitch(['monument-tl', 'monument-tr', 'monument-bl', 'monument-br'], 2)

    expect(art).toHaveLength(TILE * 2)
    for (const row of art) expect(row).toHaveLength(TILE * 2)
    expect(art[art.length - 1]).toBe(`.${'x'.repeat(TILE * 2 - 2)}.`)
  })

  it('街灯 1×2 は柱がつながり、周りは草を見せるため透明である', () => {
    const top = SPRITE_ARTS['lamp-t']
    const bottom = SPRITE_ARTS['lamp-b']

    // 継ぎ目の 1 行が一致していれば、2 枚を縦に置いたとき柱がずれない
    expect(top[TILE - 1]).toBe(bottom[0])
    expect(charsOf(top).has('.')).toBe(true)
    expect(charsOf(bottom).has('.')).toBe(true)
    // 灯りの文字を持つのは上半分だけ
    expect(charsOf(top).has('9')).toBe(true)
    expect(charsOf(bottom).has('9')).toBe(false)
    // 足元は輪郭で接地し、左右は草に溶ける
    expect(bottom[TILE - 1]).toBe(`....${'x'.repeat(8)}....`)
  })

  it('縦長の碑 1×2 は 16×32 の 1 枚に戻る', () => {
    const art = stitch(['stele-t', 'stele-b'], 1)

    expect(art).toHaveLength(TILE * 2)
    expect(art[art.length - 1]).toBe('x'.repeat(TILE))
  })

  it('机 3×2 は床の色を塗らず透明で抜く', () => {
    const art = stitch(['desk-tl', 'desk-tm', 'desk-tr', 'desk-bl', 'desk-bm', 'desk-br'], 3)

    expect(art).toHaveLength(TILE * 2)
    for (const row of art) expect(row).toHaveLength(TILE * 3)
    // 'p' は部屋の床タイルの色。構造物側で塗ると床の模様が消える
    expect(charsOf(art).has('p')).toBe(false)
    expect(charsOf(art).has('.')).toBe(true)
  })

  it('屋根は赤 2 色と輪郭だけで描かれ、軒だけが木の色を持つ', () => {
    for (const key of ['roof-red-l', 'roof-red-m', 'roof-red-r'] as const) {
      expect([...charsOf(SPRITE_ARTS[key])].sort().join(''), key).toMatch(/^\.?Rrx$/)
    }
    for (const key of ['roof-red-l-low', 'roof-red-m-low', 'roof-red-r-low'] as const) {
      expect([...charsOf(SPRITE_ARTS[key])].sort().join(''), key).toBe('Rekrx')
    }
  })

  it('青い屋根は赤い屋根の色置換で作れる', () => {
    for (const side of ['l', 'm', 'r'] as const) {
      for (const suffix of ['', '-low'] as const) {
        const red = SPRITE_ARTS[`roof-red-${side}${suffix}`]
        const blue = SPRITE_ARTS[`roof-blue-${side}${suffix}`]
        expect(recolor(red, { r: 'u', R: 'U' }), `${side}${suffix}`).toEqual(blue)
      }
    }
  })

  it('壁・窓・扉は同じ位置に柱を持ち、横に並べても継ぎ目が揃う', () => {
    const post = SPRITE_ARTS['wall-m'].map(row => row.slice(0, 4))

    for (const key of ['wall-l', 'wall-r', 'window', 'door', 'entrance-l'] as const) {
      expect(
        SPRITE_ARTS[key].map(row => row.slice(0, 4)),
        key
      ).toEqual(post)
    }
  })
})

describe('PLAYER_ARTS', () => {
  it('主人公はすべて二十四行十六列である', () => {
    for (const art of Object.values(PLAYER_ARTS)) {
      expect(art).toHaveLength(PLAYER_HEIGHT)
      for (const row of art) expect(row).toHaveLength(16)
    }
  })

  it('すべて登録済みの色だけを使う', () => {
    for (const [key, art] of Object.entries(PLAYER_ARTS)) {
      expect(validateArt(art, palette, TILE, PLAYER_HEIGHT), key).toEqual([])
    }
  })

  it('主人公のシートは高さ 24 の別シートになる', () => {
    const sheet = buildPlayerSprites()

    expect(sheet.uri.startsWith('data:image/png;base64,')).toBe(true)
    expect(sheet.count).toBe(Object.keys(PLAYER_ARTS).length)
    expect(sheet.height).toBe(PLAYER_HEIGHT)
  })

  it('静止コマは足元がマスの下辺(最終行)に着き、頭上 4 行は空である', () => {
    for (const key of ['player-up-0', 'player-down-0', 'player-right-0'] as const) {
      const art = PLAYER_ARTS[key]
      expect(art.slice(0, 4).join('')).toBe('.'.repeat(64))
      expect(art[PLAYER_HEIGHT - 1]).toMatch(/x/)
    }
  })

  it('主人公の静止コマと歩行コマが異なる', () => {
    expect(PLAYER_ARTS['player-up-0']).not.toEqual(PLAYER_ARTS['player-up-1'])
    expect(PLAYER_ARTS['player-down-0']).not.toEqual(PLAYER_ARTS['player-down-1'])
    expect(PLAYER_ARTS['player-right-0']).not.toEqual(PLAYER_ARTS['player-right-1'])
  })

  it('軸足が変わっても頭部と胴のドットは変わらない', () => {
    for (const direction of ['up', 'down'] as const) {
      const first = PLAYER_ARTS[`player-${direction}-1`]
      const second = PLAYER_ARTS[`player-${direction}-2`]
      expect(first.slice(0, -1)).toEqual(second.slice(0, -1))
      expect(first.at(-1)).not.toEqual(second.at(-1))
    }
  })

  it('横向きは反転してもずれないよう 1〜14 列に収まる', () => {
    for (const key of ['player-right-0', 'player-right-1'] as const) {
      for (const row of PLAYER_ARTS[key]) {
        expect(row[0]).toBe('.')
        expect(row[15]).toBe('.')
      }
    }
  })

  it('主人公の背景が透明である', () => {
    for (const art of Object.values(PLAYER_ARTS)) expect(art.join('')).toContain('.')
  })
})

describe('時刻ごとのシート', () => {
  // 灯り用の文字へ置き換える前(57314e2)に測った昼のシート。街灯 2 枚と焚き火は新設なので外して比べる
  const BASELINE = { count: 53, length: 3318, sha256: '6852db7f3bd8b941' }

  // 主人公の昼のシートを焼いて取った実測値。主人公にも夜の双子ができたので、地形・建物と同じく
  // バイト同一性で留める。夜の差し替えが昼の絵へ漏れれば枚数・長さ・指紋のどれかが動く。
  // この指紋の先頭は配信ファイル名にも入る(sprites.ts の sheetFileName)ので、
  // ここが動くときは配る URL も変わる = 古い PNG を掴んだままの利用者が出ない
  const PLAYER_BASELINE = { count: 8, length: 1166, sha256: 'acefcbace650ec3f' }

  it('昼のシートは文字置換の前と 1 バイトも変わらない', () => {
    const arts = Object.fromEntries(
      Object.entries(SPRITE_ARTS).filter(
        ([key]) => key !== 'lamp-t' && key !== 'lamp-b' && key !== 'campfire'
      )
    )
    const sheet = buildSheet(arts, phasePalette(palette, 'day'))

    expect(sheet.count).toBe(BASELINE.count)
    expect(sheet.uri).toHaveLength(BASELINE.length)
    expect(createHash('sha256').update(sheet.uri).digest('hex').slice(0, 16)).toBe(BASELINE.sha256)
  })

  it('昼の主人公シートは 1 バイトも変わらない', () => {
    const sheet = buildPlayerSprites('day')

    expect(sheet.count).toBe(PLAYER_BASELINE.count)
    expect(sheet.uri).toHaveLength(PLAYER_BASELINE.length)
    expect(createHash('sha256').update(sheet.uri).digest('hex').slice(0, 16)).toBe(
      PLAYER_BASELINE.sha256
    )
  })

  it('どの段階も同じ並び順・同じ枚数で焼ける', () => {
    const sheets = DAY_PHASES.map(phase => buildSprites(phase))
    const [first] = sheets

    for (const sheet of sheets) {
      expect(sheet.index).toEqual(first.index)
      expect(sheet.count).toBe(Object.keys(SPRITE_ARTS).length)
      expect(sheet.height).toBe(TILE)
    }
    for (const phase of DAY_PHASES) {
      expect(buildPlayerSprites(phase).index).toEqual(buildPlayerSprites('day').index)
    }
  })

  it('夜のシートは昼のシートと別物である', () => {
    expect(buildSprites('night').uri).not.toBe(buildSprites('day').uri)
    expect(buildPlayerSprites('night').uri).not.toBe(buildPlayerSprites('day').uri)
  })

  it('昼は今までの色、夜は発光色になる', () => {
    // '4' が窓のハイライト、'5' が地のガラス。取り違えると夜の窓が 1 段暗くなる
    const lights = [
      { label: '窓ガラスの明るい側', key: 'window', x: 6, y: 4, day: '#a0d0f8', night: '#fff0c0' },
      { label: '窓ガラス', key: 'window', x: 7, y: 4, day: '#78c0e8', night: '#f8d878' },
      { label: 'ロボットのレンズ', key: 'robot', x: 3, y: 8, day: '#6d90ba', night: '#78e0ff' },
      { label: '経歴碑の星', key: 'monument-tl', x: 11, y: 6, day: '#f8e060', night: '#fff0a0' },
      { label: '街灯のガラス', key: 'lamp-t', x: 5, y: 9, day: '#f8e060', night: '#fff0a0' },
      { label: 'モニターの画面', key: 'desk-tm', x: 9, y: 2, day: '#78c0e8', night: '#a8e8ff' },
      { label: 'モニターの光', key: 'desk-tm', x: 10, y: 2, day: '#f0e8d0', night: '#ffffff' },
    ]
    const day = sampler(buildSprites('day'))
    const night = sampler(buildSprites('night'))

    // 1 行ずつ expect すると最初の不一致で打ち切られ、後ろの行の誤りが隠れる。まとめて 1 回で比べる
    const actual = lights.map(light => ({
      label: light.label,
      day: day(light.key, light.x, light.y),
      night: night(light.key, light.x, light.y),
    }))

    expect(actual).toEqual(
      lights.map(light => ({ label: light.label, day: light.day, night: light.night }))
    )
  })

  it('目的地マーカーの赤はどの時刻でも沈まない', () => {
    // 'm' は marker だけが使う色。色調に混ぜると夜は暗い紫(#552533)になり、目印として読めない
    const actual = DAY_PHASES.map(phase => sampler(buildSprites(phase))('marker', 7, 5))

    expect(actual).toEqual(DAY_PHASES.map(() => '#e83828'))
  })

  it('灯り用の文字は予約された素材だけが使う', () => {
    // 地形や主人公がこの文字を持つと、夜に地面や服が光ってしまう。
    // 経歴碑は星が上半分にしかないため tl・tr だけ、机も画面が上段だけなので上 3 枚だけが該当する
    expect(litKeys(SPRITE_ARTS)).toEqual([
      'campfire',
      'desk-tl',
      'desk-tm',
      'desk-tr',
      'lamp-t',
      'monument-tl',
      'monument-tr',
      'robot',
      'window',
    ])
    expect(litKeys(PLAYER_ARTS)).toEqual([])
  })
})

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

  it('夜に絵が変わるのはランタンを持つ素材だけ', () => {
    // 地形や建物まで夜だけ別の絵になっていないかの見張り。増やすときはここを意図的に更新する
    expect(changedKeys(SPRITE_ARTS, SPRITE_NIGHT_ARTS)).toEqual(['robot'])
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

  it('ロボットのランタンも夜だけ灯る', () => {
    const points = lanternPoints(SPRITE_ARTS, SPRITE_NIGHT_ARTS)
    expect(points.length, 'ロボットに「昼は灯り文字でなく夜だけ灯る」点が無い').toBeGreaterThan(0)

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

  it('主人公とロボットのランタンは同じ灯りの文字を使う', () => {
    // 同じ道具なら灯る色も同じ。別々に描くと、片方だけ別の文字(=別の灯り色)になっても気付けない
    const player = lightChars(lanternPoints(PLAYER_ARTS, PLAYER_NIGHT_ARTS))
    const robot = lightChars(lanternPoints(SPRITE_ARTS, SPRITE_NIGHT_ARTS))

    expect(player).toEqual(robot)
    // 正本(lantern.ts)が決めた 2 文字だけを使う。どちらも街灯と同じ灯り用の予約文字で、
    // ガラスは暖かい黄(9)、笠と受け皿は自分の光を受ける明るい金属(7)
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

  it('ロボットが提げるのは主人公の正面と同じ 1 枚の絵である', () => {
    // 昼との差分を切り出すと、そのマスへ重ねたランタンの形そのものになる。
    // 形が 1 ドットでも違えば、どちらかが別に描かれている
    const robot = lanternStencil(SPRITE_ARTS.robot, SPRITE_NIGHT_ARTS.robot)

    expect(robot).toEqual(
      lanternStencil(PLAYER_ARTS['player-down-0'], PLAYER_NIGHT_ARTS['player-down-0'])
    )
    // 4 倍表示で灯りが消えないよう、ガラスは 2 列 × 4 行の塊を保つ
    expect(robot.filter(row => row.includes('99'))).toHaveLength(4)
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

describe('焚き火', () => {
  it('どの段階のシートにも同じ索引で載る', () => {
    const at = Object.keys(SPRITE_ARTS).indexOf('campfire')

    expect(at).toBeGreaterThanOrEqual(0)
    expect(DAY_PHASES.map(phase => buildSprites(phase).index.campfire)).toEqual(
      DAY_PHASES.map(() => at)
    )
  })

  it('夜だけの差し替えを持たない(昼も燃えている絵 1 枚で足りる)', () => {
    expect(SPRITE_NIGHT_ARTS.campfire).toEqual(SPRITE_ARTS.campfire)
  })

  it('炎の身は夜に発光し、外側のふちだけが暗く沈む', () => {
    // (7,5) は炎の上半身、(7,8) は下半身。どちらも灯り用の文字('9')。
    // ここが黄(F)のままだと夜に #5a5b45 まで落ち、炎が「黄色い塊に暗い縁が付いたもの」に見える。
    // (5,8) は外側のふち('r')で、ここは夜に沈んだままでよい — 沈むから炎の輪郭になる
    const day = sampler(buildSprites('day'))
    const night = sampler(buildSprites('night'))

    expect({
      upper: { day: day('campfire', 7, 5), night: night('campfire', 7, 5) },
      lower: { day: day('campfire', 7, 8), night: night('campfire', 7, 8) },
      edge: { day: day('campfire', 5, 8), night: night('campfire', 5, 8) },
    }).toEqual({
      upper: { day: palette['9'], night: phasePalette(palette, 'night')['9'] },
      lower: { day: palette['9'], night: phasePalette(palette, 'night')['9'] },
      edge: { day: palette.r, night: phasePalette(palette, 'night').r },
    })
  })

  it('黄色いドットは 1 つ残らず灯り用の文字で描く', () => {
    // 昼は '9' と F が同じ色なので、F が 1 つ混じっていても昼の絵では気付けない。
    // 気付けるのは夜だけで、そこだけ暗い黄土のドットとして炎に穴が開く
    expect(charsOf(SPRITE_ARTS.campfire).has('F')).toBe(false)
    expect(charsOf(SPRITE_ARTS.campfire).has('9')).toBe(true)
  })

  it('炎を灯り用の文字へ移しても昼のタイルは 1 バイトも変わらない', () => {
    // 文字を入れ替える前(F のまま)に焼いて取った実測値。'9' の昼の色は F と同じ #f8e060 なので、
    // 色を替えたのではなく発光する文字へ移しただけなら昼のタイルはここへ一致する。
    // 動いたときは「昼の絵のほうを触った」ということなので、この値を書き換えて合わせない
    const CAMPFIRE_DAY = { length: 266, sha256: 'a0dffbdc7976d42c' }
    const sheet = buildSheet({ campfire: SPRITE_ARTS.campfire }, phasePalette(palette, 'day'))

    expect(sheet.uri).toHaveLength(CAMPFIRE_DAY.length)
    expect(createHash('sha256').update(sheet.uri).digest('hex').slice(0, 16)).toBe(
      CAMPFIRE_DAY.sha256
    )
    // 指紋だけだと「なぜ一致していられるのか」が残らないので、昼の色が等しいことも直接言う
    expect(phasePalette(palette, 'day')['9']).toBe(phasePalette(palette, 'day').F)
  })
})

describe('天気のシート', () => {
  it('雨・雪ともコマごとに 16×16 ちょうどの 1 枚を返す', () => {
    const sheets = buildWeatherSprites()

    for (const kind of ['rain', 'snow'] as const) {
      expect(sheets[kind], kind).toHaveLength(2)
      for (const sheet of sheets[kind]) {
        const image = decode(sheet.uri)
        expect(sheet.count, kind).toBe(1)
        expect(sheet.height, kind).toBe(TILE)
        // 繰り返し単位が 1 マスちょうどであること。2 コマを 1 枚へ並べると単位が 2 マス幅になり、
        // コマ送りが「落ちる」ではなく「横へ 1 マスずれる」動きになってしまう
        expect([image.width, image.height], kind).toEqual([TILE, TILE])
      }
    }
  })

  it('2 コマは中身が違う', () => {
    const sheets = buildWeatherSprites()

    for (const kind of ['rain', 'snow'] as const) {
      const [first, second] = sheets[kind]
      expect(first.uri, kind).not.toBe(second.uri)
      expect(weatherArt[kind][0], kind).not.toEqual(weatherArt[kind][1])
    }
  })

  it('雪は主人公専用のモノクロを借りず、雪専用の文字だけで描く', () => {
    for (const art of weatherArt.snow) {
      const used = charsOf(art)
      // '3'・'1' は主人公専用。借りると主人公を塗り替えたとき雪の色まで黙って変わる
      expect(used.has('3')).toBe(false)
      expect(used.has('1')).toBe(false)
      expect(used.has('N') || used.has('O')).toBe(true)
    }
  })

  it('2 コマ目は 1 コマ目を半マス分ずらしたものなので、端で絵がつながる', () => {
    expect(weatherArt.rain[1]).toEqual(shift(weatherArt.rain[0], -4, 8))
    expect(weatherArt.snow[1]).toEqual(shift(weatherArt.snow[0], 1, 8))
  })

  it('粒はまばらで、地面を覆い隠さない', () => {
    for (const kind of ['rain', 'snow'] as const) {
      for (const art of weatherArt[kind]) {
        const lit = art.join('').replace(/\./g, '').length
        expect(lit, kind).toBeGreaterThan(0)
        expect(lit, kind).toBeLessThan(TILE * TILE * 0.1)
      }
    }
  })
})

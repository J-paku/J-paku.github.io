// スプライトの単体テストが共有する道具一式。焼いた PNG を RGBA へ戻して 1 ドットずつ読む読み取り器と、
// 昼と夜の絵の差を型紙として取り出す道具を集める。主題ごとに分かれた sprites*.test.ts が同じ読み方を使うため、
// ここが唯一の正本(同じ復号を各所へ書き写すと、片方だけ直したとき別の絵を見ていることに気付けない)。
// Vitest が拾うのは src/**/*.test.ts だけなので、この名前は検査として実行されない
import { inflateSync } from 'node:zlib'
import { TILE } from './art'
import type { PixelArt, Sheet } from './art'
import { LIGHT_KEYS } from './palette-phase'
import { SPRITE_ARTS } from './sprites'
import type { SpriteKey } from './sprites'

// 複数マスに跨る素材を 1 枚の下絵へ戻す。行優先で並べたキーを受け取る
export const stitch = (keys: readonly SpriteKey[], columns: number): PixelArt => {
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

export const charsOf = (art: PixelArt): Set<string> => new Set(art.join(''))

// 灯り用の文字を 1 つでも含む素材のキーを昇順で返す。予約文字の漏れを見張るのに使う
export const litKeys = (arts: Record<string, PixelArt>): string[] =>
  Object.entries(arts)
    .filter(([, art]) => LIGHT_KEYS.some(key => art.join('').includes(key)))
    .map(([key]) => key)
    .sort()

// 自前の PNG は必ずカラータイプ 6・フィルタ 0 なので、IDAT を展開して行頭 1 バイトを捨てれば RGBA に戻る
export const decode = (uri: string): { width: number; height: number; data: Uint8Array } => {
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
export const sampler = (sheet: Sheet): ((key: string, x: number, y: number) => string) => {
  const image = decode(sheet.uri)
  return (key, x, y) => {
    const at = (y * image.width + sheet.index[key] * TILE + x) * 4
    return `#${[0, 1, 2].map(i => image.data[at + i].toString(16).padStart(2, '0')).join('')}`
  }
}

export type Pixel = { hex: string; alpha: number }

// sampler と同じ読み方にアルファを足したもの。透明('.')はパレットの文字ではないので、
// 時刻で色を混ぜてもアルファは動かない。つまりアルファの差は色替えでは作れず、
// 「絵そのものが夜だけ違う」ことの証拠になる(シート全体のハッシュ比較と違い、差の中身まで特定できる)
export const pixelSampler = (sheet: Sheet): ((key: string, x: number, y: number) => Pixel) => {
  const image = decode(sheet.uri)
  return (key, x, y) => {
    const at = (y * image.width + sheet.index[key] * TILE + x) * 4
    return {
      hex: `#${[0, 1, 2].map(i => image.data[at + i].toString(16).padStart(2, '0')).join('')}`,
      alpha: image.data[at + 3],
    }
  }
}

export type LanternPoint = { key: string; x: number; y: number; dayChar: string; nightChar: string }

// 昼は灯り文字でないのに夜だけ灯り文字になる点を集める。これが「昼には無かったランタンのガラス」。
// 灯り文字('4'〜'9')は palette-phase が夜に発光色へ差し替える予約文字で、主人公の昼の絵は 1 つも持たない
export const lanternPoints = (
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
export const changedKeys = (
  base: Record<string, PixelArt>,
  night: Record<string, PixelArt>
): string[] =>
  Object.keys(base)
    .filter(key => base[key].join('') !== night[key].join(''))
    .sort()

// 灯り文字の集合を昇順で返す。主人公とロボットで比べると「同じ灯りか」が分かる
export const lightChars = (points: readonly LanternPoint[]): string[] =>
  [...new Set(points.map(point => point.nightChar))].sort()

// 夜のランタンが実際に出す 2 色。palette-phase.ts の NIGHT_LIGHTS から来る値をここへ書き写すのは、
// 「文字が何であれこの明るさで出ているか」を見たいため(文字の定数を辿ると差し替えに追従してしまう)
export const WHITE_METAL = '#ffffff'
export const WARM_GLASS = '#fff0a0'

// 昼と夜で違うドットだけを残し、周りの余白を落とす。差分はそのマスへ重ねたランタンそのものなので、
// 「同じ物を提げている」なら主人公の正面とロボットでこの型紙が 1 ドットも違わず一致する
export const lanternStencil = (base: PixelArt, night: PixelArt): string[] => {
  const drawn = night
    .map((row, y) => [...row].map((ch, x) => (ch === base[y][x] ? '.' : ch)).join(''))
    .filter(row => /[^.]/.test(row))
  const left = Math.min(...drawn.map(row => row.search(/[^.]/)))
  const right = Math.max(...drawn.map(row => row.replace(/\.+$/, '').length))
  return drawn.map(row => row.slice(left, right))
}

// 文字マトリクスをトーラス状にずらす。天気の 2 コマが平行移動の関係にあることを確かめるのに使う
export const shift = (art: PixelArt, dx: number, dy: number): PixelArt =>
  Array.from({ length: TILE }, (_, y) => {
    const row = art[(((y - dy) % TILE) + TILE) % TILE]
    return Array.from({ length: TILE }, (_, x) => row[(((x - dx) % TILE) + TILE) % TILE]).join('')
  })

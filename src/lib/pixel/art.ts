// ドット絵エンジン。文字マトリクスを組み立て・検証し、1枚のスプライトシートPNGへ変換する
// CHRバンク方式に倣い、8×8部品4枚で16×16メタタイルを作る。DOM・Reactには一切依存しない
// SVG ではなく PNG にするのは描画コストのため。SVG の data URI を background-image にすると
// マスごとに SVG 文書の描画が走り、町(約 700 マス)の 1 回の再描画に約 200ms 掛かる(実測)。
// 書体の読み込みなどで舞台が再描画されるたびに主スレッドが止まり、その間のキー入力が落ちる
import { pngDataUri } from './png'
import type { RgbaImage } from './png'

export type Palette = Record<string, string> // 1文字→CSS色。'.'は透明(登録不要)
export type PixelArt = readonly string[] // 行の配列。全行同じ長さ
// tile は 1 枚の幅、height は高さ(px)。地形・建物は正方形、主人公は縦長(頭がマスの上へはみ出す)
export type Sheet = {
  uri: string
  index: Record<string, number>
  count: number
  tile: number
  height: number
}

// クライアントの配置計算には画像本体を渡さない。
export type SheetLayout = Pick<Sheet, 'index' | 'count' | 'tile' | 'height'>

export const PART = 8
export const TILE = 16

// 透明を表す文字。パレットに登録しない
const EMPTY = '.'

// 左右反転。各行の文字順を逆にする
export const mirrorX = (art: PixelArt): PixelArt => art.map(row => [...row].reverse().join(''))

// 上下反転。行の並びを逆にする
export const mirrorY = (art: PixelArt): PixelArt => [...art].reverse()

const isPart = (art: PixelArt): boolean =>
  art.length === PART && art.every(row => row.length === PART)

// 8×8部品4枚→16×16。順は左上・右上・左下・右下
export const compose = (tl: PixelArt, tr: PixelArt, bl: PixelArt, br: PixelArt): PixelArt => {
  if (![tl, tr, bl, br].every(isPart)) {
    throw new Error(`部品は${PART}×${PART}である必要があります`)
  }
  const top = tl.map((row, i) => row + tr[i])
  const bottom = bl.map((row, i) => row + br[i])
  return [...top, ...bottom]
}

// 文字置換(屋根色の差し替え等)。mapに無い文字はそのまま
export const recolor = (art: PixelArt, map: Record<string, string>): PixelArt =>
  art.map(row => [...row].map(ch => map[ch] ?? ch).join(''))

// 行数が height・行長が width と一致し、'.'以外の全文字がパレットにあることを確かめる。問題は文字列で返す
export const validateArt = (
  art: PixelArt,
  palette: Palette,
  width: number,
  height: number = width
): string[] => {
  const issues: string[] = []
  if (art.length !== height) issues.push(`行数が${height}ではありません(${art.length})`)
  // 同じ未定義文字を何度も報告しない
  const reported = new Set<string>()
  art.forEach((row, y) => {
    if (row.length !== width) issues.push(`${y}行目の長さが${width}ではありません(${row.length})`)
    Array.from(row).forEach(ch => {
      if (ch === EMPTY || palette[ch] !== undefined || reported.has(ch)) return
      reported.add(ch)
      issues.push(`パレットに無い文字です(${ch})`)
    })
  })
  return issues
}

// パレットの CSS 色を RGBA へ。対応は #rgb・#rrggbb・#rrggbbaa の 16 進表記だけ
export const parseHexColor = (css: string): [number, number, number, number] => {
  const hex = css.startsWith('#') ? css.slice(1) : ''
  const digits = hex.length === 3 ? [...hex].map(ch => ch + ch).join('') : hex
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(digits)) {
    throw new Error(`16進表記の色ではありません(${css})`)
  }
  const value = Number.parseInt(digits.padEnd(8, 'f'), 16)
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

// アートを横一列に並べて RGBA へ落とす。'.' は透明(0,0,0,0)。全アートは同じ幅・高さであること
export const rasterize = (
  arts: readonly PixelArt[],
  palette: Palette,
  size: number,
  height: number = size
): RgbaImage => {
  const width = arts.length * size
  const data = new Uint8Array(width * height * 4)
  arts.forEach((art, i) => {
    art.forEach((row, y) => {
      Array.from(row).forEach((ch, x) => {
        if (ch === EMPTY) return
        const fill = palette[ch]
        if (fill === undefined) return
        data.set(parseHexColor(fill), (y * width + i * size + x) * 4)
      })
    })
  })
  return { width, height, data }
}

// 全アートを横一列に並べた1枚のPNG(data URI)。index[key]=何枚目か。
// height を渡すと縦長のタイル(幅は TILE のまま)になる
export const buildSheet = (
  arts: Record<string, PixelArt>,
  palette: Palette,
  height: number = TILE
): Sheet => {
  const keys = Object.keys(arts)
  const index: Record<string, number> = {}
  keys.forEach((key, i) => {
    const issues = validateArt(arts[key], palette, TILE, height)
    if (issues.length > 0) throw new Error(`${key}: ${issues.join('\n')}`)
    index[key] = i
  })
  return {
    uri: pngDataUri(
      rasterize(
        keys.map(key => arts[key]),
        palette,
        TILE,
        height
      )
    ),
    index,
    count: keys.length,
    tile: TILE,
    height,
  }
}

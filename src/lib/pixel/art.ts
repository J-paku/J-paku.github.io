// ドット絵エンジン。文字マトリクスを組み立て・検証し、1枚のスプライトシートSVGへ変換する
// CHRバンク方式に倣い、8×8部品4枚で16×16メタタイルを作る。DOM・Reactには一切依存しない

export type Palette = Record<string, string> // 1文字→CSS色。'.'は透明(登録不要)
export type PixelArt = readonly string[] // 行の配列。全行同じ長さ
export type Sheet = { uri: string; index: Record<string, number>; count: number; tile: number }

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

// 行数・行長がsizeと一致し、'.'以外の全文字がパレットにあることを確かめる。問題は文字列で返す
export const validateArt = (art: PixelArt, palette: Palette, size: number): string[] => {
  const issues: string[] = []
  if (art.length !== size) issues.push(`行数が${size}ではありません(${art.length})`)
  // 同じ未定義文字を何度も報告しない
  const reported = new Set<string>()
  art.forEach((row, y) => {
    if (row.length !== size) issues.push(`${y}行目の長さが${size}ではありません(${row.length})`)
    Array.from(row).forEach(ch => {
      if (ch === EMPTY || palette[ch] !== undefined || reported.has(ch)) return
      reported.add(ch)
      issues.push(`パレットに無い文字です(${ch})`)
    })
  })
  return issues
}

// 横ランレングスで<rect>を出す(同色連続は1つにまとめる)。'.'は出力しない
export const toSvgRects = (art: PixelArt, palette: Palette, dx: number, dy: number): string => {
  let out = ''
  art.forEach((row, y) => {
    const chars = [...row]
    let x = 0
    while (x < chars.length) {
      const ch = chars[x]
      let end = x + 1
      while (end < chars.length && chars[end] === ch) end += 1
      const fill = palette[ch]
      if (ch !== EMPTY && fill !== undefined) {
        const w = end - x
        out += `<rect x="${dx + x}" y="${dy + y}" width="${w}" height="1" fill="${fill}"/>`
      }
      x = end
    }
  })
  return out
}

// 全アートを横一列に並べた1枚のSVG(data URI)。index[key]=何枚目か
export const buildSheet = (arts: Record<string, PixelArt>, palette: Palette): Sheet => {
  const keys = Object.keys(arts)
  const index: Record<string, number> = {}
  let rects = ''
  keys.forEach((key, i) => {
    const art = arts[key]
    const issues = validateArt(art, palette, TILE)
    if (issues.length > 0) throw new Error(`${key}: ${issues.join('\n')}`)
    index[key] = i
    rects += toSvgRects(art, palette, i * TILE, 0)
  })
  const width = keys.length * TILE
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${TILE}" ` +
    `viewBox="0 0 ${width} ${TILE}" shape-rendering="crispEdges">${rects}</svg>`
  return {
    uri: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    index,
    count: keys.length,
    tile: TILE,
  }
}

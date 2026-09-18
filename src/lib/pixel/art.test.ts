// ドット絵エンジン(mirror・compose・recolor・validateArt・toSvgRects・buildSheet)のテスト
import type { PixelArt } from './art'
import {
  PART,
  TILE,
  buildSheet,
  compose,
  mirrorX,
  mirrorY,
  recolor,
  toSvgRects,
  validateArt,
} from './art'

const palette = { a: '#111111', b: '#222222', c: '#333333', d: '#444444' }
// 指定文字だけで埋めた8×8部品
const part = (ch: string): PixelArt => Array.from({ length: PART }, () => ch.repeat(PART))
// 指定文字だけで埋めた16×16アート
const tile = (ch: string): PixelArt => Array.from({ length: TILE }, () => ch.repeat(TILE))
// 文字列中の<rect>の数
const countRects = (svg: string): number => svg.split('<rect').length - 1

describe('mirrorX', () => {
  it('各行の文字順を逆にする', () => {
    expect(mirrorX(['ab.', '..c'])).toEqual(['.ba', 'c..'])
  })
  it('2回かけると元に戻る', () => {
    const art = ['abc', 'c.a']
    expect(mirrorX(mirrorX(art))).toEqual(art)
  })
})

describe('mirrorY', () => {
  it('行の並びを逆にする', () => {
    expect(mirrorY(['ab', 'cd', 'ef'])).toEqual(['ef', 'cd', 'ab'])
  })
})

describe('compose', () => {
  it('8×8の部品4枚を左上・右上・左下・右下の順で16×16にする', () => {
    const art = compose(part('a'), part('b'), part('c'), part('d'))
    expect(art.length).toBe(TILE)
    expect(art[0]).toBe('a'.repeat(PART) + 'b'.repeat(PART))
    expect(art[PART - 1]).toBe('a'.repeat(PART) + 'b'.repeat(PART))
    expect(art[PART]).toBe('c'.repeat(PART) + 'd'.repeat(PART))
    expect(art.every(row => row.length === TILE)).toBe(true)
  })
  it('7行の部品が混ざると例外を投げる', () => {
    const broken = part('a').slice(0, 7)
    expect(() => compose(broken, part('b'), part('c'), part('d'))).toThrow()
    expect(() => compose(part('a'), part('b'), part('c'), broken)).toThrow()
  })
  it('行長が8でない部品も例外を投げる', () => {
    const narrow = Array.from({ length: PART }, () => 'aaa')
    expect(() => compose(narrow, part('b'), part('c'), part('d'))).toThrow()
  })
})

describe('recolor', () => {
  it('mapにある文字だけ置換し、無い文字はそのまま残す', () => {
    expect(recolor(['ab.', 'ba.'], { a: 'x' })).toEqual(['xb.', 'bx.'])
  })
  it('空のmapなら元の内容と同じ', () => {
    expect(recolor(['ab', '.c'], {})).toEqual(['ab', '.c'])
  })
})

describe('validateArt', () => {
  it('問題が無ければ空配列', () => {
    expect(validateArt(['ab', '.a'], palette, 2)).toEqual([])
  })
  it('行数がsizeと違うと報告する', () => {
    const issues = validateArt(['ab'], palette, 2)
    expect(issues.length).toBe(1)
    expect(issues[0]).toContain('行数')
  })
  it('行長がsizeと違うと報告する', () => {
    const issues = validateArt(['abc', 'ab'], palette, 2)
    expect(issues.length).toBe(1)
    expect(issues[0]).toContain('0行目')
  })
  it('パレットに無い文字を1回だけ報告する', () => {
    const issues = validateArt(['zz', 'z.'], palette, 2)
    expect(issues.length).toBe(1)
    expect(issues[0]).toContain('z')
  })
  it('透明文字はパレット未登録でも問題にしない', () => {
    expect(validateArt(['..', '..'], palette, 2)).toEqual([])
  })
})

describe('toSvgRects', () => {
  it('同色の横連続を1つの<rect>にまとめる', () => {
    expect(countRects(toSvgRects(['aabb'], palette, 0, 0))).toBe(2)
    expect(toSvgRects(['aabb'], palette, 0, 0)).toContain('width="2"')
  })
  it('透明文字は出力せず、連続も分断する', () => {
    // aa . bb → 2枚。a.a → 2枚
    expect(countRects(toSvgRects(['aa.bb'], palette, 0, 0))).toBe(2)
    expect(countRects(toSvgRects(['a.a'], palette, 0, 0))).toBe(2)
    expect(countRects(toSvgRects(['....'], palette, 0, 0))).toBe(0)
  })
  it('dx・dyだけ座標をずらす', () => {
    const svg = toSvgRects(['.aa'], palette, 16, 3)
    expect(svg).toContain('x="17"')
    expect(svg).toContain('y="3"')
    expect(svg).toContain('height="1"')
    expect(svg).toContain(`fill="${palette.a}"`)
  })
  it('行ごとに<rect>を出す', () => {
    expect(countRects(toSvgRects(['aa', 'bb', 'ab'], palette, 0, 0))).toBe(4)
  })
})

describe('buildSheet', () => {
  it('data URIのプレフィックス・枚数・タイルサイズを返す', () => {
    const sheet = buildSheet({ grass: tile('a'), path: tile('b') }, palette)
    expect(sheet.uri.startsWith('data:image/svg+xml,')).toBe(true)
    expect(sheet.count).toBe(2)
    expect(sheet.tile).toBe(TILE)
  })
  it('indexはObject.keysの順に0始まりで振る', () => {
    const sheet = buildSheet({ grass: tile('a'), path: tile('b'), water: tile('c') }, palette)
    expect(sheet.index).toEqual({ grass: 0, path: 1, water: 2 })
  })
  it('SVGの幅はcount×16で、shape-renderingを持つ', () => {
    const sheet = buildSheet({ grass: tile('a'), path: tile('b') }, palette)
    const svg = decodeURIComponent(sheet.uri.replace('data:image/svg+xml,', ''))
    expect(svg).toContain('width="32"')
    expect(svg).toContain('viewBox="0 0 32 16"')
    expect(svg).toContain('shape-rendering="crispEdges"')
    expect(countRects(svg)).toBe(TILE * 2)
  })
  it('不正なアートがあればキー名を含む例外を投げる', () => {
    expect(() => buildSheet({ grass: tile('a'), bad: ['aa'] }, palette)).toThrow(/bad/)
  })
})

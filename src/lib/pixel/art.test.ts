// ドット絵エンジン(mirror・compose・recolor・validateArt・parseHexColor・rasterize・buildSheet)のテスト
import type { PixelArt } from './art'
import {
  PART,
  TILE,
  buildSheet,
  compose,
  mirrorX,
  mirrorY,
  parseHexColor,
  rasterize,
  recolor,
  validateArt,
} from './art'
import { bytesOfDataUri, decodePng, pixelAt } from './png.test-helper'

const palette = { a: '#111111', b: '#222222', c: '#333333', d: '#444444' }
// 指定文字だけで埋めた8×8部品
const part = (ch: string): PixelArt => Array.from({ length: PART }, () => ch.repeat(PART))
// 指定文字だけで埋めた16×16アート
const tile = (ch: string): PixelArt => Array.from({ length: TILE }, () => ch.repeat(TILE))

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

describe('parseHexColor', () => {
  it('#rrggbb を不透明の RGBA にする', () => {
    expect(parseHexColor('#15161b')).toEqual([0x15, 0x16, 0x1b, 255])
  })
  it('#rgb と #rrggbbaa も読む', () => {
    expect(parseHexColor('#f00')).toEqual([255, 0, 0, 255])
    expect(parseHexColor('#00ff0080')).toEqual([0, 255, 0, 0x80])
  })
  it('16進表記でなければ例外を投げる', () => {
    expect(() => parseHexColor('red')).toThrow()
    expect(() => parseHexColor('#12345')).toThrow()
  })
})

describe('rasterize', () => {
  it('アートを横一列に並べ、幅は枚数×size になる', () => {
    const image = rasterize(
      [
        ['aa', 'bb'],
        ['cc', 'dd'],
      ],
      palette,
      2
    )
    expect(image.width).toBe(4)
    expect(image.height).toBe(2)
    expect(pixelAt(image, 0, 0)).toEqual([0x11, 0x11, 0x11, 255])
    expect(pixelAt(image, 1, 1)).toEqual([0x22, 0x22, 0x22, 255])
    expect(pixelAt(image, 2, 0)).toEqual([0x33, 0x33, 0x33, 255])
    expect(pixelAt(image, 3, 1)).toEqual([0x44, 0x44, 0x44, 255])
  })
  it('透明文字は (0,0,0,0) のまま残す', () => {
    const image = rasterize([['a.', '.a']], palette, 2)
    expect(pixelAt(image, 1, 0)).toEqual([0, 0, 0, 0])
    expect(pixelAt(image, 0, 1)).toEqual([0, 0, 0, 0])
    expect(pixelAt(image, 0, 0)).toEqual([0x11, 0x11, 0x11, 255])
  })
})

describe('buildSheet', () => {
  it('PNG の data URI・枚数・タイルサイズを返す', () => {
    const sheet = buildSheet({ grass: tile('a'), path: tile('b') }, palette)
    expect(sheet.uri.startsWith('data:image/png;base64,')).toBe(true)
    expect(sheet.count).toBe(2)
    expect(sheet.tile).toBe(TILE)
  })
  it('indexはObject.keysの順に0始まりで振る', () => {
    const sheet = buildSheet({ grass: tile('a'), path: tile('b'), water: tile('c') }, palette)
    expect(sheet.index).toEqual({ grass: 0, path: 1, water: 2 })
  })
  it('PNG の幅は count×16・高さは 16 で、各タイルの色がパレットと一致する', () => {
    const sheet = buildSheet({ grass: tile('a'), path: tile('b') }, palette)
    const image = decodePng(bytesOfDataUri(sheet.uri))
    expect(image.width).toBe(TILE * 2)
    expect(image.height).toBe(TILE)
    expect(pixelAt(image, 0, 0)).toEqual([0x11, 0x11, 0x11, 255])
    expect(pixelAt(image, TILE - 1, TILE - 1)).toEqual([0x11, 0x11, 0x11, 255])
    expect(pixelAt(image, TILE, 0)).toEqual([0x22, 0x22, 0x22, 255])
    expect(pixelAt(image, TILE * 2 - 1, TILE - 1)).toEqual([0x22, 0x22, 0x22, 255])
  })
  it('不正なアートがあればキー名を含む例外を投げる', () => {
    expect(() => buildSheet({ grass: tile('a'), bad: ['aa'] }, palette)).toThrow(/bad/)
  })
})

// PNG 符号化(チャンク構造・CRC・フィルタ 0 の行・data URI)のテスト
import { crc32, encodePng, pngDataUri } from './png'
import { bytesOfDataUri, decodePng, pixelAt, readChunks } from './png.test-helper'

// 2×2・左上から赤・緑・青・透明
const sample = {
  width: 2,
  height: 2,
  data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0]),
}

describe('crc32', () => {
  it('既知の値(IEND チャンクの CRC)と一致する', () => {
    expect(crc32(Uint8Array.from('IEND', ch => ch.charCodeAt(0)))).toBe(0xae426082)
  })
  it('空列は 0', () => {
    expect(crc32(new Uint8Array(0))).toBe(0)
  })
})

describe('encodePng', () => {
  it('署名・IHDR・IDAT・IEND の順で並ぶ', () => {
    const png = encodePng(sample)
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(readChunks(png).map(c => c.type)).toEqual(['IHDR', 'IDAT', 'IEND'])
  })
  it('IHDR は幅・高さ・8bit・RGBA を持つ', () => {
    const ihdr = readChunks(encodePng(sample)).find(c => c.type === 'IHDR')!
    expect([...ihdr.data]).toEqual([0, 0, 0, 2, 0, 0, 0, 2, 8, 6, 0, 0, 0])
  })
  it('各チャンクの CRC が型名+データから再計算した値と一致する', () => {
    const png = encodePng(sample)
    let offset = 8
    while (offset < png.length) {
      const length =
        (png[offset] << 24) | (png[offset + 1] << 16) | (png[offset + 2] << 8) | png[offset + 3]
      const body = png.subarray(offset + 4, offset + 8 + length)
      const stored = png.subarray(offset + 8 + length, offset + 12 + length)
      expect([...stored]).toEqual([...encodeCrc(crc32(body))])
      offset += 12 + length
    }
  })
  it('復号すると元のピクセルへ戻る', () => {
    const image = decodePng(encodePng(sample))
    expect(image.width).toBe(2)
    expect(image.height).toBe(2)
    expect(pixelAt(image, 0, 0)).toEqual([255, 0, 0, 255])
    expect(pixelAt(image, 1, 0)).toEqual([0, 255, 0, 255])
    expect(pixelAt(image, 0, 1)).toEqual([0, 0, 255, 255])
    expect(pixelAt(image, 1, 1)).toEqual([0, 0, 0, 0])
  })
  it('正方形でない画像(3×2)でも行の長さを幅から取り、復号すると元のピクセルへ戻る', () => {
    // 3×2・6ピクセルをそれぞれ別の色にして行/列のずれを検出できるようにする
    const wide = {
      width: 3,
      height: 2,
      data: Uint8Array.from([
        255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255, 0, 255, 255, 255, 255, 0,
        255, 255,
      ]),
    }
    const image = decodePng(encodePng(wide))
    expect(image.width).toBe(3)
    expect(image.height).toBe(2)
    expect(pixelAt(image, 2, 1)).toEqual([255, 0, 255, 255])
  })
  it('ピクセル列の長さが寸法と合わなければ例外を投げる', () => {
    expect(() => encodePng({ width: 2, height: 2, data: new Uint8Array(15) })).toThrow()
    expect(() => encodePng({ width: 0, height: 1, data: new Uint8Array(0) })).toThrow()
  })
  it('幅または高さが 0 なら例外を投げる', () => {
    // 幅 0・高さ 0 はどちらも長さの検査(0 === 0)を素通りするので、寸法そのものの番人が要る。
    // ここが片方だけになると、もう片方は 0×N の PNG(IHDR だけ 0、IDAT は空)が黙って焼き上がり、
    // 読み込んだ側で初めて壊れた画像として現れる
    expect(() => encodePng({ width: 0, height: 1, data: new Uint8Array(0) })).toThrow()
    expect(() => encodePng({ width: 1, height: 0, data: new Uint8Array(0) })).toThrow()
    expect(() => encodePng({ width: 0, height: 0, data: new Uint8Array(0) })).toThrow()
  })
  it('幅または高さが負なら例外を投げる', () => {
    expect(() => encodePng({ width: -1, height: 2, data: new Uint8Array(0) })).toThrow()
    expect(() => encodePng({ width: 2, height: -1, data: new Uint8Array(0) })).toThrow()
    expect(() => encodePng({ width: -2, height: -2, data: new Uint8Array(16) })).toThrow()
  })
})

describe('pngDataUri', () => {
  it('base64 の data URI になり、戻すと同じ PNG', () => {
    const uri = pngDataUri(sample)
    expect(uri.startsWith('data:image/png;base64,')).toBe(true)
    expect([...bytesOfDataUri(uri)]).toEqual([...encodePng(sample)])
  })
})

const encodeCrc = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

// RGBA のピクセル列を PNG(8bit・カラータイプ 6・フィルタ 0・非インターレース)へ符号化する。
// ビルド時にスプライトシートを作るためだけに使うので、依存は Node の zlib に留める
import { deflateSync } from 'node:zlib'

export type RgbaImage = {
  width: number
  height: number
  // 左上から行優先で 1 ピクセル 4 バイト(R・G・B・A)
  data: Uint8Array
}

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const BYTES_PER_PIXEL = 4

// CRC-32(IEEE 802.3)。PNG の各チャンクは型名とデータに対するこの値を末尾に持つ
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const uint32 = (value: number): Uint8Array =>
  Uint8Array.from([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ])

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

// 長さ・型名・データ・CRC の順。CRC は型名とデータに対して計算する
const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const typeBytes = Uint8Array.from(type, ch => ch.charCodeAt(0))
  const body = concat([typeBytes, data])
  return concat([uint32(data.length), body, uint32(crc32(body))])
}

export const encodePng = ({ width, height, data }: RgbaImage): Uint8Array => {
  if (width <= 0 || height <= 0 || data.length !== width * height * BYTES_PER_PIXEL) {
    throw new Error(`ピクセル列の長さが ${width}×${height}×4 と一致しません(${data.length})`)
  }
  const ihdr = concat([
    uint32(width),
    uint32(height),
    // ビット深度 8・カラータイプ 6(RGBA)・圧縮 0・フィルタ 0・インターレース無し
    Uint8Array.from([8, 6, 0, 0, 0]),
  ])
  // 各行の先頭にフィルタ種別 0(無加工)を置く。絵が小さいので予測フィルタは使わない
  const stride = width * BYTES_PER_PIXEL
  const raw = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  }
  return concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ])
}

export const pngDataUri = (image: RgbaImage): string =>
  `data:image/png;base64,${Buffer.from(encodePng(image)).toString('base64')}`

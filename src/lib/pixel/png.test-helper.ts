// テスト専用の最小 PNG 復号。encodePng が出す形(8bit RGBA・フィルタ 0・IDAT 1 個)だけを読む
import { inflateSync } from 'node:zlib'
import type { RgbaImage } from './png'

type Chunk = { type: string; data: Uint8Array }

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]) >>>
  0

export const readChunks = (png: Uint8Array): Chunk[] => {
  const chunks: Chunk[] = []
  let offset = 8
  while (offset < png.length) {
    const length = readUint32(png, offset)
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8))
    chunks.push({ type, data: png.subarray(offset + 8, offset + 8 + length) })
    offset += 12 + length
  }
  return chunks
}

export const decodePng = (png: Uint8Array): RgbaImage => {
  const chunks = readChunks(png)
  const ihdr = chunks.find(c => c.type === 'IHDR')
  const idat = chunks.find(c => c.type === 'IDAT')
  if (ihdr === undefined || idat === undefined) throw new Error('IHDR か IDAT がありません')
  const width = readUint32(ihdr.data, 0)
  const height = readUint32(ihdr.data, 4)
  const raw = new Uint8Array(inflateSync(idat.data))
  const stride = width * 4
  const data = new Uint8Array(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    if (filter !== 0) throw new Error(`${y} 行目のフィルタが 0 ではありません(${filter})`)
    data.set(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), y * stride)
  }
  return { width, height, data }
}

export const pixelAt = (
  image: RgbaImage,
  x: number,
  y: number
): [number, number, number, number] => {
  const i = (y * image.width + x) * 4
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]]
}

// data URI の base64 部分をバイト列へ戻す
export const bytesOfDataUri = (uri: string): Uint8Array => {
  const prefix = 'data:image/png;base64,'
  if (!uri.startsWith(prefix)) throw new Error('PNG の data URI ではありません')
  return new Uint8Array(Buffer.from(uri.slice(prefix.length), 'base64'))
}

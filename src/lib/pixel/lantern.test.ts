// ランタンの型紙(3 面)と、型紙を絵へ重ねる overlayLantern のテスト
import { vi } from 'vitest'
import type { PixelArt } from './art'
import { TILE } from './art'

// 型紙は lantern.ts を読み込む時に組み立て、主人公の夜のコマは actors.ts を読み込む時に型紙を重ねて作る。
// 組み立てや重ね合わせの失敗をテストの失敗として拾えるよう、どちらもテストの中で読み込み直す
const loadLantern = async () => {
  vi.resetModules()
  return import('./lantern')
}

// 縦の枠の金物の文字。lantern.ts の外へは出していないので、ここで名指しする
const FRAME = 'i'

// ガラスの文字が並ぶ列を、ガラスを含む行ごとに返す
const glassColumns = (face: PixelArt, glass: string): number[][] =>
  face
    .map(row => [...row].flatMap((ch, x) => (ch === glass ? [x] : [])))
    .filter(columns => columns.length > 0)

describe('ランタンの型紙', () => {
  it('3 面ともどの行もタイルの幅で、透明・ガラス・枠・明るい金属の 4 文字だけで描く', async () => {
    const { frontLantern, backLantern, sideLantern, LANTERN_GLASS, LANTERN_SHINE } =
      await loadLantern()
    const allowed = new Set(['.', LANTERN_GLASS, FRAME, LANTERN_SHINE])
    for (const face of [frontLantern, backLantern, sideLantern]) {
      expect(face.every(row => row.length === TILE)).toBe(true)
      expect(face.flatMap(row => [...row]).filter(ch => !allowed.has(ch))).toEqual([])
    }
  })
  it('正面と横向きのガラスは、同じ 2 列が縦に 4 行続く塊になる', async () => {
    const { frontLantern, sideLantern, LANTERN_GLASS } = await loadLantern()
    for (const face of [frontLantern, sideLantern]) {
      const rows = glassColumns(face, LANTERN_GLASS)
      expect(rows).toHaveLength(4)
      const [left, right] = rows[0]
      expect(right).toBe(left + 1)
      expect(rows).toEqual(rows.map(() => [left, right]))
    }
  })
  it('主人公のどのコマへ重ねても体のドットと重ならず、夜のコマを組み立てられる', async () => {
    vi.resetModules()
    await expect(import('./actors')).resolves.toHaveProperty('playerNightArt')
  })
})

describe('overlayLantern', () => {
  it('型紙の . は元の絵を残し、それ以外の文字を top 行目から重ねる', async () => {
    const { overlayLantern } = await loadLantern()
    const art = ['ab..', '....', 'c...']
    expect(overlayLantern(art, ['..9.', '.7..'], 1)).toEqual(['ab..', '..9.', 'c7..'])
  })
  it('型紙の外の行はそのまま返す', async () => {
    const { overlayLantern } = await loadLantern()
    const art = ['a...', '....', '...b']
    expect(overlayLantern(art, ['.9..'], 1)).toEqual(['a...', '.9..', '...b'])
  })
  it('元の絵にドットがある所へ重ねたら、列と行を添えて例外を投げる', async () => {
    const { overlayLantern } = await loadLantern()
    const art = ['....', '..a.']
    expect(() => overlayLantern(art, ['..9.'], 1)).toThrow('ランタンが絵と重なっています(2列1行)')
  })
})

// 地図の地形タイルの色(MINI_COLORS)と建物の色(structureColor)のテスト
import { describe, expect, it, vi } from 'vitest'
import type { Structure, Tile } from '@content/types/world'
import { MINI_COLORS, structureColor } from './map-colors'

// server-onlyはvitest(node環境)では無条件に例外を投げるので、中身を持たないmockに差し替える
vi.mock('server-only', () => ({}))

import { readWorldSet } from '@/lib/content/read'

const HEX = /^#[0-9a-f]{6}$/

// #rrggbbから赤と青の0〜255を取り出す
const redBlueOf = (hex: string): { r: number; b: number } => ({
  r: parseInt(hex.slice(1, 3), 16),
  b: parseInt(hex.slice(5, 7), 16),
})

const worlds = Object.values(readWorldSet().worlds)

const house = (roof: 'red' | 'blue'): Structure => ({
  id: `house-${roof}`,
  kind: 'house',
  roof,
  area: { x: 0, y: 0, w: 4, h: 4 },
  solid: { x: 0, y: 2, w: 4, h: 2 },
  doorX: 1,
})

describe('MINI_COLORS', () => {
  it('全12種のタイルが#rrggbbの色を持つ', () => {
    const tiles = Object.keys(MINI_COLORS)
    expect(tiles).toHaveLength(12)
    for (const color of Object.values(MINI_COLORS)) {
      expect(color).toMatch(HEX)
    }
  })

  it('屋外のワールドに出るタイルはどれも色を持つ', () => {
    const outdoor = worlds.filter(world => world.kind === 'exterior')
    expect(outdoor.length).toBeGreaterThan(0)
    const used = new Set<Tile>(outdoor.flatMap(world => world.tiles.flat()))
    for (const tile of used) {
      expect(MINI_COLORS[tile]).toMatch(HEX)
    }
  })

  it('草の市松(grass-alt)は地図では草と同じ1色に塗る', () => {
    expect(MINI_COLORS['grass-alt']).toBe(MINI_COLORS.grass)
  })

  it('通れない水・木は、歩ける草・道と別の色で塗り分ける', () => {
    for (const blocked of ['water', 'tree'] as const) {
      for (const walkable of ['grass', 'path'] as const) {
        expect(MINI_COLORS[blocked]).not.toBe(MINI_COLORS[walkable])
      }
    }
  })
})

describe('structureColor', () => {
  it('赤い屋根の家は赤みの勝つ色で塗る', () => {
    const { r, b } = redBlueOf(structureColor(house('red')))
    expect(r).toBeGreaterThan(b)
  })

  it('青い屋根の家は青みの勝つ色で塗る', () => {
    const { r, b } = redBlueOf(structureColor(house('blue')))
    expect(b).toBeGreaterThan(r)
  })

  it('家以外は種類ごとの色を返す(ワールドに置かれていない石碑も含む)', () => {
    const stele: Structure = { id: 'stele', kind: 'stele', cell: { x: 0, y: 0 } }
    expect(structureColor(stele)).toMatch(HEX)
  })

  it('ワールドに置かれた全ての建物・置物が#rrggbbの色を持つ', () => {
    const structures = worlds.flatMap(world => world.structures)
    expect(structures.some(s => s.kind === 'house')).toBe(true)
    for (const structure of structures) {
      expect(structureColor(structure)).toMatch(HEX)
    }
  })
})

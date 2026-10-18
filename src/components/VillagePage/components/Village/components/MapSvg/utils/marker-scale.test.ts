// 点の印を描くかどうかの縮尺の境目(DOT_MARKER_SCALE_LIMIT)のテスト。
// MapSvgとPlayerMarkerはscale < DOT_MARKER_SCALE_LIMITでミニマップ扱いにするので、
// 2つの地図の縮尺が境目のどちら側にあるかを見る
import { describe, expect, it } from 'vitest'
import { DOT_MARKER_SCALE_LIMIT } from './marker-scale'

// Minimap/index.tsxのscale={4}とWorldMap/index.tsxのSCALE = 16。どちらもコンポーネント内の値でexportされていない
const MINIMAP_SCALE = 4
const WORLD_MAP_SCALE = 16

describe('DOT_MARKER_SCALE_LIMIT', () => {
  it('ミニマップの縮尺4は境目より小さく、点の印を描く側に入る', () => {
    expect(MINIMAP_SCALE < DOT_MARKER_SCALE_LIMIT).toBe(true)
  })

  it('拡大地図の縮尺16は境目以上で、点の印を描かない側に入る', () => {
    expect(WORLD_MAP_SCALE < DOT_MARKER_SCALE_LIMIT).toBe(false)
  })
})

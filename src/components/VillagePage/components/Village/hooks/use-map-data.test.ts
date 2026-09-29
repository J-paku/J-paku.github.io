// @vitest-environment happy-dom
// 地図とミニマップへ渡す派生値(useMapData)のテスト。実データのワールドセットと日本語の文言で、
// 地点名・一覧・扉の印の中身と、入力の変わった値だけを作り直すメモ化を確かめる
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { World } from '@content/types/world'
import { doorMarkers } from '@/lib/village/door-marker'
import { mapEntries } from '@/lib/village/map-entries'
import { useMapData, type MapDataOptions } from './use-map-data'

// server-onlyはNext.jsのビルド境界専用ガードで、vitestでは無条件に例外を投げる。
// テストでは中身を持たないmockに差し替え、読み込み専用の@/lib/content/readを素通しにする
vi.mock('server-only', () => ({}))

import { readVillageText, readWorldSet } from '@/lib/content/read'

const worldSet = readWorldSet()
const text = readVillageText('ja')
const worlds = Object.values(worldSet.worlds)
const allSpots = worlds.flatMap(world => world.spots)

const pick = <T>(label: string, found: T | undefined): T => {
  if (found === undefined) throw new Error(`${label}がcontentに無い`)
  return found
}

// 屋内へ通じる扉を持つワールド(屋外)と、扉の印を持たない屋内のワールド
const outdoor = pick(
  '扉の印を持つワールド',
  worlds.find(world => doorMarkers(worldSet, world).length > 0)
)
const indoor = pick(
  '屋内のワールド',
  worlds.find(world => world.kind === 'interior')
)
// 屋外のコース地点。訪ねると一覧の印が訪問済みに変わる
const courseSpot = pick(
  '屋外のコース地点',
  outdoor.spots.find(spot => spot.order !== undefined)
)

const optionsIn = (world: World, visited: ReadonlySet<string> = new Set()): MapDataOptions => ({
  worldSet,
  text,
  world,
  visited,
})

const renderMapData = (initialProps: MapDataOptions) =>
  renderHook((props: MapDataOptions) => useMapData(props), { initialProps })

describe('useMapData', () => {
  it('地点名は今いないワールドの地点も含め、全ワールドの地点から作る', () => {
    const { result } = renderMapData(optionsIn(outdoor))

    // 屋外にいても屋内の地点の名前を持つ(地図の一覧は自室の地点も並べる)
    expect(Object.keys(result.current.placeNames).sort()).toEqual(
      allSpots.map(spot => spot.id).sort()
    )
  })

  it('時計・釣り場の地点名は専用の欄から、それ以外は地点ごとの文言から引く', () => {
    const clockSpot = pick(
      '時計の地点',
      allSpots.find(spot => spot.action === 'clock')
    )
    const fishingSpot = pick(
      '釣り場の地点',
      allSpots.find(spot => spot.action === 'fishing')
    )
    const stopSpot = pick(
      '会話窓を開く地点',
      allSpots.find(spot => spot.action === undefined)
    )
    const { result } = renderMapData(optionsIn(outdoor))

    expect(result.current.placeNames[clockSpot.id]).toBe(text.clock.place)
    expect(result.current.placeNames[fishingSpot.id]).toBe(text.fishing.place)
    expect(result.current.placeNames[stopSpot.id]).toBe(text.stops[stopSpot.id].place)
  })

  it('一覧と扉の印は今いるワールドから作り、屋内へ移ると扉の印は無くなる', () => {
    const visited = new Set<string>()
    const { result, rerender } = renderMapData(optionsIn(outdoor, visited))

    expect(result.current.entries).toEqual(mapEntries(worldSet, outdoor, visited))
    expect(result.current.doors).toEqual(doorMarkers(worldSet, outdoor))
    const placeNamesBefore = result.current.placeNames

    rerender(optionsIn(indoor, visited))

    expect(result.current.entries).toEqual(mapEntries(worldSet, indoor, visited))
    expect(result.current.doors).toEqual([])
    // 地点名は全ワールドから作るので、ワールドを移っても作り直さない
    expect(result.current.placeNames).toBe(placeNamesBefore)
  })

  it('訪問が増えると一覧だけ作り直し、地点名と扉の印は同じ実体のまま', () => {
    const { result, rerender } = renderMapData(optionsIn(outdoor, new Set()))
    const before = result.current
    expect(before.entries.find(entry => entry.id === courseSpot.id)?.visited).toBe(false)

    rerender(optionsIn(outdoor, new Set([courseSpot.id])))

    expect(result.current.entries.find(entry => entry.id === courseSpot.id)?.visited).toBe(true)
    expect(result.current.placeNames).toBe(before.placeNames)
    expect(result.current.doors).toBe(before.doors)
  })

  it('入力が同じ実体なら、描き直しても3つとも同じ実体を返す', () => {
    const options = optionsIn(outdoor)
    const { result, rerender } = renderMapData(options)
    const before = result.current

    // 呼び出し元は描き直すたびに新しいoptionsを組むが、中の値は同じ実体
    rerender({ ...options })

    expect(result.current.placeNames).toBe(before.placeNames)
    expect(result.current.entries).toBe(before.entries)
    expect(result.current.doors).toBe(before.doors)
  })
})

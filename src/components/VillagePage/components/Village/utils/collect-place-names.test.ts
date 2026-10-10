// 地図とミニマップへ渡す地点名(collectPlaceNames)のテスト。実データのワールドセットと日本語の文言で、
// 今いないワールドの地点も含めて全ワールドの地点から作ることと、地点の種類ごとの名前の引き先を見る
import { describe, expect, it, vi } from 'vitest'
import { collectPlaceNames } from './collect-place-names'

// server-onlyはvitest(node環境)では無条件に例外を投げるので、中身を持たないmockに差し替える
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

describe('collectPlaceNames', () => {
  it('地点名は今いないワールドの地点も含め、全ワールドの地点から作る', () => {
    const names = collectPlaceNames(worldSet, text)

    expect(Object.keys(names).sort()).toEqual(allSpots.map(spot => spot.id).sort())
    // 屋外にいても屋内の地点の名前を持つ(地図の一覧は自室の地点も並べる)
    const indoor = pick(
      '屋内のワールド',
      worlds.find(world => world.kind === 'interior' && world.spots.length > 0)
    )
    for (const spot of indoor.spots) expect(names).toHaveProperty(spot.id)
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
    const names = collectPlaceNames(worldSet, text)

    expect(names[clockSpot.id]).toBe(text.clock.place)
    expect(names[fishingSpot.id]).toBe(text.fishing.place)
    expect(names[stopSpot.id]).toBe(text.stops[stopSpot.id].place)
  })
})

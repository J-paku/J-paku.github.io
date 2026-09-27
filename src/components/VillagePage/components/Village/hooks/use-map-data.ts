// 地図とミニマップに渡す派生値(地点名・一覧・扉の印)を作る
import { useMemo } from 'react'
import type { VillageText, World, WorldSet } from '@content/types/world'
import { doorMarkers, type DoorMarker } from '@/lib/village/door-marker'
import { mapEntries, type MapEntry } from '@/lib/village/map-entries'
import { placeName } from '../utils/spot-text'

export type MapDataOptions = {
  worldSet: WorldSet
  text: VillageText
  world: World
  visited: ReadonlySet<string>
}

type UseMapData = {
  placeNames: Record<string, string>
  entries: MapEntry[]
  doors: DoorMarker[]
}

export function useMapData({ worldSet, text, world, visited }: MapDataOptions): UseMapData {
  // 地図の一覧は今いないワールドの地点も並べるので、名前は全ワールドの地点から作る
  const placeNames = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        Object.values(worldSet.worlds)
          .flatMap(w => w.spots)
          .map(s => [s.id, placeName(text, s)])
      ),
    [worldSet, text]
  )
  const entries = useMemo(() => mapEntries(worldSet, world, visited), [worldSet, world, visited])
  // 屋内の地点は屋外の地図に載らないので、そこへ通じる扉に印を置く
  const doors = useMemo(() => doorMarkers(worldSet, world), [worldSet, world])

  return { placeNames, entries, doors }
}

// 地図とミニマップに渡す地点名(地点 id → 地点名)を作る
import type { VillageText, WorldSet } from '@content/types/world'
import { placeName } from './spot-text'

// 地図の一覧は今いないワールドの地点も並べるので、名前は今のワールドに絞らず全ワールドの地点から作る
export const collectPlaceNames = (worldSet: WorldSet, text: VillageText): Record<string, string> =>
  Object.fromEntries(
    Object.values(worldSet.worlds)
      .flatMap(w => w.spots)
      .map(s => [s.id, placeName(text, s)])
  )

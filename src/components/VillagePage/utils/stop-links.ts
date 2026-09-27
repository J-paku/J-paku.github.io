// 地点ごとのリンク先(作品ルート・外部 URL・リンク無し)を解決する純粋関数
import type { Locale } from '@content/types/content'
import type { VillageText, WorldSet } from '@content/types/world'
import { toHref } from '@/utils/locale-path'

type StopLinks = {
  stopHrefs: Record<string, string | null>
  stopExternal: Record<string, boolean>
}

// 地点ごとのリンク先。story は言語付きの作品ルート、external はそのまま。地点は全ワールド分
// (コース外の地点にも将来リンクが付く可能性があるため、allSpots ではなく全地点を対象にする)
export const resolveStopLinks = (
  worldSet: WorldSet,
  text: VillageText,
  locale: Locale
): StopLinks => {
  const stopHrefs: Record<string, string | null> = {}
  const stopExternal: Record<string, boolean> = {}
  const spots = Object.values(worldSet.worlds).flatMap(world => world.spots)
  for (const spot of spots) {
    const link = text.stops[spot.id]?.link
    if (link === undefined) {
      stopHrefs[spot.id] = null
      stopExternal[spot.id] = false
    } else if (link.target.kind === 'story') {
      stopHrefs[spot.id] = toHref(`/works/${link.target.slug}`, locale)
      stopExternal[spot.id] = false
    } else {
      stopHrefs[spot.id] = link.target.url
      stopExternal[spot.id] = true
    }
  }
  return { stopHrefs, stopExternal }
}

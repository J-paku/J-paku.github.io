// 会話窓に出す中身を決める。地点の会話か釣りの窓かを 1 つにまとめ、StopModal を 1 か所だけで描かせる
import type { Spot, StopText, VillageText } from '@content/types/world'

export type DialogInput = {
  mode: 'walk' | 'talk' | 'map' | 'clock' | 'fishing'
  activeSpot: Spot | null
  // 釣りの結果窓の文言。出す物が無ければ null
  fishingStop: StopText | null
  text: VillageText
  stopHrefs: Record<string, string | null>
  stopExternal: Record<string, boolean>
}

export type Dialog = {
  stop: StopText
  href: string | null
  external: boolean
  closeLabel: string
}

// 「次へ」の有無と行き先(hasNext・onNext)は A ボタンと共用するので use-village が持つ
export const pickDialog = ({
  mode,
  activeSpot,
  fishingStop,
  text,
  stopHrefs,
  stopExternal,
}: DialogInput): Dialog | null =>
  mode === 'talk' && activeSpot !== null
    ? {
        stop: text.stops[activeSpot.id],
        href: stopHrefs[activeSpot.id] ?? null,
        external: stopExternal[activeSpot.id] ?? false,
        closeLabel: text.close,
      }
    : mode === 'fishing' && fishingStop !== null
      ? {
          stop: fishingStop,
          href: null,
          external: false,
          closeLabel: text.close,
        }
      : null

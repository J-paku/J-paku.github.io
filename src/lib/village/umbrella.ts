// 雨の日に扉を出入りするときの傘の出し入れの判定。傘のコマと時間は player-pose.ts が持つ。
// 傘を差すのは雨の屋外だけで、雪・晴れと屋内は対象にしない
import type { World } from '@content/types/world'
import type { UmbrellaPose } from './player-pose'

// ワールドの移動の前後どちらで傘を動かすか。屋外から屋内へは畳み終えてから切り替え(close-before)、
// 屋内から屋外へは切り替えた後に広げる(open-after)。屋外どうし・屋内どうしと雨でないときは動かさない
export type UmbrellaWarpPlan = 'close-before' | 'open-after' | 'none'

export const planUmbrellaWarp = (from: World, to: World, raining: boolean): UmbrellaWarpPlan => {
  if (!raining) return 'none'
  const fromExterior = from.kind === 'exterior'
  const toExterior = to.kind === 'exterior'
  if (fromExterior && !toExterior) return 'close-before'
  if (!fromExterior && toExterior) return 'open-after'
  return 'none'
}

// いるワールドと天気だけで決まる、動きを伴わない傘の状態。雨の屋外なら差したまま(時間表を持たない open)、
// それ以外は傘なし。出し入れの動きを見せずに今の状態へ揃えるときに使う
export const restingUmbrella = (world: World, raining: boolean): UmbrellaPose | null =>
  world.kind === 'exterior' && raining ? { phase: 'open', since: 0 } : null

// 池での釣りの規則。立っているマスと向きだけで判定し、釣果は会話地点と同じ StopText へ写す。
// 画面も時間も持たない純粋関数に閉じ、待ち時間の長さだけを定数として画面に渡す
import type { CareerFeature, CareerRole } from '@content/types/content'
import type { Cell, Direction, FishingText, StopText, World } from '@content/types/world'

import { isWalkable } from './collision'
import { facedCell } from './spot'

export type Facing = { cell: Cell; facing: Direction }

// 投げる時間(「……」を出している間)と、かかるまでの間
export const FISHING_CAST_MS = 1400
export const FISHING_BITE_MS = 900
// 巻物が水面の上に浮いている間
export const FISHING_LAND_MS = 500

// 立っているマスが通行可で、向いている 1 マス先が water なら釣れる。
// 地図の外を向いた時は tiles の行が無いので、そのまま undefined になって false へ落ちる
export const isFishingSpot = (world: World, at: Facing): boolean => {
  if (!isWalkable(world, at.cell)) return false
  const front = facedCell(at)
  return world.tiles[front.y]?.[front.x] === 'water'
}

// 空なら null。まだ釣っていない(name が caughtNames に無い)機能を優先して 1 件選ぶ。
// 未取得が無くなったら元の列から選ぶ。村は全部を釣り上げた後は投げないのでこの分岐を通らないが、
// 空でない列には必ず 1 件返す約束として残す
export const pickCatch = <T extends { name: string }>(
  items: readonly T[],
  caughtNames: ReadonlySet<string>,
  random: () => number = Math.random
): T | null => {
  if (items.length === 0) return null
  const fresh = items.filter(item => !caughtNames.has(item.name))
  const pool = fresh.length > 0 ? fresh : items
  return pool[Math.floor(random() * pool.length)]
}

// 全部を釣り上げたか。空の列は「集め終えた」と言えないので false
export const isCollectionComplete = (
  items: readonly { name: string }[],
  caughtNames: ReadonlySet<string>
): boolean => items.length > 0 && items.every(item => caughtNames.has(item.name))

// 水辺の吹き出しの文言・ボタン・形をここ 1 か所で決める。
// 全部を釣り上げた後は「釣る」ボタンを出さず、考え事の吹き出し(thought)に切り替える
export const waterBubble = (
  text: FishingText,
  exhausted: boolean
): { text: string; label: string | undefined; kind: 'speech' | 'thought' } =>
  exhausted
    ? { text: text.exhausted, label: undefined, kind: 'thought' }
    : { text: text.prompt, label: text.go, kind: 'speech' }

// 結果窓の StopText。釣り上げた機能を、地点の会話と同じ並び(主張・根拠・補足)へ写す
export const catchToStop = (
  feature: CareerFeature,
  text: FishingText,
  roleLabels: Record<CareerRole, string>,
  last = false
): StopText => ({
  place: text.caughtPlace,
  title: feature.name,
  claim: text.caughtClaim.replace('{date}', feature.date),
  proof: text.caughtTech.replace('{tech}', feature.tech.join(' / ')),
  // last は全部が揃う最後の 1 つ。もう投げないので「もう一度投げて」の一言を空にして描かせない
  hook: last ? '' : text.caughtHook,
  next: text.caughtNext,
  detail: text.caughtRoles.replace('{roles}', feature.roles.map(r => roleLabels[r]).join('・')),
})

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
// 全部釣り終えた後も投げ続けられるよう、未取得が無くなったら元の列へ戻す
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

// 確認窓の StopText。根拠・補足・締めは出さないので空にする(StopModal が空文字の段落を描かない)
export const confirmStop = (text: FishingText): StopText => ({
  place: text.place,
  title: text.prompt,
  claim: text.lure,
  proof: '',
  hook: '',
  next: text.go,
  detail: '',
})

// 結果窓の StopText。釣り上げた機能を、地点の会話と同じ並び(主張・根拠・補足)へ写す
export const catchToStop = (
  feature: CareerFeature,
  text: FishingText,
  roleLabels: Record<CareerRole, string>
): StopText => ({
  place: text.caughtPlace,
  title: feature.name,
  claim: text.caughtClaim.replace('{date}', feature.date),
  proof: text.caughtTech.replace('{tech}', feature.tech.join(' / ')),
  hook: text.caughtHook,
  next: text.caughtNext,
  detail: text.caughtRoles.replace('{roles}', feature.roles.map(r => roleLabels[r]).join('・')),
})

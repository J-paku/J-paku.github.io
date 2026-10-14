// ワールドの出入り。描くワールドの引き方と、rAF ループが読む runtime の写しの置き換え方を決める。
// フック(hooks/use-village-world.ts)は React の state を合わせて、眠っている歩行ループを起こすだけにする
import type { Cell, Direction, World, WorldSet } from '@content/types/world'
import { createMoveState } from '@/lib/village/movement'
import type { VillageRuntime } from '../../../hooks/use-village-runtime'
import { findWorld } from './find-world'

// ワールドを移るときに置き換える runtime の写し
export type WorldEntryRefs = Pick<
  VillageRuntime,
  'world' | 'worldKey' | 'state' | 'pendingRoute' | 'pendingFast' | 'destination'
>

// 描くワールド。保存値や移動先の id は実在しないことがあるので、引けなければ開始ワールドへ倒す
export const resolveWorld = (worldSet: WorldSet, worldId: string): World =>
  findWorld(worldSet, worldId) ?? worldSet.worlds[worldSet.startWorldId]

// runtime の写しを新しいワールドへ置き換える。歩きかけのコマと経路は持ち越さず、新しいワールドの
// 初期状態へ立ち位置と向きだけを入れる。持ち越した経路・高速移動・目的地も捨てる
export const enterRuntimeWorld = (
  refs: WorldEntryRefs,
  id: string,
  next: World,
  cell: Cell,
  facing: Direction
): void => {
  refs.world.current = next
  refs.worldKey.current = id
  refs.state.current = { ...createMoveState(next), cell, facing }
  refs.pendingRoute.current = null
  refs.pendingFast.current = false
  refs.destination.current = null
}

// 地図の印の一覧 mapEntries のテスト
import { vi } from 'vitest'
import type { World, WorldSet } from '@content/types/world'
import { mapEntries } from './map-entries'

// server-only は Next.js のビルド境界専用ガードで、vitest(node 環境)では無条件に例外を投げる。
// テストでは中身を持たない mock に差し替え、読み込み専用の @/lib/content/read を素通しにする
vi.mock('server-only', () => ({}))

import { readWorldSet } from '@/lib/content/read'

// 実ワールドセットの town と room を取得。無ければテスト側で即座に落とし、以降の型を World に保つ
const worldSet = readWorldSet()
const townOrUndefined = worldSet.worlds.town
const roomOrUndefined = worldSet.worlds.room
if (townOrUndefined === undefined || roomOrUndefined === undefined)
  throw new Error('worldSet に town か room が無い')
const town: World = townOrUndefined
const room: World = roomOrUndefined

describe('mapEntries (実際の worldSet)', () => {
  it('自宅の扉を 1 番に、コース順で 8 番の次の旅まで並べ、コース外の池を 9 番に付け足す', () => {
    const entries = mapEntries(worldSet, town, new Set())
    expect(entries.map(e => [e.number, e.id])).toEqual([
      [1, 'home'],
      [2, 'meishi'],
      [3, 'lab'],
      [4, 'monument'],
      [5, 'robot'],
      [6, 'campfire'],
      [7, 'mailbox'],
      [8, 'journey'],
      [9, 'pond'],
    ])
    // 屋内の地点は扉の位置に載る
    expect(entries[0]).toEqual({
      id: 'home',
      number: 1,
      cell: { x: 14, y: 11 },
      visited: false,
      order: 1,
    })
    // コース外の地点は order を持たない
    expect(entries[8]).toEqual({ id: 'pond', number: 9, cell: { x: 6, y: 15 }, visited: false })
  })

  it('扉の印は扉の先のコース地点を訪ねると訪問済み、時計(コース外)は判定に関わらない', () => {
    const before = mapEntries(worldSet, town, new Set(['clock']))
    expect(before[0].visited).toBe(false)
    const after = mapEntries(worldSet, town, new Set(['home']))
    expect(after[0].visited).toBe(true)
  })

  it('屋外の地点とコース外の地点は id で訪問を判定する', () => {
    const entries = mapEntries(worldSet, town, new Set(['robot', 'pond']))
    const visitedIds = entries.filter(e => e.visited).map(e => e.id)
    expect(visitedIds).toEqual(['robot', 'pond'])
  })

  it('屋内のワールドには扉の印が無く、自分の地点だけを並べる', () => {
    const entries = mapEntries(worldSet, room, new Set())
    expect(entries.map(e => [e.number, e.id])).toEqual([
      [1, 'home'],
      [2, 'clock'],
    ])
  })
})

// order の無い地点を spots の先頭と途中に置き、並びの後ろへ回ることを見る
const field: World = {
  id: 'field',
  kind: 'exterior',
  width: 4,
  height: 1,
  start: { x: 0, y: 0 },
  startFacing: 'down',
  tiles: [['grass', 'grass', 'grass', 'grass']],
  structures: [],
  spots: [
    { id: 'well', cell: { x: 0, y: 0 }, facing: 'up', action: 'fishing' },
    { id: 'second', cell: { x: 1, y: 0 }, facing: 'up', order: 2 },
    { id: 'bench', cell: { x: 2, y: 0 }, facing: 'up' },
    { id: 'first', cell: { x: 3, y: 0 }, facing: 'up', order: 1 },
  ],
  warps: [],
}
const fieldSet: WorldSet = { id: 'f', startWorldId: 'field', worlds: { field } }

describe('mapEntries (order の無い地点)', () => {
  it('コース地点を order 順に並べた後ろへ、order の無い地点を spots の並び順で続ける', () => {
    const entries = mapEntries(fieldSet, field, new Set(['bench']))
    expect(entries).toEqual([
      { id: 'first', number: 1, cell: { x: 3, y: 0 }, visited: false, order: 1 },
      { id: 'second', number: 2, cell: { x: 1, y: 0 }, visited: false, order: 2 },
      { id: 'well', number: 3, cell: { x: 0, y: 0 }, visited: false },
      { id: 'bench', number: 4, cell: { x: 2, y: 0 }, visited: true },
    ])
  })
})

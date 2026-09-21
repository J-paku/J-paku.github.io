// 釣りの規則 isFishingSpot・pickCatch・isCollectionComplete・catchToStop のテスト
import { vi } from 'vitest'
import type { CareerFeature, CareerRole } from '@content/types/content'
import type { Cell, FishingText, World } from '@content/types/world'
import { isWalkable } from './collision'
import { isFishingSpot, pickCatch, isCollectionComplete, catchToStop } from './fishing'

// server-only は Next.js のビルド境界専用ガードで、vitest(node 環境)では無条件に例外を投げる。
// テストでは中身を持たない mock に差し替え、読み込み専用の @/lib/content/read を素通しにする
vi.mock('server-only', () => ({}))

import { readWorldSet } from '@/lib/content/read'

// 実ワールドセットの town を取得。無ければテスト側で即座に落とし、以降の型を World に保つ
const realTownOrUndefined = readWorldSet().worlds.town
if (realTownOrUndefined === undefined) throw new Error('worldSet に town が無い')
const realTown: World = realTownOrUndefined

// 北半分が草、南半分が水の野原。右上に街灯(縦 2 マス)を置き、物の上に立った場合も見る
const pond: World = {
  id: 'pond',
  kind: 'exterior',
  width: 4,
  height: 4,
  start: { x: 0, y: 0 },
  startFacing: 'down',
  tiles: [
    ['grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass'],
    ['water', 'water', 'water', 'water'],
    ['water', 'water', 'water', 'water'],
  ],
  structures: [{ id: 'lp', kind: 'lamp', cell: { x: 3, y: 0 } }],
  spots: [],
  warps: [],
}

describe('isFishingSpot', () => {
  it('向いている 1 マス先が水なら釣れる', () => {
    expect(isFishingSpot(pond, { cell: { x: 1, y: 1 }, facing: 'down' })).toBe(true)
  })
  it('水際に立っていても、背を向けていれば釣れない', () => {
    expect(isFishingSpot(pond, { cell: { x: 1, y: 1 }, facing: 'up' })).toBe(false)
    expect(isFishingSpot(pond, { cell: { x: 1, y: 1 }, facing: 'left' })).toBe(false)
  })
  it('水から 2 マス以上離れていれば釣れない', () => {
    expect(isFishingSpot(pond, { cell: { x: 1, y: 0 }, facing: 'down' })).toBe(false)
  })
  it('立っているマスが通行不可(街灯の上)なら釣れない', () => {
    // (3,1) は街灯の下半分。向いている先 (3,2) は水だが、そもそもそこには立てない
    expect(isWalkable(pond, { x: 3, y: 1 })).toBe(false)
    expect(isFishingSpot(pond, { cell: { x: 3, y: 1 }, facing: 'down' })).toBe(false)
  })
  it('地図の外を向いていれば釣れない', () => {
    expect(isFishingSpot(pond, { cell: { x: 0, y: 0 }, facing: 'up' })).toBe(false)
    expect(isFishingSpot(pond, { cell: { x: 0, y: 0 }, facing: 'left' })).toBe(false)
  })
})

const feature = (name: string): CareerFeature => ({
  date: '2025.03',
  name,
  tech: ['TypeScript'],
  roles: ['build'],
})

describe('pickCatch', () => {
  it('空なら null', () => {
    expect(pickCatch([], new Set())).toBeNull()
  })
  it('1 件だけなら、まだ釣っていない時はそれを返す', () => {
    const only = feature('a')
    expect(pickCatch([only], new Set())).toBe(only)
  })
  it('まだ釣っていない名前を優先して選ぶ', () => {
    const items = [feature('a'), feature('b')]
    // 未取得が b だけなので、random の値に関わらず b
    expect(pickCatch(items, new Set(['a']), () => 0)?.name).toBe('b')
    expect(pickCatch(items, new Set(['a']), () => 0.99)?.name).toBe('b')
  })
  it('未取得が複数あれば、その中から random の値で選び分ける', () => {
    const items = [feature('a'), feature('b'), feature('c')]
    expect(pickCatch(items, new Set(['a']), () => 0)?.name).toBe('b')
    expect(pickCatch(items, new Set(['a']), () => 0.99)?.name).toBe('c')
  })
  it('全部釣り終えていれば全件が対象', () => {
    const items = [feature('a'), feature('b')]
    const caught = new Set(['a', 'b'])
    expect(pickCatch(items, caught, () => 0)?.name).toBe('a')
    expect(pickCatch(items, caught, () => 0.99)?.name).toBe('b')
  })
  it('何も釣っていなければ全件が対象', () => {
    const items = [feature('a'), feature('b')]
    expect(pickCatch(items, new Set(), () => 0)?.name).toBe('a')
  })
})

describe('isCollectionComplete', () => {
  const items = [feature('a'), feature('b')]
  it('列が空なら、集め終えたとは言わない', () => {
    expect(isCollectionComplete([], new Set(['a']))).toBe(false)
  })
  it('一部しか釣っていなければ false', () => {
    expect(isCollectionComplete(items, new Set())).toBe(false)
    expect(isCollectionComplete(items, new Set(['a']))).toBe(false)
  })
  it('全ての名前が揃えば true', () => {
    expect(isCollectionComplete(items, new Set(['a', 'b']))).toBe(true)
    // 列に無い名前が混じっていても、揃っていれば true
    expect(isCollectionComplete(items, new Set(['a', 'b', 'c']))).toBe(true)
  })
})

const text: FishingText = {
  prompt: '釣りをしてみますか?',
  go: '釣る',
  cast: '……',
  bite: '何かがかかった!',
  landed: '経験を釣り上げた!',
  complete: 'すべての経験を釣り上げた!',
  caughtPlace: '釣り上げた経験',
  caughtClaim: '{date}に着手した機能です。',
  caughtTech: '使った技術: {tech}',
  caughtRoles: '担当した工程: {roles}',
  caughtHook: 'もう一度投げてみてください。',
  caughtNext: '作品一覧へ',
}

const roleLabels: Record<CareerRole, string> = {
  design: '設計',
  build: '実装',
  release: 'リリース',
}

describe('catchToStop', () => {
  it('{date} / {tech} / {roles} を機能の値で置き換える', () => {
    const caught: CareerFeature = {
      date: '2025.06',
      name: '在庫の棚卸し',
      tech: ['Next.js', 'Swift'],
      roles: ['design', 'release'],
    }
    expect(catchToStop(caught, text, roleLabels)).toEqual({
      place: '釣り上げた経験',
      title: '在庫の棚卸し',
      claim: '2025.06に着手した機能です。',
      proof: '使った技術: Next.js / Swift',
      hook: 'もう一度投げてみてください。',
      next: '作品一覧へ',
      detail: '担当した工程: 設計・リリース',
    })
  })
  it('技術・工程が 1 つなら区切り文字を足さない', () => {
    const caught = feature('単独')
    const stop = catchToStop(caught, text, roleLabels)
    expect(stop.proof).toBe('使った技術: TypeScript')
    expect(stop.detail).toBe('担当した工程: 実装')
  })
})

// 実際の worldSet(content/world.ts)の町。池を広げた結果を座標で押さえる
describe('実際の町の池', () => {
  const pondCells: Cell[] = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => ({ x: i, y: 14 + j }))
  ).flat()

  it('x0-5 / y14-19 の 36 マスが全て water で、どのマスにも立てない', () => {
    expect(pondCells).toHaveLength(36)
    for (const cell of pondCells) {
      // どのマスで落ちたか分かるよう、座標ごと突き合わせる
      expect({ ...cell, tile: realTown.tiles[cell.y]?.[cell.x] }).toEqual({
        ...cell,
        tile: 'water',
      })
      expect({ ...cell, walkable: isWalkable(realTown, cell) }).toEqual({
        ...cell,
        walkable: false,
      })
    }
  })

  it('池の北の道からも、東隣の草地からも水を向けば釣れる', () => {
    expect(isFishingSpot(realTown, { cell: { x: 5, y: 13 }, facing: 'down' })).toBe(true)
    expect(isFishingSpot(realTown, { cell: { x: 6, y: 15 }, facing: 'left' })).toBe(true)
  })

  it('池に背を向けた向きでは釣れない', () => {
    expect(isFishingSpot(realTown, { cell: { x: 5, y: 13 }, facing: 'up' })).toBe(false)
    expect(isFishingSpot(realTown, { cell: { x: 6, y: 15 }, facing: 'right' })).toBe(false)
  })
})

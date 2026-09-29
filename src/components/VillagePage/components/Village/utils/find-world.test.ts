// ワールドの一覧からidでワールドを引く(findWorld)のテスト。
// 保存値やワープ先のidは実在しないことがあるので、無いidでnullを返すことと、
// Objectのプロトタイプにある名前をワールドと取り違えないことを見る
import { describe, expect, it, vi } from 'vitest'
import { findWorld } from './find-world'

// server-onlyはvitest(node環境)では無条件に例外を投げるので、中身を持たないmockに差し替える
vi.mock('server-only', () => ({}))

import { readWorldSet } from '@/lib/content/read'

const worldSet = readWorldSet()
const worlds = Object.values(worldSet.worlds)

describe('findWorld', () => {
  it('一覧にあるidはそのワールドそのものを返す', () => {
    for (const [id, world] of Object.entries(worldSet.worlds)) {
      expect(findWorld(worldSet, id)).toBe(world)
    }
  })

  it('開始ワールドのidで開始ワールドを引ける', () => {
    expect(findWorld(worldSet, worldSet.startWorldId)?.id).toBe(worldSet.startWorldId)
  })

  it('全ワープの行き先idが、そのidを持つワールドへ解決される', () => {
    const targets = worlds.flatMap(world => world.warps.map(warp => warp.target.worldId))
    expect(targets.length).toBeGreaterThan(0)
    for (const target of targets) {
      expect(findWorld(worldSet, target)?.id).toBe(target)
    }
  })

  it('一覧に無いidはnullを返す', () => {
    expect(findWorld(worldSet, 'nowhere')).toBeNull()
    expect(findWorld(worldSet, '')).toBeNull()
  })

  it('Objectのプロトタイプにある名前は、ワールドとして返さずnullにする', () => {
    // 添字で引くだけだとconstructorやtoStringが関数として返り、ワールドとして扱われてしまう
    for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(findWorld(worldSet, name)).toBeNull()
    }
  })
})

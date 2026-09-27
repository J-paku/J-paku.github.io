// 会話窓の中身の選び分け(pickDialog)のテスト
import { describe, expect, it, vi } from 'vitest'
import type { Spot, StopText } from '@content/types/world'
import { pickDialog } from './pick-dialog'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

import { readVillageText, readWorldSet } from '@/lib/content/read'

const worldSet = readWorldSet()
const text = readVillageText('ja')
const town = worldSet.worlds.town
const spotOf = (id: string): Spot => {
  const spot = town.spots.find(s => s.id === id)
  if (spot === undefined) throw new Error(`town に地点 ${id} が無い`)
  return spot
}
const lab = spotOf('lab')
const fishingStop: StopText = { ...text.stops.lab, title: '釣果' }
const base = { text, stopHrefs: { lab: '/works/lab' }, stopExternal: { lab: true } }

describe('pickDialog', () => {
  it('会話中は地点の文言とリンクを出す', () => {
    expect(pickDialog({ ...base, mode: 'talk', activeSpot: lab, fishingStop: null })).toEqual({
      stop: text.stops.lab,
      href: '/works/lab',
      external: true,
      closeLabel: text.close,
    })
  })

  it('リンクの無い地点は href null・external false に落とす', () => {
    expect(
      pickDialog({
        ...base,
        stopHrefs: {},
        stopExternal: {},
        mode: 'talk',
        activeSpot: lab,
        fishingStop: null,
      })
    ).toMatchObject({ href: null, external: false })
  })

  it('釣りの窓は結果の文言だけでリンクを持たない', () => {
    expect(pickDialog({ ...base, mode: 'fishing', activeSpot: null, fishingStop })).toEqual({
      stop: fishingStop,
      href: null,
      external: false,
      closeLabel: text.close,
    })
  })

  it('歩行中・釣りの結果がまだ無い間は何も出さない', () => {
    expect(pickDialog({ ...base, mode: 'walk', activeSpot: lab, fishingStop })).toBeNull()
    expect(pickDialog({ ...base, mode: 'fishing', activeSpot: null, fishingStop: null })).toBeNull()
  })
})

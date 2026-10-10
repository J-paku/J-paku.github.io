// 吹き出しの位置・文言の決め方(resolveTalkBubble)のテスト
import { describe, expect, it, vi } from 'vitest'
import type { Spot } from '@content/types/world'
import { talkAnchor } from '@/lib/village/spot'
import { arriveSpeech, talkLabelOf } from './spot-text'
import { resolveTalkBubble } from './talk-bubble'

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
const pond = spotOf('pond')
const base = {
  mode: 'walk' as const,
  catchCount: 3,
  fishingTarget: null,
  world: town,
  text,
  exhausted: false,
}

describe('resolveTalkBubble', () => {
  it('地点に立てば地点の吹き出しを出し、釣りにはしない', () => {
    expect(resolveTalkBubble({ ...base, activeSpot: lab, playerCell: lab.cell })).toEqual({
      canFish: false,
      talkAt: talkAnchor(town, lab, lab.cell),
      talkText: arriveSpeech(text, lab),
      talkLabel: talkLabelOf(text, lab),
      talkKind: 'speech',
    })
  })

  it('釣り場の地点では水辺の吹き出しを頭上に出す', () => {
    expect(resolveTalkBubble({ ...base, activeSpot: pond, playerCell: pond.cell })).toEqual({
      canFish: true,
      talkAt: { x: pond.cell.x + 0.5, y: pond.cell.y - 0.5 },
      talkText: text.fishing.prompt,
      talkLabel: text.fishing.go,
      talkKind: 'speech',
    })
  })

  it('全部を釣り上げた後はボタンの無い考え事に替わる', () => {
    expect(
      resolveTalkBubble({ ...base, activeSpot: pond, playerCell: pond.cell, exhausted: true })
    ).toMatchObject({
      canFish: true,
      talkText: text.fishing.exhausted,
      talkLabel: undefined,
      talkKind: 'thought',
    })
  })

  it('地点の外で水を向いて立てば、水辺の吹き出しを頭上に出す', () => {
    const playerCell = { x: 4, y: 6 }
    expect(
      resolveTalkBubble({ ...base, activeSpot: null, fishingTarget: { x: 4, y: 7 }, playerCell })
    ).toEqual({
      canFish: true,
      talkAt: { x: 4.5, y: 5.5 },
      talkText: text.fishing.prompt,
      talkLabel: text.fishing.go,
      talkKind: 'speech',
    })
  })

  it('地点の外で水を向いていなければ、どの吹き出しも出さない', () => {
    expect(resolveTalkBubble({ ...base, activeSpot: null, playerCell: { x: 4, y: 6 } })).toEqual({
      canFish: false,
      talkAt: null,
      talkText: null,
      talkLabel: undefined,
      talkKind: 'speech',
    })
  })

  it('釣り場でない地点に立てば、水を向いていても地点の吹き出しを出して釣りにはしない', () => {
    expect(
      resolveTalkBubble({
        ...base,
        activeSpot: lab,
        fishingTarget: { x: lab.cell.x, y: lab.cell.y + 1 },
        playerCell: lab.cell,
      })
    ).toEqual({
      canFish: false,
      talkAt: talkAnchor(town, lab, lab.cell),
      talkText: arriveSpeech(text, lab),
      talkLabel: talkLabelOf(text, lab),
      talkKind: 'speech',
    })
  })

  it('全部を釣り上げた後でも、釣り場でない地点の吹き出しは考え事にしない', () => {
    expect(
      resolveTalkBubble({ ...base, activeSpot: lab, playerCell: lab.cell, exhausted: true })
    ).toMatchObject({ canFish: false, talkKind: 'speech' })
  })

  it('釣れる中身が無い・歩行中でない時は水辺の吹き出しを出さない', () => {
    const empty = {
      canFish: false,
      talkAt: null,
      talkText: null,
      talkLabel: undefined,
      talkKind: 'speech',
    }
    expect(
      resolveTalkBubble({ ...base, catchCount: 0, activeSpot: pond, playerCell: pond.cell })
    ).toEqual(empty)
    expect(
      resolveTalkBubble({ ...base, mode: 'fishing', activeSpot: pond, playerCell: pond.cell })
    ).toEqual(empty)
  })
})

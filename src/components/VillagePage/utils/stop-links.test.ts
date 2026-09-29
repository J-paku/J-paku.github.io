// 地点ごとのリンク先の解決(resolveStopLinks)のテスト
import { describe, expect, it, vi } from 'vitest'
import type { Spot, StopText, VillageText, World, WorldSet } from '@content/types/world'
import { resolveStopLinks } from './stop-links'

// server-onlyはvitest(node環境)では無条件に例外を投げるので、中身を持たないmockに差し替える
vi.mock('server-only', () => ({}))

import { readVillageText, readWorldSet } from '@/lib/content/read'

// 解決が読むのは地点のidと文言のlinkだけ。残りは型を満たすための最小の値
const spotAt = (id: string, x: number): Spot => ({ id, cell: { x, y: 0 }, facing: 'down' })

const worldOf = (id: string, kind: World['kind'], spots: Spot[]): World => ({
  id,
  kind,
  width: 4,
  height: 1,
  start: { x: 0, y: 0 },
  startFacing: 'down',
  tiles: [],
  structures: [],
  spots,
  warps: [],
})

// 屋外の町と屋内の部屋の2ワールド。部屋の地点は開始ワールドの外にある
const worldSet: WorldSet = {
  id: 'test',
  startWorldId: 'town',
  worlds: {
    town: worldOf('town', 'exterior', [
      spotAt('story-spot', 0),
      spotAt('external-spot', 1),
      spotAt('plain-spot', 2),
      spotAt('silent-spot', 3),
    ]),
    room: worldOf('room', 'interior', [spotAt('room-spot', 0)]),
  },
}

const PLAIN_STOP: StopText = {
  place: '場所',
  title: '見出し',
  claim: '主張',
  proof: '根拠',
  hook: '誘い',
  next: '次へ',
  detail: '補足',
}

// silent-spotは文言そのものを持たない(時計・釣りのように専用の窓を開く地点と同じ形)。
// orphanは文言だけがあり、どのワールドにも地点が無い
const text: VillageText = {
  ...readVillageText('ja'),
  stops: {
    'story-spot': {
      ...PLAIN_STOP,
      link: { label: '作品へ', target: { kind: 'story', slug: 'sample-work' } },
    },
    'external-spot': {
      ...PLAIN_STOP,
      link: { label: 'デモへ', target: { kind: 'external', url: 'https://example.com/demo/' } },
    },
    'plain-spot': PLAIN_STOP,
    'room-spot': {
      ...PLAIN_STOP,
      link: { label: '作品へ', target: { kind: 'story', slug: 'room-work' } },
    },
    orphan: {
      ...PLAIN_STOP,
      link: { label: '作品へ', target: { kind: 'story', slug: 'orphan-work' } },
    },
  },
}

describe('resolveStopLinks', () => {
  it('storyのリンクはjaでは接頭辞の無い作品ルートになり、外部扱いにしない', () => {
    const { stopHrefs, stopExternal } = resolveStopLinks(worldSet, text, 'ja')
    expect(stopHrefs['story-spot']).toBe('/works/sample-work/')
    expect(stopExternal['story-spot']).toBe(false)
  })

  it('storyのリンクはkoでは/ko付きの作品ルートになる', () => {
    const { stopHrefs, stopExternal } = resolveStopLinks(worldSet, text, 'ko')
    expect(stopHrefs['story-spot']).toBe('/ko/works/sample-work/')
    expect(stopExternal['story-spot']).toBe(false)
  })

  // 外部URLは言語で変えない。/koを付けると別サイトのURLが壊れる
  it.each(['ja', 'ko'] as const)('externalは%sでもURLのまま・外部扱い', locale => {
    const { stopHrefs, stopExternal } = resolveStopLinks(worldSet, text, locale)
    expect(stopHrefs['external-spot']).toBe('https://example.com/demo/')
    expect(stopExternal['external-spot']).toBe(true)
  })

  it('文言にリンクが無い地点はnull・外部扱いにしない', () => {
    const { stopHrefs, stopExternal } = resolveStopLinks(worldSet, text, 'ja')
    expect(stopHrefs['plain-spot']).toBeNull()
    expect(stopExternal['plain-spot']).toBe(false)
  })

  it('文言そのものが無い地点も例外を投げずnull・外部扱いにしない', () => {
    const { stopHrefs, stopExternal } = resolveStopLinks(worldSet, text, 'ja')
    expect(stopHrefs['silent-spot']).toBeNull()
    expect(stopExternal['silent-spot']).toBe(false)
  })

  it('開始ワールドの外(屋内)の地点も解決する', () => {
    const { stopHrefs, stopExternal } = resolveStopLinks(worldSet, text, 'ko')
    expect(stopHrefs['room-spot']).toBe('/ko/works/room-work/')
    expect(stopExternal['room-spot']).toBe(false)
  })

  // 鍵は地点から作る。文言にしか無いidを混ぜると、存在しない地点のリンクがVillageへ渡る
  it('両方の表の鍵は全ワールドの地点idとちょうど一致し、地点の無い文言は含めない', () => {
    const { stopHrefs, stopExternal } = resolveStopLinks(worldSet, text, 'ja')
    const expected = ['external-spot', 'plain-spot', 'room-spot', 'silent-spot', 'story-spot']
    expect(Object.keys(stopHrefs).sort()).toEqual(expected)
    expect(Object.keys(stopExternal).sort()).toEqual(expected)
  })
})

describe('resolveStopLinks(実データ)', () => {
  const realWorldSet = readWorldSet()
  const allSpots = Object.values(realWorldSet.worlds).flatMap(world => world.spots)

  it.each(['ja', 'ko'] as const)('%sの全地点を種類ごとに解決する', locale => {
    const realText = readVillageText(locale)
    const { stopHrefs, stopExternal } = resolveStopLinks(realWorldSet, realText, locale)
    const prefix = locale === 'ja' ? '' : '/ko'

    expect(Object.keys(stopHrefs).sort()).toEqual(allSpots.map(spot => spot.id).sort())

    const storySpot = allSpots.find(spot => realText.stops[spot.id]?.link?.target.kind === 'story')
    const externalSpot = allSpots.find(
      spot => realText.stops[spot.id]?.link?.target.kind === 'external'
    )
    const unlinkedSpot = allSpots.find(spot => realText.stops[spot.id]?.link === undefined)
    if (storySpot === undefined) throw new Error('storyのリンクを持つ地点がcontentに無い')
    if (externalSpot === undefined) throw new Error('externalのリンクを持つ地点がcontentに無い')
    if (unlinkedSpot === undefined) throw new Error('リンクを持たない地点がcontentに無い')

    const storyTarget = realText.stops[storySpot.id]?.link?.target
    const externalTarget = realText.stops[externalSpot.id]?.link?.target
    if (storyTarget?.kind !== 'story') throw new Error('storyの行き先が読めない')
    if (externalTarget?.kind !== 'external') throw new Error('externalの行き先が読めない')

    expect(stopHrefs[storySpot.id]).toBe(`${prefix}/works/${storyTarget.slug}/`)
    expect(stopExternal[storySpot.id]).toBe(false)
    expect(stopHrefs[externalSpot.id]).toBe(externalTarget.url)
    expect(stopExternal[externalSpot.id]).toBe(true)
    expect(stopHrefs[unlinkedSpot.id]).toBeNull()
    expect(stopExternal[unlinkedSpot.id]).toBe(false)
  })
})

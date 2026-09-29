// @vitest-environment happy-dom
// 人物を置く部品(writePose・placePlayer)のテスト。人物のtransform・data-sprite・--iと、
// 付いて回る要素(目印・吹き出しの土台・灯り)へ書く値、同じ値を書き直さない所、ワールドが替わった時に書き直す所を確かめる。
// 釣り・傘の経過はperformance.nowから数えるので固定する
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Direction } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import type { MoveState } from '@/lib/village/movement'
import type { FishingPose, UmbrellaPose } from '@/lib/village/player-pose'
import { placePlayer, writePose, type FollowerRefs, type PoseSources } from './place-player'
import type { CameraFrame } from './types'
import { makeFrameState } from './walk-loop.test-helper'

// 使うコマだけを並べたシート。添字が0でないことで、--iが実際にシートを引いたと分かる
const sprites: SheetLayout = {
  index: {
    'player-down-0': 3,
    'player-right-0': 5,
    'player-fish-down-windup': 8,
    'player-fish-down': 9,
    'player-umbrella-open-reach': 12,
  },
  count: 13,
  tile: 16,
  height: 24,
}

let clock = 1000

const standing = (facing: Direction): MoveState => ({
  cell: { x: 2, y: 3 },
  facing,
  motion: null,
  route: [],
  fast: false,
  turnRemainingMs: 0,
  stride: 0,
})

type Sources = PoseSources & { playerRef: { current: HTMLDivElement } }

const makeSources = (
  facing: Direction = 'down',
  fishing: FishingPose | null = null,
  umbrella: UmbrellaPose | null = null
): Sources => ({
  playerRef: { current: document.createElement('div') },
  stateRef: { current: standing(facing) },
  fishingPoseRef: { current: fishing },
  umbrellaPoseRef: { current: umbrella },
  reduceMotion: false,
  sprites,
})

const makeFollowers = () => ({
  locatorRef: { current: document.createElement('div') },
  hintRef: { current: document.createElement('div') },
  playerLightRef: { current: document.createElement('div') },
})

// 1マス64pxで(2.5,3)に立つ = (160,192)px
const camera = (switched: boolean): CameraFrame => ({
  px: 64,
  v: { x: 2.5, y: 3 },
  switched,
  caughtUp: true,
})
const SHIFT = 'translate(160px, 192px)'

beforeEach(() => {
  clock = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('writePose', () => {
  it('人物の要素が無ければ何もせずfalse', () => {
    const frameState = makeFrameState({ shift: SHIFT })
    const sources = { ...makeSources(), playerRef: { current: null } }
    expect(writePose(frameState, sources)).toBe(false)
    expect(frameState.spriteKey).toBe('')
    expect(frameState.lastTransform).toBe('')
  })

  it('最初の配置の前(shiftが空)はtransformもコマも書かずfalse', () => {
    const frameState = makeFrameState()
    const sources = makeSources()
    expect(writePose(frameState, sources)).toBe(false)
    const player = sources.playerRef.current
    expect(player.style.transform).toBe('')
    expect(player.dataset.sprite).toBeUndefined()
    expect(frameState.spriteKey).toBe('')
  })

  it('直前の位置へtransformを書き、コマの名前とシートの添字を書く', () => {
    const frameState = makeFrameState({ shift: SHIFT })
    const sources = makeSources('down')
    expect(writePose(frameState, sources)).toBe(false)
    const player = sources.playerRef.current
    expect(player.style.transform).toBe(SHIFT)
    expect(player.dataset.sprite).toBe('player-down-0')
    expect(player.style.getPropertyValue('--i')).toBe('3')
    expect(frameState.lastTransform).toBe(SHIFT)
    expect(frameState.spriteKey).toBe('player-down-0')
  })

  it('左向きは右向きのコマを使い、位置の後ろにscaleX(-1)を付けて反転する', () => {
    const frameState = makeFrameState({ shift: SHIFT })
    const sources = makeSources('left')
    writePose(frameState, sources)
    const player = sources.playerRef.current
    expect(player.style.transform).toBe(`${SHIFT} scaleX(-1)`)
    expect(player.dataset.sprite).toBe('player-right-0')
    expect(player.style.getPropertyValue('--i')).toBe('5')
  })

  it('transformもコマも前と同じなら書き直さない', () => {
    const frameState = makeFrameState({ shift: SHIFT })
    const sources = makeSources('down')
    const player = sources.playerRef.current
    writePose(frameState, sources)
    const observer = new MutationObserver(() => {})
    observer.observe(player, { attributes: true })
    writePose(frameState, sources)
    expect(observer.takeRecords()).toHaveLength(0)
    // 向きが変わればtransformは同じでもコマだけ書く
    sources.stateRef.current = standing('right')
    writePose(frameState, sources)
    expect(observer.takeRecords().map(record => record.attributeName)).toContain('data-sprite')
    expect(player.style.transform).toBe(SHIFT)
    observer.disconnect()
  })

  it('釣りは段階に入ってからの経過でコマを選び、コマがまだ変わる間だけtrue', () => {
    // 投げ始めて100msは振りかぶり(120ms未満)
    const frameState = makeFrameState({ shift: SHIFT })
    const sources = makeSources('down', { phase: 'casting', since: 1000 })
    clock = 1100
    expect(writePose(frameState, sources)).toBe(true)
    expect(sources.playerRef.current.dataset.sprite).toBe('player-fish-down-windup')
    expect(sources.playerRef.current.style.getPropertyValue('--i')).toBe('8')
    // 振り終えた(480ms以降)構えは時間で変わらない
    clock = 1600
    expect(writePose(frameState, sources)).toBe(false)
    expect(sources.playerRef.current.dataset.sprite).toBe('player-fish-down')
    expect(sources.playerRef.current.style.getPropertyValue('--i')).toBe('9')
  })

  it('傘を広げている間は時間表のコマを出し、左向きでも反転しない', () => {
    const frameState = makeFrameState({ shift: SHIFT })
    const sources = makeSources('left', null, { phase: 'opening', since: 1000 })
    clock = 1050
    expect(writePose(frameState, sources)).toBe(true)
    const player = sources.playerRef.current
    expect(player.dataset.sprite).toBe('player-umbrella-open-reach')
    expect(player.style.getPropertyValue('--i')).toBe('12')
    expect(player.style.transform).toBe(SHIFT)
  })
})

describe('placePlayer', () => {
  it('人物の位置を覚え、付いて回る要素へ同じtranslateを書いてapplyPoseの結果を返す', () => {
    const frameState = makeFrameState()
    const followers: FollowerRefs = makeFollowers()
    // applyPoseは新しい位置を覚えた後に呼ばれる
    const seenShift: string[] = []
    const applyPose = vi.fn(() => {
      seenShift.push(frameState.shift)
      return true
    })
    expect(placePlayer(frameState, followers, camera(false), applyPose)).toBe(true)
    expect(applyPose).toHaveBeenCalledTimes(1)
    expect(seenShift).toEqual([SHIFT])
    expect(frameState.shift).toBe(SHIFT)
    expect(followers.locatorRef.current?.style.transform).toBe(SHIFT)
    expect(followers.hintRef.current?.style.transform).toBe(SHIFT)
    expect(followers.playerLightRef.current?.style.transform).toBe(SHIFT)
    expect(placePlayer(frameState, followers, camera(false), () => false)).toBe(false)
  })

  it('人物が反転しても、付いて回る要素は反転させない', () => {
    const frameState = makeFrameState()
    const sources = makeSources('left')
    const followers = makeFollowers()
    placePlayer(frameState, followers, camera(false), () => writePose(frameState, sources))
    expect(sources.playerRef.current.style.transform).toBe(`${SHIFT} scaleX(-1)`)
    expect(followers.locatorRef.current.style.transform).toBe(SHIFT)
    expect(followers.hintRef.current.style.transform).toBe(SHIFT)
    expect(followers.playerLightRef.current.style.transform).toBe(SHIFT)
  })

  it('ワールドが替わったフレームは覚えたtransformを捨て、Reactが書き戻した位置を必ず書き直す', () => {
    const sources = makeSources('down')
    const player = sources.playerRef.current
    // 前のフレームで同じ位置を書いた後、ワールドの差し替えでReactが開始マスの値に戻した形
    const frameState = makeFrameState({ shift: SHIFT, lastTransform: SHIFT })
    player.style.transform = 'translate(0px, 0px)'
    placePlayer(frameState, makeFollowers(), camera(true), () => writePose(frameState, sources))
    expect(player.style.transform).toBe(SHIFT)
    expect(frameState.lastTransform).toBe(SHIFT)
  })

  it('ワールドが替わらないフレームは覚えたtransformを信じて書き直さない', () => {
    const sources = makeSources('down')
    const player = sources.playerRef.current
    const frameState = makeFrameState({ shift: SHIFT, lastTransform: SHIFT })
    player.style.transform = 'translate(0px, 0px)'
    placePlayer(frameState, makeFollowers(), camera(false), () => writePose(frameState, sources))
    expect(player.style.transform).toBe('translate(0px, 0px)')
  })

  it('付いて回る要素がまだ無くても人物は置く', () => {
    const frameState = makeFrameState()
    const followers: FollowerRefs = {
      locatorRef: { current: null },
      hintRef: { current: null },
      playerLightRef: { current: null },
    }
    const applyPose = vi.fn(() => false)
    expect(placePlayer(frameState, followers, camera(false), applyPose)).toBe(false)
    expect(applyPose).toHaveBeenCalledTimes(1)
    expect(frameState.shift).toBe(SHIFT)
  })
})

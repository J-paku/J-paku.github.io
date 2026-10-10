// @vitest-environment happy-dom
// 人物を置く部品(writePose・placePlayer)のテスト。人物のtransform・data-sprite・--iと、
// 付いて回る要素(目印・吹き出しの土台・灯り)へ書く値、同じ値を書き直さない所、ワールドが替わった時に書き直す所、
// 飛んでいる間の浮き上がりと地上に残す影(transform・data-flying)、影を隠す hideShadow を確かめる。
// 釣り・傘の経過はperformance.nowから数えるので固定する
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Direction } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import { flightLiftCells, flightShadow, type Flying } from '@/lib/village/flight'
import type { MoveState } from '@/lib/village/movement'
import type { FishingPose, UmbrellaPose } from '@/lib/village/player-pose'
import {
  hideShadow,
  placePlayer,
  writePose,
  type FollowerRefs,
  type PoseSources,
} from './place-player'
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
  fly: false,
  flight: null,
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
  shadowRef: { current: document.createElement('div') },
})

// 1マス64pxで(2.5,3)に立つ = (160,192)px
const camera = (switched: boolean): CameraFrame => ({
  px: 64,
  v: { x: 2.5, y: 3 },
  switched,
  caughtUp: true,
})
const SHIFT = 'translate(160px, 192px)'

// 飛んでいない(地上を歩く・立つ)
const grounded: Flying = { flight: null }
// (0,3)から(5,3)へ1000msかけて飛び、elapsedMsだけ経った状態
const inFlight = (elapsedMs: number): Flying => ({
  flight: { from: { x: 0, y: 3 }, to: { x: 5, y: 3 }, durationMs: 1000, elapsedMs },
})

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
    expect(placePlayer(frameState, followers, camera(false), grounded, applyPose)).toBe(true)
    expect(applyPose).toHaveBeenCalledTimes(1)
    expect(seenShift).toEqual([SHIFT])
    expect(frameState.shift).toBe(SHIFT)
    expect(followers.locatorRef.current?.style.transform).toBe(SHIFT)
    expect(followers.hintRef.current?.style.transform).toBe(SHIFT)
    expect(followers.playerLightRef.current?.style.transform).toBe(SHIFT)
    expect(placePlayer(frameState, followers, camera(false), grounded, () => false)).toBe(false)
  })

  it('人物が反転しても、付いて回る要素は反転させない', () => {
    const frameState = makeFrameState()
    const sources = makeSources('left')
    const followers = makeFollowers()
    placePlayer(frameState, followers, camera(false), grounded, () =>
      writePose(frameState, sources)
    )
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
    placePlayer(frameState, makeFollowers(), camera(true), grounded, () =>
      writePose(frameState, sources)
    )
    expect(player.style.transform).toBe(SHIFT)
    expect(frameState.lastTransform).toBe(SHIFT)
  })

  it('ワールドが替わらないフレームは覚えたtransformを信じて書き直さない', () => {
    const sources = makeSources('down')
    const player = sources.playerRef.current
    const frameState = makeFrameState({ shift: SHIFT, lastTransform: SHIFT })
    player.style.transform = 'translate(0px, 0px)'
    placePlayer(frameState, makeFollowers(), camera(false), grounded, () =>
      writePose(frameState, sources)
    )
    expect(player.style.transform).toBe('translate(0px, 0px)')
  })

  it('付いて回る要素がまだ無くても人物は置く', () => {
    const frameState = makeFrameState()
    const followers: FollowerRefs = {
      locatorRef: { current: null },
      hintRef: { current: null },
      playerLightRef: { current: null },
      shadowRef: { current: null },
    }
    const applyPose = vi.fn(() => false)
    expect(placePlayer(frameState, followers, camera(false), grounded, applyPose)).toBe(false)
    expect(applyPose).toHaveBeenCalledTimes(1)
    expect(frameState.shift).toBe(SHIFT)
    expect(frameState.shadowTransform).toBe('')
    expect(frameState.shadowFlying).toBe('')
  })
})

describe('placePlayer(飛行)', () => {
  it('飛んでいる間は人物と付いて回る要素を、浮いた高さだけ地上の位置から上へずらす', () => {
    const flying = inFlight(300)
    const lift = flightLiftCells(flying)
    expect(lift).toBeGreaterThan(0)
    const lifted = `translate(160px, ${(3 - lift) * 64}px)`
    const frameState = makeFrameState()
    const sources = makeSources('right')
    const followers = makeFollowers()
    placePlayer(frameState, followers, camera(false), flying, () => writePose(frameState, sources))
    expect(frameState.shift).toBe(lifted)
    expect(sources.playerRef.current.style.transform).toBe(lifted)
    expect(followers.locatorRef.current.style.transform).toBe(lifted)
    expect(followers.hintRef.current.style.transform).toBe(lifted)
    expect(followers.playerLightRef.current.style.transform).toBe(lifted)
  })

  it('影は浮かせず地上の位置に置き、浮いた高さに応じて縮め、data-flyingをtrueにする', () => {
    const flying = inFlight(300)
    const scale = flightShadow(flying)
    expect(scale).toBeLessThan(1)
    const frameState = makeFrameState()
    const followers = makeFollowers()
    placePlayer(frameState, followers, camera(false), flying, () => false)
    const shadow = followers.shadowRef.current
    expect(shadow.style.transform).toBe(`${SHIFT} scale(${scale})`)
    expect(shadow.dataset.flying).toBe('true')
    expect(frameState.shadowTransform).toBe(`${SHIFT} scale(${scale})`)
    expect(frameState.shadowFlying).toBe('true')
  })

  it('飛んでいない間の影は等倍で人物と同じ地上の位置に置き、data-flyingをfalseにする', () => {
    const frameState = makeFrameState()
    const followers = makeFollowers()
    placePlayer(frameState, followers, camera(false), grounded, () => false)
    expect(followers.shadowRef.current.style.transform).toBe(`${SHIFT} scale(1)`)
    expect(followers.shadowRef.current.dataset.flying).toBe('false')
  })

  it('着地したら影のdata-flyingをfalseへ戻し、人物も地上の位置へ下ろす', () => {
    const frameState = makeFrameState()
    const followers = makeFollowers()
    placePlayer(frameState, followers, camera(false), inFlight(300), () => false)
    expect(followers.shadowRef.current.dataset.flying).toBe('true')
    placePlayer(frameState, followers, camera(false), grounded, () => false)
    expect(followers.shadowRef.current.dataset.flying).toBe('false')
    expect(followers.shadowRef.current.style.transform).toBe(`${SHIFT} scale(1)`)
    expect(frameState.shift).toBe(SHIFT)
  })

  it('影の位置も印も前に書いた値と同じなら書き直さず、変わった方だけ書く', () => {
    const frameState = makeFrameState()
    const followers = makeFollowers()
    const shadow = followers.shadowRef.current
    placePlayer(frameState, followers, camera(false), grounded, () => false)
    const observer = new MutationObserver(() => {})
    observer.observe(shadow, { attributes: true })
    placePlayer(frameState, followers, camera(false), grounded, () => false)
    expect(observer.takeRecords()).toHaveLength(0)
    // 地上を歩いて位置だけ変わったら transform だけ書き、data-flying には触らない
    const walked: CameraFrame = { ...camera(false), v: { x: 3, y: 3 } }
    placePlayer(frameState, followers, walked, grounded, () => false)
    expect(observer.takeRecords().map(record => record.attributeName)).toEqual(['style'])
    expect(shadow.style.transform).toBe('translate(192px, 192px) scale(1)')
    // 飛び立てば data-flying も書く
    placePlayer(frameState, followers, walked, inFlight(300), () => false)
    expect(observer.takeRecords().map(record => record.attributeName)).toContain('data-flying')
    observer.disconnect()
  })
})

describe('hideShadow', () => {
  it('飛んでいた影をdata-flying=falseで隠し、覚えた印も下ろす。位置は書き換えない', () => {
    const frameState = makeFrameState()
    const followers = makeFollowers()
    placePlayer(frameState, followers, camera(false), inFlight(300), () => false)
    const shadow = followers.shadowRef.current
    const placed = shadow.style.transform
    hideShadow(frameState, shadow)
    expect(shadow.dataset.flying).toBe('false')
    expect(frameState.shadowFlying).toBe('false')
    expect(shadow.style.transform).toBe(placed)
    expect(frameState.shadowTransform).toBe(placed)
  })

  it('隠した後に飛んでいる影を描けば、data-flyingをtrueへ書き戻す', () => {
    // 覚えた印を下ろし忘れると、次に飛んだ時に「前と同じ true」とみなして書かず、影が隠れたままになる
    const frameState = makeFrameState()
    const followers = makeFollowers()
    placePlayer(frameState, followers, camera(false), inFlight(300), () => false)
    hideShadow(frameState, followers.shadowRef.current)
    placePlayer(frameState, followers, camera(false), inFlight(400), () => false)
    expect(followers.shadowRef.current.dataset.flying).toBe('true')
  })

  it('もう隠れている影は書き直さない', () => {
    const frameState = makeFrameState()
    const followers = makeFollowers()
    placePlayer(frameState, followers, camera(false), grounded, () => false)
    const shadow = followers.shadowRef.current
    const observer = new MutationObserver(() => {})
    observer.observe(shadow, { attributes: true })
    hideShadow(frameState, shadow)
    expect(observer.takeRecords()).toHaveLength(0)
    observer.disconnect()
  })

  it('影の要素が無ければ何もしない', () => {
    const frameState = makeFrameState({ shadowFlying: 'true' })
    hideShadow(frameState, null)
    expect(frameState.shadowFlying).toBe('true')
  })
})

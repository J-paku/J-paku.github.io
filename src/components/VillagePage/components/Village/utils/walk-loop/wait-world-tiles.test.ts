// @vitest-environment happy-dom
// ワールドを移った直後、新しいタイルがDOMに載るまで待つwaitForWorldTilesのテスト。
// 経過時間はperformance.nowを差し替えた時計で進める
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { World } from '@content/types/world'
import { LOADING_DELAY_MS, waitForWorldTiles } from './wait-world-tiles'
import type { WalkFrameState } from './types'

// 移った先のワールド。見るのはidだけ
const room: World = {
  id: 'room',
  kind: 'interior',
  width: 1,
  height: 1,
  start: { x: 0, y: 0 },
  startFacing: 'down',
  tiles: [['floor']],
  structures: [],
  spots: [],
  warps: [],
}

const makeFrameState = (waitSince: number | null): WalkFrameState => ({
  spriteKey: '',
  fishingTarget: null,
  waitSince,
  enteredWorld: room,
  ignoreHeld: false,
  plannedTarget: null,
  staleTarget: false,
  smoothedCam: null,
  paintedWorld: null,
  shift: '',
  lastTransform: '',
  frameWidth: null,
  veilCell: '',
  veilId: '',
})

// タイルの層。data-worldに今DOMへ載っているワールドのidを持つ
const makeLayer = (worldId: string) => {
  const layer = document.createElement('div')
  layer.dataset.world = worldId
  return layer
}

const isShown = (loading: HTMLElement) => loading.hasAttribute('data-show')

let now = 0

beforeEach(() => {
  now = 1000
  vi.stubGlobal('performance', { now: () => now })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('waitForWorldTiles', () => {
  it('覆いを出すまでの待ちは100ms', () => {
    expect(LOADING_DELAY_MS).toBe(100)
  })

  it('前のワールドのタイルが残っていればfalseを返し、待ち始めた時刻を覚える', () => {
    const frameState = makeFrameState(null)
    const loading = document.createElement('div')
    expect(waitForWorldTiles(frameState, makeLayer('town'), loading, room)).toBe(false)
    expect(frameState.waitSince).toBe(1000)
    expect(isShown(loading)).toBe(false)
  })

  it('data-worldがまだ付いていない層も、載っていないとみなして待つ', () => {
    const frameState = makeFrameState(null)
    expect(waitForWorldTiles(frameState, document.createElement('div'), null, room)).toBe(false)
    expect(frameState.waitSince).toBe(1000)
  })

  it('待っている間は待ち始めた時刻を書き換えない', () => {
    const frameState = makeFrameState(null)
    const layer = makeLayer('town')
    waitForWorldTiles(frameState, layer, null, room)
    now = 1050
    waitForWorldTiles(frameState, layer, null, room)
    expect(frameState.waitSince).toBe(1000)
  })

  it('待ちがちょうど100msでは覆いを出さず、100msを超えたら出す', () => {
    const frameState = makeFrameState(1000)
    const layer = makeLayer('town')
    const loading = document.createElement('div')
    now = 1000 + LOADING_DELAY_MS
    expect(waitForWorldTiles(frameState, layer, loading, room)).toBe(false)
    expect(isShown(loading)).toBe(false)
    now = 1000 + LOADING_DELAY_MS + 1
    expect(waitForWorldTiles(frameState, layer, loading, room)).toBe(false)
    expect(isShown(loading)).toBe(true)
  })

  it('覆いの要素が無ければ、待ちが長引いても落ちずにfalseを返す', () => {
    const frameState = makeFrameState(1000)
    now = 5000
    expect(waitForWorldTiles(frameState, makeLayer('town'), null, room)).toBe(false)
  })

  it('新しいタイルが載ったらtrueを返し、待ちを解いて覆いを外す', () => {
    const frameState = makeFrameState(1000)
    const loading = document.createElement('div')
    loading.dataset.show = ''
    expect(waitForWorldTiles(frameState, makeLayer('room'), loading, room)).toBe(true)
    expect(frameState.waitSince).toBeNull()
    expect(isShown(loading)).toBe(false)
  })

  it('タイルの層がまだ無ければ待たずにtrueを返す', () => {
    const frameState = makeFrameState(1000)
    const loading = document.createElement('div')
    loading.dataset.show = ''
    expect(waitForWorldTiles(frameState, null, loading, room)).toBe(true)
    expect(frameState.waitSince).toBeNull()
    expect(isShown(loading)).toBe(false)
  })

  it('載った後で覆いの要素が無くても落ちずにtrueを返す', () => {
    const frameState = makeFrameState(1000)
    expect(waitForWorldTiles(frameState, makeLayer('room'), null, room)).toBe(true)
    expect(frameState.waitSince).toBeNull()
  })
})

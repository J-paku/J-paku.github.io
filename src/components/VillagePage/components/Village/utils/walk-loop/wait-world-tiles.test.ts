// @vitest-environment happy-dom
// ワールドを移った直後、新しいタイルがDOMに載るまで待つwaitForWorldTilesのテスト。
// 待つ間の読み込み中の覆いと、飛行の影を隠す所を確かめる。
// 経過時間はperformance.nowを差し替えた時計で進める
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { World } from '@content/types/world'
import { LOADING_DELAY_MS, waitForWorldTiles, type WorldTileTargets } from './wait-world-tiles'
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

const makeFrameState = (
  waitSince: number | null,
  shadowFlying: WalkFrameState['shadowFlying'] = ''
): WalkFrameState => ({
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
  shadowTransform: '',
  shadowFlying,
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

// 待つ間に触る要素。覆いと影は無い(null)ものから始め、確かめたい所だけ渡す
const targets = (
  layer: HTMLElement | null,
  overrides: Partial<Omit<WorldTileTargets, 'layer'>> = {}
): WorldTileTargets => ({ layer, loading: null, shadow: null, ...overrides })

// 前のワールドで飛んでいた影。歩行ループが最後に書いた位置と data-flying='true' が残っている
const makeFlyingShadow = () => {
  const shadow = document.createElement('div')
  shadow.dataset.flying = 'true'
  shadow.style.transform = 'translate(896px, 704px) scale(0.9)'
  return shadow
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
    expect(waitForWorldTiles(frameState, targets(makeLayer('town'), { loading }), room)).toBe(false)
    expect(frameState.waitSince).toBe(1000)
    expect(isShown(loading)).toBe(false)
  })

  it('data-worldがまだ付いていない層も、載っていないとみなして待つ', () => {
    const frameState = makeFrameState(null)
    expect(waitForWorldTiles(frameState, targets(document.createElement('div')), room)).toBe(false)
    expect(frameState.waitSince).toBe(1000)
  })

  it('待っている間は待ち始めた時刻を書き換えない', () => {
    const frameState = makeFrameState(null)
    const layer = makeLayer('town')
    waitForWorldTiles(frameState, targets(layer), room)
    now = 1050
    waitForWorldTiles(frameState, targets(layer), room)
    expect(frameState.waitSince).toBe(1000)
  })

  it('待ちがちょうど100msでは覆いを出さず、100msを超えたら出す', () => {
    const frameState = makeFrameState(1000)
    const layer = makeLayer('town')
    const loading = document.createElement('div')
    now = 1000 + LOADING_DELAY_MS
    expect(waitForWorldTiles(frameState, targets(layer, { loading }), room)).toBe(false)
    expect(isShown(loading)).toBe(false)
    now = 1000 + LOADING_DELAY_MS + 1
    expect(waitForWorldTiles(frameState, targets(layer, { loading }), room)).toBe(false)
    expect(isShown(loading)).toBe(true)
  })

  it('覆いは値を持たないdata-showで出す', () => {
    const frameState = makeFrameState(1000)
    const loading = document.createElement('div')
    now = 1000 + LOADING_DELAY_MS + 1
    waitForWorldTiles(frameState, targets(makeLayer('town'), { loading }), room)
    expect(loading.getAttribute('data-show')).toBe('')
  })

  it('覆いの要素が無ければ、待ちが長引いても落ちずにfalseを返す', () => {
    const frameState = makeFrameState(1000)
    now = 5000
    expect(waitForWorldTiles(frameState, targets(makeLayer('town')), room)).toBe(false)
  })

  it('新しいタイルが載ったらtrueを返し、待ちを解いて覆いを外す', () => {
    const frameState = makeFrameState(1000)
    const loading = document.createElement('div')
    loading.dataset.show = ''
    expect(waitForWorldTiles(frameState, targets(makeLayer('room'), { loading }), room)).toBe(true)
    expect(frameState.waitSince).toBeNull()
    expect(isShown(loading)).toBe(false)
  })

  it('タイルの層がまだ無ければ待たずにtrueを返す', () => {
    const frameState = makeFrameState(1000)
    const loading = document.createElement('div')
    loading.dataset.show = ''
    expect(waitForWorldTiles(frameState, targets(null, { loading }), room)).toBe(true)
    expect(frameState.waitSince).toBeNull()
    expect(isShown(loading)).toBe(false)
  })

  it('載った後で覆いの要素が無くても落ちずにtrueを返す', () => {
    const frameState = makeFrameState(1000)
    expect(waitForWorldTiles(frameState, targets(makeLayer('room')), room)).toBe(true)
    expect(frameState.waitSince).toBeNull()
  })

  describe('飛行の影', () => {
    it('待っている間は影をdata-flying=falseで隠し、覚えた印も下ろす(位置は書き換えない)', () => {
      // 着地と扉が同じフレームだった形。前のワールドで飛んでいた印が残っている
      const frameState = makeFrameState(null, 'true')
      const shadow = makeFlyingShadow()
      const tiles = targets(makeLayer('town'), { shadow })
      expect(waitForWorldTiles(frameState, tiles, room)).toBe(false)
      expect(shadow.dataset.flying).toBe('false')
      expect(frameState.shadowFlying).toBe('false')
      expect(shadow.style.transform).toBe('translate(896px, 704px) scale(0.9)')
    })

    it('待つ間に隠した後は、同じ値を書き直さない', () => {
      const frameState = makeFrameState(null, 'true')
      const shadow = makeFlyingShadow()
      const layer = makeLayer('town')
      waitForWorldTiles(frameState, targets(layer, { shadow }), room)
      const observer = new MutationObserver(() => {})
      observer.observe(shadow, { attributes: true })
      waitForWorldTiles(frameState, targets(layer, { shadow }), room)
      expect(observer.takeRecords()).toHaveLength(0)
      observer.disconnect()
    })

    it('新しいタイルが載っていれば影には触らない(位置と印は次の描画が書く)', () => {
      const frameState = makeFrameState(1000, 'true')
      const shadow = makeFlyingShadow()
      expect(waitForWorldTiles(frameState, targets(makeLayer('room'), { shadow }), room)).toBe(true)
      expect(shadow.dataset.flying).toBe('true')
      expect(frameState.shadowFlying).toBe('true')
    })

    it('影の要素がまだ無くても、落ちずに待つ', () => {
      const frameState = makeFrameState(null, 'true')
      expect(waitForWorldTiles(frameState, targets(makeLayer('town')), room)).toBe(false)
      expect(frameState.shadowFlying).toBe('true')
    })
  })
})

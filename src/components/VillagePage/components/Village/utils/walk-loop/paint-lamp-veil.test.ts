// @vitest-environment happy-dom
// 主人公に重なった街灯を重ねる層へ写す部品(paintLampVeil)のテスト。席へ書く位置・添字・表示の印と、
// 立つマス・重なる街灯が変わらない間は判定も書き込みもしない所、ワールドをまたいだ時に書き直す所、
// 飛んでいる間は出発のマスの街灯を重ねない所を確かめる。
// 判定はlibのlampVeilAtをそのまま通し、呼ばれた回数だけを数える
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Cell, Structure } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import type { Flight } from '@/lib/village/flight'
import { lampVeilAt } from '@/lib/village/lamp-veil'
import { paintLampVeil } from './paint-lamp-veil'
import { makeFrameState, makeOpenWorld } from './walk-loop.test-helper'

vi.mock('@/lib/village/lamp-veil', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/village/lamp-veil')>()
  return { ...actual, lampVeilAt: vi.fn(actual.lampVeilAt) }
})

const lamp = (id: string, x: number, y: number): Structure => ({
  id,
  kind: 'lamp',
  cell: { x, y },
})

// (x,y)に立っている(飛んでいない)
const standingAt = (x: number, y: number): { cell: Cell; flight: Flight | null } => ({
  cell: { x, y },
  flight: null,
})
// (x,y)から(5,6)へ飛んでいる最中。cellは出発のマスのまま
const flyingFrom = (x: number, y: number): { cell: Cell; flight: Flight | null } => ({
  cell: { x, y },
  flight: { from: { x, y }, to: { x: 5, y: 6 }, durationMs: 600, elapsedMs: 100 },
})

// 西の街灯は(2,2)が灯・(2,3)が柱、東の街灯は(6,2)と(6,3)
const town = makeOpenWorld('town', 8, 8, [lamp('lamp-west', 2, 2), lamp('lamp-east', 6, 2)])
// 町と同じidの街灯を別の場所(4,4)に持つワールド。(2,2)には何も無い
const garden = makeOpenWorld('garden', 8, 8, [lamp('lamp-west', 4, 4)])

// ワールドのシートのうち街灯の2枚だけ。添字が0でないことで、--iが実際にシートを引いたと分かる
const veilSprites: SheetLayout = {
  index: { 'lamp-t': 7, 'lamp-b': 8 },
  count: 9,
  tile: 16,
  height: 16,
}

// LampVeilと同じく席を2つ持つ箱
const makeVeilRef = (slots = 2) => {
  const root = document.createElement('div')
  for (let i = 0; i < slots; i++) root.append(document.createElement('div'))
  return { current: root }
}

const slotAt = (root: HTMLDivElement, i: number): HTMLElement => {
  const slot = root.children[i]
  if (!(slot instanceof HTMLElement)) throw new Error(`${i}番目の席が無い`)
  return slot
}

// 席に書かれた値を読みやすい形にまとめる。印が無ければonはfalse
const readSlot = (slot: HTMLElement) => ({
  on: slot.dataset.villageVeilOn !== undefined,
  left: slot.style.left,
  top: slot.style.top,
  i: slot.style.getPropertyValue('--i'),
})

afterEach(() => {
  vi.mocked(lampVeilAt).mockClear()
})

describe('paintLampVeil', () => {
  it('街灯の絵のマスに立つと、上下2マスを席へ写して表示の印を立てる', () => {
    const frameState = makeFrameState()
    const veilRef = makeVeilRef()
    paintLampVeil(frameState, veilRef, town, standingAt(2, 2), veilSprites)
    expect(readSlot(slotAt(veilRef.current, 0))).toEqual({
      on: true,
      left: 'calc(var(--cell) * 2)',
      top: 'calc(var(--cell) * 2)',
      i: '7',
    })
    expect(readSlot(slotAt(veilRef.current, 1))).toEqual({
      on: true,
      left: 'calc(var(--cell) * 2)',
      top: 'calc(var(--cell) * 3)',
      i: '8',
    })
    expect(frameState.veilCell).toBe('town:2,2')
    expect(frameState.veilId).toBe('town:lamp-west')
  })

  it('街灯に重ならないマスへ移ると、全部の席の印を消す', () => {
    // 柱のすぐ下(2,4)は重なりに数えない
    const frameState = makeFrameState()
    const veilRef = makeVeilRef()
    paintLampVeil(frameState, veilRef, town, standingAt(2, 2), veilSprites)
    paintLampVeil(frameState, veilRef, town, standingAt(2, 4), veilSprites)
    expect(slotAt(veilRef.current, 0).dataset.villageVeilOn).toBeUndefined()
    expect(slotAt(veilRef.current, 1).dataset.villageVeilOn).toBeUndefined()
    expect(frameState.veilId).toBe('')
  })

  it('同じマスに立っている間は、判定も呼ばず席にも書かない', () => {
    const frameState = makeFrameState()
    const veilRef = makeVeilRef()
    paintLampVeil(frameState, veilRef, town, standingAt(2, 2), veilSprites)
    const observer = new MutationObserver(() => {})
    observer.observe(veilRef.current, { attributes: true, subtree: true })
    paintLampVeil(frameState, veilRef, town, standingAt(2, 2), veilSprites)
    paintLampVeil(frameState, veilRef, town, standingAt(2, 2), veilSprites)
    expect(vi.mocked(lampVeilAt)).toHaveBeenCalledTimes(1)
    expect(observer.takeRecords()).toHaveLength(0)
    observer.disconnect()
  })

  it('街灯の無いマスからマスへ歩く間は、判定し直しても席に触らない', () => {
    const frameState = makeFrameState()
    const veilRef = makeVeilRef()
    const observer = new MutationObserver(() => {})
    observer.observe(veilRef.current, { attributes: true, subtree: true })
    paintLampVeil(frameState, veilRef, town, standingAt(5, 5), veilSprites)
    paintLampVeil(frameState, veilRef, town, standingAt(5, 6), veilSprites)
    expect(vi.mocked(lampVeilAt)).toHaveBeenCalledTimes(2)
    expect(observer.takeRecords()).toHaveLength(0)
    expect(frameState.veilCell).toBe('town:5,6')
    observer.disconnect()
  })

  it('判定し直しても重なる街灯が前と同じ(どれにも重ならない)なら、層を読みもしない', () => {
    // 席を1つずつ回って何も消さない空回りもさせない。層を読んだ回数を数える
    const root = makeVeilRef().current
    let reads = 0
    const countingRef = {
      get current() {
        reads += 1
        return root
      },
    }
    const frameState = makeFrameState()
    paintLampVeil(frameState, countingRef, town, standingAt(5, 5), veilSprites)
    paintLampVeil(frameState, countingRef, town, standingAt(5, 6), veilSprites)
    expect(vi.mocked(lampVeilAt)).toHaveBeenCalledTimes(2)
    expect(reads).toBe(0)
    // 街灯に重なれば層を読んで書く
    paintLampVeil(frameState, countingRef, town, standingAt(2, 2), veilSprites)
    expect(reads).toBe(1)
  })

  it('別の街灯へ移ったら、その街灯の位置へ書き直す', () => {
    const frameState = makeFrameState()
    const veilRef = makeVeilRef()
    paintLampVeil(frameState, veilRef, town, standingAt(2, 2), veilSprites)
    paintLampVeil(frameState, veilRef, town, standingAt(6, 2), veilSprites)
    expect(readSlot(slotAt(veilRef.current, 0))).toMatchObject({
      on: true,
      left: 'calc(var(--cell) * 6)',
    })
    expect(frameState.veilId).toBe('town:lamp-east')
  })

  it('ワールドが替わると同じ座標でも判定し直し、前のワールドの街灯を残さない', () => {
    const frameState = makeFrameState()
    const veilRef = makeVeilRef()
    paintLampVeil(frameState, veilRef, town, standingAt(2, 2), veilSprites)
    paintLampVeil(frameState, veilRef, garden, standingAt(2, 2), veilSprites)
    expect(slotAt(veilRef.current, 0).dataset.villageVeilOn).toBeUndefined()
    expect(slotAt(veilRef.current, 1).dataset.villageVeilOn).toBeUndefined()
    expect(frameState.veilCell).toBe('garden:2,2')
  })

  it('別のワールドの同じidの街灯へ移っても、その街灯の位置へ書き直す', () => {
    const frameState = makeFrameState()
    const veilRef = makeVeilRef()
    paintLampVeil(frameState, veilRef, town, standingAt(2, 2), veilSprites)
    paintLampVeil(frameState, veilRef, garden, standingAt(4, 4), veilSprites)
    expect(readSlot(slotAt(veilRef.current, 0))).toMatchObject({
      on: true,
      left: 'calc(var(--cell) * 4)',
      top: 'calc(var(--cell) * 4)',
    })
    expect(readSlot(slotAt(veilRef.current, 1))).toMatchObject({
      on: true,
      top: 'calc(var(--cell) * 5)',
    })
    expect(frameState.veilId).toBe('garden:lamp-west')
  })

  it('席が絵のマスより多ければ、余った席の印は消す', () => {
    const frameState = makeFrameState()
    const veilRef = makeVeilRef(3)
    slotAt(veilRef.current, 2).dataset.villageVeilOn = ''
    paintLampVeil(frameState, veilRef, town, standingAt(2, 2), veilSprites)
    expect(slotAt(veilRef.current, 0).dataset.villageVeilOn).toBe('')
    expect(slotAt(veilRef.current, 1).dataset.villageVeilOn).toBe('')
    expect(slotAt(veilRef.current, 2).dataset.villageVeilOn).toBeUndefined()
  })

  it('HTML要素でない子には触らない', () => {
    const frameState = makeFrameState()
    const veilRef = makeVeilRef()
    const stray = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    stray.dataset.villageVeilOn = ''
    veilRef.current.append(stray)
    // 重なった時(余った席を消す)と離れた時(全部の席を消す)の両方で飛ばす
    paintLampVeil(frameState, veilRef, town, standingAt(2, 2), veilSprites)
    paintLampVeil(frameState, veilRef, town, standingAt(2, 4), veilSprites)
    expect(stray.dataset.villageVeilOn).toBe('')
  })

  it('街灯の下から飛び立つと、出発のマスの街灯を重ねたまま残さずに全部の席の印を消す', () => {
    const frameState = makeFrameState()
    const veilRef = makeVeilRef()
    paintLampVeil(frameState, veilRef, town, standingAt(2, 2), veilSprites)
    vi.mocked(lampVeilAt).mockClear()
    paintLampVeil(frameState, veilRef, town, flyingFrom(2, 2), veilSprites)
    expect(slotAt(veilRef.current, 0).dataset.villageVeilOn).toBeUndefined()
    expect(slotAt(veilRef.current, 1).dataset.villageVeilOn).toBeUndefined()
    expect(frameState.veilId).toBe('')
    expect(frameState.veilCell).toBe('')
    // 飛んでいる間は出発のマスで判定しない
    expect(vi.mocked(lampVeilAt)).not.toHaveBeenCalled()
  })

  it('飛んでいる間は判定も席への書き込みもせず、着地したマスで調べ直す', () => {
    const frameState = makeFrameState()
    const veilRef = makeVeilRef()
    const observer = new MutationObserver(() => {})
    observer.observe(veilRef.current, { attributes: true, subtree: true })
    paintLampVeil(frameState, veilRef, town, flyingFrom(5, 5), veilSprites)
    paintLampVeil(frameState, veilRef, town, flyingFrom(5, 5), veilSprites)
    expect(vi.mocked(lampVeilAt)).not.toHaveBeenCalled()
    expect(observer.takeRecords()).toHaveLength(0)
    observer.disconnect()
    // 東の街灯の灯のマスへ着地したら、その街灯を重ねる
    paintLampVeil(frameState, veilRef, town, standingAt(6, 2), veilSprites)
    expect(vi.mocked(lampVeilAt)).toHaveBeenCalledTimes(1)
    expect(readSlot(slotAt(veilRef.current, 0))).toMatchObject({
      on: true,
      left: 'calc(var(--cell) * 6)',
    })
    expect(frameState.veilId).toBe('town:lamp-east')
  })

  it('層がまだ無くても投げない', () => {
    expect(() =>
      paintLampVeil(makeFrameState(), { current: null }, town, standingAt(2, 2), veilSprites)
    ).not.toThrow()
  })
})

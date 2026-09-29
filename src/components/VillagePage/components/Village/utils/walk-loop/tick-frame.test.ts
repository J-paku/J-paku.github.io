// 1フレーム分を進める部品(tickFrame)のテスト。止めている間・ワープ直後の入力を捨てる印・傘の最中の扱いと、
// 到着と衝突の知らせ方、眠ってよいかの判定を確かめる。移動規則はlibのstepをそのまま通し、
// フック側の処理(描く・知らせる)はモックで数える
import { describe, expect, it, vi } from 'vitest'
import type { Cell, Direction } from '@content/types/world'
import { createMoveState, type MoveState } from '@/lib/village/movement'
import { tickFrame, type FrameSteps } from './tick-frame'
import type { MoveRefs } from './types'
import { makeFrameState, makeOpenWorld } from './walk-loop.test-helper'

// 8×8の草地。出発は(3,3)の下向き
const field = makeOpenWorld('field', 8, 8)
// 扉の先の別ワールド。ワープ直後を作るのに使う
const yard = makeOpenWorld('yard', 8, 8)

const resting = (): MoveState => createMoveState(field)

// fromからtoへprogressまで進んだ状態
const walking = (from: Cell, to: Cell, progress: number, route: Cell[] = []): MoveState => ({
  ...createMoveState(field),
  cell: from,
  facing: 'up',
  motion: { from, to, progress },
  route,
})

const makeRefs = (state: MoveState = resting()): MoveRefs => ({
  world: { current: field },
  state: { current: state },
  pendingRoute: { current: null },
  pendingFast: { current: false },
  autoTalk: { current: true },
  locked: { current: false },
  held: { current: null as Direction | null },
  pointerTarget: { current: null as Cell | null },
})

// 既定は「コマは止まっている・描き終えた・傘は動いていない」。確かめたい所だけ差し替える
const makeSteps = (overrides: Partial<FrameSteps> = {}) => ({
  applyPose: vi.fn((): boolean => false),
  paint: vi.fn((_dtMs: number): boolean => true),
  arrive: vi.fn((_cell: Cell) => {}),
  bump: vi.fn((_cell: Cell) => {}),
  retarget: vi.fn((_cell: Cell) => {}),
  umbrellaBusy: vi.fn((): boolean => false),
  ...overrides,
})

describe('tickFrame', () => {
  describe('止めている間', () => {
    it('会話・地図で止めている間はコマだけ書き直し、その結果をそのまま返す', () => {
      const state = resting()
      const refs = makeRefs(state)
      refs.locked.current = true
      refs.held.current = 'down'
      refs.pendingRoute.current = [{ x: 3, y: 4 }]
      const frameState = makeFrameState()
      const animating = makeSteps({ applyPose: vi.fn(() => true) })
      expect(tickFrame(frameState, refs, animating, 16)).toBe(true)
      const settled = makeSteps({ applyPose: vi.fn(() => false) })
      expect(tickFrame(frameState, refs, settled, 16)).toBe(false)
      // 歩みも描画も進めず、置いてある経路もワールドの覚えもそのまま
      expect(animating.paint).not.toHaveBeenCalled()
      expect(settled.paint).not.toHaveBeenCalled()
      expect(refs.state.current).toBe(state)
      expect(refs.pendingRoute.current).toEqual([{ x: 3, y: 4 }])
      expect(frameState.enteredWorld).toBeNull()
    })
  })

  describe('ワープ直後の入力', () => {
    it('ワールドが替わった最初のフレームは、押しっぱなしの向きとポインタを捨てる', () => {
      const refs = makeRefs()
      refs.held.current = 'down'
      refs.pointerTarget.current = { x: 3, y: 6 }
      const frameState = makeFrameState({ enteredWorld: yard, plannedTarget: { x: 1, y: 1 } })
      const steps = makeSteps()
      // 離したのを見届けるまで眠らない
      expect(tickFrame(frameState, refs, steps, 16)).toBe(true)
      expect(frameState.enteredWorld).toBe(field)
      expect(frameState.ignoreHeld).toBe(true)
      expect(frameState.staleTarget).toBe(true)
      expect(frameState.plannedTarget).toBeNull()
      // 前のワールドの入力では歩き出さず、自動で開く予約も取り消さない
      expect(refs.state.current.motion).toBeNull()
      expect(refs.state.current.cell).toEqual({ x: 3, y: 3 })
      expect(refs.autoTalk.current).toBe(true)
      expect(steps.retarget).not.toHaveBeenCalled()
    })

    it('起動時のように何も押していなければ、捨てる印は立てずに作った経路の覚えだけ消す', () => {
      const refs = makeRefs()
      const frameState = makeFrameState({ plannedTarget: { x: 1, y: 1 } })
      expect(tickFrame(frameState, refs, makeSteps(), 16)).toBe(false)
      expect(frameState.enteredWorld).toBe(field)
      expect(frameState.ignoreHeld).toBe(false)
      expect(frameState.staleTarget).toBe(false)
      expect(frameState.plannedTarget).toBeNull()
    })

    it('捨てている向きは離すまで効かず、離したら印を下ろして次に押した向きで歩き出す', () => {
      const refs = makeRefs()
      const frameState = makeFrameState({ enteredWorld: field, ignoreHeld: true })
      refs.held.current = 'down'
      tickFrame(frameState, refs, makeSteps(), 16)
      expect(refs.state.current.motion).toBeNull()
      expect(frameState.ignoreHeld).toBe(true)

      refs.held.current = null
      tickFrame(frameState, refs, makeSteps(), 16)
      expect(frameState.ignoreHeld).toBe(false)

      refs.held.current = 'down'
      tickFrame(frameState, refs, makeSteps(), 16)
      expect(refs.state.current.motion?.to).toEqual({ x: 3, y: 4 })
    })

    it('ワープ直後のポインタは一度離すまで経路にせず、離したら印を下ろして次の押下で経路を作る', () => {
      const refs = makeRefs()
      const frameState = makeFrameState({ enteredWorld: field, staleTarget: true })
      refs.pointerTarget.current = { x: 3, y: 6 }
      const stale = makeSteps()
      tickFrame(frameState, refs, stale, 16)
      expect(refs.state.current.motion).toBeNull()
      expect(stale.retarget).not.toHaveBeenCalled()
      expect(frameState.staleTarget).toBe(true)

      refs.pointerTarget.current = null
      tickFrame(frameState, refs, makeSteps(), 16)
      expect(frameState.staleTarget).toBe(false)

      refs.pointerTarget.current = { x: 3, y: 6 }
      const fresh = makeSteps()
      tickFrame(frameState, refs, fresh, 16)
      expect(fresh.retarget).toHaveBeenCalledWith({ x: 3, y: 6 })
      expect(refs.state.current.motion?.to).toEqual({ x: 3, y: 4 })
    })
  })

  describe('歩みを進める', () => {
    it('押しっぱなしの向きは自動で開く予約を取り消し、その向きへ歩き出す', () => {
      const refs = makeRefs()
      refs.held.current = 'down'
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), 16)).toBe(true)
      expect(refs.autoTalk.current).toBe(false)
      expect(refs.state.current.motion).toEqual({
        from: { x: 3, y: 3 },
        to: { x: 3, y: 4 },
        progress: 0,
      })
    })

    it('置いてある経路と速度をstepへ渡し、渡した後は置き場を空にする', () => {
      const refs = makeRefs()
      refs.pendingRoute.current = [
        { x: 3, y: 4 },
        { x: 3, y: 5 },
      ]
      refs.pendingFast.current = true
      tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), 16)
      expect(refs.state.current.motion?.to).toEqual({ x: 3, y: 4 })
      expect(refs.state.current.fast).toBe(true)
      expect(refs.state.current.route).toEqual([{ x: 3, y: 5 }])
      expect(refs.pendingRoute.current).toBeNull()
      expect(refs.pendingFast.current).toBe(false)
    })

    it('着いたマスをarriveへ知らせる', () => {
      // 0.9から100ms(256msで1マス)進めば着く
      const refs = makeRefs(walking({ x: 3, y: 3 }, { x: 3, y: 4 }, 0.9))
      const steps = makeSteps()
      tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, 100)
      expect(steps.arrive).toHaveBeenCalledTimes(1)
      expect(steps.arrive).toHaveBeenCalledWith({ x: 3, y: 4 })
      expect(steps.bump).not.toHaveBeenCalled()
      expect(refs.state.current.cell).toEqual({ x: 3, y: 4 })
    })

    it('通れないマスへ押すと、ぶつかった先をbumpへ知らせる', () => {
      // 上端(3,0)から上は盤の外
      const refs = makeRefs({ ...resting(), cell: { x: 3, y: 0 }, facing: 'up' })
      refs.held.current = 'up'
      const steps = makeSteps()
      tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, 16)
      expect(steps.bump).toHaveBeenCalledTimes(1)
      expect(steps.bump).toHaveBeenCalledWith({ x: 3, y: -1 })
      expect(steps.arrive).not.toHaveBeenCalled()
    })

    it('経路の最後の1歩でぶつかっても、到着でワールドが替わっていれば古い衝突として捨てる', () => {
      // (3,0)へ着いた同じフレームで、残りの経路の(3,-1)にぶつかる。着いたマスが扉でワールドが替わった形
      const refs = makeRefs(walking({ x: 3, y: 1 }, { x: 3, y: 0 }, 0.9, [{ x: 3, y: -1 }]))
      const steps = makeSteps({
        arrive: vi.fn((_cell: Cell) => {
          refs.world.current = yard
        }),
      })
      tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, 100)
      expect(steps.arrive).toHaveBeenCalledWith({ x: 3, y: 0 })
      expect(steps.bump).not.toHaveBeenCalled()
    })

    it('到着でワールドが替わらなければ、同じフレームの衝突はbumpへ渡す', () => {
      const refs = makeRefs(walking({ x: 3, y: 1 }, { x: 3, y: 0 }, 0.9, [{ x: 3, y: -1 }]))
      const steps = makeSteps()
      tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, 100)
      expect(steps.arrive).toHaveBeenCalledWith({ x: 3, y: 0 })
      expect(steps.bump).toHaveBeenCalledWith({ x: 3, y: -1 })
    })
  })

  describe('傘を開け閉めしている間', () => {
    it('移動を始めず描画だけ進め、入力は捨てずに残して眠らない', () => {
      const state = resting()
      const refs = makeRefs(state)
      refs.held.current = 'down'
      refs.pendingRoute.current = [{ x: 3, y: 4 }]
      refs.pendingFast.current = true
      const steps = makeSteps({ umbrellaBusy: vi.fn(() => true) })
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, 16)).toBe(true)
      expect(steps.paint).toHaveBeenCalledTimes(1)
      expect(steps.paint).toHaveBeenCalledWith(16)
      expect(refs.state.current).toBe(state)
      expect(refs.pendingRoute.current).toEqual([{ x: 3, y: 4 }])
      expect(refs.pendingFast.current).toBe(true)
      expect(refs.autoTalk.current).toBe(true)
      expect(steps.arrive).not.toHaveBeenCalled()
      expect(steps.bump).not.toHaveBeenCalled()
    })
  })

  describe('眠ってよいか', () => {
    it('入力も経路も無く描き終えたら、経過を描画へ渡してfalseを返す', () => {
      const steps = makeSteps()
      expect(tickFrame(makeFrameState({ enteredWorld: field }), makeRefs(), steps, 16)).toBe(false)
      expect(steps.paint).toHaveBeenCalledWith(16)
    })

    it('描き終えていなければ、入力が無くても眠らない', () => {
      const steps = makeSteps({ paint: vi.fn((_dtMs: number) => false) })
      expect(tickFrame(makeFrameState({ enteredWorld: field }), makeRefs(), steps, 16)).toBe(true)
    })

    it('捨てている向きでも押したままなら眠らない(離したのを見届けるため)', () => {
      const refs = makeRefs()
      refs.held.current = 'down'
      const frameState = makeFrameState({ enteredWorld: field, ignoreHeld: true })
      expect(tickFrame(frameState, refs, makeSteps(), 16)).toBe(true)
      expect(refs.state.current.motion).toBeNull()
    })

    it('ポインタを押したままなら、立つマスの上で経路が無くても眠らない', () => {
      const refs = makeRefs()
      refs.pointerTarget.current = { x: 3, y: 3 }
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), 16)).toBe(true)
      expect(refs.state.current.motion).toBeNull()
      expect(refs.pendingRoute.current).toBeNull()
    })

    it('歩いている途中は描き終えていても眠らない', () => {
      const refs = makeRefs(walking({ x: 3, y: 3 }, { x: 3, y: 4 }, 0.1))
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), 16)).toBe(true)
    })

    it('到着の処理が次の経路を置いたら眠らない', () => {
      const refs = makeRefs(walking({ x: 3, y: 3 }, { x: 3, y: 4 }, 0.9))
      const steps = makeSteps({
        arrive: vi.fn((_cell: Cell) => {
          refs.pendingRoute.current = [{ x: 3, y: 5 }]
        }),
      })
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, 100)).toBe(true)
      expect(refs.state.current.motion).toBeNull()
    })
  })
})

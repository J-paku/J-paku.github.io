// 1フレーム分を進める部品(tickFrame)のテスト。止めている間・ワープ直後の入力を捨てる印・傘の最中の扱いと、
// 到着と衝突・飛び立ちの知らせ方、自動の経路を飛ぶか・飛んでいる間の入力の錠、眠ってよいかの判定を確かめる。
// 移動規則はlibのstepをそのまま通し、フック側の処理(描く・知らせる)はモックで数える
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

// (3,3)から(3,7)へ600msかけて飛んでいる最中の状態。elapsedMsは飛び立ってからの経過
const flying = (elapsedMs = 0): MoveState => ({
  ...createMoveState(field),
  flight: { from: { x: 3, y: 3 }, to: { x: 3, y: 7 }, durationMs: 600, elapsedMs },
})

// (3,3)から下へまっすぐ3マス。最後のマスまで直線で3マスなので、飛んでよければ飛ぶ
const straightRoute = (): Cell[] => [
  { x: 3, y: 4 },
  { x: 3, y: 5 },
  { x: 3, y: 6 },
]

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
  liftOff: vi.fn(() => {}),
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
      expect(tickFrame(frameState, refs, animating, false, 16)).toBe(true)
      const settled = makeSteps({ applyPose: vi.fn(() => false) })
      expect(tickFrame(frameState, refs, settled, false, 16)).toBe(false)
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
      expect(tickFrame(frameState, refs, steps, false, 16)).toBe(true)
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
      expect(tickFrame(frameState, refs, makeSteps(), false, 16)).toBe(false)
      expect(frameState.enteredWorld).toBe(field)
      expect(frameState.ignoreHeld).toBe(false)
      expect(frameState.staleTarget).toBe(false)
      expect(frameState.plannedTarget).toBeNull()
    })

    it('捨てている向きは離すまで効かず、離したら印を下ろして次に押した向きで歩き出す', () => {
      const refs = makeRefs()
      const frameState = makeFrameState({ enteredWorld: field, ignoreHeld: true })
      refs.held.current = 'down'
      tickFrame(frameState, refs, makeSteps(), false, 16)
      expect(refs.state.current.motion).toBeNull()
      expect(frameState.ignoreHeld).toBe(true)

      refs.held.current = null
      tickFrame(frameState, refs, makeSteps(), false, 16)
      expect(frameState.ignoreHeld).toBe(false)

      refs.held.current = 'down'
      tickFrame(frameState, refs, makeSteps(), false, 16)
      expect(refs.state.current.motion?.to).toEqual({ x: 3, y: 4 })
    })

    it('ワープ直後のポインタは一度離すまで経路にせず、離したら印を下ろして次の押下で経路を作る', () => {
      const refs = makeRefs()
      const frameState = makeFrameState({ enteredWorld: field, staleTarget: true })
      refs.pointerTarget.current = { x: 3, y: 6 }
      const stale = makeSteps()
      tickFrame(frameState, refs, stale, false, 16)
      expect(refs.state.current.motion).toBeNull()
      expect(stale.retarget).not.toHaveBeenCalled()
      expect(frameState.staleTarget).toBe(true)

      refs.pointerTarget.current = null
      tickFrame(frameState, refs, makeSteps(), false, 16)
      expect(frameState.staleTarget).toBe(false)

      refs.pointerTarget.current = { x: 3, y: 6 }
      const fresh = makeSteps()
      tickFrame(frameState, refs, fresh, false, 16)
      expect(fresh.retarget).toHaveBeenCalledWith({ x: 3, y: 6 })
      expect(refs.state.current.motion?.to).toEqual({ x: 3, y: 4 })
    })
  })

  describe('歩みを進める', () => {
    it('押しっぱなしの向きは自動で開く予約を取り消し、その向きへ歩き出す', () => {
      const refs = makeRefs()
      refs.held.current = 'down'
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), false, 16)).toBe(
        true
      )
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
      // 高速の経路は飛ぶので、飛ばない設定(動きを控える)で歩きへ渡る経路と速度を見る
      tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), true, 16)
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
      tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, false, 100)
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
      tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, false, 16)
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
      tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, false, 100)
      expect(steps.arrive).toHaveBeenCalledWith({ x: 3, y: 0 })
      expect(steps.bump).not.toHaveBeenCalled()
    })

    it('到着でワールドが替わらなければ、同じフレームの衝突はbumpへ渡す', () => {
      const refs = makeRefs(walking({ x: 3, y: 1 }, { x: 3, y: 0 }, 0.9, [{ x: 3, y: -1 }]))
      const steps = makeSteps()
      tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, false, 100)
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
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, false, 16)).toBe(true)
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

  describe('自動の経路を飛ぶか', () => {
    it('高速の経路(次へ・地図からの移動)は飛び立ち、着地するマスまで直線で飛ぶ', () => {
      const refs = makeRefs()
      refs.pendingRoute.current = straightRoute()
      refs.pendingFast.current = true
      tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), false, 16)
      expect(refs.state.current.flight?.from).toEqual({ x: 3, y: 3 })
      expect(refs.state.current.flight?.to).toEqual({ x: 3, y: 6 })
      expect(refs.state.current.motion).toBeNull()
      expect(refs.pendingRoute.current).toBeNull()
      expect(refs.pendingFast.current).toBe(false)
    })

    it('動きを控える設定では高速の経路でも飛ばず、速い歩きで1マスずつ辿る', () => {
      const refs = makeRefs()
      refs.pendingRoute.current = straightRoute()
      refs.pendingFast.current = true
      tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), true, 16)
      expect(refs.state.current.flight).toBeNull()
      expect(refs.state.current.motion?.to).toEqual({ x: 3, y: 4 })
      expect(refs.state.current.fast).toBe(true)
    })

    it('等速の経路(舞台のタップ)は飛ばずに歩く', () => {
      const refs = makeRefs()
      refs.pendingRoute.current = straightRoute()
      tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), false, 16)
      expect(refs.state.current.flight).toBeNull()
      expect(refs.state.current.motion?.to).toEqual({ x: 3, y: 4 })
    })
  })

  describe('飛んでいる間', () => {
    it('押した向きでは自動で開く予約を取り消さず、歩き出しもしない', () => {
      const refs = makeRefs(flying())
      refs.held.current = 'left'
      tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), false, 16)
      expect(refs.autoTalk.current).toBe(true)
      expect(refs.state.current.flight?.elapsedMs).toBe(16)
      expect(refs.state.current.motion).toBeNull()
    })

    it('押しっぱなしのポインタへ経路を作り直さず、行き先の印も動かさない', () => {
      const refs = makeRefs(flying())
      refs.pointerTarget.current = { x: 6, y: 3 }
      const frameState = makeFrameState({ enteredWorld: field })
      const steps = makeSteps()
      tickFrame(frameState, refs, steps, false, 16)
      expect(steps.retarget).not.toHaveBeenCalled()
      expect(frameState.plannedTarget).toBeNull()
      expect(refs.autoTalk.current).toBe(true)
      expect(refs.state.current.flight?.to).toEqual({ x: 3, y: 7 })
    })

    it('入力が無く描き終えていても、飛んでいる間は眠らない', () => {
      const refs = makeRefs(flying())
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), false, 16)).toBe(
        true
      )
    })

    it('着地したフレームで、着地したマスをarriveへ知らせる', () => {
      // 600msのうち550ms飛んだ所から100ms進めば着地する
      const refs = makeRefs(flying(550))
      const steps = makeSteps()
      tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, false, 100)
      expect(steps.arrive).toHaveBeenCalledTimes(1)
      expect(steps.arrive).toHaveBeenCalledWith({ x: 3, y: 7 })
      expect(refs.state.current.flight).toBeNull()
      expect(refs.state.current.cell).toEqual({ x: 3, y: 7 })
    })
  })

  describe('飛び立ちの知らせ', () => {
    it('止まっていたマスから飛び立ったフレームで1回だけliftOffを呼び、飛んでいる続きのフレームでは呼ばない', () => {
      const refs = makeRefs()
      refs.pendingRoute.current = straightRoute()
      refs.pendingFast.current = true
      const frameState = makeFrameState({ enteredWorld: field })
      const steps = makeSteps()
      tickFrame(frameState, refs, steps, false, 16)
      expect(refs.state.current.flight?.to).toEqual({ x: 3, y: 6 })
      expect(steps.liftOff).toHaveBeenCalledTimes(1)
      // 飛び立ちは到着ではない(立っていたマスにも降りるマスにもまだ着いていない)
      expect(steps.arrive).not.toHaveBeenCalled()
      tickFrame(frameState, refs, steps, false, 16)
      expect(refs.state.current.flight?.elapsedMs).toBe(16)
      expect(steps.liftOff).toHaveBeenCalledTimes(1)
    })

    it('歩き出したフレーム・動きを控える設定の速い歩き・着地したフレームでは呼ばない', () => {
      const tapped = makeRefs()
      tapped.pendingRoute.current = straightRoute()
      const walkSteps = makeSteps()
      tickFrame(makeFrameState({ enteredWorld: field }), tapped, walkSteps, false, 16)
      expect(tapped.state.current.motion?.to).toEqual({ x: 3, y: 4 })
      expect(walkSteps.liftOff).not.toHaveBeenCalled()

      const reduced = makeRefs()
      reduced.pendingRoute.current = straightRoute()
      reduced.pendingFast.current = true
      const reducedSteps = makeSteps()
      tickFrame(makeFrameState({ enteredWorld: field }), reduced, reducedSteps, true, 16)
      expect(reduced.state.current.motion?.to).toEqual({ x: 3, y: 4 })
      expect(reducedSteps.liftOff).not.toHaveBeenCalled()

      const landing = makeRefs(flying(550))
      const landSteps = makeSteps()
      tickFrame(makeFrameState({ enteredWorld: field }), landing, landSteps, false, 100)
      expect(landing.state.current.flight).toBeNull()
      expect(landSteps.liftOff).not.toHaveBeenCalled()
    })

    it('歩き終えたマスへの到着と飛び立ちが同じフレームに重なると、arriveの後にliftOffを呼ぶ', () => {
      // (3,2)から(3,3)へ0.9まで歩いた所に高速の経路が届く。速い歩き(128msで1マス)で100ms進めば(3,3)に着き、
      // 同じフレームで(3,6)へ飛び立つ
      const refs = makeRefs(walking({ x: 3, y: 2 }, { x: 3, y: 3 }, 0.9))
      refs.pendingRoute.current = straightRoute()
      refs.pendingFast.current = true
      const order: string[] = []
      const steps = makeSteps({
        arrive: vi.fn((cell: Cell) => {
          order.push(`arrive ${cell.x},${cell.y}`)
        }),
        liftOff: vi.fn(() => {
          order.push('liftOff')
        }),
      })
      tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, false, 100)
      expect(refs.state.current.flight?.from).toEqual({ x: 3, y: 3 })
      expect(order).toEqual(['arrive 3,3', 'liftOff'])
    })

    it('到着でワールドが替われば、同じフレームで飛び立っていても知らせない', () => {
      // 着いたマスが扉で、到着の処理が新しいワールドの移動状態(飛んでいない)へ作り直した形
      const refs = makeRefs(walking({ x: 3, y: 2 }, { x: 3, y: 3 }, 0.9))
      refs.pendingRoute.current = straightRoute()
      refs.pendingFast.current = true
      const steps = makeSteps({
        arrive: vi.fn((_cell: Cell) => {
          refs.world.current = yard
          refs.state.current = createMoveState(yard)
        }),
      })
      tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, false, 100)
      expect(steps.arrive).toHaveBeenCalledTimes(1)
      expect(steps.liftOff).not.toHaveBeenCalled()
    })
  })

  describe('眠ってよいか', () => {
    it('入力も経路も無く描き終えたら、経過を描画へ渡してfalseを返す', () => {
      const steps = makeSteps()
      expect(tickFrame(makeFrameState({ enteredWorld: field }), makeRefs(), steps, false, 16)).toBe(
        false
      )
      expect(steps.paint).toHaveBeenCalledWith(16)
    })

    it('描き終えていなければ、入力が無くても眠らない', () => {
      const steps = makeSteps({ paint: vi.fn((_dtMs: number) => false) })
      expect(tickFrame(makeFrameState({ enteredWorld: field }), makeRefs(), steps, false, 16)).toBe(
        true
      )
    })

    it('捨てている向きでも押したままなら眠らない(離したのを見届けるため)', () => {
      const refs = makeRefs()
      refs.held.current = 'down'
      const frameState = makeFrameState({ enteredWorld: field, ignoreHeld: true })
      expect(tickFrame(frameState, refs, makeSteps(), false, 16)).toBe(true)
      expect(refs.state.current.motion).toBeNull()
    })

    it('ポインタを押したままなら、立つマスの上で経路が無くても眠らない', () => {
      const refs = makeRefs()
      refs.pointerTarget.current = { x: 3, y: 3 }
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), false, 16)).toBe(
        true
      )
      expect(refs.state.current.motion).toBeNull()
      expect(refs.pendingRoute.current).toBeNull()
    })

    it('歩いている途中は描き終えていても眠らない', () => {
      const refs = makeRefs(walking({ x: 3, y: 3 }, { x: 3, y: 4 }, 0.1))
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, makeSteps(), false, 16)).toBe(
        true
      )
    })

    it('到着の処理が経路の残る移動状態へ置き直したら眠らない', () => {
      // 眠ってよいかは知らせた後の移動状態で決める。残りの経路は次のフレームで辿る
      const refs = makeRefs(walking({ x: 3, y: 3 }, { x: 3, y: 4 }, 0.9))
      const steps = makeSteps({
        arrive: vi.fn((cell: Cell) => {
          refs.state.current = { ...createMoveState(field), cell, route: [{ x: 3, y: 5 }] }
        }),
      })
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, false, 100)).toBe(true)
    })

    it('到着の処理が旋回待ちの残る移動状態へ置き直したら眠らない', () => {
      const refs = makeRefs(walking({ x: 3, y: 3 }, { x: 3, y: 4 }, 0.9))
      const steps = makeSteps({
        arrive: vi.fn((cell: Cell) => {
          refs.state.current = { ...createMoveState(field), cell, turnRemainingMs: 50 }
        }),
      })
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, false, 100)).toBe(true)
    })

    it('到着の処理が次の経路を置いたら眠らない', () => {
      const refs = makeRefs(walking({ x: 3, y: 3 }, { x: 3, y: 4 }, 0.9))
      const steps = makeSteps({
        arrive: vi.fn((_cell: Cell) => {
          refs.pendingRoute.current = [{ x: 3, y: 5 }]
        }),
      })
      expect(tickFrame(makeFrameState({ enteredWorld: field }), refs, steps, false, 100)).toBe(true)
      expect(refs.state.current.motion).toBeNull()
    })
  })
})

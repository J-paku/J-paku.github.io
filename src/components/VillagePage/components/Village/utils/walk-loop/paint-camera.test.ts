// @vitest-environment happy-dom
// カメラを描く部品(paintCamera)のテスト。層へ書くtransformの値と、減衰追従・ワールド切り替え・
// 動きを控える設定での置き方、飛んでいる間の持ち上げと減衰しない追従、マスの実寸を枠の幅から求める所を確かめる。
// happy-domは配置を計算しない(clientWidthは0)ので、枠の幅は覚えた値かスパイで渡す
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Cell } from '@content/types/world'
import { flightPosition } from '@/lib/village/flight'
import type { MoveState } from '@/lib/village/movement'
import { CAM_TAU } from '../stage-scale'
import { paintCamera, type CameraTargets } from './paint-camera'
import { makeFrameState, makeOpenWorld } from './walk-loop.test-helper'

// 30×20の町。表示枠(10×9)より広いので、カメラは主人公の4マス手前を原点にする
const town = makeOpenWorld('town', 30, 20)
// 町と同じ大きさの別ワールド。寸法が同じでも別物なら切り替えとして扱うことを見る
const twin = makeOpenWorld('twin', 30, 20)

const standing = (cell: Cell): MoveState => ({
  cell,
  facing: 'down',
  motion: null,
  route: [],
  fast: false,
  fly: false,
  flight: null,
  turnRemainingMs: 0,
  stride: 0,
})

const walking = (from: Cell, to: Cell, progress: number): MoveState => ({
  ...standing(from),
  motion: { from, to, progress },
})

// fromからtoへ1000msかけて飛び、elapsedMsだけ経った状態。cellは出発のマスのまま
const flying = (from: Cell, to: Cell, elapsedMs: number): MoveState => ({
  ...standing(from),
  flight: { from, to, durationMs: 1000, elapsedMs },
})

const makeTargets = (): CameraTargets & { layer: HTMLElement } => ({
  frame: document.createElement('div'),
  layer: document.createElement('div'),
  camRef: { current: { x: 0, y: 0 } },
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('paintCamera', () => {
  it('初回のフレームは目標へそのまま置き、層を整数pxのtranslateでずらす', () => {
    // 枠640pxを10列で割って1マス64px。(15,10)に立つと原点は(11,6)で、層は(-704,-384)px
    const frameState = makeFrameState({ frameWidth: 640 })
    const targets = makeTargets()
    const result = paintCamera(frameState, targets, town, standing({ x: 15, y: 10 }), false, 16)
    expect(result).toEqual({ px: 64, v: { x: 15, y: 10 }, switched: true, caughtUp: true })
    expect(targets.layer.style.transform).toBe('translate(-704px, -384px)')
    expect(targets.camRef.current).toEqual({ x: 11, y: 6 })
    expect(frameState.smoothedCam).toEqual({ x: 11, y: 6 })
    expect(frameState.paintedWorld).toBe(town)
  })

  it('同じワールドでも覚えた原点が無ければ補間せず目標から始める', () => {
    const frameState = makeFrameState({ frameWidth: 640, paintedWorld: town })
    const targets = makeTargets()
    const result = paintCamera(frameState, targets, town, standing({ x: 15, y: 10 }), false, 16)
    expect(result.switched).toBe(false)
    expect(result.caughtUp).toBe(true)
    expect(targets.camRef.current).toEqual({ x: 11, y: 6 })
  })

  it('同じワールドの続きのフレームは目標へ減衰しながら寄り、追い付くまでcaughtUpはfalse', () => {
    // 原点10から目標11へ16ms分だけ寄る。1-exp(-16/70)≒0.2043なので10.2043マス、64倍して653px
    const frameState = makeFrameState({
      frameWidth: 640,
      paintedWorld: town,
      smoothedCam: { x: 10, y: 6 },
    })
    const targets = makeTargets()
    const result = paintCamera(frameState, targets, town, standing({ x: 15, y: 10 }), false, 16)
    const expectedX = 10 + (1 - Math.exp(-16 / CAM_TAU))
    expect(result.switched).toBe(false)
    expect(result.caughtUp).toBe(false)
    expect(targets.camRef.current.x).toBeCloseTo(expectedX, 10)
    expect(targets.camRef.current.y).toBe(6)
    expect(frameState.smoothedCam).toBe(targets.camRef.current)
    expect(targets.layer.style.transform).toBe('translate(-653px, -384px)')
  })

  it('横は追い付いていても、縦がまだ寄っている間はcaughtUpはfalse', () => {
    // 原点(11,5)から目標(11,6)へ。横は同じ値のまま、縦だけ16ms分寄る
    const frameState = makeFrameState({
      frameWidth: 640,
      paintedWorld: town,
      smoothedCam: { x: 11, y: 5 },
    })
    const targets = makeTargets()
    const result = paintCamera(frameState, targets, town, standing({ x: 15, y: 10 }), false, 16)
    expect(targets.camRef.current.x).toBe(11)
    expect(targets.camRef.current.y).toBeCloseTo(5 + (1 - Math.exp(-16 / CAM_TAU)), 10)
    expect(result.caughtUp).toBe(false)
  })

  it('ワールドが替わったフレームは差が1.5マス以内でも補間せず目標へ飛ぶ', () => {
    // 半マスの差なら同じワールドの中では補間する距離。ワールドが違えばスライドさせずに切る
    const frameState = makeFrameState({
      frameWidth: 640,
      paintedWorld: twin,
      smoothedCam: { x: 10.5, y: 6 },
    })
    const targets = makeTargets()
    const result = paintCamera(frameState, targets, town, standing({ x: 15, y: 10 }), false, 16)
    expect(result.switched).toBe(true)
    expect(result.caughtUp).toBe(true)
    expect(targets.camRef.current).toEqual({ x: 11, y: 6 })
    expect(targets.layer.style.transform).toBe('translate(-704px, -384px)')
    expect(frameState.paintedWorld).toBe(town)
  })

  it('移動中は補間座標をvに返し、カメラの目標もその座標から求める', () => {
    // 横へ1/4進んだ所は15.25マス → 原点11.25 → 720px
    const across = makeTargets()
    const acrossResult = paintCamera(
      makeFrameState({ frameWidth: 640 }),
      across,
      town,
      walking({ x: 15, y: 10 }, { x: 16, y: 10 }, 0.25),
      false,
      16
    )
    expect(acrossResult.v).toEqual({ x: 15.25, y: 10 })
    expect(across.layer.style.transform).toBe('translate(-720px, -384px)')
    // 縦へ半分進んだ所は10.5マス → 原点6.5 → 416px
    const down = makeTargets()
    const downResult = paintCamera(
      makeFrameState({ frameWidth: 640 }),
      down,
      town,
      walking({ x: 15, y: 10 }, { x: 15, y: 11 }, 0.5),
      false,
      16
    )
    expect(downResult.v).toEqual({ x: 15, y: 10.5 })
    expect(down.layer.style.transform).toBe('translate(-704px, -416px)')
  })

  it('動きを控える設定では補間せず、移動中でもstate.cellの位置に置く', () => {
    const targets = makeTargets()
    const result = paintCamera(
      makeFrameState({ frameWidth: 640 }),
      targets,
      town,
      walking({ x: 15, y: 10 }, { x: 16, y: 10 }, 0.25),
      true,
      16
    )
    expect(result.v).toEqual({ x: 15, y: 10 })
    expect(targets.layer.style.transform).toBe('translate(-704px, -384px)')
  })

  it('飛んでいる間は飛行の地上の位置をvに返し、カメラは浮いた高さの半分だけ上を狙う', () => {
    // (12,10)から(20,10)へ半分の時間飛んだ所。出発のマス(state.cell)ではなく飛行の位置に置く。
    // 進み具合は 0.5³×(10-15×0.5+6×0.25)=0.5 で地上の位置は(16,10)。浮き上がりは (4×0.5×0.5)³=1 の 2 マス倍で
    // 2 マス(頂点)、その半分の 1 マスだけ上の(16,9)を狙い、原点は(12,5)。64 倍して(768,320)px
    const state = flying({ x: 12, y: 10 }, { x: 20, y: 10 }, 500)
    const targets = makeTargets()
    const result = paintCamera(makeFrameState({ frameWidth: 640 }), targets, town, state, false, 16)
    expect(result.v).toEqual({ x: 16, y: 10 })
    expect(result.caughtUp).toBe(true)
    expect(targets.camRef.current).toEqual({ x: 12, y: 5 })
    expect(targets.layer.style.transform).toBe('translate(-768px, -320px)')
  })

  it('飛んでいる間は減衰させず、遅れていたカメラも 1 フレームで目標へそのまま置く', () => {
    // 上と同じ飛行の途中。原点(11,5.5)は目標(12,5)から横に 1 マス・縦に半マス遅れていて、
    // どちらの軸も 1.5 マス以内なので、歩きなら補間で寄る距離
    const frameState = makeFrameState({
      frameWidth: 640,
      paintedWorld: town,
      smoothedCam: { x: 11, y: 5.5 },
    })
    const targets = makeTargets()
    const state = flying({ x: 12, y: 10 }, { x: 20, y: 10 }, 500)
    const result = paintCamera(frameState, targets, town, state, false, 16)
    expect(result.switched).toBe(false)
    expect(result.caughtUp).toBe(true)
    expect(targets.camRef.current).toEqual({ x: 12, y: 5 })
    expect(frameState.smoothedCam).toEqual({ x: 12, y: 5 })
    expect(targets.layer.style.transform).toBe('translate(-768px, -320px)')
  })

  it('着地した次のフレームは減衰追従へ戻り、着地の直前と同じpxに留まって跳ねない', () => {
    // 1000msのうち990ms飛んだ所は地上(19.99992,10)・浮き上がり約0.00012マスで、原点は約(15.99992,5.99994)。
    // pxへ直すと着地したマス(20,10)の原点(16,6)と同じ(-1024,-384)
    const frameState = makeFrameState({ frameWidth: 640 })
    const targets = makeTargets()
    const lastFlying = flying({ x: 12, y: 10 }, { x: 20, y: 10 }, 990)
    paintCamera(frameState, targets, town, lastFlying, false, 16)
    expect(targets.layer.style.transform).toBe('translate(-1024px, -384px)')
    const landed = paintCamera(frameState, targets, town, standing({ x: 20, y: 10 }), false, 16)
    expect(landed.switched).toBe(false)
    expect(landed.v).toEqual({ x: 20, y: 10 })
    expect(targets.layer.style.transform).toBe('translate(-1024px, -384px)')
    // 残差は半 px 未満なので、減衰追従はそのまま目標へ吸着する
    expect(targets.camRef.current).toEqual({ x: 16, y: 6 })
    expect(landed.caughtUp).toBe(true)
  })

  it('動きを控える設定でも、飛んでいる最中なら出発のマスへ戻さず飛行の位置に置く', () => {
    const state = flying({ x: 12, y: 10 }, { x: 20, y: 10 }, 500)
    const result = paintCamera(
      makeFrameState({ frameWidth: 640 }),
      makeTargets(),
      town,
      state,
      true,
      16
    )
    expect(result.v).toEqual(flightPosition(state))
  })

  it('pxへ直した値は四捨五入で整数に寄せる', () => {
    // 枠370pxで1マス37px。横へ半分進むと原点11.5 → 425.5pxは426pxへ寄る(切り捨てなら425)
    const targets = makeTargets()
    paintCamera(
      makeFrameState({ frameWidth: 370 }),
      targets,
      town,
      walking({ x: 15, y: 10 }, { x: 16, y: 10 }, 0.5),
      false,
      16
    )
    expect(targets.layer.style.transform).toBe('translate(-426px, -222px)')
  })

  it('覚えた幅が無い間だけframe.clientWidthを読んでマスの実寸を決める', () => {
    const unmeasured = makeTargets()
    const unmeasuredWidth = vi.spyOn(unmeasured.frame, 'clientWidth', 'get').mockReturnValue(320)
    const first = paintCamera(
      makeFrameState(),
      unmeasured,
      town,
      standing({ x: 15, y: 10 }),
      false,
      16
    )
    expect(unmeasuredWidth).toHaveBeenCalled()
    expect(first.px).toBe(32)
    expect(unmeasured.layer.style.transform).toBe('translate(-352px, -192px)')

    // 幅を覚えた後は、毎フレームの再計算を強いるclientWidthを読まない
    const measured = makeTargets()
    const measuredWidth = vi.spyOn(measured.frame, 'clientWidth', 'get').mockReturnValue(320)
    const next = paintCamera(
      makeFrameState({ frameWidth: 640 }),
      measured,
      town,
      standing({ x: 15, y: 10 }),
      false,
      16
    )
    expect(measuredWidth).not.toHaveBeenCalled()
    expect(next.px).toBe(64)
  })

  it('層が無くてもカメラの原点は入力側へ渡し、結果を返す', () => {
    const targets = { ...makeTargets(), layer: null }
    const result = paintCamera(
      makeFrameState({ frameWidth: 640 }),
      targets,
      town,
      standing({ x: 15, y: 10 }),
      false,
      16
    )
    expect(result.caughtUp).toBe(true)
    expect(targets.camRef.current).toEqual({ x: 11, y: 6 })
  })

  it('表示枠より小さいワールドは負の原点なので、層を正の向きへずらして中央に置く', () => {
    // 6×5のワールドは原点(-2,-2)。層は(128,128)pxだけ右下へ寄る
    const targets = makeTargets()
    paintCamera(
      makeFrameState({ frameWidth: 640 }),
      targets,
      makeOpenWorld('hut', 6, 5),
      standing({ x: 3, y: 3 }),
      false,
      16
    )
    expect(targets.layer.style.transform).toBe('translate(128px, 128px)')
  })
})

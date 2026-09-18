// computeCell の境界と、追従カメラ cameraOffset の原点計算・approachCamera の減衰追従
import { describe, expect, it } from 'vitest'
import {
  CAM_SNAP_CELLS,
  CAM_TAU,
  CELL_MAX,
  CELL_MIN,
  VIEW_COLS,
  VIEW_ROWS,
  approachCamera,
  cameraOffset,
  computeCell,
} from './use-stage-scale'

describe('computeCell', () => {
  it('PCは上限64pxで止まる(1280×720)', () => {
    // 幅 1280/10=128・高さ 720/9=80 なので上限で頭打ち
    expect(computeCell(1280, 720, 0, VIEW_COLS, VIEW_ROWS)).toBe(CELL_MAX)
  })
  it('縦持ちは幅基準で切り捨て(390×844・帯104)', () => {
    // 幅 390/10=39 < 高さ (844-104)/9=82
    expect(computeCell(390, 844, 104, VIEW_COLS, VIEW_ROWS)).toBe(39)
  })
  it('横持ちは高さ基準(844×390・帯48)', () => {
    // 高さ (390-48)/9=38 < 幅 844/10=84
    expect(computeCell(844, 390, 48, VIEW_COLS, VIEW_ROWS)).toBe(38)
  })
  it('部屋(10×8)を直接渡しても上限64pxで止まる', () => {
    // 高さ 720/8=90・幅 128 のどちらも上限を超える
    expect(computeCell(1280, 720, 0, 10, 8)).toBe(CELL_MAX)
  })
  it('極端に小さい舞台でも下限12px(200×100)', () => {
    // 高さ 100/9=11 は下限を割るので 12 へ引き上げる
    expect(computeCell(200, 100, 0, VIEW_COLS, VIEW_ROWS)).toBe(CELL_MIN)
  })
})

describe('cameraOffset', () => {
  const town = { width: 30, height: 20 }

  it('左上の端では原点0で止まる', () => {
    // 希望値は x=2-4=-2・y=1-4=-3 だがどちらも負なので 0 へ丸める
    expect(cameraOffset(town, { x: 2, y: 1 })).toEqual({ x: 0, y: 0 })
  })
  it('右下の端ではワールド端で止まる', () => {
    // 上限は x=30-10=20・y=20-9=11。希望値 24・15 を超えない
    expect(cameraOffset(town, { x: 28, y: 19 })).toEqual({ x: 20, y: 11 })
  })
  it('中央ではプレイヤーの4マス手前を原点にする', () => {
    expect(cameraOffset(town, { x: 15, y: 10 })).toEqual({ x: 11, y: 6 })
  })
  it('補間中の小数座標はそのまま追従する(マス単位に丸めない)', () => {
    // 丸めるとカメラが1マスぶん飛ぶので、小数のまま 4 を引いた値を返す。
    // 10.2-4 は二進小数で割り切れないため厳密一致ではなく近似で見る
    const cam = cameraOffset(town, { x: 15.6, y: 10.2 })
    expect(cam.x).toBeCloseTo(11.6, 10)
    expect(cam.y).toBeCloseTo(6.2, 10)
  })
  it('小数座標でも端では止まる', () => {
    // 左上は 0 未満へ行かず、右下は 20・11 を超えない
    expect(cameraOffset(town, { x: 3.4, y: 2.5 })).toEqual({ x: 0, y: 0 })
    expect(cameraOffset(town, { x: 25.5, y: 16.5 })).toEqual({ x: 20, y: 11 })
  })
  it('部屋(10×8)は表示枠に収まるので中央寄せ・下に1行残る', () => {
    // 横は同寸で 0、縦は -floor((9-8)/2)=0 となり黒地が下に 1 行残る
    expect(cameraOffset({ width: 10, height: 8 }, { x: 5, y: 4 })).toEqual({ x: 0, y: 0 })
  })
  it('表示枠より小さいワールドは負の原点で中央へ寄る', () => {
    // -floor((10-6)/2)=-2・-floor((9-5)/2)=-2
    expect(cameraOffset({ width: 6, height: 5 }, { x: 0, y: 4 })).toEqual({ x: -2, y: -2 })
  })
})

describe('approachCamera', () => {
  it('目標へ一部だけ寄り、行き過ぎない', () => {
    const next = approachCamera({ x: 0, y: 0 }, { x: 1, y: -1 }, 16)
    expect(next.x).toBeGreaterThan(0)
    expect(next.x).toBeLessThan(1)
    expect(next.y).toBeLessThan(0)
    expect(next.y).toBeGreaterThan(-1)
  })
  it('1フレームで進む割合は 1-exp(-dt/τ)', () => {
    const next = approachCamera({ x: 0, y: 0 }, { x: 1, y: 0 }, CAM_TAU)
    expect(next.x).toBeCloseTo(1 - Math.exp(-1), 10)
  })
  it('分割しても同じ経過時間なら同じ位置へ着く(フレームレート非依存)', () => {
    const target = { x: 1.2, y: 0.8 }
    const once = approachCamera({ x: 0, y: 0 }, target, 64)
    let split = { x: 0, y: 0 }
    for (let i = 0; i < 4; i += 1) split = approachCamera(split, target, 16)
    expect(split.x).toBeCloseTo(once.x, 6)
    expect(split.y).toBeCloseTo(once.y, 6)
  })
  it('CAM_SNAP_CELLS を超える差は両軸とも即座に目標へ', () => {
    // ワープ・地図移動。x が閾値を超えたら y も引きずらず一緒に飛ばす
    const far = { x: CAM_SNAP_CELLS + 0.5, y: 0.2 }
    expect(approachCamera({ x: 0, y: 0 }, far, 16)).toEqual(far)
  })
  it('すでに目標なら値はそのまま動かない', () => {
    const target = { x: 11.6, y: 6.2 }
    expect(approachCamera({ x: 11.6, y: 6.2 }, target, 16)).toEqual(target)
  })
  it('サブピクセル未満の残差は目標へ吸着して微動を止める', () => {
    const target = { x: 5, y: 3 }
    const next = approachCamera({ x: 5 - 1 / (CELL_MAX * 8), y: 3 }, target, 16)
    expect(next).toEqual(target)
  })
})

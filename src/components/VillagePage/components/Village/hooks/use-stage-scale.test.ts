// computeCell の境界と、追従カメラ cameraOffset の原点計算・approachCamera の減衰追従。
// bandHeight は --band として書き込む値そのものなので、静的配置(縦持ち)と 0px になる場合を確認する
import { describe, expect, it, vi } from 'vitest'
import {
  CAM_SNAP_CELLS,
  CAM_TAU,
  CELL_MAX,
  CELL_MIN,
  VIEW_COLS,
  VIEW_ROWS,
  approachCamera,
  bandGap,
  bandHeight,
  cameraOffset,
  cellMax,
  computeCell,
  hasGutters,
} from './use-stage-scale'

describe('cellMax', () => {
  it('列数が2倍(20列)になれば上限は半分(32px)になり、合計横幅64×10を保つ', () => {
    expect(cellMax(20)).toBe(32)
  })
})

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
  it('列数20の広い舞台でも上限は32pxで止まる(64×10と同じ合計横幅640px)', () => {
    // 幅 1280/20=64・高さ 720/9=80 のどちらも上限 32px を超える
    expect(computeCell(1280, 720, 0, 20, VIEW_ROWS)).toBe(32)
  })
})

describe('bandHeight', () => {
  // node 環境には DOM が無いので、必要なプロパティだけを持つ最小限のオブジェクトを
  // Partial<HTMLDivElement> 経由で型付けする(as unknown は使わない)
  const band = { offsetHeight: 104 } as Partial<HTMLDivElement> as HTMLDivElement

  it('静的配置(縦持ちの帯)なら offsetHeight をそのまま --band の値にする', () => {
    vi.stubGlobal('getComputedStyle', (): Partial<CSSStyleDeclaration> => ({ position: 'static' }))
    expect(bandHeight(band)).toBe(104)
    vi.unstubAllGlobals()
  })

  it('absolute配置(横持ち)は帯が枠に重なるだけなので --band は0px', () => {
    vi.stubGlobal('getComputedStyle', (): Partial<CSSStyleDeclaration> => ({
      position: 'absolute',
    }))
    expect(bandHeight(band)).toBe(0)
    vi.unstubAllGlobals()
  })

  it('帯の要素そのものが無ければ0px', () => {
    expect(bandHeight(null)).toBe(0)
  })
})

describe('bandGap', () => {
  it('帯が画面下端に接していなければ、舞台下端から帯の上端までの距離を返す(664-442=222)', () => {
    expect(bandGap(664, 442)).toBe(222)
  })
  it('帯の上端が舞台下端と一致すれば0', () => {
    expect(bandGap(664, 664)).toBe(0)
  })
  it('帯の上端が舞台下端より下(負の距離になる場合)は0に丸める', () => {
    expect(bandGap(664, 700)).toBe(0)
  })
})

describe('hasGutters', () => {
  it('横持ちスマホ(750×342, cell38)は片側185pxのガターが立つ', () => {
    expect(hasGutters(750, 38, VIEW_COLS)).toBe(true)
  })
  it('iPad横持ち(1024×768, cell64)は片側192pxのガターが立つ', () => {
    expect(hasGutters(1024, 64, VIEW_COLS)).toBe(true)
  })
  it('iPad縦持ち(768×1024, cell64)は片側64pxしかなくガターは立たない(帯は下段のまま)', () => {
    expect(hasGutters(768, 64, VIEW_COLS)).toBe(false)
  })
  it('境界の150pxちょうどは成立する', () => {
    // cell40・cols10で枠400、幅700なら片側150px
    expect(hasGutters(700, 40, VIEW_COLS)).toBe(true)
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

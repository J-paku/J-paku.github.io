// 拡大地図の枠を押した位置からマスを求めるcellFromClickのテスト
import { describe, expect, it } from 'vitest'
import { cellFromClick } from './cell-from-click'

// 画面の(100,50)から幅200・高さ100の枠。10×5マスなので1マスは20px角
const rect = { left: 100, top: 50, width: 200, height: 100 }
const world = { width: 10, height: 5 }

// 枠の左上からの距離で押した位置を作る
const at = (dx: number, dy: number) => ({ clientX: rect.left + dx, clientY: rect.top + dy })

describe('cellFromClick', () => {
  it('枠の左上を差し引いた割合からマスを求める', () => {
    expect(cellFromClick(at(45, 30), rect, world)).toEqual({ x: 2, y: 1 })
  })

  it('枠の左上ちょうどは(0,0)', () => {
    expect(cellFromClick(at(0, 0), rect, world)).toEqual({ x: 0, y: 0 })
  })

  it('マスの境目ちょうどは右・下のマス、その手前は左・上のマス', () => {
    expect(cellFromClick(at(20, 20), rect, world)).toEqual({ x: 1, y: 1 })
    expect(cellFromClick(at(19.9, 19.9), rect, world)).toEqual({ x: 0, y: 0 })
  })

  it('右端・下端ちょうどは枠外ではなく端のマスへ収める', () => {
    expect(cellFromClick(at(200, 100), rect, world)).toEqual({ x: 9, y: 4 })
  })

  it('枠の外を押しても盤の中のマスへ収める', () => {
    expect(cellFromClick(at(-30, -30), rect, world)).toEqual({ x: 0, y: 0 })
    expect(cellFromClick(at(500, 500), rect, world)).toEqual({ x: 9, y: 4 })
  })

  it('枠の幅か高さが0(描かれていない)ならnull', () => {
    expect(cellFromClick(at(0, 0), { ...rect, width: 0 }, world)).toBeNull()
    expect(cellFromClick(at(0, 0), { ...rect, height: 0 }, world)).toBeNull()
  })
})

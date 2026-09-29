// @vitest-environment happy-dom
// 拡大地図で重なった地点の印をずらすarrangeBadgesのテスト。
// happy-domは配置を計算しない(寸法が0)ので、枠と印の子の外接矩形はgetBoundingClientRectを差し替えて与える
import { describe, expect, it, vi } from 'vitest'
import { arrangeBadges } from './arrange-badges'

type Box = { left: number; top: number; right: number; bottom: number }

// 左上と一辺の長さから正方形の矩形を作る。既定は字の大きさ20px角
const square = (left: number, top: number, size = 20): Box => ({
  left,
  top,
  right: left + size,
  bottom: top + size,
})

const measure = (element: Element, box: Box) => {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(box.left, box.top, box.right - box.left, box.bottom - box.top)
  )
}

// 枠と地点のボタンを組み立てる。地点は並べた順(番号の順)に置き、各地点の矩形はボタンの子(字・札)の外接矩形
const makeCanvas = (frame: Box, spots: readonly (readonly Box[])[]) => {
  const canvas = document.createElement('div')
  measure(canvas, frame)
  const buttons = spots.map((parts, index) => {
    const button = document.createElement('button')
    button.dataset.spotId = `spot-${index}`
    for (const part of parts) {
      const child = document.createElement('span')
      measure(child, part)
      button.append(child)
    }
    canvas.append(button)
    return button
  })
  return { canvas, buttons }
}

const nudgeOf = (button: HTMLElement) => ({
  x: button.style.getPropertyValue('--nudge-x'),
  y: button.style.getPropertyValue('--nudge-y'),
})

const NONE = { x: '', y: '' }
// 印がどこへずれても収まる広い枠
const WIDE = square(0, 0, 400)

describe('arrangeBadges', () => {
  it('離れた印は動かさず、前回書いたずらしを外す', () => {
    const { canvas, buttons } = makeCanvas(WIDE, [[square(100, 100)], [square(200, 100)]])
    buttons[1].style.setProperty('--nudge-x', '99px')
    buttons[1].style.setProperty('--nudge-y', '99px')
    arrangeBadges(canvas)
    expect(nudgeOf(buttons[0])).toEqual(NONE)
    expect(nudgeOf(buttons[1])).toEqual(NONE)
  })

  it('6px空いていれば触れていない、5pxなら触れて押し出す', () => {
    const apart = makeCanvas(WIDE, [[square(100, 100)], [square(126, 100)]])
    arrangeBadges(apart.canvas)
    expect(nudgeOf(apart.buttons[1])).toEqual(NONE)

    const close = makeCanvas(WIDE, [[square(100, 100)], [square(125, 100)]])
    arrangeBadges(close.canvas)
    expect(nudgeOf(close.buttons[1])).toEqual({ x: '1px', y: '' })
  })

  it('右にある後の印を右へ、6pxの隙間を空けるまで押し出す。前の印は動かさない', () => {
    const { canvas, buttons } = makeCanvas(WIDE, [[square(100, 100)], [square(110, 100)]])
    arrangeBadges(canvas)
    expect(nudgeOf(buttons[0])).toEqual(NONE)
    expect(nudgeOf(buttons[1])).toEqual({ x: '16px', y: '' })
  })

  it('左にある後の印は左へ押し出す', () => {
    const { canvas, buttons } = makeCanvas(WIDE, [[square(200, 100)], [square(190, 100)]])
    arrangeBadges(canvas)
    expect(nudgeOf(buttons[1])).toEqual({ x: '-16px', y: '' })
  })

  it('上下の差の方が大きければ縦へ押し出す', () => {
    const below = makeCanvas(WIDE, [[square(100, 100)], [square(102, 110)]])
    arrangeBadges(below.canvas)
    expect(nudgeOf(below.buttons[1])).toEqual({ x: '', y: '16px' })

    const above = makeCanvas(WIDE, [[square(100, 100)], [square(102, 90)]])
    arrangeBadges(above.canvas)
    expect(nudgeOf(above.buttons[1])).toEqual({ x: '', y: '-16px' })
  })

  it('縦横の差が同じなら横へ押し出す', () => {
    const { canvas, buttons } = makeCanvas(WIDE, [[square(100, 100)], [square(105, 105)]])
    arrangeBadges(canvas)
    expect(nudgeOf(buttons[1])).toEqual({ x: '21px', y: '' })
  })

  it('中心がぴったり重なる(差が0)なら右へ押し出す', () => {
    const { canvas, buttons } = makeCanvas(WIDE, [[square(100, 100)], [square(100, 100)]])
    arrangeBadges(canvas)
    expect(nudgeOf(buttons[1])).toEqual({ x: '26px', y: '' })
  })

  it('先に試す軸で枠の外へ出るなら、もう一方の軸へ押し出す', () => {
    // 横は130pxまでしか無い縦長の枠。右へ押すと右端が146pxで外へ出る
    const frame = { left: 0, top: 0, right: 130, bottom: 400 }
    const { canvas, buttons } = makeCanvas(frame, [[square(100, 100)], [square(105, 102)]])
    arrangeBadges(canvas)
    expect(nudgeOf(buttons[1])).toEqual({ x: '', y: '24px' })
  })

  it('どちらの軸へ押しても枠の外なら、先に試した軸のまま置く', () => {
    const { canvas, buttons } = makeCanvas(square(0, 0, 130), [
      [square(100, 100)],
      [square(105, 102)],
    ])
    arrangeBadges(canvas)
    expect(nudgeOf(buttons[1])).toEqual({ x: '21px', y: '' })
  })

  it('字と右上へはみ出す札を合わせた外接矩形で触れているかを測る', () => {
    // 字だけなら右端120pxで後の印(左端132px)と12px空くが、札の右端128pxまで含めると4pxしか空かない
    const badge = { left: 118, top: 94, right: 128, bottom: 104 }
    const { canvas, buttons } = makeCanvas(WIDE, [[square(100, 100), badge], [square(132, 100)]])
    arrangeBadges(canvas)
    expect(nudgeOf(buttons[1])).toEqual({ x: '2px', y: '' })
  })

  it('子を持たない地点はずらしを書かず、前回のずらしも外す', () => {
    const { canvas, buttons } = makeCanvas(WIDE, [[], [square(100, 100)]])
    buttons[0].style.setProperty('--nudge-x', '99px')
    arrangeBadges(canvas)
    expect(nudgeOf(buttons[0])).toEqual(NONE)
    expect(nudgeOf(buttons[1])).toEqual(NONE)
  })

  it('押し出した先で別の置いた印に触れたら、そこからも続けて押し出す', () => {
    const { canvas, buttons } = makeCanvas(WIDE, [
      [square(100, 100)],
      [square(100, 100)],
      [square(100, 100)],
    ])
    arrangeBadges(canvas)
    expect(nudgeOf(buttons[0])).toEqual(NONE)
    expect(nudgeOf(buttons[1])).toEqual({ x: '26px', y: '' })
    expect(nudgeOf(buttons[2])).toEqual({ x: '52px', y: '' })
  })

  it('行き場が無い時は、置いた印の数+1回ずらしたところで打ち切る', () => {
    // 前の2つの間は26pxしか無く、20pxの印に両側6pxの隙間を足した32pxが入らない。
    // 後の印は左の印(1回目)→右の印(2回目)→左の印(3回目)と押し返され、3回目で止まる
    const { canvas, buttons } = makeCanvas(WIDE, [
      [square(100, 100)],
      [square(146, 100)],
      [square(123, 100)],
    ])
    arrangeBadges(canvas)
    expect(nudgeOf(buttons[0])).toEqual(NONE)
    expect(nudgeOf(buttons[1])).toEqual(NONE)
    expect(nudgeOf(buttons[2])).toEqual({ x: '3px', y: '' })
  })
})

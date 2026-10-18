// 吹き出し(TalkBubble)を直接描き、村の枠(data-village)からはみ出した分を横へ押し戻すことと、
// 測り直す時機(出た直後・カメラが落ち着いた頃・画面の大きさが変わった時・指す点が変わった時)と、測る前に外した吹き出しを後から測らないことを見る。
// 村と同じく、枠の中の world 層(カメラと一緒に動く層)に置いて描く。枠と world 層の寸法はテストが決める。
// 村の画面の中で、壁際の主人公の頭上に出た吹き出しが押し戻されるのは、画面全体を描く bubble-edge-shift が見る。
// rAF は本物のまま、タイマー(setTimeout)だけを偽の時計に載せ、カメラが落ち着いた頃の測り直しはテストが時計を進めた時にだけ走らせる
import { cleanup, render } from '@testing-library/react'
import type { CSSProperties } from 'react'
import { page } from 'vitest/browser'
import TalkBubble from '@/components/VillagePage/components/Village/components/TalkBubble/container'
import { FRAME_PADDING } from '@/components/VillagePage/components/Village/components/TalkBubble/utils/shift-bubble'
import {
  FRAME_MS,
  advanceUntil,
  runFor,
  stepFrame,
} from '@/components/VillagePage/__tests__/village-walk.test-helper'
import { bubbleElement, shiftOf, speechProps, type BubblePoint } from './talk-bubble.test-helper'

// 1 マスの大きさ(px)と、枠の大きさ(マス)。枠は画面の左上から離して置く(枠の位置を測っていることを見るため)
const CELL = 20
const COLS = 10
const ROWS = 8
const FRAME_OFFSET = 40
// カメラが落ち着いた頃に測り直すまでの時間(TalkBubble の SETTLE_DELAY)
const SETTLE_DELAY = 350

type FrameStyle = CSSProperties & { '--cell': string }

// 村の枠と world 層の中の吹き出し。world 層の移り(カメラ)は、村では歩行ループが書く。ここではテストが書く
const scene = (at: BubblePoint, frameWidth: string) => {
  const frameStyle: FrameStyle = {
    position: 'relative',
    left: FRAME_OFFSET,
    top: FRAME_OFFSET,
    width: frameWidth,
    height: CELL * ROWS,
    overflow: 'hidden',
    '--cell': `${CELL}px`,
  }
  return (
    <div data-village style={frameStyle}>
      <div data-world-stub style={{ position: 'absolute', inset: 0 }}>
        <TalkBubble {...speechProps(at, () => {})} />
      </div>
    </div>
  )
}

const FRAME_WIDTH = `${CELL * COLS}px`
const renderBubble = (at: BubblePoint, frameWidth = FRAME_WIDTH) => render(scene(at, frameWidth))

const required = (selector: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`${selector} が描かれていない`)
  return element
}
const frameBox = () => required('[data-village]').getBoundingClientRect()
const shiftPx = () => Number.parseFloat(shiftOf(bubbleElement()))

// 出た直後の 2 フレームの後に、吹き出しが最初に測られる(--shift が書かれる)まで待つ
const firstMeasured = () => advanceUntil(() => shiftOf(bubbleElement()) !== '', '吹き出しを測った')

beforeEach(async () => {
  await page.viewport(1280, 720)
  // 画面の大きさを替えた知らせ(resize)は次の描画の時に届く。描く前に届けさせ、出た直後の測りに混ぜない
  await runFor(FRAME_MS * 2)
  // カメラが落ち着いた頃の測り直しは、テストが時計を進めた時だけ走らせる(rAF・resize は本物)。
  // expect.poll・expect.element は偽の時計を待つたびに進めるので、このファイルでは待つのに advanceUntil(本物の rAF)を使う
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  // 先に外してから時計を戻す(片付けが偽の時計の上の予約を取り消してから戻すため)
  cleanup()
  vi.useRealTimers()
})

describe('枠からはみ出した吹き出しの押し戻し', () => {
  test('枠の左端を指す吹き出しは、出た直後に枠の左の余白の内側まで右へ押し戻す', async () => {
    renderBubble({ x: 0, y: 4 })
    await firstMeasured()
    expect(shiftPx(), '右へ押す(正の量)').toBeGreaterThan(0)
    expect(bubbleElement().getBoundingClientRect().left, '左端は枠の左の余白の所').toBeCloseTo(
      frameBox().left + FRAME_PADDING,
      0
    )
  })

  test('枠の右端を指す吹き出しは、出た直後に枠の右の余白の内側まで左へ押し戻す', async () => {
    renderBubble({ x: COLS, y: 4 })
    await firstMeasured()
    expect(shiftPx(), '左へ押す(負の量)').toBeLessThan(0)
    expect(bubbleElement().getBoundingClientRect().right, '右端は枠の右の余白の所').toBeCloseTo(
      frameBox().right - FRAME_PADDING,
      0
    )
  })

  test('枠に収まる吹き出しは押し戻さず、指す点の真上を中心に置く', async () => {
    renderBubble({ x: COLS / 2, y: 4 })
    await firstMeasured()
    expect(shiftOf(bubbleElement()), '押し戻す量は 0').toBe('0px')
    const box = bubbleElement().getBoundingClientRect()
    expect(box.left + box.width / 2, '中心は指す点(枠の左から 5 マス)').toBeCloseTo(
      frameBox().left + CELL * (COLS / 2),
      0
    )
  })

  test('出た後にカメラが動いて枠からはみ出した吹き出しは、落ち着いた頃に測り直して押し戻す', async () => {
    renderBubble({ x: COLS / 2, y: 4 })
    await firstMeasured()
    expect(shiftOf(bubbleElement()), '出た直後は収まっている').toBe('0px')

    // カメラが左へ 5 マス動き、指す点が枠の左端へ来る
    required('[data-world-stub]').style.transform = `translateX(${-CELL * (COLS / 2)}px)`
    // 落ち着く前は測り直さない(出た直後の 2 フレームは済み、画面の大きさも変わらない)
    vi.advanceTimersByTime(SETTLE_DELAY - 1)
    await runFor(FRAME_MS * 3)
    expect(shiftOf(bubbleElement()), '落ち着く前は測り直さない').toBe('0px')

    vi.advanceTimersByTime(1)
    expect(shiftPx(), '落ち着いた頃に右へ押す').toBeGreaterThan(0)
    expect(bubbleElement().getBoundingClientRect().left, '左端は枠の左の余白の所').toBeCloseTo(
      frameBox().left + FRAME_PADDING,
      0
    )
  })

  test('押し戻した吹き出しは、落ち着いた頃に測り直しても同じ量で押し戻したままにする', async () => {
    renderBubble({ x: 0, y: 4 })
    await firstMeasured()
    const first = shiftOf(bubbleElement())
    expect(shiftPx(), '出た直後に右へ押す').toBeGreaterThan(0)

    // 測り直す箱には押し戻した量が乗っている。その量を引いた押し戻す前の位置で測るので、収まって見えても 0 へ戻さない
    vi.advanceTimersByTime(SETTLE_DELAY)
    expect(shiftOf(bubbleElement()), '測り直しても押し戻す量は同じ').toBe(first)
    expect(
      bubbleElement().getBoundingClientRect().left,
      '左端は枠の左の余白の所のまま'
    ).toBeCloseTo(frameBox().left + FRAME_PADDING, 0)
  })

  test('画面の大きさが変わって枠からはみ出した吹き出しは、その知らせで測り直して押し戻す', async () => {
    // 枠の幅は画面の半分。広い画面では、枠の左から 20 マス(400px)の点を指す吹き出しが収まる
    renderBubble({ x: 20, y: 4 }, '50vw')
    await firstMeasured()
    expect(shiftOf(bubbleElement()), '広い画面では収まっている').toBe('0px')

    // 画面を狭めると枠も狭まり、指す点が枠の右の外へ出る。落ち着いた頃の測り直し(偽の時計)は進めない
    await page.viewport(600, 720)
    await advanceUntil(() => shiftPx() < 0, '画面の大きさが変わった知らせで左へ押す')
    expect(bubbleElement().getBoundingClientRect().right, '右端は枠の右の余白の所').toBeCloseTo(
      frameBox().right - FRAME_PADDING,
      0
    )
  })

  test('指す点が変わった吹き出しは測り直し、新しい点で枠からはみ出す分を押し戻す', async () => {
    const { rerender } = renderBubble({ x: COLS / 2, y: 4 })
    await firstMeasured()
    expect(shiftOf(bubbleElement()), '最初の点では収まっている').toBe('0px')

    rerender(scene({ x: 0, y: 4 }, FRAME_WIDTH))
    await advanceUntil(() => shiftPx() > 0, '左端の点へ変わると右へ押す')
    expect(bubbleElement().getBoundingClientRect().left, '左端は枠の左の余白の所').toBeCloseTo(
      frameBox().left + FRAME_PADDING,
      0
    )
  })
})

// 測る手は枠が必ずあるとして測る。外した吹き出しを後から測らないのは、外す時の片付けが
// 出た直後の 2 フレームと落ち着いた頃の測り直しを取り消すからで、ここではその取り消しを見る
describe('測る前に外した吹き出し', () => {
  test('出てすぐ外した吹き出しは、その後のフレームでも、落ち着く頃を過ぎても測らない', async () => {
    renderBubble({ x: 0, y: 4 })
    const bubble = bubbleElement()
    cleanup()

    await runFor(FRAME_MS * 3)
    expect(
      () => vi.advanceTimersByTime(SETTLE_DELAY),
      '落ち着いた頃の測り直しは片付けで取り消してある'
    ).not.toThrow()
    expect(shiftOf(bubble), '外した吹き出しには押し戻す量を書かない').toBe('')
  })

  test('出た直後の 1 フレーム目の後に外した吹き出しは、2 フレーム目が来ても測らない', async () => {
    renderBubble({ x: 0, y: 4 })
    const bubble = bubbleElement()
    await stepFrame()
    expect(shiftOf(bubble), '前提: 1 フレーム目ではまだ測らない').toBe('')
    cleanup()

    // 2 フレーム目で測る手は、1 フレーム目の中で予約されている
    await runFor(FRAME_MS * 3)
    expect(shiftOf(bubble), '外した吹き出しには押し戻す量を書かない').toBe('')
  })
})

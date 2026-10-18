// 操作帯のスティック(Joystick。倒した向きを知らせる状態のコンテナ)を直接描き、マウスと指で倒した時のつまみの位置
// (pointer の処理が DOM へ直接書く transform)と、知らせる向き(onHold)を、離した・取り消された・捕捉を失った時に中央へ戻すことまで確かめる。
// 知らせた向きが村の中で歩く・本文を送る・地図の焦点を移すのに届くかは、村を描く stick-tilt が見る。
// マウスと指は CDP の Input で置く(village-walk.test-helper.ts の mouse・finger・touches)。タッチ端末は CDP のタッチの模擬で作る
import { cleanup, render } from '@testing-library/react'
import { onTestFinished } from 'vitest'
import { cdp, page } from 'vitest/browser'
import type { Direction } from '@content/types/world'
import Joystick from '@/components/VillagePage/components/Village/components/Joystick/container'
import {
  CENTER,
  RADIUS_RATIO,
  knobTransform,
  type Position,
} from '@/components/VillagePage/components/Village/components/Joystick/utils/stick-vector'
import {
  emulateTouch,
  finger,
  mouse,
  touches,
} from '@/components/VillagePage/__tests__/village-walk.test-helper'
import {
  prepareVillage,
  resetVillage,
  villageJa,
} from '@/components/VillagePage/__tests__/village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

afterEach(async () => {
  // 先に外してから環境を戻す(戻す物は village.test-helper.ts の resetVillage)
  cleanup()
  await resetVillage()
})

const { joystick: label } = villageJa.text

// スティックを描き、知らせた向きを順に控える。土台・つまみ・土台の真ん中と、控えた向き・描き直す手を返す
const renderStick = () => {
  const held: (Direction | null)[] = []
  const onHold = (direction: Direction | null) => {
    held.push(direction)
  }
  const { rerender } = render(<Joystick label={label} onHold={onHold} />)
  const base = page.getByRole('application', { name: label }).element()
  if (!(base instanceof HTMLElement)) throw new Error('スティックの土台が無い')
  const knob = base.firstElementChild
  if (!(knob instanceof HTMLElement)) throw new Error('スティックのつまみが無い')
  const box = base.getBoundingClientRect()
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const redraw = (next: (direction: Direction | null) => void) =>
    rerender(<Joystick label={label} onHold={next} />)
  return { base, knob, center, held, redraw }
}

// つまみが倒れた横と縦のずれ(px)。CSS の遷移で動く途中の位置ではなく、スティックが DOM へ書いた行き先(transform)を読む
const knobShift = (knob: HTMLElement) => {
  const match = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\)$/.exec(knob.style.transform)
  if (match === null) throw new Error(`つまみの transform が読めない: ${knob.style.transform}`)
  return { x: Number(match[1]), y: Number(match[2]) }
}

// つまみが shift だけ倒れるまで待つ(入力は CDP から届くので、届いた後の DOM を読む)
const expectKnobAt = async (knob: HTMLElement, shift: Position, message: string) => {
  await expect.poll(() => knobShift(knob), { message }).toEqual(shift)
}

describe('マウスで倒す', () => {
  beforeEach(async () => {
    // E2E(Playwright の Desktop Chrome)と同じ画面の大きさ
    await page.viewport(1280, 720)
  })

  test('つまみは土台の真ん中から始まり、押さずに上を動かしても倒れず、何も知らせない', async () => {
    const { knob, center, held } = renderStick()
    expect(knob.style.transform, '描いた時のつまみ').toBe(knobTransform(CENTER))
    expect(knob.getAttribute('aria-hidden'), 'つまみは飾り').toBe('true')
    await mouse.move(center.x, center.y, false)
    await mouse.move(center.x + 20, center.y, false)
    await mouse.move(center.x + 20, center.y + 20, false)
    // 押した後の動きは届くので、押していない間の動きも届いていたと分かる
    await mouse.down(center.x + 20, center.y + 20)
    await mouse.move(center.x + 40, center.y + 20, true)
    await expectKnobAt(knob, { x: 20, y: 0 }, '押した所からのずれだけ倒れる')
    expect(held, '押していない間の動きは知らせない').toEqual(['right'])
    await mouse.up(center.x + 40, center.y + 20)
  })

  test('押して倒すと、つまみは押した所からのずれに付いて動き、向きは変わった時だけ知らせ、離すと中央へ戻して向きなしを知らせる', async () => {
    const { knob, center, held } = renderStick()
    await mouse.move(center.x, center.y, false)
    await mouse.down(center.x, center.y)
    // 少しだけ動かした間(DEAD_ZONE の 10px 未満)は、つまみは付いて動くが向きは無い
    await mouse.move(center.x + 5, center.y, true)
    await expectKnobAt(knob, { x: 5, y: 0 }, '少しだけ動かすとつまみは付いて動く')
    expect(held, '少しだけ動かした間は知らせない').toEqual([])
    await mouse.move(center.x + 20, center.y, true)
    await expectKnobAt(knob, { x: 20, y: 0 }, '右へ倒れる')
    expect(held).toEqual(['right'])
    // 右へ倒したまま下へも少しずらす。横のずれの方が大きいので向きは右のまま
    await mouse.move(center.x + 20, center.y + 8, true)
    await expectKnobAt(knob, { x: 20, y: 8 }, 'つまみは指に付いて下へもずれる')
    expect(held, '同じ向きのままなら知らせ直さない').toEqual(['right'])
    await mouse.move(center.x, center.y + 25, true)
    await expectKnobAt(knob, { x: 0, y: 25 }, '下へ倒れる')
    expect(held).toEqual(['right', 'down'])
    await mouse.up(center.x, center.y + 25)
    await expectKnobAt(knob, CENTER, '離すと中央へ戻る')
    expect(held, '離すと向きなしを知らせる').toEqual(['right', 'down', null])
  })

  test('倒せる距離を越えて土台の外まで引いても、つまみは土台の幅から決まる縁で止まって指を追い続け、土台の外で離しても中央へ戻す', async () => {
    const { base, knob, center, held } = renderStick()
    // 倒せる距離は押した時の土台の幅(枠線の内側)に比で掛けて決める
    const radius = base.clientWidth * RADIUS_RATIO
    await mouse.move(center.x, center.y, false)
    await mouse.down(center.x, center.y)
    // 1 回目の動きで、もう土台の外(土台の幅は 88px)へ出す。押した時に掴んだので、土台の外の動きも届く
    await mouse.move(center.x + 100, center.y, true)
    await expect.poll(() => knobShift(knob).x, { message: '右の縁で止まる' }).toBeCloseTo(radius, 3)
    expect(knobShift(knob).y).toBe(0)
    await mouse.move(center.x, center.y - 100, true)
    await expect
      .poll(() => knobShift(knob).y, { message: '上の縁で止まる' })
      .toBeCloseTo(-radius, 3)
    expect(held).toEqual(['right', 'up'])
    await mouse.up(center.x, center.y - 100)
    await expectKnobAt(knob, CENTER, '土台の外で離しても中央へ戻る')
    expect(held).toEqual(['right', 'up', null])
  })

  test('マウスで押しても、焦点を今の所から動かさない', async () => {
    const { center } = renderStick()
    // 土台の外の、焦点を置ける物に焦点を置いておく(村では枠に焦点がある)
    const outside = document.createElement('button')
    outside.textContent = 'outside'
    document.body.append(outside)
    onTestFinished(() => outside.remove())
    outside.focus()
    await mouse.move(center.x, center.y, false)
    await mouse.down(center.x, center.y)
    await mouse.up(center.x, center.y)
    expect(document.activeElement, '押した後の焦点').toBe(outside)
  })

  test('倒している間に親が描き直しても、つまみは倒した所のまま、その後の向きは新しく受けた知らせ先へ届ける', async () => {
    const { knob, center, held, redraw } = renderStick()
    await mouse.move(center.x, center.y, false)
    await mouse.down(center.x, center.y)
    await mouse.move(center.x + 20, center.y, true)
    await expectKnobAt(knob, { x: 20, y: 0 }, '右へ倒れる')
    const next: (Direction | null)[] = []
    redraw(direction => {
      next.push(direction)
    })
    expect(knobShift(knob), '描き直してもつまみは倒した所のまま').toEqual({ x: 20, y: 0 })
    await mouse.move(center.x, center.y + 25, true)
    await expectKnobAt(knob, { x: 0, y: 25 }, '下へ倒れる')
    await mouse.up(center.x, center.y + 25)
    await expectKnobAt(knob, CENTER, '離すと中央へ戻る')
    expect(held, '前の知らせ先').toEqual(['right'])
    expect(next, '新しい知らせ先').toEqual(['down', null])
  })

  test('倒している間に土台が pointer の捕捉を失うと、離す前でもつまみを中央へ戻して向きなしを知らせる', async () => {
    const { base, knob, center, held } = renderStick()
    // 押した時に土台が掴んだ pointer を控える
    const captured: number[] = []
    const readCapture = (event: PointerEvent) => {
      captured.push(event.pointerId)
    }
    base.addEventListener('gotpointercapture', readCapture)
    onTestFinished(() => base.removeEventListener('gotpointercapture', readCapture))
    await mouse.move(center.x, center.y, false)
    await mouse.down(center.x, center.y)
    await mouse.move(center.x + 20, center.y, true)
    await expectKnobAt(knob, { x: 20, y: 0 }, '右へ倒れる')
    expect(captured, '押した時に土台が掴む').toHaveLength(1)
    // 捕捉を失う(ブラウザが lostpointercapture を送る)のを、テストが土台の捕捉を外して起こす。
    // 外した知らせは、その pointer の次の知らせ(ここでは土台の上で下へ動かした pointermove)の前に届く
    base.releasePointerCapture(captured[0])
    await mouse.move(center.x, center.y + 25, true)
    await expectKnobAt(knob, CENTER, '捕捉を失うと中央へ戻り、その後の動きでは倒れない')
    expect(held, '捕捉を失うと向きなしを知らせる').toEqual(['right', null])
    await mouse.up(center.x, center.y + 25)
    expect(held, '離しても知らせ直さない').toEqual(['right', null])
  })
})

describe('指で倒す', () => {
  test('指で触れた時の既定の動き(iOS の長押しの拡大鏡)を止める', async () => {
    await emulateTouch()
    await page.viewport(390, 664)
    const { center } = renderStick()
    // 土台の後ろ(文書)で、触れた知らせが既定の動きを止められたかを読む
    const prevented: boolean[] = []
    const readTouch = (event: TouchEvent) => {
      prevented.push(event.defaultPrevented)
    }
    document.addEventListener('touchstart', readTouch)
    onTestFinished(() => document.removeEventListener('touchstart', readTouch))
    await finger.down(center.x, center.y)
    await finger.up()
    await expect.poll(() => prevented, { message: '触れた時の既定の動き' }).toEqual([true])
  })

  test('縦持ちのタッチ端末で土台が広がると、倒せる距離も押した時の土台の幅に合わせて広がる', async () => {
    await emulateTouch()
    await page.viewport(390, 664)
    const { base, knob, center, held } = renderStick()
    // 縦持ちのタッチでは CSS が土台を 88px から 120px へ広げる
    expect(base.getBoundingClientRect().width, '前提: 土台が広がっている').toBe(120)
    await finger.down(center.x, center.y)
    await finger.move(center.x + 100, center.y)
    await expect
      .poll(() => knobShift(knob).x, { message: '広がった土台の縁で止まる' })
      .toBeCloseTo(base.clientWidth * RADIUS_RATIO, 3)
    expect(held).toEqual(['right'])
    await finger.up()
    await expectKnobAt(knob, CENTER, '離すと中央へ戻る')
    expect(held).toEqual(['right', null])
  })

  test('1 本目の指で倒している間は、2 本目の指が触れても動いても離れても、つまみも向きも 1 本目の指のまま', async () => {
    // 2 本の指を同時に置ける端末にしてから描く
    await emulateTouch(2)
    await page.viewport(390, 664)
    const { knob, center, held } = renderStick()
    const first = { id: 0, x: center.x + 20, y: center.y }
    await touches('touchStart', [{ ...first, x: center.x }])
    await touches('touchMove', [first])
    await expectKnobAt(knob, { x: 20, y: 0 }, '1 本目の指で右へ倒れる')
    // 2 本目の指を真ん中に置いて左へ倒す
    const second = { id: 1, x: center.x - 20, y: center.y - 5 }
    await touches('touchStart', [first, { ...second, x: center.x, y: center.y }])
    await touches('touchMove', [first, second])
    // 2 本目の指だけを離す(触れている指の並びから外す)
    await touches('touchMove', [first])
    // 1 本目の指を下へ倒し直す。ここまでの 2 本目の指の知らせが先に届いている
    await touches('touchMove', [{ ...first, x: center.x, y: center.y + 25 }])
    await expectKnobAt(knob, { x: 0, y: 25 }, '1 本目の指で下へ倒れる')
    expect(held, '2 本目の指の向きは知らせない').toEqual(['right', 'down'])
    await touches('touchEnd', [])
    await expectKnobAt(knob, CENTER, '1 本目の指を離すと中央へ戻る')
    expect(held).toEqual(['right', 'down', null])
  })

  test('指で倒している間に触れた操作が取り消されると、取り消しの知らせの中でつまみを中央へ戻して向きなしを知らせる', async () => {
    await emulateTouch()
    await page.viewport(390, 664)
    const { knob, center, held } = renderStick()
    // 取り消し(pointercancel)の後には捕捉を失った知らせ(lostpointercapture)も続き、そちらでも中央へ戻す。
    // 取り消しの知らせそのもので戻すことを、土台の後ろ(window)でその知らせを受けた時のつまみと向きで見る
    const atCancel: { knob: string; held: (Direction | null)[] }[] = []
    const readCancel = () => {
      atCancel.push({ knob: knob.style.transform, held: [...held] })
    }
    window.addEventListener('pointercancel', readCancel)
    onTestFinished(() => window.removeEventListener('pointercancel', readCancel))
    await finger.down(center.x, center.y)
    await finger.move(center.x + 20, center.y)
    await expectKnobAt(knob, { x: 20, y: 0 }, '右へ倒れる')
    // 触れている指の取り消し(CDP は touchCancel に指を並べることを認めない)
    await cdp().send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    await expect
      .poll(() => atCancel, { message: '取り消しの知らせを受けた時のつまみと向き' })
      .toEqual([{ knob: knobTransform(CENTER), held: ['right', null] }])
    expect(held, '後に続く捕捉を失った知らせでは知らせ直さない').toEqual(['right', null])
  })
})

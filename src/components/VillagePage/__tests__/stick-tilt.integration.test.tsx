// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import { mapEntries } from '@/lib/village/map-entries'
import { spotToward } from '@/components/VillagePage/components/Village/components/WorldMap/utils/spot-navigation'
import {
  FRAME_MS,
  SETTLE_MS,
  advanceUntil,
  emulateTouch,
  expectLoopIdle,
  finger,
  focusVillage,
  leaveRoom,
  readCell,
  runFor,
  touches,
  type TouchPoint,
} from './village-walk.test-helper'
import { PHASE_CLOCKS, startVillageClock } from './village-time.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// ---- 操作帯のスティック(Joystick) ----
// スティックを指で倒した向きが村へ届くことを、会話窓の本文送り・2 本目の指・拡大地図の焦点の移り方・同じ向きの中で動かす指で、
// 利用者に見える振る舞いで確かめる(初めの 3 本は、E2E を移した検査が通らないフックの分岐を通す検査から分けたもの)。
// タッチ端末(pointer: coarse)は CDP のタッチの模擬(emulateTouch)で描き、指は CDP の Input で置く。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('操作帯のスティック', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa

  // 描いて、起動の覆いが外れたら枠へ焦点を置く(E2E の openVillage)。既定は E2E と同じ PC の 1280×720
  const openVillage = async (width = 1280, height = 720) => {
    await page.viewport(width, height)
    render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
  }

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

  const town = villageJa.worldSet.worlds.town
  const dialog = page.getByRole('dialog')

  test('会話窓が開いている間にスティックを指で倒すと本文を送り、指を離すと送るのを止める', async () => {
    await emulateTouch()
    await openVillage(390, 664)
    await userEvent.keyboard('e')
    await expect.element(dialog.getByRole('heading', { name: text.stops.home.title })).toBeVisible()
    const panel = dialog.element().querySelector('[data-village-panel]')
    if (panel === null) throw new Error('会話窓の本文が無い')
    const stick = page
      .getByRole('application', { name: text.joystick })
      .element()
      .getBoundingClientRect()
    const x = stick.x + stick.width / 2
    const y = stick.y + stick.height / 2
    await finger.down(x, y)
    await finger.move(x, y + 30)
    await advanceUntil(() => panel.scrollTop > 0, 'スティックを下へ倒すと本文を送る')
    await finger.up()
    await runFor(FRAME_MS)
    const released = panel.scrollTop
    await runFor(FRAME_MS * 4)
    expect(panel.scrollTop, '離した後は送らない').toBe(released)
    expect(dialog.query(), '窓は開いたまま').not.toBeNull()
  })

  test('スティックを指で倒している間に 2 本目の指でスティックに触れても、1 本目の指の向きのまま歩き続ける', async () => {
    // 2 本の指を同時に置ける端末にしてから描く
    await emulateTouch(2)
    await openVillage(390, 664)
    await expectLoopIdle()
    const stick = page.getByRole('application', { name: text.joystick }).element()
    const knob = stick.firstElementChild
    if (!(knob instanceof HTMLElement)) throw new Error('スティックのつまみが無い')
    // つまみを倒した横のずれ(px)。倒した向きへずれる。つまみは CSS の遷移で動くので、描いている途中の位置ではなく、
    // スティックが DOM へ書いた行き先(transform)を読む
    const knobShift = () => {
      const match = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\)$/.exec(knob.style.transform)
      if (match === null) throw new Error(`つまみの transform が読めない: ${knob.style.transform}`)
      return Number(match[1])
    }
    const rest = knobShift()
    const box = stick.getBoundingClientRect()
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const TILT = 30
    const column = () => readCell(setId)?.cell.x ?? 4
    // 1 本目の指を中央に置いて右へ倒す。開始地点 (4,4) の行は右の壁際 (9,4) まで床
    const first: TouchPoint = { id: 0, x: center.x + TILT, y: center.y }
    await touches('touchStart', [{ ...first, x: center.x }])
    await touches('touchMove', [first])
    await advanceUntil(() => column() === 5, '右へ倒すと右へ歩き出す')
    // 2 本目の指をスティックの中央に置いて左へ倒す。1 本目の指は右へ倒したまま
    const second: TouchPoint = { id: 1, x: center.x - TILT, y: center.y }
    await touches('touchStart', [first, { ...second, x: center.x }])
    await touches('touchMove', [first, second])
    const before = column()
    await runFor(SETTLE_MS * 2)
    expect(knobShift() - rest, 'つまみは 1 本目の指のとおり右へ倒れたまま').toBeGreaterThan(
      TILT / 2
    )
    expect(column(), '1 本目の指の向き(右)へ歩き続ける').toBeGreaterThan(before)
    // 2 本目の指だけを離す(触れている指の並びから外す)。1 本目の指は倒れたまま
    await touches('touchMove', [first])
    await runFor(FRAME_MS * 2)
    expect(knobShift() - rest, '2 本目の指を離してもつまみは右へ倒れたまま').toBeGreaterThan(
      TILT / 2
    )
    // 1 本目の指も離すと止まり、つまみは中央へ戻る
    await touches('touchEnd', [])
    await expectLoopIdle()
    expect(knobShift(), '1 本目の指を離すとつまみは中央へ戻る').toBeCloseTo(rest, 0)
  })

  test('拡大地図はスティックを倒した瞬間にその向きの地点へ焦点を移し、倒し続ければ間を置いて次へ移す', async () => {
    // 地図を開いたままスティックを倒し続けた時に、次の地点へ移し直す間隔(hooks/use-map-focus.ts の SPOT_REPEAT_MS)
    const SPOT_REPEAT_MS = 300
    await emulateTouch()
    await openVillage(390, 664)
    expect(await leaveRoom(setId)).toBe(3)
    const entries = mapEntries(villageJa.worldSet, town, new Set())
    const focusedSpot = () => document.activeElement?.getAttribute('data-spot-id') ?? null
    // 番号 1 の地点から同じ向きに地点が 2 つ続く向きを、町のデータから選ぶ
    const TILTS = {
      right: { x: 30, y: 0 },
      down: { x: 0, y: 30 },
      left: { x: -30, y: 0 },
      up: { x: 0, y: -30 },
    } as const
    const line = (Object.keys(TILTS) as (keyof typeof TILTS)[]).flatMap(direction => {
      const near = spotToward(entries, entries[0].id, direction)
      const far = near === null ? null : spotToward(entries, near.id, direction)
      return near === null || far === null ? [] : [{ direction, near, far }]
    })[0]
    if (line === undefined) throw new Error('番号 1 の地点から同じ向きに地点が 2 つ続く向きが無い')
    const stick = page
      .getByRole('application', { name: text.joystick })
      .element()
      .getBoundingClientRect()
    const center = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2 }
    const tilted = {
      x: center.x + TILTS[line.direction].x,
      y: center.y + TILTS[line.direction].y,
    }
    // 縦持ちのタッチ端末では地図が操作帯を覆わないので、地図を開いたままスティックを倒せる
    await userEvent.keyboard('m')
    await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    await advanceUntil(() => focusedSpot() === entries[0].id, '開いた直後の焦点は番号 1 の地点')
    await finger.down(center.x, center.y)
    await finger.move(tilted.x, tilted.y)
    await advanceUntil(() => focusedSpot() === line.near.id, '倒した瞬間にその向きの地点へ移る')
    const movedAt = performance.now()
    // 倒し続けても、間を置くまでは次へ移らない
    await runFor(SPOT_REPEAT_MS - FRAME_MS * 2)
    expect(focusedSpot(), '間を置くまでは同じ地点').toBe(line.near.id)
    await advanceUntil(() => focusedSpot() === line.far.id, '間を置くと次の地点へ移る')
    expect(performance.now() - movedAt, '次へ移るまでの ms').toBeGreaterThanOrEqual(SPOT_REPEAT_MS)
    await finger.up()
  })

  test('スティックを倒したまま同じ向きの中で指を動かすと、つまみは指に付いて動き、向きは変えずに歩き続ける', async () => {
    await emulateTouch()
    await openVillage(390, 664)
    await expectLoopIdle()
    const stick = page.getByRole('application', { name: text.joystick }).element()
    const knob = stick.firstElementChild
    if (!(knob instanceof HTMLElement)) throw new Error('スティックのつまみが無い')
    // つまみが倒れた横と縦のずれ(px)。CSS の遷移で動く途中の位置ではなく、スティックが DOM へ書いた行き先(transform)を読む
    const knobShift = () => {
      const match = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\)$/.exec(knob.style.transform)
      if (match === null) throw new Error(`つまみの transform が読めない: ${knob.style.transform}`)
      return { x: Number(match[1]), y: Number(match[2]) }
    }
    const box = stick.getBoundingClientRect()
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const cell = () => readCell(setId)?.cell ?? { x: 4, y: 4 }
    // 開始地点 (4,4) の行は右の壁際 (9,4) まで床。右へ浅く倒して歩き出す
    await finger.down(center.x, center.y)
    await finger.move(center.x + 15, center.y)
    await advanceUntil(() => cell().x === 5, '右へ倒すと右へ歩き出す')
    const shallow = knobShift()
    // 右へ倒したまま、指を右と下へ少しずらす。横のずれの方が大きいので向きは右のまま
    await finger.move(center.x + 25, center.y + 8)
    await runFor(FRAME_MS * 2)
    const moved = knobShift()
    expect(moved.x - shallow.x, 'つまみは指に付いて右へ動く').toBeGreaterThan(5)
    expect(moved.y - shallow.y, 'つまみは指に付いて下へ動く').toBeGreaterThan(5)
    const before = cell().x
    await advanceUntil(() => cell().x > before, '右へ歩き続ける')
    expect(cell().y, '下へは曲がらない').toBe(4)
    await finger.up()
    await expectLoopIdle()
  })
})

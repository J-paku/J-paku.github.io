// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell } from '@content/types/world'
import VillagePageContainer from '@/components/VillagePage'
import { isWalkable } from '@/lib/village/collision'
import {
  FRAME_MS,
  advanceUntil,
  expectLoopIdle,
  focusVillage,
  leaveRoom,
  loopState,
  readCell,
  runFor,
  villageFrame,
  walk,
} from './village-walk.test-helper'
import { withSpots } from './village-spots.test-helper'
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

// ---- 村の入力と道中の配線(地図の開け閉めと地図からの移動) ----
// E2E から移した歩く・待つ・釣り・傘・飛ぶの検査(idle-loop・fishing・umbrella・flight-* の各ファイル)が通らないフックの分岐のうち、地図の開け閉め・今立っている地点と地形のマスを選んだ時・
// 地点の無い町の地図を、利用者に見える振る舞いで確かめる。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('村の入力と道中の配線(地図)', () => {
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

  const room = villageJa.worldSet.worlds.room
  const town = villageJa.worldSet.worlds.town
  const dialog = page.getByRole('dialog')
  const speech = () => page.getByRole('status').element().textContent ?? ''
  const sameCell = (goal: { worldId: string; cell: Cell }) => () =>
    JSON.stringify(readCell(setId)) === JSON.stringify(goal)

  test('地図は屋内では M を押しても開かず、町では地図の中で M をもう一度押すと閉じる', async () => {
    await openVillage()
    await userEvent.keyboard('m')
    await runFor(FRAME_MS * 2)
    expect(dialog.query(), '自室では地図を開かない').toBeNull()
    expect(await leaveRoom(setId)).toBe(3)
    await userEvent.keyboard('m')
    await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    await userEvent.keyboard('m')
    await expect.element(dialog).not.toBeInTheDocument()
    // 閉じた後は錠が外れて歩ける
    expect(await walk(setId, 'ArrowRight', 1)).toBe(1)
  })

  test('地図で今立っている地点を選ぶとその場で着いたことにし、地形のマスを押すと地点でなくても向かう', async () => {
    const monument = town.spots.find(spot => spot.id === 'monument')
    if (monument === undefined) throw new Error('町に経歴碑の地点が無い')
    const place = text.stops.monument.place
    const spotButton = () =>
      dialog.getByRole('button', { name: text.fastTravel.replace('{place}', place) })
    const atMonument = { worldId: town.id, cell: monument.cell }
    await openVillage()
    expect(await leaveRoom(setId)).toBe(3)
    await userEvent.keyboard('m')
    await spotButton().click()
    await advanceUntil(sameCell(atMonument), '経歴碑へ着く', 10_000)
    await expectLoopIdle()
    // 今立っている地点をもう一度選ぶ。地図を閉じ、歩きも飛びもせずにその場に立つ
    await userEvent.keyboard('m')
    await spotButton().click()
    await expect.element(dialog).not.toBeInTheDocument()
    await runFor(FRAME_MS * 4)
    expect(loopState(), '動かない').toBe('idle')
    expect(readCell(setId)).toEqual(atMonument)
    // 地図の地形のうち、地点でも扉でもない歩けるマスを押す。経歴碑の前から 3 マス離れた所を選ぶ
    const target = [
      { x: 3, y: 0 },
      { x: -3, y: 0 },
      { x: 0, y: 3 },
      { x: 0, y: -3 },
    ]
      .map(d => ({ x: monument.cell.x + d.x, y: monument.cell.y + d.y }))
      .find(
        cell =>
          isWalkable(town, cell) &&
          !town.spots.some(s => s.cell.x === cell.x && s.cell.y === cell.y) &&
          !town.warps.some(w => w.cell.x === cell.x && w.cell.y === cell.y)
      )
    if (target === undefined) throw new Error('経歴碑の前から 3 マス先に歩ける地形が無い')
    const before = speech()
    await userEvent.keyboard('m')
    await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    const canvas = [...dialog.element().querySelectorAll<HTMLElement>('div')].find(
      element => element.style.getPropertyValue('--map-w') !== ''
    )
    if (canvas === undefined) throw new Error('地図の地形が無い')
    const box = canvas.getBoundingClientRect()
    await page.elementLocator(canvas).click({
      position: {
        x: ((target.x + 0.5) / town.width) * box.width,
        y: ((target.y + 0.5) / town.height) * box.height,
      },
    })
    await expect.element(dialog).not.toBeInTheDocument()
    await advanceUntil(
      sameCell({ worldId: town.id, cell: target }),
      '押した地形のマスへ着く',
      10_000
    )
    // 地点でない所へは地点名を言えないので、行き先の案内は出さない
    expect(speech(), '案内文は押す前のまま').toBe(before)
  }, 30_000)

  test('地点の無い町では地図を開いても焦点が枠に残り、枠で M をもう一度押すと閉じる', async () => {
    // 実際のコンテンツには地点の無い町が無いので、町の地点と自室のコースの地点を外した版を渡す(地図に印が 1 つも並ばない)
    const bare = withSpots('town', () => [])
    const worldSet = {
      ...bare,
      worlds: {
        ...bare.worlds,
        room: { ...room, spots: room.spots.filter(spot => spot.order === undefined) },
      },
    }
    await page.viewport(1280, 720)
    render(<VillagePageContainer {...villageJa} worldSet={worldSet} />)
    await focusVillage()
    expect(await leaveRoom(setId)).toBe(3)
    await userEvent.keyboard('m')
    await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    expect(dialog.element().querySelectorAll('[data-spot-id]').length, '地図に地点の印が無い').toBe(
      0
    )
    await runFor(FRAME_MS * 2)
    expect(document.activeElement, '焦点を置く地点が無いので枠に残る').toBe(villageFrame())
    await userEvent.keyboard('m')
    await expect.element(dialog).not.toBeInTheDocument()
  })
})

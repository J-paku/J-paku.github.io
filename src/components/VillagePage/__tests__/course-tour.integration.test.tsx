// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell, Direction, WorldSet } from '@content/types/world'
import VillagePageContainer from '@/components/VillagePage/container'
import { readVisited, writePosition, writeVisited } from '@/lib/preferences'
import {
  FRAME_MS,
  SETTLE_MS,
  advanceUntil,
  expectLoopIdle,
  focusVillage,
  loopState,
  readCell,
  runFor,
} from './village-walk.test-helper'
import { moveSpot, spotOf, withSpots } from './village-spots.test-helper'
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

// ---- 村の入力と道中の配線(コースを巡る) ----
// E2E から移した歩く・待つ・釣り・傘・飛ぶの検査(idle-loop・fishing・umbrella・flight-* の各ファイル)が通らないフックの分岐のうち、コースの完走・次の地点にもう立っている時の「次へ」・
// 完走の直後に村を離れた時を、利用者に見える振る舞いで確かめる。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('村の入力と道中の配線(コースを巡る)', () => {
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
  const speech = () => page.getByRole('status').element().textContent ?? ''

  // 保存した位置から村を描く。読み込み直後の最初の描画は保存を捨てるので、先に一度描いて外してから保存を置く
  // (このテストだけを走らせた時も同じ所から始めるため)
  const openAt = async (
    saved: { worldId: string; cell: Cell; facing: Direction },
    worldSet: WorldSet = villageJa.worldSet
  ) => {
    await page.viewport(1280, 720)
    render(<VillagePageContainer {...villageJa} />)
    cleanup()
    writePosition(setId, saved)
    render(<VillagePageContainer {...villageJa} worldSet={worldSet} />)
    await focusVillage()
    await expectLoopIdle()
  }

  test('コースの全地点で話して最後の会話窓を閉じると、案内が一覧への誘いに替わり、一覧への出口へ焦点が移る', async () => {
    // コースの地点(order を持つ地点)を巡る順に並べる
    const course = Object.values(villageJa.worldSet.worlds)
      .flatMap(world => world.spots)
      .filter(spot => spot.order !== undefined)
      .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const titleOf = (id: string) => text.stops[id]?.title ?? id
    const headingShown = (id: string) => () =>
      dialog.getByRole('heading', { name: titleOf(id) }).query() !== null
    await openVillage()
    // 同じ地点で 2 回話しても訪問は 1 回に数える(完走の判定がずれない)
    await userEvent.keyboard('e')
    await expect.element(dialog.getByRole('heading', { name: titleOf('home') })).toBeVisible()
    await dialog.getByRole('button', { name: text.close }).click()
    await expect.element(dialog).not.toBeInTheDocument()
    await userEvent.keyboard('e')
    await expect.element(dialog.getByRole('heading', { name: titleOf('home') })).toBeVisible()
    // 次へで残りの地点を順に巡る
    for (const [index, spot] of course.slice(0, -1).entries()) {
      const next = course[index + 1]
      await dialog.getByRole('button', { name: text.stops[spot.id]?.next ?? spot.id }).click()
      await advanceUntil(headingShown(next.id), `${next.id} の会話窓が開く`, 10_000)
    }
    const allSeen = text.allSeen.replaceAll('{list}', () => text.toList)
    expect(speech(), '最後の会話窓を閉じるまでは完走の案内を出さない').not.toBe(allSeen)
    await dialog.getByRole('button', { name: text.close }).click()
    await expect.element(dialog).not.toBeInTheDocument()
    await runFor(FRAME_MS * 2)
    expect(speech()).toBe(allSeen)
    const exit = document.querySelector<HTMLElement>('[data-village-exit]')
    expect(document.activeElement, '一覧への出口へ焦点が移る').toBe(exit)
    expect(exit?.hasAttribute('data-bounce'), '出口が跳ねる').toBe(true)
  }, 60_000)

  test('次の地点にもう立っている時の「次へ」は、歩かずにその場で次の地点へ話しかけ、訪れたことにする', async () => {
    // 実際のコンテンツでは地点どうしの立ち位置が重ならないので、研究所の立ち位置を名刺工房と同じマスへ動かした版を渡す
    const meishi = spotOf(town, 'meishi')
    const worldSet = withSpots('town', spots => moveSpot(spots, 'lab', meishi.cell))
    await openAt({ worldId: town.id, cell: meishi.cell, facing: meishi.facing }, worldSet)
    await userEvent.keyboard('e')
    await expect
      .element(dialog.getByRole('heading', { name: text.stops.meishi.title }))
      .toBeVisible()
    expect(readVisited(setId), '前提: 研究所はまだ訪れていない').not.toContain('lab')
    await dialog.getByRole('button', { name: text.stops.meishi.next }).click()
    // 同じマスに立つ研究所へ話しかける。会話窓は閉じずに開いたまま、研究所を訪れたことに数える
    await expect
      .poll(() => readVisited(setId), { message: '研究所を訪れたことにする' })
      .toContain('lab')
    expect(document.querySelector('[role="dialog"]'), '会話窓は開いたまま').not.toBeNull()
    await runFor(SETTLE_MS)
    expect(readCell(setId), '歩いていない').toEqual({ worldId: town.id, cell: meishi.cell })
    expect(loopState(), '歩行ループは眠ったまま').toBe('idle')
  })

  test('コースの最後の会話窓を閉じた直後に村を離れても、一覧への出口へ焦点を移す処理は外れた後に何もしない', async () => {
    // 自室の地点のほかは話し終えた状態から始める(読み込み直後の最初の描画は保存を捨てるので、一度描いて外してから置く)
    const others = Object.values(villageJa.worldSet.worlds)
      .flatMap(world => world.spots)
      .filter(spot => spot.order !== undefined && spot.id !== 'home')
      .map(spot => spot.id)
    await page.viewport(1280, 720)
    render(<VillagePageContainer {...villageJa} />)
    cleanup()
    writeVisited(setId, others)
    await openVillage()
    await userEvent.keyboard('e')
    await expect.element(dialog.getByRole('heading', { name: text.stops.home.title })).toBeVisible()
    await dialog.getByRole('button', { name: text.close }).click()
    await expect.element(dialog).not.toBeInTheDocument()
    // 閉じた時点で完走の案内に替わり、出口へ焦点を移すのは次のフレーム。その前に村を離れる
    expect(speech()).toBe(text.allSeen.replaceAll('{list}', () => text.toList))
    cleanup()
    await runFor(FRAME_MS * 2)
    expect(document.querySelector('[data-village-exit]'), '出口はもう無い').toBeNull()
    expect(document.activeElement, '焦点はどこへも移さない').toBe(document.body)
  })
})

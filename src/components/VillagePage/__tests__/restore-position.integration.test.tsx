// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import { writePosition } from '@/lib/preferences'
import { isWalkable } from '@/lib/village/collision'
import {
  expectLoopIdle,
  focusVillage,
  playerOnScreen,
  readCell,
  walk,
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

// ---- 村の入力と道中の配線(保存の復元) ----
// E2E から移した歩く・待つ・釣り・傘・飛ぶの検査(idle-loop・fishing・umbrella・flight-* の各ファイル)が通らないフックの分岐のうち、描き直した村が保存した位置から始めるかを、
// 利用者に見える振る舞いで確かめる。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩くのは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('村の入力と道中の配線(保存の復元)', () => {
  const setId = villageJa.worldSet.id

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

  test('描き直した村は保存した位置から始め、読めない保存(知らないワールド・歩けないマス)は捨てて開始地点から始める', async () => {
    await openVillage()
    expect(await walk(setId, 'ArrowDown', 1)).toBe(1)
    expect(readCell(setId)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
    // 村を離れて戻る(作品ページから戻った時と同じく、同じ読み込みの中で描き直す)
    cleanup()
    render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
    await expectLoopIdle()
    // 部屋は枠に収まりカメラは動かないので、描かれた位置がそのままマス
    expect(playerOnScreen().x).toBeCloseTo(4, 1)
    expect(playerOnScreen().y, '保存した (4,5) から始める').toBeCloseTo(5, 1)
    const wall = { x: 0, y: 0 }
    expect(isWalkable(room, wall), '部屋の左上の角は歩けない').toBe(false)
    const unreadable = [
      { worldId: 'nowhere', cell: { x: 4, y: 5 }, facing: 'down' },
      { worldId: 'room', cell: wall, facing: 'down' },
    ] as const
    for (const saved of unreadable) {
      cleanup()
      writePosition(setId, saved)
      render(<VillagePageContainer {...villageJa} />)
      await focusVillage()
      await expectLoopIdle()
      const where = `${saved.worldId} (${saved.cell.x},${saved.cell.y})`
      expect(playerOnScreen().y, `${where} の保存は捨てて開始地点 (4,4) から`).toBeCloseTo(4, 1)
    }
  })
})

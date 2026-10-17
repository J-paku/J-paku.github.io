// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell, Direction, WorldSet } from '@content/types/world'
import VillagePageContainer from '@/components/VillagePage/container'
import { writePosition } from '@/lib/preferences'
import { isWalkable } from '@/lib/village/collision'
import { objectSpotAt } from '@/lib/village/spot'
import {
  FRAME_MS,
  SETTLE_MS,
  advanceUntil,
  cellCenter,
  click,
  expectLoopIdle,
  focusVillage,
  leaveRoom,
  mouse,
  readCell,
  runFor,
} from './village-walk.test-helper'
import { spotOf } from './village-spots.test-helper'
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

// ---- 村の入力と道中の配線(舞台を押す) ----
// E2E から移した歩く・待つ・釣り・傘・飛ぶの検査(idle-loop・fishing・umbrella・flight-* の各ファイル)が通らないフックの分岐のうち、押したまま動かす指・物を押して話しかける・
// 釣っている間に動かす指を、利用者に見える振る舞いで確かめる。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)、舞台を押すのは CDP の Input で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('村の入力と道中の配線(舞台を押す)', () => {
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

  test('舞台を押したまま指先を別のマスへ動かすと、行き先を指先のマスへ移してそこへ着く', async () => {
    await openVillage()
    expect(await leaveRoom(setId)).toBe(3)
    await expectLoopIdle()
    // 自宅前 (14,12) から右へは横道が続く
    const first = { x: 16, y: 12 }
    const second = { x: 17, y: 12 }
    expect(isWalkable(town, first) && isWalkable(town, second), '自宅前の右の道').toBe(true)
    const from = cellCenter(first)
    await mouse.move(from.x, from.y, false)
    await mouse.down(from.x, from.y)
    await runFor(FRAME_MS * 2)
    // 押している指先は同じマスの中でも少し揺れる。揺れてもそのまま押し続ける
    await mouse.move(from.x + 2, from.y + 2, true)
    await runFor(FRAME_MS * 2)
    const to = cellCenter(second)
    await mouse.move(to.x, to.y, true)
    await advanceUntil(sameCell({ worldId: town.id, cell: second }), '指先のマスへ着く')
    await mouse.up(to.x, to.y)
    await expectLoopIdle()
    expect(readCell(setId)).toEqual({ worldId: town.id, cell: second })
  })

  test('自室で机を押すと、もう話しかけられるマスに立っていれば歩かずに会話窓を開く', async () => {
    await openVillage()
    await expectLoopIdle()
    const home = room.spots.find(spot => spot.id === 'home')
    if (home === undefined) throw new Error('自室に自宅の地点が無い')
    // 対照: 歩いて届かず地点の物でもないマス(部屋の左上の角の壁)を押しても、歩きも話しもしない
    const wall = { x: 0, y: 0 }
    expect(isWalkable(room, wall) || objectSpotAt(room, wall) !== null).toBe(false)
    const corner = cellCenter(wall)
    await click(corner.x, corner.y)
    await runFor(SETTLE_MS)
    expect(dialog.query(), '壁を押しても窓は開かない').toBeNull()
    expect(readCell(setId), '壁を押しても歩かない').toBeNull()
    // 開始地点は自宅の地点の立ち位置で、上を向いた先の 1 マスが机
    const desk = { x: home.cell.x, y: home.cell.y - 1 }
    expect(objectSpotAt(room, desk)?.id, '上の 1 マスは自宅の地点の物').toBe('home')
    const point = cellCenter(desk)
    await click(point.x, point.y)
    await expect.element(dialog.getByRole('heading', { name: text.stops.home.title })).toBeVisible()
    expect(readCell(setId), '歩いていない').toBeNull()
  })

  test('池で舞台を押したまま釣り始め、釣っている間に指先を別のマスへ動かしても、やめた後はその場に留まる', async () => {
    const pond = spotOf(town, 'pond')
    await openAt({ worldId: town.id, cell: pond.cell, facing: pond.facing })
    // 立っているマスを押したままにする(行き先が今のマスなので歩き出さない)
    const here = cellCenter(pond.cell)
    await mouse.move(here.x, here.y, false)
    await mouse.down(here.x, here.y)
    await runFor(FRAME_MS * 2)
    // 釣り始める。釣りの間は窓を出さないので、焦点は枠に残り、押している指も外れない
    await userEvent.keyboard('e')
    await advanceUntil(() => speech() === text.fishing.cast, '投げ始める')
    // 釣っている間に、押したままの指先を歩いて行けるマスへ動かす
    const elsewhere = { x: 8, y: 13 }
    expect(isWalkable(town, elsewhere), '動かした先は歩いて行ける').toBe(true)
    const there = cellCenter(elsewhere)
    await mouse.move(there.x, there.y, true)
    await runFor(FRAME_MS * 4)
    // やめる。釣っている間の指先の動きは読まないので、行き先は押した時のマス(今のマス)のまま
    await userEvent.keyboard('x')
    await runFor(SETTLE_MS * 2)
    expect(readCell(setId), '釣っている間に動かした指先のマスへは歩かない').toEqual({
      worldId: town.id,
      cell: pond.cell,
    })
    await mouse.up(there.x, there.y)
    await expectLoopIdle()
  })
})

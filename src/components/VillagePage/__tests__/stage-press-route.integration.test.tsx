// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell, Direction } from '@content/types/world'
import VillagePageContainer from '@/components/VillagePage'
import { writePosition } from '@/lib/preferences'
import { isWalkable } from '@/lib/village/collision'
import { findPath } from '@/lib/village/path'
import { objectSpotAt } from '@/lib/village/spot'
import {
  FRAME_MS,
  SETTLE_MS,
  advanceUntil,
  cellCenter,
  click,
  expectLoopIdle,
  focusVillage,
  loopState,
  mouse,
  press,
  readCell,
  runFor,
  walk,
} from './village-walk.test-helper'
import { ARRIVE_MS, EXIT_MAT, TOWN_ENTRY, flyingNow } from './flight.test-helper'
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

// ---- 村の入力と道中の配線(舞台を押して向かう道筋) ----
// 舞台を押した時と押したままにした時の道筋のうち、stage-press・destination-pin が通らない場合を、利用者に見える振る舞い
// (着いたマス・会話窓・行き先の印)で確かめる。離れた所から地点の物を押す・話しかけるマスへ歩いている途中に物を押す・
// 飛んでいる間に押す・押したまま扉を抜ける・押したまま方向キーで寄り道する、の 5 つ。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)、舞台を押すのは CDP の Input で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境は、ファイル先頭の afterEach が戻す
describe('村の入力と道中の配線(舞台を押して向かう道筋)', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa
  const { room, town } = villageJa.worldSet.worlds
  const dialog = page.getByRole('dialog')

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

  // 描いて、起動の覆いが外れたら枠へ焦点を置く(E2E の openVillage)。PC の 1280×720
  const openVillage = async () => {
    await page.viewport(1280, 720)
    render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
  }

  // 保存した位置から村を描く。読み込み直後の最初の描画は保存を捨てるので、先に一度描いて外してから保存を置く
  // (このテストだけを走らせた時も同じ所から始めるため)
  const openAt = async (saved: { worldId: string; cell: Cell; facing: Direction }) => {
    await page.viewport(1280, 720)
    render(<VillagePageContainer {...villageJa} />)
    cleanup()
    writePosition(setId, saved)
    render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
    await expectLoopIdle()
  }

  const sameCell = (goal: { worldId: string; cell: Cell }) => () =>
    JSON.stringify(readCell(setId)) === JSON.stringify(goal)
  // 地点 id の会話窓の見出しが出ているか
  const headingShown = (id: string) => () =>
    dialog.getByRole('heading', { name: text.stops[id]?.title ?? id }).query() !== null
  // 地面に立てた行き先の印の箱の真ん中から、マスの真ん中までの距離(px)。印が無ければ無限大
  const pinGap = (cell: Cell) => {
    const pin = document.querySelector('[data-village-destination]')
    if (pin === null) return Number.POSITIVE_INFINITY
    const box = pin.getBoundingClientRect()
    const center = cellCenter(cell)
    return Math.hypot(box.x + box.width / 2 - center.x, box.y + box.height / 2 - center.y)
  }

  const home = spotOf(room, 'home')
  // 自宅の地点の物(机)のマス。話しかけるマス(home.cell)の 2 つ上で、机の上の段
  const desk = { x: home.cell.x, y: home.cell.y - 2 }

  test('離れたマスから地点の物(机)を押すと、話しかけられるマスに行き先の印を立てて歩き、着いたら会話窓を開く', async () => {
    expect(objectSpotAt(room, desk)?.id, '前提: 押すマスは自宅の地点の物').toBe('home')
    await openVillage()
    // 開始地点(自宅の地点の立ち位置)から下へ 2 マス離れる
    expect(await walk(setId, 'ArrowDown', 2), '机から下へ 2 マス離れる').toBe(2)
    await expectLoopIdle()
    const from = { x: home.cell.x, y: home.cell.y + 2 }
    expect(readCell(setId)).toEqual({ worldId: room.id, cell: from })
    const point = cellCenter(desk)
    await click(point.x, point.y)
    await advanceUntil(() => pinGap(home.cell) <= 1, '話しかけられるマスに行き先の印を立てる')
    await advanceUntil(headingShown('home'), '着いたら自宅の会話窓を開く')
    expect(readCell(setId), '話しかけられるマスまで歩いた').toEqual({
      worldId: room.id,
      cell: home.cell,
    })
  })

  test('話しかけられるマスへ方向キーで歩いている途中に地点の物を押すと、着いたそのマスで会話窓を開く', async () => {
    // 自宅の地点の立ち位置の 1 つ下から、上を向いて始める
    const below = { x: home.cell.x, y: home.cell.y + 1 }
    await openAt({ worldId: room.id, cell: below, facing: 'up' })
    await press('ArrowUp')
    // 押して離しただけで、上の 1 マス(話しかけられるマス)へ向かう途中
    expect(loopState(), '前提: 押した時はまだ歩いている').toBe('running')
    expect(readCell(setId), '前提: まだ話しかけられるマスに着いていない').toEqual({
      worldId: room.id,
      cell: below,
    })
    const point = cellCenter(desk)
    await click(point.x, point.y)
    await advanceUntil(headingShown('home'), '着いたら自宅の会話窓を開く')
    expect(readCell(setId), '歩いていた先の話しかけられるマスに立つ').toEqual({
      worldId: room.id,
      cell: home.cell,
    })
  })

  test('次へで飛んでいる間に舞台を押しても読まず、行き先の印は次の地点に立ったまま、着くとその地点の会話窓を開く', async () => {
    const meishi = spotOf(town, 'meishi')
    const lab = spotOf(town, 'lab')
    // 押すのは名刺工房の前の道。読めばそこへ行き先の印を移し、着いた時に会話窓を開くのも取り消す
    const road = { x: meishi.cell.x, y: meishi.cell.y + 1 }
    expect(isWalkable(town, road), '前提: 押すマスは歩ける道').toBe(true)
    await openAt({ worldId: town.id, cell: meishi.cell, facing: meishi.facing })
    await userEvent.keyboard('e')
    await expect
      .element(dialog.getByRole('heading', { name: text.stops.meishi.title }))
      .toBeVisible()
    await dialog.getByRole('button', { name: text.stops.meishi.next }).click()
    await expect.element(dialog).not.toBeInTheDocument()
    await advanceUntil(() => flyingNow() === 'true', '研究所へ飛び立つ')
    await advanceUntil(() => pinGap(lab.cell) <= 1, '前提: 行き先の印は研究所の前')
    const point = cellCenter(road)
    await click(point.x, point.y)
    await runFor(FRAME_MS * 4)
    expect(flyingNow(), '前提: 押した後もまだ飛んでいる').toBe('true')
    expect(
      pinGap(lab.cell),
      '飛んでいる間に押しても、行き先の印は研究所の前のまま(px)'
    ).toBeLessThanOrEqual(1)
    await advanceUntil(headingShown('lab'), '着くと研究所の会話窓を開く', ARRIVE_MS)
    expect(readCell(setId), '降りたのは研究所の前').toEqual({ worldId: town.id, cell: lab.cell })
  })

  test('舞台を押したまま部屋の出口のマットまで歩いて町へ出ると、押したままでも出た所に留まり、離した後も歩き出さない', async () => {
    // 町にも部屋のマットと同じ座標のマスがあり、自宅前から歩いて行ける。押したマス(部屋の座標)を町で読めばそこへ歩き出す
    expect(isWalkable(town, EXIT_MAT), '前提: 町の同じ座標のマスは歩ける').toBe(true)
    expect(findPath(town, TOWN_ENTRY, EXIT_MAT), '前提: 自宅前から歩いて行ける').not.toBeNull()
    await openVillage()
    const point = cellCenter(EXIT_MAT)
    await mouse.move(point.x, point.y, false)
    await mouse.down(point.x, point.y)
    await advanceUntil(
      sameCell({ worldId: town.id, cell: TOWN_ENTRY }),
      '押したままマットまで歩いて町の自宅前へ出る'
    )
    await runFor(SETTLE_MS * 3)
    expect(readCell(setId), '押したままでも、出た所から歩き出さない').toEqual({
      worldId: town.id,
      cell: TOWN_ENTRY,
    })
    await mouse.up(point.x, point.y)
    await expectLoopIdle()
    expect(readCell(setId), '離した後も出た所に留まる').toEqual({
      worldId: town.id,
      cell: TOWN_ENTRY,
    })
  })

  test('押したままの指先のマスに着いた後、方向キーで寄り道しても、キーを離すと押したままの指先のマスへ戻る', async () => {
    const target = { x: TOWN_ENTRY.x + 1, y: TOWN_ENTRY.y }
    const detour = { x: target.x, y: target.y + 1 }
    expect(isWalkable(town, target), '前提: 自宅前の右隣は歩ける').toBe(true)
    expect(isWalkable(town, detour), '前提: その 1 つ下も歩ける').toBe(true)
    await openAt({ worldId: town.id, cell: TOWN_ENTRY, facing: 'down' })
    const point = cellCenter(target)
    await mouse.move(point.x, point.y, false)
    await mouse.down(point.x, point.y)
    await advanceUntil(sameCell({ worldId: town.id, cell: target }), '押した指先のマスへ着く')
    // 押したまま、方向キーで下へ 1 マス寄り道する
    await press('ArrowDown')
    await advanceUntil(sameCell({ worldId: town.id, cell: detour }), '方向キーで下へ 1 マス歩く')
    await advanceUntil(
      sameCell({ worldId: town.id, cell: target }),
      'キーを離すと押したままの指先のマスへ戻る'
    )
    await mouse.up(point.x, point.y)
    await expectLoopIdle()
    expect(readCell(setId)).toEqual({ worldId: town.id, cell: target })
  })
})

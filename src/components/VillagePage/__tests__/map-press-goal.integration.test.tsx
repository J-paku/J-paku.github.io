// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell, Direction } from '@content/types/world'
import VillagePageContainer from '@/components/VillagePage'
import { writePosition } from '@/lib/preferences'
import { isWalkable } from '@/lib/village/collision'
import {
  advanceUntil,
  expectLoopIdle,
  focusVillage,
  isPainted,
  loopState,
  readCell,
  runFrames,
  worldLayer,
} from './village-walk.test-helper'
import { ARRIVE_MS, TOWN_ENTRY } from './flight.test-helper'
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

// ---- 拡大地図で押したマスの行き先 ----
// 拡大地図の地形(地点の印でない所)を押した時の行き先のうち、map-press-travel が通らない 2 つを、利用者に見える振る舞い
// (案内文・着いたマス・目印)で確かめる。押した家の壁から歩いて届く最も近いマスが地点の立ち位置だった時と、今立っているマスを押した時。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 地図を開くのは実際のキー入力(userEvent)、地図を押すのは Playwright のクリックで行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境は、ファイル先頭の afterEach が戻す
describe('拡大地図で押したマスの行き先', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa
  const { town } = villageJa.worldSet.worlds
  const map = page.getByRole('dialog')
  const speech = () => page.getByRole('status').element().textContent ?? ''

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

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

  const openMap = async () => {
    await userEvent.keyboard('m')
    await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
  }

  // 地図の地形の箱の中で、マスの (fx, fy)(0〜1 の割合)の所を押す。地点の印のボタン(マスより大きい)に掛からない所を選ぶので、
  // 押す点の下にあるのがボタンでないことを先に確かめる
  const pressMapCell = async (cell: Cell, fx: number, fy: number) => {
    const canvas = Array.from(map.element().querySelectorAll<HTMLElement>('div')).find(
      element => element.style.getPropertyValue('--map-w') !== ''
    )
    if (canvas === undefined) throw new Error('地図の地形が無い')
    const box = canvas.getBoundingClientRect()
    const position = {
      x: ((cell.x + fx) / town.width) * box.width,
      y: ((cell.y + fy) / town.height) * box.height,
    }
    const under = document.elementFromPoint(box.x + position.x, box.y + position.y)
    expect(under?.closest('button') ?? null, '前提: 押す所は地点の印のボタンの外').toBeNull()
    await page.elementLocator(canvas).click({ position })
    await expect.element(map, { message: '地形を押すと地図を閉じる' }).not.toBeInTheDocument()
  }

  test('研究所の窓の行(家の壁のマス)を押すと、歩いて届く最も近いマスが研究所の前なので、研究所へ向かう案内を出して研究所の前へ着く', async () => {
    const lab = spotOf(town, 'lab')
    // 研究所の前の 2 つ上は家の壁(窓の行)。そこから 2 マス以内で歩けるのは研究所の前だけなので、押せばそこが行き先になる。
    // 研究所の前の印のボタン(マスより大きい)から離れているので、地形を押せる
    const wall = { x: lab.cell.x, y: lab.cell.y - 2 }
    const near = town.tiles
      .flatMap((row, y) => row.map((_, x) => ({ x, y })))
      .filter(cell => Math.abs(cell.x - wall.x) + Math.abs(cell.y - wall.y) <= 2)
    expect(
      near.filter(cell => isWalkable(town, cell)),
      '前提: 押すマスから 2 マス以内で歩けるのは研究所の前だけ'
    ).toEqual([lab.cell])
    await openAt({ worldId: town.id, cell: TOWN_ENTRY, facing: 'down' })
    await openMap()
    await pressMapCell(wall, 0.5, 0.3)
    await expect
      .poll(speech, { message: '研究所へ向かう案内' })
      .toBe(text.headTo.replaceAll('{place}', text.stops.lab.place))
    await advanceUntil(
      () =>
        JSON.stringify(readCell(setId)) === JSON.stringify({ worldId: town.id, cell: lab.cell }),
      '研究所の前へ着く',
      ARRIVE_MS
    )
  })

  test('今立っているマスを押すと、地図を閉じて歩かずに着いたことにし、着くまで出していた目印を下ろす', async () => {
    // 目印(主人公の頭上で跳ねる矢印)は、村を開いてから最初にどこかへ着くまでだけ出す。シートの目印の絵で見分ける
    const locatorIndex = String(villageJa.sprites.index.locator)
    const locatorDrawn = () =>
      Array.from(worldLayer().querySelectorAll<HTMLElement>('div')).some(
        element => element.style.getPropertyValue('--i') === locatorIndex && isPainted(element)
      )
    // 自宅前の横道を右へ 5 マス行った所。地点の印のボタン(マスより大きい)から離れているので、地形を押せる
    const here = { x: TOWN_ENTRY.x + 5, y: TOWN_ENTRY.y }
    expect(isWalkable(town, here), '前提: 立つマスは歩ける道').toBe(true)
    const marked = [...town.spots.map(spot => spot.cell), ...town.warps.map(warp => warp.cell)]
    expect(
      marked.filter(cell => Math.max(Math.abs(cell.x - here.x), Math.abs(cell.y - here.y)) < 2),
      '前提: 地点と扉のマスから 2 マス以上離れている'
    ).toEqual([])
    await openAt({ worldId: town.id, cell: here, facing: 'down' })
    expect(locatorDrawn(), '前提: まだどこにも着いていないので目印が出ている').toBe(true)
    await openMap()
    await pressMapCell(here, 0.5, 0.5)
    await runFrames(5)
    expect(locatorDrawn(), '着いたことにして目印を下ろす').toBe(false)
    expect(readCell(setId), '歩かない').toEqual({ worldId: town.id, cell: here })
    expect(loopState(), '歩行ループは眠ったまま').toBe('idle')
  })
})

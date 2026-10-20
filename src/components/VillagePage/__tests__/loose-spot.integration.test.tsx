// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell, Direction, Spot, WorldSet } from '@content/types/world'
import VillagePageContainer from '@/components/VillagePage'
import { validateWorldSet } from '@/lib/content/validate-world'
import { writePosition } from '@/lib/preferences'
import {
  advanceUntil,
  cellCenter,
  expectLoopIdle,
  focusVillage,
  runFor,
  walk,
  worldLayer,
} from './village-walk.test-helper'
import { spotOf, withSpots } from './village-spots.test-helper'
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

// ---- コース順や建物を持たない地点 ----
// 地点は、コース順(order)と話しかける物(structureId)を持たなくてもよい(コース外の地点・建物に結び付かない地点)。
// 実際のコンテンツでは、そういう地点は釣り場と卓上時計(どちらも会話窓ではない専用の窓)だけなので、
// 地点の並びを差し替えた版の村(village-spots.test-helper.ts)で、会話窓を開く地点からコース順を外した時と、
// 卓上時計の地点から話しかける物を外した時の振る舞いを利用者に見える物で確かめる。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境は、ファイル先頭の afterEach が戻す
describe('コース順や建物を持たない地点', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa
  const { room, town } = villageJa.worldSet.worlds
  const dialog = page.getByRole('dialog')

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

  // 保存した位置から、地点の並びを差し替えた版の村を描く。読み込み直後の最初の描画は保存を捨てるので、
  // 先に一度描いて外してから保存を置く(このテストだけを走らせた時も同じ所から始めるため)
  const openAt = async (
    saved: { worldId: string; cell: Cell; facing: Direction },
    worldSet: WorldSet
  ) => {
    await page.viewport(1280, 720)
    render(<VillagePageContainer {...villageJa} />)
    cleanup()
    writePosition(setId, saved)
    render(<VillagePageContainer {...villageJa} worldSet={worldSet} />)
    await focusVillage()
    await expectLoopIdle()
  }

  // 地点 id から一部の項目を外した並び
  const without = (spots: readonly Spot[], id: string, key: 'order' | 'structureId'): Spot[] =>
    spots.map(spot => {
      if (spot.id !== id) return spot
      const { [key]: _dropped, ...rest } = spot
      return rest
    })

  test('コース順を持たない地点の会話窓は、次の地点へ進むボタンを出さず、一覧への案内のリンクを出す', async () => {
    // コースの最後の地点(次の旅)からコース順を外す。コース順はほかの地点だけで 1 から途切れずに続く
    const journey = spotOf(town, 'journey')
    const worldSet = withSpots('town', spots => without(spots, 'journey', 'order'))
    const below = { x: journey.cell.x, y: journey.cell.y + 1 }
    await openAt({ worldId: town.id, cell: below, facing: 'up' }, worldSet)
    expect(await walk(setId, 'ArrowUp', 1), '道の突き当たりへ 1 マス歩く').toBe(1)
    const title = dialog.getByRole('heading', { name: text.stops.journey.title })
    await advanceUntil(() => title.query() !== null, '突き当たりに着くと次の旅の会話窓が開く')
    expect(
      dialog.getByRole('button', { name: text.stops.journey.next }).query(),
      '次の地点へ進むボタンは出さない'
    ).toBeNull()
    await expect
      .element(dialog.getByRole('link', { name: text.stops.journey.next }), {
        message: '同じ文言で一覧への案内のリンクを出す',
      })
      .toHaveAttribute('href', villageJa.listHref)
    await userEvent.keyboard('x')
    await expect.element(dialog).not.toBeInTheDocument()
  })

  test('話しかける物を持たない地点に立つと、地点の吹き出しは主人公が向いている 1 マスの上を指す', async () => {
    // 卓上時計の地点から話しかける物(卓上時計)を外す。立ち位置・向き・action はそのまま。
    // 話しかける物を持たない地点は到着範囲か action のどちらかを持たなければ、ワールドの検査(validate-world.ts)が
    // ビルドで落とすので、action を持つ卓上時計の地点で作る
    const clock = spotOf(room, 'clock')
    const worldSet = withSpots('room', spots => without(spots, 'clock', 'structureId'))
    expect(validateWorldSet(worldSet), '前提: 差し替えた村もワールドの検査を通る').toEqual([])
    await openAt({ worldId: room.id, cell: clock.cell, facing: clock.facing }, worldSet)
    // 吹き出しは出た直後と、カメラが落ち着いた後(TalkBubble の SETTLE_DELAY 350ms)に測り直すので、その後で測る
    await runFor(800)
    const bubble = document.querySelector(
      '[data-village-bubble][data-village-bubble-kind="speech"]'
    )
    if (bubble === null) throw new Error('地点の吹き出しが出ていない')
    expect(bubble.textContent, '卓上時計の地点の吹き出し').toContain(text.clock.arrive)
    // 向いている 1 マス(卓上時計の地点は上向きなので 1 つ上)の、横の真ん中・上辺を指す。吹き出しの本体は指す点の 12px 上に置く
    const faced = { x: clock.cell.x, y: clock.cell.y - 1 }
    const cell = parseFloat(getComputedStyle(worldLayer()).getPropertyValue('--cell'))
    const point = { x: cellCenter(faced).x, y: cellCenter(faced).y - cell / 2 }
    const box = bubble.getBoundingClientRect()
    expect(
      box.x + box.width / 2,
      '吹き出しの横の真ん中は、向いている 1 マスの真ん中(px)'
    ).toBeCloseTo(point.x, 0)
    expect(box.bottom, '吹き出しの下端は、向いている 1 マスの上辺の 12px 上(px)').toBeCloseTo(
      point.y - 12,
      0
    )
  })
})

// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell, Direction, WorldSet } from '@content/types/world'
import VillagePageContainer from '@/components/VillagePage/container'
import { writePosition } from '@/lib/preferences'
import { isWalkable } from '@/lib/village/collision'
import { headToSpeech } from '@/components/VillagePage/components/Village/utils/spot-text'
import {
  SETTLE_MS,
  advanceUntil,
  cellCenter,
  emulateReducedMotion,
  expectLoopIdle,
  focusVillage,
  loopState,
  press,
  readCell,
  runFor,
  walk,
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

// ---- 地面の行き先の印(Ground) ----
// 地図で選んだ地点へ向かう間に地面に立てる行き先の印の位置と、歩いて届かない地点へ向かう時の印と案内文を、
// 利用者に見える振る舞いで確かめる(後ろの 3 本は、E2E を移した検査が通らないフックの分岐を通す検査から分けたもの)。
// 実際のコンテンツでは作れない配置は、地点の並びを差し替えた版の村(village-spots.test-helper.ts)で作る。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('地面の行き先の印', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa

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
  // 拡大地図の地点のボタン(読み上げ名は地点名を入れた移動の案内)と、地面に立てた行き先の印
  const mapSpot = (id: string) =>
    dialog.getByRole('button', {
      name: text.fastTravel.replace('{place}', text.stops[id]?.place ?? id),
    })
  const destinationPin = () => document.querySelector('[data-village-destination]')
  const ROOM_ENTRY = { worldId: room.id, cell: { x: 4, y: 6 } }

  test('地図で選んだ地点へ向かう間は、行き先のマスの真ん中に行き先の印の絵を立て、着くと下ろす', async () => {
    // 動きを控える設定では飛ばずに 1 マスずつ歩くので、向かう途中のフレームで印を測れる
    await emulateReducedMotion()
    const monument = spotOf(town, 'monument')
    await openAt({ worldId: town.id, cell: town.start, facing: town.startFacing })
    expect(destinationPin(), '向かう前は印が無い').toBeNull()
    await userEvent.keyboard('m')
    await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    await mapSpot('monument').click()
    await expect.element(dialog).not.toBeInTheDocument()
    await advanceUntil(() => destinationPin() !== null, '行き先の印が立つ')
    const pin = destinationPin()
    if (!(pin instanceof HTMLElement)) throw new Error('行き先の印が無い')
    // 印は 1 マスの絵を半分に縮めてマスの真ん中に立てるので、箱の真ん中が行き先のマスの真ん中に来る。
    // 箱もマスの位置もワールドの層から読むので、歩いてカメラが動いている間でも同じ瞬間の値どうしで比べられる
    const box = pin.getBoundingClientRect()
    const center = cellCenter(monument.cell)
    const gap = Math.hypot(box.x + box.width / 2 - center.x, box.y + box.height / 2 - center.y)
    expect(gap, '印の真ん中から経歴碑の前のマスの真ん中まで(px)').toBeLessThanOrEqual(1)
    expect(pin.style.getPropertyValue('--i'), 'シートの行き先の印の絵').toBe(
      String(villageJa.sprites.index.marker)
    )
    await advanceUntil(sameCell({ worldId: town.id, cell: monument.cell }), '経歴碑へ着く', 10_000)
    expect(destinationPin(), '着くと印を下ろす').toBeNull()
  })

  test('次の地点へ歩いて届かない時の「次へ」は行き先の印と案内だけ立て、地図からその地点を選んでも何もしない', async () => {
    // 実際のコンテンツの地点はどれも歩いて届くので、研究所の立ち位置を研究所の建物の中(歩けないマス)へ動かした版を渡す
    const unreachable = { x: 22, y: 4 }
    expect(isWalkable(town, unreachable), '研究所の建物の中は歩けない').toBe(false)
    const meishi = spotOf(town, 'meishi')
    const worldSet = withSpots('town', spots => moveSpot(spots, 'lab', unreachable))
    const lab = spotOf(worldSet.worlds.town, 'lab')
    await openAt({ worldId: town.id, cell: meishi.cell, facing: meishi.facing }, worldSet)
    await userEvent.keyboard('e')
    await expect
      .element(dialog.getByRole('heading', { name: text.stops.meishi.title }))
      .toBeVisible()
    await dialog.getByRole('button', { name: text.stops.meishi.next }).click()
    await expect.element(dialog).not.toBeInTheDocument()
    expect(speech(), '研究所への案内が出る').toBe(headToSpeech(text, lab))
    expect(destinationPin(), '行き先の印が立つ').not.toBeNull()
    await runFor(SETTLE_MS)
    await expectLoopIdle()
    expect(readCell(setId), '歩き出さない').toEqual({ worldId: town.id, cell: meishi.cell })
    // 地図から同じ地点を選ぶ。歩いて届かないので地図を閉じるだけで、案内も印も動かない
    const pin = destinationPin()?.getAttribute('style')
    await userEvent.keyboard('m')
    await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    await mapSpot('lab').click()
    await expect.element(dialog).not.toBeInTheDocument()
    await runFor(SETTLE_MS)
    expect(loopState(), '歩き出さない').toBe('idle')
    expect(speech(), '案内は替わらない').toBe(headToSpeech(text, lab))
    expect(destinationPin()?.getAttribute('style'), '行き先の印も動かない').toBe(pin)
    expect(readCell(setId)).toEqual({ worldId: town.id, cell: meishi.cell })
  })

  test('地図で選んだ自室の地点が扉の先で歩いて届かない時は、扉を出た所で行き先の印と案内だけ立てて止まる', async () => {
    // 実際のコンテンツの自室の地点は歩いて届くので、自室の地点の立ち位置を部屋の左上の角(壁)へ動かした版を渡す
    const wall = { x: 0, y: 0 }
    expect(isWalkable(room, wall), '部屋の左上の角は歩けない').toBe(false)
    const worldSet = withSpots('room', spots => moveSpot(spots, 'home', wall))
    const home = spotOf(worldSet.worlds.room, 'home')
    await openAt({ worldId: town.id, cell: town.start, facing: town.startFacing }, worldSet)
    // 自室の地点は、町の地図では自宅の扉に番号の印として並ぶ
    await userEvent.keyboard('m')
    await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    await mapSpot('home').click()
    await expect.element(dialog).not.toBeInTheDocument()
    await advanceUntil(sameCell(ROOM_ENTRY), '扉を通って部屋の出口手前へ出る')
    await runFor(SETTLE_MS)
    await expectLoopIdle()
    expect(readCell(setId), '扉を出た所から歩き出さない').toEqual(ROOM_ENTRY)
    expect(speech(), '自室の地点への案内が出る').toBe(headToSpeech(text, home))
    expect(destinationPin(), '行き先の印が立つ').not.toBeNull()
  })

  test('地図から自室の地点へ向かう途中でキーを押して止め、自分で扉へ入った時は、扉を出た所で行き先の印と案内だけ立て直して歩き出さない', async () => {
    // 動きを控える設定では飛ばずに速く歩くので、扉へ着く前にキーで止められる
    await emulateReducedMotion()
    const home = spotOf(room, 'home')
    // 自宅前 (14,12) の右の道。扉 (14,11) までは左へ 4 マス歩いてから上
    await openAt({ worldId: town.id, cell: { x: 18, y: 12 }, facing: 'left' })
    await userEvent.keyboard('m')
    await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    await mapSpot('home').click()
    await expect.element(dialog).not.toBeInTheDocument()
    const column = () => readCell(setId)?.cell.x ?? 18
    await advanceUntil(() => column() === 17, '扉へ向かって歩き出す')
    // 右を押して止める。キーを押すと自動の経路は捨てられ、速さも等速へ戻る
    await press('ArrowRight')
    await expectLoopIdle()
    expect(readCell(setId)?.worldId, '前提: 扉へ着く前に止めた').toBe(town.id)
    // 自分で自宅前まで歩き、上を押して扉へ入る
    const lefts = column() - 14
    expect(await walk(setId, 'ArrowLeft', lefts), '自宅前まで歩けた').toBe(lefts)
    expect(await walk(setId, 'ArrowUp', 1), '扉へ入れた').toBe(1)
    expect(readCell(setId)).toEqual(ROOM_ENTRY)
    await runFor(SETTLE_MS * 2)
    await expectLoopIdle()
    expect(readCell(setId), '扉を出た所から歩き出さない').toEqual(ROOM_ENTRY)
    expect(speech(), '自室の地点への案内を立て直す').toBe(headToSpeech(text, home))
    expect(destinationPin(), '行き先の印を立て直す').not.toBeNull()
  })
})

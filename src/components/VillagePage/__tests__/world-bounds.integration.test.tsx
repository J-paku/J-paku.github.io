// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell, Direction } from '@content/types/world'
import VillagePageContainer from '@/components/VillagePage'
import { writePosition } from '@/lib/preferences'
import { isWalkable } from '@/lib/village/collision'
import {
  FRAME_MS,
  advanceUntil,
  expectLoopIdle,
  focusVillage,
  isVisible,
  playerOnScreen,
  readCell,
  stepFrame,
  villageFrame,
  villagePlayer,
  walk,
  worldLayer,
} from './village-walk.test-helper'
import { EXIT_MAT } from './flight.test-helper'
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

// ---- 村の入力と道中の配線(ワールドの端と移り目) ----
// 歩いて行ける所の端と、ワールドを移った直後の描き方を、利用者に見える振る舞い(着いたマス・描かれた位置・読み込み中の覆い)で確かめる。
// 町の北の道の突き当たり(外周のマス)から外へ押した時と、扉を抜けた後に新しいワールドのタイルがなかなか載らない時の 2 つ。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境は、ファイル先頭の afterEach が戻す
describe('村の入力と道中の配線(ワールドの端と移り目)', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa
  const { room, town } = villageJa.worldSet.worlds
  const dialog = page.getByRole('dialog')

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

  test('北の道の突き当たり(町の外周のマス)で会話窓を閉じた後に上へ押しても、町の外へは出ず、上を向いたまま立つ', async () => {
    const journey = spotOf(town, 'journey')
    expect(journey.cell.y, '前提: 突き当たりは町の外周の行').toBe(0)
    const below = { x: journey.cell.x, y: journey.cell.y + 1 }
    expect(isWalkable(town, below), '前提: 突き当たりの 1 つ下は道').toBe(true)
    await openAt({ worldId: town.id, cell: below, facing: 'up' })
    expect(await walk(setId, 'ArrowUp', 1), '突き当たりへ 1 マス歩く').toBe(1)
    const title = dialog.getByRole('heading', { name: text.stops.journey.title })
    await advanceUntil(() => title.query() !== null, '突き当たりに着くと次の旅の会話窓が開く')
    await userEvent.keyboard('x')
    await expect.element(dialog).not.toBeInTheDocument()
    await expectLoopIdle()
    const before = playerOnScreen()
    expect(await walk(setId, 'ArrowUp', 1), '上へ押しても町の外へは出ない').toBe(0)
    await expectLoopIdle()
    expect(readCell(setId), '突き当たりのマスに留まる').toEqual({
      worldId: town.id,
      cell: journey.cell,
    })
    const after = playerOnScreen()
    expect({ x: after.x, y: after.y }, '描かれた位置も動かない').toEqual({
      x: before.x,
      y: before.y,
    })
    expect(villagePlayer().dataset.sprite, '上を向いたまま立つ').toBe('player-up-0')
    expect(dialog.query(), 'ぶつかっても次の旅の会話窓は開き直さない').toBeNull()
  })

  test('扉を抜けた後、新しいワールドのタイルが載らないままフレームが 100ms を超えて進むと読み込み中の覆いを出し、載ると外す', async () => {
    // 遅い端末で、ワールドを移した描き直し(React の確定)がフレームより遅れる時を作る。React は確定を偽にしない
    // MessageChannel のタスクで行うので、偽の時計を同じ同期の処理の中で進めるだけなら、その間に確定は走らない
    const frameWithoutCommit = () => vi.advanceTimersByTime(FRAME_MS)
    const above = { x: EXIT_MAT.x, y: EXIT_MAT.y - 1 }
    await openAt({ worldId: room.id, cell: above, facing: 'down' })
    // 枠の最初の子が読み込み中の覆い(文言を持たず点滅の点だけ)
    const loading = villageFrame().firstElementChild
    if (loading === null) throw new Error('読み込み中の覆いが無い')
    expect(isVisible(loading), '前提: 歩き出す前は覆わない').toBe(false)
    await userEvent.keyboard('{ArrowDown>}')
    for (let frame = 0; frame < 60 && readCell(setId)?.worldId !== town.id; frame += 1) {
      frameWithoutCommit()
    }
    expect(readCell(setId)?.worldId, '前提: マットに乗って町へ移った').toBe(town.id)
    expect(worldLayer().dataset.world, '前提: 描かれているタイルはまだ部屋').toBe(room.id)
    // 待ち始めてから 6 フレーム(96ms)は前の場面のまま覆わない
    for (let frame = 0; frame < 6; frame += 1) frameWithoutCommit()
    expect(isVisible(loading), '待ちが 100ms に届くまでは覆わない').toBe(false)
    frameWithoutCommit()
    expect(isVisible(loading), '待ちが 100ms を超えると読み込み中の覆いを出す').toBe(true)
    // 押していた向きを離し、React に確定の手番を渡す
    await userEvent.keyboard('{/ArrowDown}')
    await advanceUntil(() => worldLayer().dataset.world === town.id, '町のタイルが載る')
    await stepFrame()
    expect(isVisible(loading), '載ると読み込み中の覆いを外す').toBe(false)
    await expectLoopIdle()
  })
})

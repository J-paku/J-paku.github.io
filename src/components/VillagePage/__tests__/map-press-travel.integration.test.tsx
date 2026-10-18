// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell } from '@content/types/world'
import { isWalkable } from '@/lib/village/collision'
import VillagePageContainer from '@/components/VillagePage/container'
import {
  advanceUntil,
  expectLoopIdle,
  focusVillage,
  leaveRoom,
  readCell,
  villageFrame,
  worldLayer,
} from './village-walk.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// ---- 拡大地図から向かう ----
// 拡大地図(WorldMap)の地点の印と地形を押した時の行き先を、利用者に見える物(role・名前・要素の有無)と保存された現在地で断定する。
// 時間は実時間で進める(rAF・タイマー・performance.now は本物)。差し替えるのは天気(ネットワーク)だけで、
// 歩く・押す・待つは village-walk.test-helper.ts の手順
describe('拡大地図から向かう', () => {
  const { text } = villageJa
  const setId = villageJa.worldSet.id
  const { town } = villageJa.worldSet.worlds
  const map = page.getByRole('dialog')

  // 画面は既定で PC(E2E の既定と同じ 1280×720)
  beforeEach(async () => {
    await page.viewport(1280, 720)
  })

  // 村の根。data-phase に今の段階が、インラインの --cols・--rows(Village)と --cell・--band(useStageScale)に寸法が載る
  const root = () => {
    const element = villageFrame().closest<HTMLElement>('[data-phase]')
    if (element === null) throw new Error('村の根(data-phase)が描かれていない')
    return element
  }
  const worldId = () => worldLayer().getAttribute('data-world')

  // 村を描き、起動の覆いが外れたら枠へ焦点を置き(E2E の openVillage)、useStageScale が舞台の実測を --cell に書くまで待つ。
  // CSS の既定値だけでも近い寸法になるため、インラインの値で見る。実際のコンテンツでは作れない場合だけ、props を変えた版を overrides で渡す
  const renderVillage = async (overrides: Partial<typeof villageJa> = {}) => {
    render(<VillagePageContainer {...villageJa} {...overrides} />)
    await focusVillage()
    await advanceUntil(
      () => root().style.getPropertyValue('--cell') !== '',
      'useStageScale が --cell を書いた'
    )
  }

  // 村は自室の開始マス (4,4) から始まる。下端の 1 マスのマット (4,7) へ下へ 3 マス歩いて乗ると、町の自宅前 (14,12) へ出る
  const walkOutToTown = async () => {
    villageFrame().focus()
    expect(await leaveRoom(setId), '部屋の下端のマットまで歩けた').toBe(3)
    // 天気・灯りを数える前に「今いるのは屋外」を確定させる。屋内のままだと天気は常に 0 枚で素通りする
    await expect.poll(worldId, { message: '町(屋外)へ出た' }).toBe('town')
  }

  // 保存された現在地が町の cell になったか
  const standsOn = (cell: Cell) => () =>
    JSON.stringify(readCell(setId)) === JSON.stringify({ worldId: town.id, cell })

  // 地図を開き、地点の印や地形が描かれるまで待つ
  const openMap = async () => {
    await userEvent.keyboard('m')
    await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
  }

  test('拡大地図で地点の印を押すとその地点へ、地点の無い地形のマスを押すとそのマスへ、地図を閉じて向かう', async () => {
    const monument = town.spots.find(spot => spot.id === 'monument')
    if (monument === undefined) throw new Error('町に経歴碑の地点が無い')
    await renderVillage()
    await walkOutToTown()
    await expectLoopIdle()

    // 地点の印を押す。印は地形の上に重ねたボタンで、押すと地図を閉じてその地点へ向かう
    await openMap()
    await map
      .getByRole('button', {
        name: text.fastTravel.replace('{place}', text.stops.monument.place),
      })
      .click()
    await expect.element(map, { message: '地点の印を押すと地図を閉じる' }).not.toBeInTheDocument()
    await advanceUntil(standsOn(monument.cell), '経歴碑へ着く', 10_000)
    await expectLoopIdle()

    // 地点でも扉でもない歩ける地形のマスを押す。経歴碑の前から 3 マス離れた所を選ぶ
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
    await openMap()
    // 地形を描く箱(--map-w に地図の幅を持つ)。地図の SVG はこの箱いっぱいに伸びる
    const canvas = Array.from(map.element().querySelectorAll<HTMLElement>('div')).find(
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
    await expect.element(map, { message: '地形を押すと地図を閉じる' }).not.toBeInTheDocument()
    await advanceUntil(standsOn(target), '押した地形のマスへ着く', 10_000)
  }, 30_000)
})

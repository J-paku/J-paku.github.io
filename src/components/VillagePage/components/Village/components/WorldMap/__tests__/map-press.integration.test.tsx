// 拡大地図(WorldMap)を直接描き、地点の印・地形・番号の一覧・閉じるボタンを押した時に、どの知らせをどの値で呼ぶかを見る。
// 知らせを受けて地図を閉じ、歩いて向かうのは呼び出し側(村の画面)で、画面全体を描く map-press-travel が見る
import { cleanup, render } from '@testing-library/react'
import { inject } from 'vitest'
import { page } from 'vitest/browser'
import WorldMap from '@/components/VillagePage/components/Village/components/WorldMap/container'
import {
  cellAwayFromSpots,
  cellPosition,
  entries,
  mapCanvas,
  mapProps,
  placeNames,
  spotButtonName,
} from './world-map.test-helper'

const { text } = inject('villageJa')

// 押した所が地点の印のボタンに掛からないよう、どの印からも離す量(マス)。印のボタンは 39px 角で、
// この画面(1280×720)の地図では 1 マスが約 14px なので、ボタンと番号の札とずらし分を合わせても 4 マス離れれば掛からない
const AWAY_FROM_SPOTS = 4

const renderMap = () => {
  const handlers = { onTravel: vi.fn(), onTravelTo: vi.fn(), onClose: vi.fn() }
  render(<WorldMap {...mapProps(handlers, { current: null }, { current: null })} />)
  return handlers
}

beforeEach(async () => {
  // E2E(Playwright の Desktop Chrome)と同じ画面の大きさ
  await page.viewport(1280, 720)
})

afterEach(() => {
  cleanup()
})

describe('地図を押して向かう', () => {
  const dialog = page.getByRole('dialog', { name: text.mapTitle })

  test('地点の印を押すと、その地点の id で向かう知らせを呼び、押した所のマスへ向かう知らせは呼ばない', async () => {
    const handlers = renderMap()
    // 番号 2 の地点(開いた直後に焦点のある番号 1 とは別の印)
    const target = entries[1]
    await dialog.getByRole('button', { name: spotButtonName(target.id), exact: true }).click()
    expect(handlers.onTravel, '地点の id で向かう').toHaveBeenCalledExactlyOnceWith(target.id)
    expect(handlers.onTravelTo, '印の下の地形のマスへは向かわない').not.toHaveBeenCalled()
  })

  test('地点の無い地形を押すと、押した位置のマスで向かう知らせを呼ぶ', async () => {
    const handlers = renderMap()
    const cell = cellAwayFromSpots(AWAY_FROM_SPOTS)
    const canvas = mapCanvas(dialog.element())
    await page.elementLocator(canvas).click({ position: cellPosition(canvas, cell) })
    expect(handlers.onTravelTo, '押した位置のマスへ向かう').toHaveBeenCalledExactlyOnceWith(cell)
    expect(handlers.onTravel, '地点へは向かわない').not.toHaveBeenCalled()
  })

  test('番号の一覧で地点を押すと、その地点の id で向かう知らせを呼ぶ', async () => {
    const handlers = renderMap()
    const target = entries[entries.length - 1]
    const item = dialog
      .getByRole('listitem')
      .filter({ hasText: placeNames[target.id] })
      .getByRole('button')
    await item.click()
    expect(handlers.onTravel, '一覧の地点の id で向かう').toHaveBeenCalledExactlyOnceWith(target.id)
    expect(handlers.onTravelTo, '一覧は地形の外なのでマスへは向かわない').not.toHaveBeenCalled()
  })

  test('閉じるボタンを押すと閉じる知らせを呼び、どこへも向かわない', async () => {
    const handlers = renderMap()
    await dialog.getByRole('button', { name: text.closeMap, exact: true }).click()
    expect(handlers.onClose, '閉じる知らせ').toHaveBeenCalledTimes(1)
    expect(handlers.onTravel).not.toHaveBeenCalled()
    expect(handlers.onTravelTo).not.toHaveBeenCalled()
  })
})

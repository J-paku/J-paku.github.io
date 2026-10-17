// 拡大地図(WorldMap)を直接描き、開いた時と外した時の焦点、Esc・M で閉じる知らせ、方向キーとスティックで地点から地点へ焦点を移すこと、
// Tab の輪を見る。閉じた後に村の枠へ焦点が戻るのは、画面全体を描く map-tab-ring・map-spot-focus が見る
import { cleanup, render } from '@testing-library/react'
import { inject } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import type { Direction } from '@content/types/world'
import WorldMap from '@/components/VillagePage/components/Village/components/WorldMap/container'
import { spotToward } from '@/components/VillagePage/components/Village/components/WorldMap/utils/spot-navigation'
import { MAP_FOCUSABLE_SELECTOR } from '@/utils/focusables'
import { cycleWithTab, placeOpener } from '../village-dialog.test-helper'
import { entries, mapProps } from './world-map.test-helper'

const { text } = inject('villageJa')

const renderMap = (scrollHeldRef: { current: Direction | null } = { current: null }) => {
  const handlers = { onTravel: vi.fn(), onTravelTo: vi.fn(), onClose: vi.fn() }
  const opener = placeOpener()
  const view = render(<WorldMap {...mapProps(handlers, { current: opener }, scrollHeldRef)} />)
  return { ...view, handlers, opener }
}

// 今の焦点の地点の id。地点の印でなければ undefined
const focusedSpot = () =>
  document.activeElement instanceof HTMLElement ? document.activeElement.dataset.spotId : undefined

// 番号 1 の地点から、実際に地点のある向き(右か下)とその先の地点
const firstMove = () => {
  const first = entries[0]
  const moves = (['right', 'down'] as const).map(direction => ({
    direction,
    spot: spotToward(entries, first.id, direction),
  }))
  const move = moves.find(candidate => candidate.spot !== null)
  if (move === undefined || move.spot === null) throw new Error('番号 1 の右にも下にも地点が無い')
  return { direction: move.direction, spot: move.spot }
}
const ARROW_KEYS: Record<Direction, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
}

beforeEach(async () => {
  // E2E(Playwright の Desktop Chrome)と同じ画面の大きさ
  await page.viewport(1280, 720)
})

afterEach(() => {
  cleanup()
})

describe('地図の焦点とキー', () => {
  const dialog = page.getByRole('dialog')

  test('開いた地図は見出しを名前に持つ窓で、番号 1 の地点の印に焦点を置き、外すと開く前の所へ焦点を戻す', async () => {
    const { unmount, opener } = renderMap()
    await expect
      .element(dialog, { message: '見出しが窓の名前' })
      .toHaveAccessibleName(text.mapTitle)
    await expect
      .poll(focusedSpot, { message: '開いた直後の焦点は番号 1 の地点' })
      .toBe(entries[0].id)

    unmount()
    await expect
      .element(page.elementLocator(opener), { message: '外すと開く前の所へ戻す' })
      .toHaveFocus()
  })

  test('地図の中で Esc を押しても M を押しても閉じる知らせを呼ぶ', async () => {
    const { handlers } = renderMap()
    await expect.poll(focusedSpot).toBe(entries[0].id)
    await userEvent.keyboard('{Escape}')
    expect(handlers.onClose, 'Esc で閉じる知らせ').toHaveBeenCalledTimes(1)
    await userEvent.keyboard('m')
    expect(handlers.onClose, 'M で閉じる知らせ').toHaveBeenCalledTimes(2)
  })

  test('方向キーを押すと、その向きで最も近い地点の印へ焦点を移す', async () => {
    renderMap()
    await expect.poll(focusedSpot).toBe(entries[0].id)
    const { direction, spot } = firstMove()
    await userEvent.keyboard(`{${ARROW_KEYS[direction]}}`)
    await expect.poll(focusedSpot, { message: 'その向きの地点へ焦点が移る' }).toBe(spot.id)
  })

  test('スティックを倒すと、その向きで最も近い地点の印へ焦点を移す', async () => {
    // スティックの向きは村の入力が ref へ書き、地図は読むだけ。ここではテストが書く
    const scrollHeldRef: { current: Direction | null } = { current: null }
    renderMap(scrollHeldRef)
    await expect.poll(focusedSpot).toBe(entries[0].id)
    const { direction, spot } = firstMove()
    scrollHeldRef.current = direction
    // 向きが変わった知らせは来ず、地図はキー・ポインタの入力を合図に読み直す。合図には向きを持たない Shift を押す
    await userEvent.keyboard('{Shift}')
    await expect.poll(focusedSpot, { message: 'スティックの向きの地点へ焦点が移る' }).toBe(spot.id)
    scrollHeldRef.current = null
  })

  test('地図の中の Tab は、窓の中の押せる物を両端で回る', async () => {
    renderMap()
    await expect.poll(focusedSpot).toBe(entries[0].id)
    await cycleWithTab(dialog.element(), MAP_FOCUSABLE_SELECTOR)
  })
})

// 拡大地図(WorldMap)を直接描き、地形の箱を地図のマスの縦横比で描くことと、渡された行き先を地図の SVG に描くことと、
// 地点の印(字 + 番号の札)どうしを開いた時と画面の大きさが変わった後に重ねないことを見る。村の画面の中で町の地図を開いた時の印は、画面全体を描く map-badges が見る
import { cleanup, render } from '@testing-library/react'
import { page } from 'vitest/browser'
import WorldMap from '@/components/VillagePage/components/Village/components/WorldMap'
import { runFrames } from '@/components/VillagePage/__tests__/village-walk.test-helper'
import { cellAwayFromSpots, entries, mapCanvas, mapProps, town } from './world-map.test-helper'

const renderMap = () =>
  render(
    <WorldMap
      {...mapProps(
        { onTravel: vi.fn(), onTravelTo: vi.fn(), onClose: vi.fn() },
        { current: null },
        { current: null }
      )}
    />
  )

// 地形の箱の中の地図の SVG(地点の印のボタンの中の ✓/? の字の SVG とは別)
const mapSvg = (dialog: Element): SVGSVGElement => {
  const svg = mapCanvas(dialog).querySelector<SVGSVGElement>(':scope > svg')
  if (svg === null) throw new Error('地図の SVG が無い')
  return svg
}
// 地図の SVG が描く四角の、描く順の位置と大きさ(「x,y,幅,高さ」の形)
const mapRects = (dialog: Element) =>
  Array.from(mapSvg(dialog).querySelectorAll('rect')).map(rect =>
    ['x', 'y', 'width', 'height'].map(name => rect.getAttribute(name)).join(',')
  )
// 主人公の印は白い縁と黒い中身の 2 枚で、地図の SVG の最後(いちばん上)に描く
const PLAYER_RECTS = 2

// 印は字と札を合わせた範囲(ボタンの子の外接矩形。札はボタンの外へはみ出す)
const badgeBoxes = (dialog: Element) =>
  Array.from(dialog.querySelectorAll('[data-spot-id]')).map(spot => {
    const rects = Array.from(spot.children).map(child => child.getBoundingClientRect())
    return {
      id: spot.getAttribute('data-spot-id'),
      left: Math.min(...rects.map(rect => rect.left)),
      right: Math.max(...rects.map(rect => rect.right)),
      top: Math.min(...rects.map(rect => rect.top)),
      bottom: Math.max(...rects.map(rect => rect.bottom)),
    }
  })
// 重なっている印の組(接するだけは数えない)
const overlapping = (dialog: Element) => {
  const boxes = badgeBoxes(dialog)
  return boxes.flatMap((a, index) =>
    boxes
      .slice(index + 1)
      .filter(b => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
      .map(b => `${a.id}/${b.id}`)
  )
}

// 大きさが変わってから測り直すまでに待つフレーム数(測り直しは次のフレームの 1 回)。余裕を見て 5 フレーム
const SETTLE_FRAMES = 5

beforeEach(async () => {
  // E2E(Playwright の Desktop Chrome)と同じ画面の大きさ
  await page.viewport(1280, 720)
})

afterEach(() => {
  cleanup()
})

describe('地図の描き方', () => {
  const dialog = page.getByRole('dialog')

  test('地形の箱は、地図のマスの縦横比で描く', () => {
    renderMap()
    const box = mapCanvas(dialog.element()).getBoundingClientRect()
    expect(box.width, '地形の箱に幅がある').toBeGreaterThan(0)
    expect(box.width / box.height, '箱の縦横比は町のマスの縦横比').toBeCloseTo(
      town.width / town.height,
      1
    )
  })

  test('行き先を渡すと、地図の SVG のそのマスに 1 マスの行き先の印を地形の上・主人公の印の下へ描き、無くなると消す', () => {
    const props = mapProps(
      { onTravel: vi.fn(), onTravelTo: vi.fn(), onClose: vi.fn() },
      { current: null },
      { current: null }
    )
    const { rerender } = render(<WorldMap {...props} />)
    const before = mapRects(dialog.element())
    const to = cellAwayFromSpots(2)
    expect(to, '前提: 行き先は主人公の立つマスと違う').not.toEqual(town.start)
    // 1 マスの大きさ(地図の縮尺)は、SVG の幅を町の幅で割って出す
    const scale = Number(mapSvg(dialog.element()).getAttribute('width')) / town.width

    rerender(<WorldMap {...props} destination={to} />)
    expect(mapRects(dialog.element()), '増えるのは主人公の印の直前の行き先の印の 1 枚だけ').toEqual(
      [
        ...before.slice(0, -PLAYER_RECTS),
        `${to.x * scale},${to.y * scale},${scale},${scale}`,
        ...before.slice(-PLAYER_RECTS),
      ]
    )

    rerender(<WorldMap {...props} destination={null} />)
    expect(mapRects(dialog.element()), '行き先が無くなると印を消す').toEqual(before)
  })

  test('地点の印どうしは、開いた時も、開いたまま画面の大きさが変わった後も重ならない', async () => {
    renderMap()
    expect(badgeBoxes(dialog.element()).length, '地図に町の印が全部並ぶ').toBe(entries.length)
    expect(overlapping(dialog.element()), '開いた時、印どうしは重ならない').toEqual([])
    await page.viewport(390, 664)
    await runFrames(SETTLE_FRAMES)
    expect(overlapping(dialog.element()), '小さい画面へ変えた後も、印どうしは重ならない').toEqual(
      []
    )
  })
})

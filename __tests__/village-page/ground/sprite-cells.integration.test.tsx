// 地面の層(Ground。床・設置物の正面・行き先の印を並べる状態のコンテナ)を直接描き、床のマスと設置物の正面のマスを
// それぞれの位置へマスの種類のシートの絵で並べること(ワールドが替われば並べ直すこと)と、行き先を渡した間だけそのマスに行き先の印を立てることを、
// 描かれた箱の位置とシートの絵の番号(--i)で確かめる。
// props は村の container.fixture.ts が node で組んで provide したワールドとシートを使う。マスの大きさ(--cell)は、村では
// 舞台の実測(use-stage-scale)が書くので、ここでは描く箱にテストが決めた値を置く。
// 地図で選んだ地点へ向かう間に村が印を立てる・下ろすかは、村を描く destination-pin が見る
import { cleanup, render } from '@testing-library/react'
import type { Cell, World } from '@content/types/world'
import Ground from '@/components/VillagePage/components/Village/components/Ground/container'
import { facadeCells } from '@/lib/village/facade'
import { spotOf } from '../village-spots.test-helper'
import { prepareVillage, resetVillage, villageJa } from '../village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

afterEach(async () => {
  // 先に外してから環境を戻す(戻す物は village.test-helper.ts の resetVillage)
  cleanup()
  await resetVillage()
})

const { sprites } = villageJa
const { room, town } = villageJa.worldSet.worlds
// 描く箱に置くマスの大きさ(px)
const CELL_PX = 16

// 村の .world と同じく、マスを左上から --cell ずつ並べる箱に地面を描く。描いた箱と、描き直す手を返す。
// 描き直す手はワールドを省くと同じワールドのまま行き先だけを替える
const renderGround = (world: World, destination: Cell | null) => {
  const host = document.createElement('div')
  host.style.position = 'relative'
  host.style.setProperty('--cell', `${CELL_PX}px`)
  document.body.append(host)
  const ground = (on: World, to: Cell | null) => (
    <Ground world={on} sprites={sprites} destination={to} />
  )
  const { rerender } = render(ground(world, destination), { container: host })
  const redraw = (next: Cell | null, nextWorld: World = world) => rerender(ground(nextWorld, next))
  return { host, redraw }
}

// 描かれた箱の真ん中から、描いた箱の中のそのマスの真ん中までの距離(px)
const gapToCell = (host: HTMLElement, element: Element, { x, y }: Cell) => {
  const origin = host.getBoundingClientRect()
  const box = element.getBoundingClientRect()
  return Math.hypot(
    box.x + box.width / 2 - (origin.x + CELL_PX * (x + 0.5)),
    box.y + box.height / 2 - (origin.y + CELL_PX * (y + 0.5))
  )
}

// 地面に立てた行き先の印
const destinationPin = () => document.querySelector('[data-village-destination]')

// 地面の箱(動かないマスをまとめる 1 枚の箱)
const terrainOf = (host: HTMLElement) => {
  const terrain = host.querySelector('[data-village-terrain]')
  if (terrain === null) throw new Error('地面の箱が無い')
  return terrain
}

// 地面に並ぶはずのマス。床のマス(上の行から、行の中は左から)の後に、設置物ごとの正面のマスが続く。DOM の後ろほど上に描かれる
const expectedCells = (world: World) => [
  ...world.tiles.flatMap((row, y) => row.map((key, x) => ({ cell: { x, y }, key }))),
  ...world.structures.flatMap(structure => facadeCells(structure)),
]

// 1 枚ずつ、描かれた箱の真ん中とシートの絵の番号を、そのマスの真ん中とマスの種類の絵に照らし、違うマスを挙げる
const wrongCells = (host: HTMLElement, expected: ReturnType<typeof expectedCells>) => {
  const drawn = [...terrainOf(host).children]
  return expected.flatMap(({ cell, key }, i) => {
    const element = drawn[i]
    if (!(element instanceof HTMLElement)) return [`${i} 枚目が無い`]
    const gap = gapToCell(host, element, cell)
    const sheet = element.style.getPropertyValue('--i')
    return gap > 1 || sheet !== String(sprites.index[key])
      ? [`${i} 枚目 (${cell.x},${cell.y}) ${key}: ずれ ${gap}px・絵 ${sheet}`]
      : []
  })
}

describe('床と設置物の正面', () => {
  for (const world of [room, town]) {
    test(`${world.id} の地面は、床のマスを上の行から 1 枚ずつそのマスへ並べた後に設置物の正面のマスを重ね、どのマスもその種類のシートの絵で描く`, () => {
      const { host } = renderGround(world, null)
      const expected = expectedCells(world)
      expect(world.structures.length, '前提: 設置物がある').toBeGreaterThan(0)
      const missing = expected.filter(({ key }) => !Object.hasOwn(sprites.index, key))
      expect(missing, '前提: 床と設置物の絵はどれもシートにある').toEqual([])
      const terrain = terrainOf(host)
      // 動かないマスは 1 枚の箱にまとめ、飾りなので読み上げからは隠す
      expect(terrain.getAttribute('aria-hidden')).toBe('true')
      expect(terrain.children.length, '地面に並べたマスの数').toBe(expected.length)
      expect(wrongCells(host, expected), '位置か絵が違うマス').toEqual([])
      expect(destinationPin(), '行き先が無い間は印を立てない').toBeNull()
    })
  }
})

describe('ワールドが替わった時', () => {
  test('部屋から町へ描き直すと、床も設置物の正面も町のマスと絵で並べ直す', () => {
    const { host, redraw } = renderGround(room, null)
    expect(wrongCells(host, expectedCells(room)), '前提: 部屋のマスで並ぶ').toEqual([])
    redraw(null, town)
    const expected = expectedCells(town)
    expect(terrainOf(host).children.length, '町の地面に並べたマスの数').toBe(expected.length)
    expect(wrongCells(host, expected), '位置か絵が町と違うマス').toEqual([])
  })
})

describe('行き先の印', () => {
  test('行き先を渡すとそのマスの真ん中に行き先の印の絵を地面の後ろへ立て、行き先が替わると印も移り、無くなると下ろす', () => {
    // 縦と横を取り違えると別のマスになる行き先を 2 つ選ぶ
    const first = spotOf(town, 'monument').cell
    const second = spotOf(town, 'lab').cell
    expect([first.x === first.y, second.x === second.y], '前提: 縦と横が違うマス').toEqual([
      false,
      false,
    ])
    const { host, redraw } = renderGround(town, first)
    const pinAt = (cell: Cell) => {
      const pin = destinationPin()
      if (!(pin instanceof HTMLElement)) throw new Error('行き先の印が無い')
      // 印は 1 マスの絵を半分に縮めてマスの真ん中に立てるので、箱の真ん中が行き先のマスの真ん中に来る
      expect(
        gapToCell(host, pin, cell),
        '印の真ん中から行き先のマスの真ん中まで(px)'
      ).toBeLessThanOrEqual(1)
      expect(pin.style.getPropertyValue('--i'), 'シートの行き先の印の絵').toBe(
        String(sprites.index.marker)
      )
      expect(pin.getAttribute('aria-hidden'), '飾りなので読み上げからは隠す').toBe('true')
      // 地面の箱より後ろに置き、床と設置物の上に描く
      expect(pin.previousElementSibling?.hasAttribute('data-village-terrain')).toBe(true)
    }
    pinAt(first)
    redraw(second)
    pinAt(second)
    redraw(null)
    expect(destinationPin(), '行き先が無くなると印を下ろす').toBeNull()
  })
})

// 夜の灯り(状態コンテナ)を直接描く統合テスト(Vitest Browser Mode)。灯りの層を実際の Chromium で描き(ADR 0016)、
// ワールドの光源ごとに置く丸い箱の位置・大きさ・濃さ・色と、焚き火だけの揺らぎ、主人公のランタンの ref と土台の transform を、
// 計算された配置(矩形)とスタイルで確かめる。
// 段階(data-phase)と 1 マスの長さ(--cell)は村の根が配るので、ここでは描く箱に置く。
// 村の中で夜に灯り、歩いても主人公から離れないかは __tests__/village-page/night-lights.integration.test.tsx が見る。
// props は村の container.fixture.ts が node で組んで provide したワールド(villageJa)を inject で受け取る
import { createRef } from 'react'
import { cleanup, render } from '@testing-library/react'
import { inject, onTestFinished } from 'vitest'
import { page } from 'vitest/browser'
import { PLAYER_LIGHT, worldLights } from '@/lib/village/lights'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import styles from '@/components/VillagePage/components/Village/components/Lighting/lighting.module.css'
import Lighting from '@/components/VillagePage/components/Village/components/Lighting/container'

const { worlds } = inject('villageJa').worldSet

// 1 マスの長さ(px)。箱の位置と大きさはこの倍数で出る
const CELL_PX = 10
// 矩形の実測のまるめの許容(px)。箱の位置は小数第 3 位で丸めたマス数なので、ずれは 0.01px に届かない
const PX_TOLERANCE = 0.5
// rAF が回る前の主人公の灯りの土台(initial-view の startShift と同じ形の文字列)
const START_SHIFT = 'translate(30px, 40px)'

beforeEach(async () => {
  // 村の統合テストと同じ PC の画面の大きさ
  await page.viewport(1280, 720)
})

afterEach(() => {
  cleanup()
})

// 灯りの層を描く箱。村の根の代わりに段階と 1 マスの長さを持ち、層(inset 0)の原点になる
const stageOf = (phase: string) => {
  const stage = document.createElement('div')
  stage.dataset.phase = phase
  stage.style.setProperty('--cell', `${CELL_PX}px`)
  stage.style.position = 'relative'
  stage.style.width = '400px'
  stage.style.height = '300px'
  document.body.append(stage)
  onTestFinished(() => stage.remove())
  return stage
}

// 主人公の灯りを除いた、ワールドの光源の箱(描いた順)
const sourceBoxes = (stage: HTMLElement) =>
  Array.from(
    stage.querySelectorAll<HTMLElement>('[data-village-light]:not([data-village-light="player"])')
  )
const playerBox = (stage: HTMLElement) => {
  const element = stage.querySelector<HTMLElement>('[data-village-light="player"]')
  if (element === null) throw new Error('主人公の灯りが描かれていない')
  return element
}

// 箱の矩形を、箱の原点(層の左上)から測ったマスの px で返す
const boxOf = (stage: HTMLElement, element: HTMLElement) => {
  const origin = stage.getBoundingClientRect()
  const rect = element.getBoundingClientRect()
  return {
    centerX: rect.x - origin.x + rect.width / 2,
    centerY: rect.y - origin.y + rect.height / 2,
    width: rect.width,
    height: rect.height,
  }
}

describe('夜の灯りの箱', () => {
  test('夜の町の光源ごとに、灯の座標を中心とし半径の 2 倍を直径とする箱を光源の濃さと色で置き、揺らがせるのは焚き火だけ', async () => {
    const stage = stageOf('night')
    const town = worlds.town
    const sources = worldLights(town)
    // 焚き火(揺らぐ)とそれ以外(揺らがない)の両方が無いと、揺らぎの描き分けを見たことにならない
    expect(
      sources.some(light => light.flicker === true),
      '前提: 町に揺らぐ灯りがある'
    ).toBe(true)
    expect(
      sources.some(light => light.flicker !== true),
      '前提: 町に揺らがない灯りがある'
    ).toBe(true)
    render(<Lighting world={town} playerLightRef={{ current: null }} startShift={START_SHIFT} />, {
      container: stage,
    })

    const layer = playerBox(stage).parentElement
    if (layer === null) throw new Error('灯りの層が描かれていない')
    expect(getComputedStyle(layer).display, '夜は層を描く').toBe('block')
    expect(layer.getAttribute('aria-hidden'), '灯りは飾りなので読み上げから隠す').toBe('true')

    const boxes = sourceBoxes(stage)
    expect(boxes.length, '光源 1 つにつき箱を 1 つ置く').toBe(sources.length)
    sources.forEach((light, index) => {
      const element = boxes[index]
      const box = boxOf(stage, element)
      const label = `${light.id} の灯り`
      expect(element.dataset.villageLight, `${label}は種類を data 属性に載せる`).toBe(light.kind)
      expect(Math.abs(box.centerX - light.x * CELL_PX), `${label}の中心の x`).toBeLessThanOrEqual(
        PX_TOLERANCE
      )
      expect(Math.abs(box.centerY - light.y * CELL_PX), `${label}の中心の y`).toBeLessThanOrEqual(
        PX_TOLERANCE
      )
      expect(Math.abs(box.width - light.radius * 2 * CELL_PX), `${label}の幅`).toBeLessThanOrEqual(
        PX_TOLERANCE
      )
      expect(
        Math.abs(box.height - light.radius * 2 * CELL_PX),
        `${label}の高さ`
      ).toBeLessThanOrEqual(PX_TOLERANCE)
      expect(Number(getComputedStyle(element).opacity), `${label}の濃さ`).toBeCloseTo(
        light.intensity,
        5
      )
      expect(element.style.getPropertyValue('--light-color'), `${label}の色`).toBe(light.color)
      expect(element.classList.contains(styles.light), `${label}は光の溜まりとして描く`).toBe(true)
      expect(
        element.classList.contains(styles.flicker),
        `${label}が揺らぐのは揺らぐ光源の時だけ`
      ).toBe(light.flicker === true)
    })
  })

  test('主人公の灯りは渡された ref に付き、rAF が回る前は立っているマスの中央を中心に土台の transform だけずらして置く', async () => {
    const stage = stageOf('night')
    const playerLightRef = createRef<HTMLDivElement>()
    render(
      <Lighting world={worlds.town} playerLightRef={playerLightRef} startShift={START_SHIFT} />,
      { container: stage }
    )

    const element = playerBox(stage)
    expect(playerLightRef.current, '主人公の灯りの箱が ref に付く').toBe(element)
    expect(element.style.transform, '土台の transform を置く').toBe(START_SHIFT)
    expect(element.classList.contains(styles.player), '主人公の灯りとして描く').toBe(true)
    expect(element.classList.contains(styles.flicker), '主人公の灯りは揺らがない').toBe(false)
    const box = boxOf(stage, element)
    const diameter = PLAYER_LIGHT.radius * 2 * CELL_PX
    // 原点は主人公の立つマスの左上で、灯はマスの中央(0.5 マス)。そこから土台の translate(30px, 40px) だけずれる
    expect(Math.abs(box.centerX - (0.5 * CELL_PX + 30)), '中心の x').toBeLessThanOrEqual(
      PX_TOLERANCE
    )
    expect(Math.abs(box.centerY - (0.5 * CELL_PX + 40)), '中心の y').toBeLessThanOrEqual(
      PX_TOLERANCE
    )
    expect(Math.abs(box.width - diameter), '幅は半径の 2 倍').toBeLessThanOrEqual(PX_TOLERANCE)
    expect(Math.abs(box.height - diameter), '高さは半径の 2 倍').toBeLessThanOrEqual(PX_TOLERANCE)
    expect(Number(getComputedStyle(element).opacity), '濃さ').toBeCloseTo(PLAYER_LIGHT.intensity, 5)
    expect(element.style.getPropertyValue('--light-color'), '色').toBe(PLAYER_LIGHT.color)
  })

  test('ワールドが替わると光源を組み直し、光源の無い部屋では主人公の灯りだけを置く', async () => {
    const stage = stageOf('night')
    const playerLightRef = createRef<HTMLDivElement>()
    const townCount = worldLights(worlds.town).length
    // 部屋の光源が 0 だと「町の光源が残った」と「組み直した」を見分けられる
    expect(worldLights(worlds.room), '前提: 部屋に光源は無い').toEqual([])
    const { rerender } = render(
      <Lighting world={worlds.town} playerLightRef={playerLightRef} startShift={START_SHIFT} />,
      { container: stage }
    )
    expect(sourceBoxes(stage).length, '町では町の光源の数だけ置く').toBe(townCount)

    rerender(
      <Lighting world={worlds.room} playerLightRef={playerLightRef} startShift={START_SHIFT} />
    )
    expect(sourceBoxes(stage), '部屋へ替わると町の光源を外す').toEqual([])
    expect(playerLightRef.current, '主人公の灯りは残る').toBe(playerBox(stage))

    rerender(
      <Lighting world={worlds.town} playerLightRef={playerLightRef} startShift={START_SHIFT} />
    )
    expect(sourceBoxes(stage).length, '町へ戻ると町の光源を置き直す').toBe(townCount)
  })

  test('夜でない段階では層ごと描かず、灯りの要素は残したままにする', async () => {
    const stage = stageOf('day')
    render(
      <Lighting world={worlds.town} playerLightRef={{ current: null }} startShift={START_SHIFT} />,
      { container: stage }
    )
    const layer = playerBox(stage).parentElement
    if (layer === null) throw new Error('灯りの層が描かれていない')
    expect(getComputedStyle(layer).display, '昼は層を描かない').toBe('none')
    expect(sourceBoxes(stage).length, '要素は昼も残る').toBe(worldLights(worlds.town).length)
  })
})

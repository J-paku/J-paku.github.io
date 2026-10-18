// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage'
import { facadeCells } from '@/lib/village/facade'
import { cellCenter, expectLoopIdle, focusVillage } from './village-walk.test-helper'
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

// ---- 地面の床と設置物の正面(Ground) ----
// 地面の層が、床のマスと設置物の正面のマスをそれぞれの位置へ、マスの種類のシートの絵で並べることを、
// 描かれた箱の位置とシートの絵の番号(--i)で確かめる。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('地面の床と設置物の正面', () => {
  // 描いて、起動の覆いが外れたら枠へ焦点を置く(E2E の openVillage)。既定は E2E と同じ PC の 1280×720
  const openVillage = async (width = 1280, height = 720) => {
    await page.viewport(width, height)
    render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
  }

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

  test('地面は床のマスを 1 枚ずつそのマスへ並べてから設置物の正面のマスを重ね、どのマスもその種類のシートの絵で描く', async () => {
    await openVillage()
    await expectLoopIdle()
    const room = villageJa.worldSet.worlds.room
    const { index } = villageJa.sprites
    // 床のマス(上の行から、行の中は左から)の後に、設置物ごとの正面のマスが続く。DOM の後ろほど上に描かれる
    const expected = [
      ...room.tiles.flatMap((row, y) => row.map((key, x) => ({ cell: { x, y }, key }))),
      ...room.structures.flatMap(structure => facadeCells(structure)),
    ]
    expect(room.structures.length, '前提: 部屋に設置物がある').toBeGreaterThan(0)
    const unknown = expected.filter(({ key }) => !Object.hasOwn(index, key))
    expect(unknown, '前提: 部屋の床と設置物の絵はどれもシートにある').toEqual([])
    const terrain = document.querySelector('[data-village-terrain]')
    if (terrain === null) throw new Error('地面の箱が無い')
    const drawn = [...terrain.children]
    expect(drawn.length, '地面に並べたマスの数').toBe(expected.length)
    // 1 枚ずつ、描かれた箱の真ん中とシートの絵の番号を、そのマスの真ん中とマスの種類の絵に照らす
    const wrong = expected.flatMap(({ cell, key }, i) => {
      const element = drawn[i]
      if (!(element instanceof HTMLElement)) return [`${i} 枚目が無い`]
      const box = element.getBoundingClientRect()
      const center = cellCenter(cell)
      const gap = Math.hypot(box.x + box.width / 2 - center.x, box.y + box.height / 2 - center.y)
      const sheet = element.style.getPropertyValue('--i')
      return gap > 1 || sheet !== String(index[key])
        ? [`${i} 枚目 (${cell.x},${cell.y}) ${key}: ずれ ${gap}px・絵 ${sheet}`]
        : []
    })
    expect(wrong, '位置か絵が違うマス').toEqual([])
  })
})

// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage'
import {
  advanceUntil,
  focusVillage,
  leaveRoom,
  runFrames,
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

// ---- 拡大地図の地点の印 ----
// 地点の印を実測でずらすフック(use-badge-layout)を、開いたまま画面の大きさが変わる時まで統合で通すもの。
// 利用者に見える物(role・名前・位置)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。差し替えるのは天気(ネットワーク)だけで、
// 歩く・押す・待つは village-walk.test-helper.ts の手順
describe('拡大地図の地点の印', () => {
  const { text } = villageJa
  const setId = villageJa.worldSet.id

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

  // 「段階が変わらない」を見る前に待つフレーム数。段階を変える処理(シートの decode を待ってから setState)は、
  // 走れば 2 フレーム以内に画面へ届いた(2026-10-15、取消しで時刻を決めてしまう欠陥を入れて実測)ので、余裕を見て 5 フレーム
  const SETTLE_FRAMES = 5

  // 拡大地図の地点の印(字 + 番号の札)は、隣り合うマスの地点どうしで重なるので実測でずらして離す。
  // ずらす量は px なので、開いたまま画面の大きさが変わると測り直さないと重なる
  test('拡大地図を開いたまま画面の大きさが変わっても、地点の印どうしは重ならない', async () => {
    await renderVillage()
    await walkOutToTown()
    await userEvent.keyboard('m')
    const map = page.getByRole('dialog')
    await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    // 印は字と札を合わせた範囲(ボタンの子の外接矩形。札はボタンの外へはみ出す)
    const badgeBoxes = () =>
      Array.from(map.element().querySelectorAll('[data-spot-id]')).map(spot => {
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
    const overlapping = () => {
      const boxes = badgeBoxes()
      return boxes.flatMap((a, index) =>
        boxes
          .slice(index + 1)
          .filter(b => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
          .map(b => `${a.id}/${b.id}`)
      )
    }
    expect(badgeBoxes().length, '地図に地点の印が並ぶ').toBeGreaterThanOrEqual(2)
    expect(overlapping(), '開いた時、印どうしは重ならない').toEqual([])
    await page.viewport(390, 664)
    await runFrames(SETTLE_FRAMES)
    expect(overlapping(), '小さい画面へ変えた後も、印どうしは重ならない').toEqual([])
  })
})

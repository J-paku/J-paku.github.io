// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage'
import { MAP_FOCUSABLE_SELECTOR } from '@/utils/focusables'
import {
  advanceUntil,
  focusIndex,
  focusVillage,
  leaveRoom,
  villageFrame,
  worldLayer,
} from './village-walk.test-helper'
import { cycleWithTab, expectFrameFocused } from './village-dialog.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// ---- 拡大地図の Tab の輪 ----
// E2E が見ていた窓の焦点の断定を、E2E からこの統合テストへ移したもの(ADR 0018 の「統合へ移す」)。
// E2E と同じく利用者に見える物(role・名前・焦点)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。差し替えるのは天気(ネットワーク)だけで、
// 歩く・押す・待つは village-walk.test-helper.ts の手順
describe('拡大地図の焦点', () => {
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

  test('拡大地図は Tab の輪を両端で回し、閉じると村の枠へ焦点を戻す', async () => {
    await renderVillage()
    // 地図は町でだけ開く。部屋の下端のマットから町の自宅前へ出る
    await walkOutToTown()
    await expectFrameFocused('開く前の焦点は村の枠')
    await userEvent.keyboard('m')
    const map = page.getByRole('dialog')
    await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    // 開いた直後の焦点は番号 1 の地点で、並びの先頭(閉じるボタン)ではない。そこから末尾まで進めて回す
    await expect
      .poll(() => focusIndex(map.element(), MAP_FOCUSABLE_SELECTOR), {
        message: '開いた直後の焦点は窓の中の、先頭より後ろ',
      })
      .toBeGreaterThan(0)

    await cycleWithTab(map.element(), MAP_FOCUSABLE_SELECTOR)

    await userEvent.keyboard('{Escape}')
    await expect.element(map).not.toBeInTheDocument()
    await expectFrameFocused('閉じると村の枠へ焦点が戻る')
  })
})

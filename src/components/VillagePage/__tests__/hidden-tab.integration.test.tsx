// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage'
import {
  SETTLE_MS,
  advanceUntil,
  expectLoopIdle,
  focusVillage,
  readCell,
  runFor,
} from './village-walk.test-helper'
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

// ---- 村の入力と道中の配線(タブが隠れる) ----
// E2E から移した歩く・待つ・釣り・傘・飛ぶの検査(idle-loop・fishing・umbrella・flight-* の各ファイル)が通らないフックの分岐のうち、方向キーを押したままタブが隠れた時を、
// 利用者に見える振る舞いで確かめる。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩くのは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('村の入力と道中の配線(タブが隠れる)', () => {
  const setId = villageJa.worldSet.id

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

  // タブの切り替えはヘッドレスの Chromium では起こせない(CDP にページの見え方を変える命令が無い)。
  // ブラウザの環境の設定として document の visibilityState を隠れた値に差し替え、ブラウザと同じく visibilitychange を送る
  test('方向キーを押したままタブが隠れると、離した知らせが届かなくても歩くのを止め、見えている間の知らせでは止めない', async () => {
    await openVillage()
    await expectLoopIdle()
    const column = () => readCell(setId)?.cell.x ?? 4
    // 開始地点 (4,4) の行は右の壁際 (9,4) まで床
    await userEvent.keyboard('{ArrowRight>}')
    await advanceUntil(() => column() === 5, '右へ歩き出す')
    // 見えている間の知らせ(タブが見えるようになった時と同じ)では止めない。知らせた時に歩きかけていた 1 マス(6)の
    // 先まで歩き続ける
    document.dispatchEvent(new Event('visibilitychange'))
    await advanceUntil(() => column() === 7, '見えている間は歩き続ける')
    // タブが隠れる。離した知らせ(keyup)は届かず、キーは押されたまま
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    hidden.mockRestore()
    // 歩きかけの 1 マスは最後まで進み、そこで止まって眠る
    await expectLoopIdle()
    const stopped = column()
    await runFor(SETTLE_MS * 2)
    expect(column(), '隠れた後は歩かない').toBe(stopped)
    expect(stopped, '右の壁際より手前で止まる').toBeLessThan(9)
    await userEvent.keyboard('{/ArrowRight}')
  })
})

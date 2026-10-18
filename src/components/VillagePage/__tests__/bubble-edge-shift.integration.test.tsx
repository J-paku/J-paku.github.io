// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage'
import {
  advanceUntil,
  emulateTouch,
  focusVillage,
  runFor,
  villageFrame,
  villagePlayer,
  walk,
  type WalkKey,
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

// ---- 吹き出しの押し戻し ----
// E2E が見ていた吹き出しの位置の断定を、E2E からこの統合テストへ移したもの(ADR 0018 の「統合へ移す」)。
// E2E と同じく利用者に見える物(要素の有無・位置)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。差し替えるのは天気(ネットワーク)だけで、
// 歩く・押す・待つは village-walk.test-helper.ts の手順。
// タッチ端末(E2E の isMobile・hasTouch)は、CDP のタッチの模擬(emulateTouch)で描く
describe('吹き出しの位置', () => {
  const { text } = villageJa
  const setId = villageJa.worldSet.id

  // 画面は既定で PC(E2E の既定と同じ 1280×720)
  beforeEach(async () => {
    await page.viewport(1280, 720)
  })

  // DOM から 1 つ引く。無ければ前提が崩れているのでその場で落とす
  const queryOne = (selector: string, from: ParentNode = document): HTMLElement => {
    const element = from.querySelector<HTMLElement>(selector)
    if (element === null) throw new Error(`${selector} が描かれていない`)
    return element
  }

  // 村の根。data-phase に今の段階が、インラインの --cols・--rows(Village)と --cell・--band(useStageScale)に寸法が載る
  const root = () => {
    const element = villageFrame().closest<HTMLElement>('[data-phase]')
    if (element === null) throw new Error('村の根(data-phase)が描かれていない')
    return element
  }

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

  // 部屋は 10 列で枠の幅と同じなので、カメラは横に動かず、壁際のマスは枠の左右の端に描かれる。
  // 開始マス (4,4) の行は家具が無く、左へ 4 マスで左端 (0,4)、右へ 5 マスで右端 (9,4) に着く
  const EDGES: { side: string; key: WalkKey; cells: number }[] = [
    { side: '左', key: 'ArrowLeft', cells: 4 },
    { side: '右', key: 'ArrowRight', cells: 5 },
  ]
  // 話せる相手がいない所で話しかけた時に頭上へ出る考え事の吹き出し
  const THOUGHT = '[data-village-bubble][data-village-bubble-kind="thought"]'
  // 吹き出しは出た直後(rAF 2 回の後)と、カメラが落ち着く 350ms 後(TalkBubble の SETTLE_DELAY)に測り直す。
  // 測り直しを終えた後の位置を見るため、それより後で測る。一言は 2.5 秒で消えるので、それより前に測る(E2E と同じ 800ms)
  const BUBBLE_SETTLED_MS = 800

  // 縦持ちの狭い枠ほど、壁際で出した吹き出しが枠の外へはみ出しやすい。寸法は E2E と同じ 390×664 で、
  // 入力の種別も E2E と同じタッチ端末にする(この幅ではマス 39px・幅 390 の枠になる)
  describe.each(EDGES)('吹き出しを枠の左右へ押し戻す', ({ side, key, cells }) => {
    test(`部屋の${side}の壁際で出した考え事の吹き出しが枠の中に収まる`, async () => {
      await emulateTouch()
      await page.viewport(390, 664)
      await renderVillage()
      expect(await walk(setId, key, cells), `${side}の壁際まで歩けた`).toBe(cells)
      await userEvent.keyboard('e')
      await expect
        .poll(() => document.querySelector(THOUGHT)?.textContent, {
          message: '考え事の吹き出しが出る',
        })
        .toContain(text.noTarget)
      await runFor(BUBBLE_SETTLED_MS)

      const bubble = queryOne(THOUGHT).getBoundingClientRect()
      const stage = villageFrame().getBoundingClientRect()
      const player = villagePlayer().getBoundingClientRect()
      const playerCenter = player.left + player.width / 2
      // 押し戻さなければ、吹き出しは主人公の頭の真上を中心に描かれて枠の外へはみ出す位置にいる。
      // ここが成り立たないと、押し戻しを外しても下の検査が通ってしまう
      const natural = {
        left: playerCenter - bubble.width / 2,
        right: playerCenter + bubble.width / 2,
      }
      const wouldOverflow = side === '左' ? natural.left < stage.left : natural.right > stage.right
      expect(wouldOverflow, '押し戻さなければ枠の外へはみ出す位置で出している').toBe(true)

      expect(bubble.left, '吹き出しの左端が枠の中').toBeGreaterThanOrEqual(stage.left)
      expect(bubble.right, '吹き出しの右端が枠の中').toBeLessThanOrEqual(stage.right)
    })
  })
})

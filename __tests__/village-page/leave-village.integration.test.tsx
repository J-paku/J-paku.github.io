// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import { CLOCK_FOCUSABLE_SELECTOR } from '@/utils/focusables'
import {
  FRAME_MS,
  advanceUntil,
  focusIndex,
  focusVillage,
  loopState,
  runFor,
  walk,
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

// ---- 村の入力と道中の配線(村を離れる時の後始末) ----
// E2E から移した歩く・待つ・釣り・傘・飛ぶの検査(idle-loop・fishing・umbrella・flight-* の各ファイル)が通らないフックの分岐のうち、天気の問い合わせの中断と、
// 村を外した後の後片付けより先にフレームや繰り返しの時刻が来た時を、利用者に見える振る舞いで確かめる。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('村の入力と道中の配線(村を離れる時の後始末)', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

  const dialog = page.getByRole('dialog')

  test('天気が届く前に村を離れると、天気の問い合わせを中断する', async () => {
    const signals: (AbortSignal | null | undefined)[] = []
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal)
      return Response.json({ current: { precipitation: 2.4, snowfall: 0 } })
    })
    await page.viewport(1280, 720)
    render(<VillagePageContainer {...villageJa} />)
    expect(signals.length, '描いた時に天気を問い合わせる').toBe(1)
    cleanup()
    expect(signals[0]?.aborted, '離れた時に問い合わせを中断する').toBe(true)
    // 中断した後に届いた応答は使わない(描く先の無い村の状態を書き換えない)
    await runFor(FRAME_MS * 2)
  })

  // 村を外した commit の中で、外した部品の後片付けの effect より前に時計を ms 進める。ページを移って村を外すと、
  // ref は commit の中で外れ、押しっぱなしのループを止める後片付けは commit の後に回るので、その間にフレームが来うる。
  // フレームの中で投げた物は errors へ集める(投げると、ページを移る時に外れた窓を触って落ちたことになる)
  function AdvanceAfterLeaving({ ms, errors }: { ms: number; errors: string[] }) {
    useLayoutEffect(() => {
      try {
        vi.advanceTimersByTime(ms)
      } catch (error) {
        errors.push(String(error))
      }
    }, [ms, errors])
    return null
  }

  test('会話窓で下を押したまま村を離れ、後片付けより先にフレームが来ても、本文送りは外れた窓を触らない', async () => {
    await page.viewport(1280, 720)
    const view = render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
    await userEvent.keyboard('e')
    await expect.element(dialog.getByRole('heading', { name: text.stops.home.title })).toHaveFocus()
    // 下を押したままにする。押している間は本文送りのループが毎フレーム回る
    await userEvent.keyboard('{ArrowDown>}')
    await runFor(FRAME_MS * 2)
    const errors: string[] = []
    view.rerender(<AdvanceAfterLeaving ms={FRAME_MS} errors={errors} />)
    expect(errors, '外れた後のフレームで投げない').toEqual([])
    expect(document.querySelector('[role="dialog"]'), '窓はもう無い').toBeNull()
    await userEvent.keyboard('{/ArrowDown}')
  })

  test('卓上時計の窓で下(S)を押したまま村を離れ、後片付けより先に繰り返しの時刻が来ても、外れた窓の焦点を動かさない', async () => {
    // 1 段目でスティック・WASD を倒し続けた時に、焦点を次のボタンへ移し直す間隔(ClockModal/utils/step-clock-time.ts の CHOOSE_REPEAT_MS)
    const CHOOSE_REPEAT_MS = 300
    await page.viewport(1280, 720)
    const view = render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
    // 部屋の開始マス (4,4) から時計の前 (7,3) へ
    expect(await walk(setId, 'ArrowRight', 3), '時計と同じ列まで歩けた').toBe(3)
    expect(await walk(setId, 'ArrowUp', 1), '時計の前まで歩けた').toBe(1)
    await userEvent.keyboard('e')
    const clockWindow = page.getByRole('dialog', { name: text.clock.place })
    await expect.element(clockWindow).toHaveAttribute('data-step', 'choose')
    await expect.element(clockWindow.getByRole('button').first()).toHaveFocus()
    // S を押したままにする。窓は矢印だけを自分で受け、S は枠が押しっぱなしの向き(下)として読む
    await userEvent.keyboard('{s>}')
    await advanceUntil(
      () => focusIndex(clockWindow.element(), CLOCK_FOCUSABLE_SELECTOR) === 1,
      '押した瞬間に次のボタンへ移る'
    )
    const errors: string[] = []
    // 押し続けた時の次の 1 つの時刻を過ぎるまで進める
    view.rerender(<AdvanceAfterLeaving ms={CHOOSE_REPEAT_MS + FRAME_MS} errors={errors} />)
    expect(errors, '外れた後のフレームで投げない').toEqual([])
    expect(document.querySelector('[role="dialog"]'), '窓はもう無い').toBeNull()
    await userEvent.keyboard('{/s}')
  })

  test('描いた直後、枠の幅の最初の知らせが届く前に村を離れ、後片付けより先に最初のフレームが来ても、歩行ループは外れた枠を読まない', async () => {
    await page.viewport(1280, 720)
    // 描いてから離れるまで await を挟まず、同じタスクの中で済ませる。枠の幅を覚える ResizeObserver の知らせは
    // 本物の描画の段で届くので、その間には届かず、歩行ループの最初のフレームは枠そのものの幅を読みに行く
    const view = render(<VillagePageContainer {...villageJa} />)
    // 描いた時に頼んだ最初のフレームは、偽の時計を 1 度も進めていないのでまだ来ていない
    expect(loopState(), '前提: 最初のフレームを頼んで待っている').toBe('running')
    const errors: string[] = []
    // 偽の rAF は時計を入れた時の本物の時刻から 16ms 刻みで来る。日付を本物の今日より前(昼の瞬間)へ戻して止めているので、
    // 最初のフレームは 16ms 以上 32ms 未満の先になる。2 フレーム分進めて、最初のフレームを必ず来させる
    view.rerender(<AdvanceAfterLeaving ms={FRAME_MS * 2} errors={errors} />)
    expect(errors, '外れた後のフレームで投げない').toEqual([])
    expect(document.querySelector('[data-village]'), '村はもう無い').toBeNull()
  })
})

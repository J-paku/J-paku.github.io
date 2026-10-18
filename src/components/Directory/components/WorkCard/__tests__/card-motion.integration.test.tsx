// 作品カード(状態コンテナ)の、動きの出し分け(use-card-motion)の統合テスト(Vitest Browser Mode)。
// カードを実際の Chromium で、フック・子と一緒に描き(ADR 0016)、動きを控える設定では動画・リールを流さないことと、
// 一時停止のボタンで動画を止める・流し直すことを、利用者に見える形(role・名前・aria-*・要素の有無)で確かめる。
// 動きを控える設定は差し替えず、Chromium の模擬(CDP)で本物の media query を切り替える(directory.test-helper.ts の preferReducedMotion)。
// props は一覧の index.fixture.ts が node で組んで provide した作品・文言を inject で受け取る
import { cleanup, render, within } from '@testing-library/react'
import { userEvent } from 'vitest/browser'
import WorkCard from '@/components/Directory/components/WorkCard'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import shotStyles from '@/components/Directory/components/WorkCard/components/Shot/shot.module.css'
import {
  belowFold,
  cardOf,
  cardProps,
  intersectionSettled,
  preferReducedMotion,
  prepareEachTest,
  queryOrThrow,
  reelWork,
  restoreEachTest,
  settleNotice,
  shotOf,
  ui,
  videoIn,
  videoWork,
} from '@/components/Directory/__tests__/directory.test-helper'

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('動きの出し分け(use-card-motion)', () => {
  it.each([
    ['動画', videoWork],
    ['リール', reelWork],
  ])('動きを控える設定では%sを流さず、一時停止のボタンも出さない', async (_kind, work) => {
    await preferReducedMotion()
    render(<WorkCard {...cardProps(work)} />)

    const card = cardOf(work)
    expect(card.querySelector('video')).toBeNull()
    expect(card.querySelector(`.${shotStyles.reel}`)).toBeNull()
    expect(within(card).queryByRole('button', { name: ui.work.pauseMotion })).toBeNull()
    expect(within(card).queryByRole('button', { name: ui.work.resumeMotion })).toBeNull()
    // 代わりに静止画を出す
    expect(queryOrThrow(shotOf(work), 'img').getAttribute('src')).toBe(work.thumbnail)
  })

  it('動きを許す設定では動画を流し、一時停止のボタンを押すとラベルが再生へ替わる', async () => {
    // 実際に止める・流す相手は動画要素。中身は本物のまま呼び、呼ばれた回数だけを数える
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play')
    render(<WorkCard {...cardProps(videoWork)} />)

    const card = cardOf(videoWork)
    expect(card.querySelector('video')).not.toBeNull()
    const toggle = within(card).getByRole('button', { name: ui.work.pauseMotion })

    await userEvent.click(toggle)
    await expect.element(toggle).toHaveAttribute('aria-label', ui.work.resumeMotion)
    expect(within(card).queryByRole('button', { name: ui.work.pauseMotion })).toBeNull()
    expect(pause).toHaveBeenCalledTimes(1)
    expect(play).not.toHaveBeenCalled()

    // もう一度押すと流し直し、止める呼び出しは増えない
    await userEvent.click(toggle)
    await expect.element(toggle).toHaveAttribute('aria-label', ui.work.pauseMotion)
    expect(play).toHaveBeenCalledTimes(1)
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('流し直しが始まる前にまた止めても、捕まえられない例外を出さず、止まったままになる', async () => {
    // 画面の外のカードの動画はまだ src を持たないので、流し直し(play)は始まらないまま待つ。そこで止めると play の約束は拒まれる
    // play を vi.spyOn で数えると、spy が返った約束を見届けるために拒まれた約束を捕まえてしまい、欠陥を隠す。
    // 呼ばれたことは動画の play・pause の出来事で見る
    const rejections: PromiseRejectionEvent[] = []
    const recordRejection = (event: PromiseRejectionEvent) => {
      rejections.push(event)
    }
    window.addEventListener('unhandledrejection', recordRejection)
    try {
      render(<WorkCard {...cardProps(videoWork)} />, { container: belowFold() })
      const card = cardOf(videoWork)
      const video = videoIn(card)
      expect(card.getBoundingClientRect().top, 'カードは最初の画面の外').toBeGreaterThan(
        window.innerHeight
      )
      await intersectionSettled(card)
      await settleNotice()
      expect(video.hasAttribute('src'), '画面の外の動画はまだ読み込まない').toBe(false)
      const mediaEvents: string[] = []
      const recordMediaEvent = (event: Event) => {
        mediaEvents.push(event.type)
      }
      video.addEventListener('play', recordMediaEvent)
      video.addEventListener('pause', recordMediaEvent)

      // 画面に入れないよう、スクロールせずにフォーカスを置いてキーボードで押す(押すたびに止める・流す・止める)
      const toggle = within(card).getByRole('button', { name: ui.work.pauseMotion })
      toggle.focus({ preventScroll: true })
      await userEvent.keyboard('{Enter}')
      await expect.element(toggle).toHaveAttribute('aria-label', ui.work.resumeMotion)
      await userEvent.keyboard('{Enter}')
      await expect.element(toggle).toHaveAttribute('aria-label', ui.work.pauseMotion)
      await userEvent.keyboard('{Enter}')
      await expect.element(toggle).toHaveAttribute('aria-label', ui.work.resumeMotion)
      // 拒まれた約束が捕まえられないまま残れば、ここまでの間に unhandledrejection が届く
      await settleNotice()

      expect(rejections, '捕まえられない例外が出ていない').toEqual([])
      expect(video.paused, '止まったまま').toBe(true)
      // 前提: 中身の無いまま(HAVE_NOTHING)流し直し(play)、その約束が済む前に止めた(pause)。
      // このとき play の約束は AbortError で拒まれる(HTML の仕様)。そうでなければ上の検査は空回りする
      expect(mediaEvents, '流し直してから止めた').toEqual(['play', 'pause'])
      expect(video.readyState, '動画の中身はまだ無い').toBe(HTMLMediaElement.HAVE_NOTHING)
      expect(video.hasAttribute('src'), 'カードは画面の外のまま').toBe(false)
    } finally {
      window.removeEventListener('unhandledrejection', recordRejection)
    }
  })
})

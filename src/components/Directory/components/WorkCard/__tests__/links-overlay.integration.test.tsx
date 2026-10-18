// 作品カード(状態コンテナ)の、リンクの覆い(LinksOverlay)の統合テスト(Vitest Browser Mode)。
// カードを実際の Chromium で、フック・子と一緒に描き(ADR 0016)、覆いの有無・タップで開閉するトリガー・覆いの中のリンクと
// 一時停止ボタンの出し分けを、利用者に見える形(role・名前・aria-*・行き先・要素の有無)で確かめる。
// CSS も Vite が実際に当てるので、押せるかどうかは本物の重なりで決まる。
// タッチ端末かどうかの問い合わせだけを差し替える(directory.test-helper.ts の viewAsTouch)。
// props は一覧の container.fixture.ts が node で組んで provide した作品・文言を inject で受け取る。
// 実データに無い形(リンクを持たない作品など)は、作品の写しを変えてテストが直接渡す
import { cleanup, render, within } from '@testing-library/react'
import { userEvent } from 'vitest/browser'
import type { Work } from '@content/types/content'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import shotStyles from '@/components/Directory/components/WorkCard/components/Shot/shot.module.css'
import WorkCard from '@/components/Directory/components/WorkCard/container'
import {
  cardProps,
  directoryJa,
  directoryKo,
  isStoryOnly,
  motionLinkWork,
  pickWork,
  prepareEachTest,
  queryOrThrow,
  restoreEachTest,
  shotOf,
  stillLinkWork,
  ui,
  viewAsTouch,
} from '@/components/Directory/__tests__/directory.test-helper'

// リンクの覆い。表示の切り替えは CSS が受け持ち、開いている印はクラスで見る
const overlayOf = (work: Work) => queryOrThrow(shotOf(work), `.${shotStyles.shotOverlay}`)
const isOverlayOpen = (overlay: HTMLElement) =>
  overlay.classList.contains(shotStyles.shotOverlayOpen)

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('リンクの覆い(LinksOverlay)', () => {
  describe('覆いの有無', () => {
    it('リンクもストーリーも持たない作品では、トリガーも覆いも描かない', () => {
      // リンクもストーリーも持たない作品(準備中の作品の形)。いまの実データには無いので、実データから外して作る
      const bareWork: Work = { ...stillLinkWork, links: {}, story: undefined }
      viewAsTouch()
      render(<WorkCard {...cardProps(bareWork)} />)

      // 枠に残るのは静止画だけ
      const shot = shotOf(bareWork)
      expect([...shot.children].map(child => child.tagName)).toEqual(['IMG'])
    })
  })

  describe('トリガー(タップで開閉する入口)', () => {
    it.each([
      ['動きの無いカードをマウスで', stillLinkWork, false],
      ['動きの無いカードをタッチで', stillLinkWork, true],
      ['動きを持つカードをタッチで', motionLinkWork, true],
    ])('%s見るときは、閉じた状態のトリガーを置く', (_label, work, isTouch) => {
      if (isTouch) viewAsTouch()
      render(<WorkCard {...cardProps(work)} />)

      const trigger = within(shotOf(work)).getByRole('button', { name: ui.work.openLinks })
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    })

    it('動きを持つカードをマウスで見るときは、トリガーも覆い内の一時停止ボタンも置かず(全面トグルが担う)、覆いのリンクは置く', () => {
      render(<WorkCard {...cardProps(motionLinkWork)} />)

      const overlay = overlayOf(motionLinkWork)
      expect(within(overlay).queryAllByRole('button')).toHaveLength(0)
      // 枠の中で押せるボタンは、覆いの外の全面トグルだけ
      const buttons = within(shotOf(motionLinkWork)).getAllByRole('button')
      expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual([
        ui.work.pauseMotion,
      ])
      expect(within(overlay).getByRole('link', { name: ui.work.live }).getAttribute('href')).toBe(
        motionLinkWork.links.live
      )
    })

    it('トリガーを押すと覆いが開いてaria-expandedがtrueになり、覆いの空きを押すと閉じる', async () => {
      render(<WorkCard {...cardProps(stillLinkWork)} />)

      const trigger = within(shotOf(stillLinkWork)).getByRole('button', {
        name: ui.work.openLinks,
      })
      const overlay = overlayOf(stillLinkWork)
      expect(isOverlayOpen(overlay)).toBe(false)

      // マウスではホバーした枠に覆いが出てトリガーに重なる(マウスの利用者はリンクを直接押す)。トリガーはキーボードで押す
      trigger.focus()
      await userEvent.keyboard('{Enter}')
      await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
      expect(isOverlayOpen(overlay)).toBe(true)

      // 覆いの空きを押す。リンクのボタンは下端の中央に並ぶので、左上の角は空いている
      await userEvent.click(overlay, { position: { x: 4, y: 4 } })
      await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(isOverlayOpen(overlay)).toBe(false)
    })
  })

  describe('覆いの中のリンク', () => {
    const linkCases: [string, Work][] = [
      ['公開ページとGitHub', stillLinkWork],
      ['公開ページだけ', { ...stillLinkWork, links: { live: stillLinkWork.links.live } }],
      ['GitHubだけ', { ...stillLinkWork, links: { repo: stillLinkWork.links.repo } }],
    ]

    it.each(linkCases)(
      '外部リンクが%sの作品は、「リンクを開く」トリガーと持っているリンクだけを置き、ストーリーへの入口は置かない',
      (_label, work) => {
        viewAsTouch()
        render(<WorkCard {...cardProps(work)} />)

        const shot = within(shotOf(work))
        expect(shot.getByRole('button', { name: ui.work.openLinks })).toBeDefined()
        // 持たないリンクは要素ごと無い(行き先がundefinedのまま一致する)
        const live = shot.queryByRole('link', { name: ui.work.live })
        const repo = shot.queryByRole('link', { name: ui.work.repo })
        expect(live?.getAttribute('href')).toBe(work.links.live)
        expect(repo?.getAttribute('href')).toBe(work.links.repo)
        expect(shot.queryByRole('link', { name: ui.work.story })).toBeNull()
      }
    )

    it('公開ページとGitHubへの外部リンクは、行き先へ参照元を渡さない(rel=noreferrer)', () => {
      viewAsTouch()
      render(<WorkCard {...cardProps(stillLinkWork)} />)

      const overlay = within(overlayOf(stillLinkWork))
      for (const name of [ui.work.live, ui.work.repo]) {
        expect(overlay.getByRole('link', { name }).getAttribute('rel')).toBe('noreferrer')
      }
    })

    it.each([
      ['ja', directoryJa, ''],
      ['ko', directoryKo, '/ko'],
    ] as const)(
      'ストーリーだけを持つ作品は、「ストーリーを開く」トリガーと、その言語のストーリーページへの入口を1つだけ置く(%s)',
      (_locale, data, prefix) => {
        const work = pickWork(data.works, 'ストーリーだけを持つ', isStoryOnly)
        viewAsTouch()
        render(<WorkCard {...cardProps(work, data)} />)

        const shot = within(shotOf(work))
        expect(shot.getByRole('button', { name: data.ui.work.openStory })).toBeDefined()
        const links = shot.getAllByRole('link')
        expect(links).toHaveLength(1)
        expect(links[0].textContent).toBe(data.ui.work.story)
        expect(links[0].getAttribute('href')).toBe(`${prefix}/works/${work.slug}/`)
      }
    )
  })

  describe('覆いの中の一時停止ボタン(タッチ環境の操作口)', () => {
    it('動きを持つカードをタッチで見るときは一時停止ボタンを置き、押すと再生へ替わり、開いた覆いは閉じない', async () => {
      viewAsTouch()
      render(<WorkCard {...cardProps(motionLinkWork)} />)

      const shot = within(shotOf(motionLinkWork))
      const trigger = shot.getByRole('button', { name: ui.work.openLinks })
      await userEvent.click(trigger)
      await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')

      // 押されたボタンは覆いの中にある(覆いの背景を押せば閉じる)。ホバー中の動画カードの覆いは CSS が押下を通さないので、キーボードで押す
      const toggle = shot.getByRole('button', { name: ui.work.pauseMotion })
      expect(overlayOf(motionLinkWork).contains(toggle)).toBe(true)
      toggle.focus()
      await userEvent.keyboard('{Enter}')
      await expect.element(toggle).toHaveAttribute('aria-label', ui.work.resumeMotion)
      // 覆いの背景を押したことにはならない(押下は覆いの閉じる処理へ伝わらない)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')

      await userEvent.keyboard('{Enter}')
      await expect.element(toggle).toHaveAttribute('aria-label', ui.work.pauseMotion)
    })

    it.each([
      ['マウスで', false],
      ['タッチで', true],
    ])('動きの無いカードを%s見るときは一時停止ボタンを置かない', (_label, isTouch) => {
      if (isTouch) viewAsTouch()
      render(<WorkCard {...cardProps(stillLinkWork)} />)

      const shot = within(shotOf(stillLinkWork))
      expect(shot.queryByRole('button', { name: ui.work.pauseMotion })).toBeNull()
      expect(shot.queryByRole('button', { name: ui.work.resumeMotion })).toBeNull()
    })
  })
})

// @vitest-environment happy-dom
// 作品カードのリンクの覆い(LinksOverlay)の統合テスト。実データの作品をhappy-domへ描き、作品が持つ
// リンクの種類と、動きの有無・ポインタの種類で分かれる表示を、利用者に見える形(role・aria-*・名前・
// 行き先・要素の有無)で確かめる。開閉と一時停止の状態は、親と同じくuseStateで持たせて実際に押す
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Locale, UiStrings, Work } from '@content/types/content'
import LinksOverlay from './index'
import { resolveOverlayKind } from '../../utils/overlay-kind'
// 部品は親のshot.module.cssのクラス表を受け取る。同じmoduleをimportすれば部品と同じクラス名が引ける
import shotStyles from '../../shot.module.css'

// server-onlyはvitestでは無条件に例外を投げるため、中身を持たないmockに差し替える
vi.mock('server-only', () => ({}))

import { readContent } from '@/lib/content/read'

const { works, ui } = readContent('ja')

const pickWork = (candidates: Work[], label: string, predicate: (work: Work) => boolean): Work => {
  const found = candidates.find(predicate)
  if (found === undefined) throw new Error(`${label}作品がcontentに無い`)
  return found
}

// 外部リンクを持たず、ストーリーだけを持つ作品(覆いはストーリーへの入口1つになる)
const isStoryOnly = (work: Work) =>
  work.links.live === undefined && work.links.repo === undefined && work.story !== undefined

// 公開ページとGitHubの両方を持つ作品
const linkWork = pickWork(
  works,
  '公開ページとGitHubを持つ',
  work => work.links.live !== undefined && work.links.repo !== undefined
)
// リンクもストーリーも持たない作品(準備中の作品の形)。いまの実データには無いので、実データから外して作る
const bareWork: Work = { ...linkWork, links: {}, story: undefined }

type Environment = { hasMotion: boolean; isFinePointer: boolean }

// 動き(動画・リール)を持つカードか、マウス(ホバーできる細かいポインタ)で見ているか
const MOTION_MOUSE: Environment = { hasMotion: true, isFinePointer: true }
const MOTION_TOUCH: Environment = { hasMotion: true, isFinePointer: false }
const STILL_MOUSE: Environment = { hasMotion: false, isFinePointer: true }
const STILL_TOUCH: Environment = { hasMotion: false, isFinePointer: false }

type HarnessProps = Environment & { work: Work; locale: Locale; strings: UiStrings }

// 親(Shot・WorkCard)と同じく、覆いの種別はresolveOverlayKindで決め、開閉と一時停止はuseStateで持つ
function OverlayHarness({ work, locale, strings, hasMotion, isFinePointer }: HarnessProps) {
  const [isLinksOpen, setIsLinksOpen] = useState(false)
  const [isMotionPaused, setIsMotionPaused] = useState(false)

  return (
    <LinksOverlay
      work={work}
      locale={locale}
      ui={strings}
      styles={shotStyles}
      {...resolveOverlayKind(work)}
      hasMotion={hasMotion}
      isFinePointer={isFinePointer}
      isMotionPaused={isMotionPaused}
      handleToggleMotion={() => setIsMotionPaused(paused => !paused)}
      isLinksOpen={isLinksOpen}
      setIsLinksOpen={setIsLinksOpen}
    />
  )
}

const renderOverlay = (work: Work, environment: Environment, locale: Locale = 'ja') =>
  render(
    <OverlayHarness work={work} locale={locale} strings={readContent(locale).ui} {...environment} />
  )

const queryOrThrow = (root: HTMLElement, selector: string): HTMLElement => {
  const element = root.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`${selector}が描かれていない`)
  return element
}

// 覆いが開いている印(表示の切り替えはCSSが受け持ち、happy-domは描かないのでクラスで見る)
const isOverlayOpen = (overlay: HTMLElement) =>
  overlay.classList.contains(shotStyles.shotOverlayOpen)

beforeEach(() => {
  // 外へ通信させない(happy-domは相対URLをlocalhost:3000へ取りに行く)
  vi.stubGlobal('fetch', () => Promise.reject(new Error('テストでは通信しない')))
  // ビルドはnext.configのtrailingSlash: trueをこの環境変数でnext/linkへ渡す。無いとnext/linkが
  // 行き先の末尾スラッシュを削り、配信物とは違うhrefになる
  vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('覆いの有無', () => {
  it('リンクもストーリーも持たない作品では、トリガーも覆いも描かない', () => {
    const { container } = renderOverlay(bareWork, STILL_TOUCH)

    expect(container.childElementCount).toBe(0)
  })
})

describe('トリガー(タップで開閉する入口)', () => {
  it.each([
    ['動きの無いカードをマウスで', STILL_MOUSE],
    ['動きの無いカードをタッチで', STILL_TOUCH],
    ['動きを持つカードをタッチで', MOTION_TOUCH],
  ])('%s見るときは、閉じた状態のトリガーを置く', (_label, environment) => {
    renderOverlay(linkWork, environment)

    const trigger = screen.getByRole('button', { name: ui.work.openLinks })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('動きを持つカードをマウスで見るときは、トリガーも覆い内の一時停止ボタンも置かず(全面トグルが担う)、覆いのリンクは置く', () => {
    const { container } = renderOverlay(linkWork, MOTION_MOUSE)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(container.querySelector(`.${shotStyles.shotOverlay}`)).not.toBeNull()
    expect(screen.getByRole('link', { name: ui.work.live }).getAttribute('href')).toBe(
      linkWork.links.live
    )
  })

  it('トリガーを押すと覆いが開いてaria-expandedがtrueになり、覆いの空きを押すと閉じる', async () => {
    const user = userEvent.setup()
    const { container } = renderOverlay(linkWork, STILL_MOUSE)
    const trigger = screen.getByRole('button', { name: ui.work.openLinks })
    const overlay = queryOrThrow(container, `.${shotStyles.shotOverlay}`)
    expect(isOverlayOpen(overlay)).toBe(false)

    await user.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(isOverlayOpen(overlay)).toBe(true)

    await user.click(overlay)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(isOverlayOpen(overlay)).toBe(false)
  })
})

describe('覆いの中のリンク', () => {
  const linkCases: [string, Work][] = [
    ['公開ページとGitHub', linkWork],
    ['公開ページだけ', { ...linkWork, links: { live: linkWork.links.live } }],
    ['GitHubだけ', { ...linkWork, links: { repo: linkWork.links.repo } }],
  ]

  it.each(linkCases)(
    '外部リンクが%sの作品は、「リンクを開く」トリガーと持っているリンクだけを置き、ストーリーへの入口は置かない',
    (_label, work) => {
      renderOverlay(work, STILL_TOUCH)

      expect(screen.getByRole('button', { name: ui.work.openLinks })).toBeDefined()
      // 持たないリンクは要素ごと無い(行き先がundefinedのまま一致する)
      const live = screen.queryByRole('link', { name: ui.work.live })
      const repo = screen.queryByRole('link', { name: ui.work.repo })
      expect(live?.getAttribute('href')).toBe(work.links.live)
      expect(repo?.getAttribute('href')).toBe(work.links.repo)
      expect(screen.queryByRole('link', { name: ui.work.story })).toBeNull()
    }
  )

  it.each([
    ['ja', ''],
    ['ko', '/ko'],
  ] as const)(
    'ストーリーだけを持つ作品は、「ストーリーを開く」トリガーと、その言語のストーリーページへの入口を1つだけ置く(%s)',
    (locale, prefix) => {
      const content = readContent(locale)
      const work = pickWork(content.works, 'ストーリーだけを持つ', isStoryOnly)
      renderOverlay(work, STILL_TOUCH, locale)

      expect(screen.getByRole('button', { name: content.ui.work.openStory })).toBeDefined()
      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(1)
      expect(links[0].textContent).toBe(content.ui.work.story)
      expect(links[0].getAttribute('href')).toBe(`${prefix}/works/${work.slug}/`)
    }
  )
})

describe('覆いの中の一時停止ボタン(タッチ環境の操作口)', () => {
  it('動きを持つカードをタッチで見るときは一時停止ボタンを置き、押すと再生へ替わり、開いた覆いは閉じない', async () => {
    const user = userEvent.setup()
    renderOverlay(linkWork, MOTION_TOUCH)
    const trigger = screen.getByRole('button', { name: ui.work.openLinks })
    await user.click(trigger)

    const toggle = screen.getByRole('button', { name: ui.work.pauseMotion })
    await user.click(toggle)
    expect(toggle.getAttribute('aria-label')).toBe(ui.work.resumeMotion)
    // 覆いの背景を押したことにはならない(押下は覆いの閉じる処理へ伝わらない)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    await user.click(toggle)
    expect(toggle.getAttribute('aria-label')).toBe(ui.work.pauseMotion)
  })

  it.each([
    ['マウスで', STILL_MOUSE],
    ['タッチで', STILL_TOUCH],
  ])('動きの無いカードを%s見るときは一時停止ボタンを置かない', (_label, environment) => {
    renderOverlay(linkWork, environment)

    expect(screen.queryByRole('button', { name: ui.work.pauseMotion })).toBeNull()
    expect(screen.queryByRole('button', { name: ui.work.resumeMotion })).toBeNull()
  })
})

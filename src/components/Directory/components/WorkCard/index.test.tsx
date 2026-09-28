// @vitest-environment happy-dom
// 作品カード(WorkCard)の統合テスト。実データの作品を happy-dom へ描き、環境(URL のハッシュ・
// matchMedia・IntersectionObserver の有無)で分かれる表示を、利用者に見える形
// (role・aria-*・inert・要素の有無)で確かめる。実際の配置・スクロールは E2E が受け持つ
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Work } from '@content/types/content'
import WorkCard from './index'
// vitest は CSS を処理せず、CSS Modules を「キーから `_<キー>_<ファイル名のハッシュ>` を返す Proxy」に
// 置き換える(node_modules/vitest の CSSEnablerPlugin)。同じ module を import すれば部品と同じクラス名が引ける
import cardStyles from './work-card.module.css'
import shotStyles from './components/Shot/shot.module.css'

// server-only は Next.js のビルド境界専用ガードで、vitest では無条件に例外を投げる。
// テストでは中身を持たない mock に差し替え、読み込み専用の @/lib/content/read を素通しにする
vi.mock('server-only', () => ({}))

import { readContent } from '@/lib/content/read'

const { works, ui } = readContent('ja')

const pickWork = (label: string, predicate: (work: Work) => boolean): Work => {
  const found = works.find(predicate)
  if (found === undefined) throw new Error(`${label}作品が content に無い`)
  return found
}

// 詳細の開閉トグルを持つ作品
const detailWork = pickWork('詳細を持つ', work => work.detail !== undefined)
// 実操作デモ動画を持つ作品
const videoWork = pickWork('動画を持つ', work => work.video !== undefined)
// ストーリー場面をサムネイル枠で循環させる作品
const reelWork = pickWork(
  'リールを持つ',
  work => work.storyReel === true && (work.story?.scenes.length ?? 0) > 0
)

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const FINE_POINTER = '(hover: hover) and (pointer: fine)'

// matchMedia を「渡した問い合わせだけが一致する」形に差し替える。カードのフックは matches だけを読む
const stubMatchMedia = (matching: readonly string[]) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: matching.includes(query),
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

// 観察はできるが、まだ一度も交差を通知していない(カードが画面の外にある)状態
class SilentIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

const renderCard = (work: Work) => render(<WorkCard work={work} index={0} locale='ja' ui={ui} />)

// トグルが aria-controls で指す詳細の領域
const detailRegionOf = (toggle: HTMLElement): HTMLElement => {
  const region = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
  if (region === null) throw new Error('トグルの aria-controls が指す要素が無い')
  return region
}

// inert の祖先に入っていれば、操作からも読み上げからも外れている
const isInert = (element: HTMLElement) => element.closest('[inert]') !== null

const queryOrThrow = (root: HTMLElement, selector: string): HTMLElement => {
  const element = root.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`${selector} が描かれていない`)
  return element
}

const originalUrl = window.location.href

beforeEach(() => {
  // 既定はマウス操作・動きを許す設定・カードはまだ画面の外。各テストが必要な条件だけ上書きする
  stubMatchMedia([FINE_POINTER])
  vi.stubGlobal('IntersectionObserver', SilentIntersectionObserver)
  // 外へ通信させない。動きを控える設定でも、書き出した HTML と揃えた初回の描画(動きを許す前提)で
  // リールが一度マウントされ、場面 SVG の取得を始める(差し替えないと happy-dom が :3000 へ接続しに行く)
  vi.stubGlobal('fetch', () => Promise.reject(new Error('テストでは通信しない')))
})

afterEach(() => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', originalUrl)
})

describe('詳細の開閉(use-detail-open)', () => {
  it('#slug 付きで到着すると詳細が最初から開いていて、トグルを押すと閉じて操作から外れる', async () => {
    window.history.replaceState(null, '', `#${detailWork.slug}`)
    const user = userEvent.setup()
    renderCard(detailWork)

    const toggle = screen.getByRole('button', { name: ui.work.hideDetail })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(isInert(detailRegionOf(toggle))).toBe(false)

    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.textContent).toBe(ui.work.showDetail)
    expect(isInert(detailRegionOf(toggle))).toBe(true)
  })

  it('ハッシュが無ければ詳細は閉じたまま始まる', () => {
    renderCard(detailWork)

    const toggle = screen.getByRole('button', { name: ui.work.showDetail })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(isInert(detailRegionOf(toggle))).toBe(true)
  })
})

describe('動きの出し分け(use-card-motion)', () => {
  it.each([
    ['動画', videoWork],
    ['リール', reelWork],
  ])('動きを控える設定では%sを流さず、一時停止のボタンも出さない', (_kind, work) => {
    stubMatchMedia([REDUCED_MOTION, FINE_POINTER])
    const { container } = renderCard(work)

    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector(`.${shotStyles.reel}`)).toBeNull()
    expect(screen.queryByRole('button', { name: ui.work.pauseMotion })).toBeNull()
    expect(screen.queryByRole('button', { name: ui.work.resumeMotion })).toBeNull()
    // 代わりに静止画を出す
    expect(queryOrThrow(container, 'img').getAttribute('src')).toBe(work.thumbnail)
  })

  it('動きを許す設定では動画を流し、一時停止のボタンを押すとラベルが再生へ替わる', async () => {
    const user = userEvent.setup()
    const { container } = renderCard(videoWork)

    expect(container.querySelector('video')).not.toBeNull()
    const toggle = screen.getByRole('button', { name: ui.work.pauseMotion })

    await user.click(toggle)
    expect(toggle.getAttribute('aria-label')).toBe(ui.work.resumeMotion)
    expect(screen.queryByRole('button', { name: ui.work.pauseMotion })).toBeNull()
  })
})

describe('交差を観察できるかどうか(use-reveal・use-fully-visible)', () => {
  it('IntersectionObserver が無い環境では、カードを隠さず写真も色付きで描く', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { container } = renderCard(videoWork)

    // 表示してよい合図は動画の src を付けてよい合図も兼ねる
    expect(queryOrThrow(container, 'article').classList.contains(cardStyles.cardRevealed)).toBe(
      true
    )
    expect(queryOrThrow(container, 'video').getAttribute('src')).toBe(videoWork.video)
    // 画面に丸ごと収まっている印(写真の色を戻す)。判定できない環境では表示側へ倒す
    expect(
      queryOrThrow(container, `.${shotStyles.shot}`).classList.contains(shotStyles.shotInView)
    ).toBe(true)
  })

  it('観察できる環境では、画面に入ったと通知されるまで隠したまま・灰色のまま', () => {
    const { container } = renderCard(videoWork)

    expect(queryOrThrow(container, 'article').classList.contains(cardStyles.cardRevealed)).toBe(
      false
    )
    expect(queryOrThrow(container, 'video').hasAttribute('src')).toBe(false)
    expect(
      queryOrThrow(container, `.${shotStyles.shot}`).classList.contains(shotStyles.shotInView)
    ).toBe(false)
  })
})

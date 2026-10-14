// 一覧の画面(コンテナ)の統合テスト(Vitest Browser Mode)。一覧を実際の Chromium で、フック・子と一緒に描き(ADR 0016)、
// 作品カードの出し分けを、利用者に見える形
// (role・名前・aria-*・inert・行き先・要素の有無)で確かめる。CSS も Vite が実際に当てるので、押せるかどうかは本物の重なりで決まる。
// props は入口(index.tsx)と同じ組み方で container.fixture.ts が node で組み、inject で受け取る。
// 差し替えるのはネットワーク(場面 SVG の取得)と、タッチ端末かどうかの問い合わせ1つだけ(理由は viewAsTouch の注釈)。
// 動きを控える設定は差し替えず、Chromium の模擬(CDP)で本物の media query を切り替える
import { act, cleanup, render, within } from '@testing-library/react'
import { inject } from 'vitest'
import { cdp, page, userEvent } from 'vitest/browser'
import type { Work } from '@content/types/content'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import cardStyles from './components/WorkCard/work-card.module.css'
import shotStyles from './components/WorkCard/components/Shot/shot.module.css'
import type { DirectoryData } from './container.fixture'
import DirectoryContainer from './container'

const directoryJa = inject('directoryJa')
const { works, ui } = directoryJa

const pickWork = (candidates: Work[], label: string, predicate: (work: Work) => boolean): Work => {
  const found = candidates.find(predicate)
  if (found === undefined) throw new Error(`${label}作品がcontentに無い`)
  return found
}

// 詳細の開閉トグルを持つ作品
const detailWork = pickWork(works, '詳細を持つ', work => work.detail !== undefined)
// 実操作デモ動画を持つ作品
const videoWork = pickWork(works, '動画を持つ', work => work.video !== undefined)
// ストーリー場面をサムネイル枠で循環させる作品
const reelWork = pickWork(
  works,
  'リールを持つ',
  work => work.storyReel === true && (work.story?.scenes.length ?? 0) > 0
)
// 動画もリールも持たず、静止画だけを持つ作品
const stillWork = pickWork(
  works,
  '静止画だけを持つ',
  work => work.thumbnail !== undefined && work.video === undefined && work.storyReel !== true
)
// 公開ページとGitHubの両方を持ち、動画を持つ作品。マウスでは全面トグル、タッチでは覆いの中の一時停止ボタンが出る
const motionLinkWork = pickWork(
  works,
  '公開ページとGitHubを持つ動画の',
  work => work.links.live !== undefined && work.links.repo !== undefined && work.video !== undefined
)

const renderDirectory = (data: DirectoryData = directoryJa) =>
  render(<DirectoryContainer {...data} />)

const queryOrThrow = (root: HTMLElement, selector: string): HTMLElement => {
  const element = root.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`${selector}が描かれていない`)
  return element
}

const videoIn = (root: HTMLElement): HTMLVideoElement => {
  const video = root.querySelector('video')
  if (video === null) throw new Error('動画が描かれていない')
  return video
}

// カードは <article id="<slug>"> で並ぶ。詳細の開閉・一時停止などはカードごとに同じ名前で並ぶので、カードの中で探す
const cardOf = (work: Work): HTMLElement => {
  const card = document.getElementById(work.slug)
  if (card === null || card.tagName !== 'ARTICLE') {
    throw new Error(`${work.slug}のカードが描かれていない`)
  }
  return card
}

// 画面キャプチャの枠。リンクの覆いが外側の押下を判定する基準でもある
const shotOf = (work: Work) => queryOrThrow(cardOf(work), `.${shotStyles.shot}`)

// トグルが aria-controls で指す詳細の領域
const detailRegionOf = (toggle: HTMLElement): HTMLElement => {
  const region = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
  if (region === null) throw new Error('トグルの aria-controls が指す要素が無い')
  return region
}

// inert の祖先に入っていれば、操作からも読み上げからも外れている
const isInert = (element: HTMLElement) => element.closest('[inert]') !== null

const NO_NETWORK = 'テストでは通信しない'
// カードのフックが問う「ホバーできる細かいポインタか」(use-card-motion.ts)
const FINE_POINTER = '(hover: hover) and (pointer: fine)'

// タッチ端末として見る。カードのフックが問う FINE_POINTER だけを「いいえ」と答え、ほかの問い合わせは本物へ渡す。
// Chromium のタッチの模擬(CDP の Emulation.setTouchEmulationEnabled)は使わない — 切った後もポインタもホバーも
// 無い端末のまま戻らず(2026-10-14 の実測)、同じページで続くテスト(村の枠の読み上げ名はポインタで変わる)へ漏れる。
// CSS の @media は本物のマウスのまま(ホバーで覆いが出て、動画カードの覆いは押下を通さない)なので、
// 覆いに重なるボタンはキーボードで押す
const viewAsTouch = () => {
  const realMatchMedia = window.matchMedia.bind(window)
  vi.stubGlobal('matchMedia', (query: string) =>
    realMatchMedia(query === FINE_POINTER ? 'not all' : query)
  )
}

// 動きを控える設定にする。CSS の @media もフックの matchMedia も本物のまま切り替わる。戻すのは afterEach
let isMediaEmulated = false
const preferReducedMotion = async () => {
  isMediaEmulated = true
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
}

// 交差の観察が一度回る(要素への最初の通知が来る)のを待つ。カードのフックの観察者が受けた通知による更新は
// これより遅れて画面に届きうるので、「変わらないまま」を確かめるときは続けて settleNotice で待つ
const intersectionSettled = (target: Element) =>
  new Promise<void>(resolve => {
    const observer = new IntersectionObserver(() => {
      observer.disconnect()
      resolve()
    })
    observer.observe(target)
  })

const nextFrame = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve())
  })

// 観察の通知を受けたフックの状態の更新が、画面に届くまで待つ。「変わらないまま」を確かめる前に置く。
// 実測では通知から2フレーム目に届いた(2026-10-14、通知のたびに真へ倒すようフックを壊して測った)ので、余裕を見て5フレーム待つ
const settleNotice = async (frames = 5): Promise<void> => {
  if (frames === 0) return
  await nextFrame()
  await settleNotice(frames - 1)
}

const originalUrl = window.location.href

beforeEach(async () => {
  // 既定は PC の画面・マウス・動きを許す設定。各テストが必要な条件だけ替える
  await page.viewport(1280, 720)
  // 外へ通信させない。リールは場面 SVG を取りに行き、取れない場面は準備中の文言に替わる
  vi.stubGlobal('fetch', () => Promise.reject(new Error(NO_NETWORK)))
})

afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', originalUrl)
  if (isMediaEmulated) {
    isMediaEmulated = false
    await cdp().send('Emulation.setEmulatedMedia', { features: [] })
  }
})

describe('作品カード(WorkCard)', () => {
  describe('通し番号', () => {
    // 10件並べた一覧。番号は並び順だけで決まるので、静止画の作品を slug だけ替えて並べる
    const tenWorks = Array.from({ length: 10 }, (_, index) => ({
      ...stillWork,
      slug: `${stillWork.slug}-${index}`,
    }))

    it.each([
      [0, 'NO.01'],
      [9, 'NO.10'],
    ])('一覧の配列で%i番目(0始まり)のカードは、1始まりの2桁で %s と振る', (index, serial) => {
      renderDirectory({ ...directoryJa, works: tenWorks })

      expect(within(cardOf(tenWorks[index])).getByText(serial)).toBeDefined()
    })
  })

  describe('詳細の開閉(use-detail-open)', () => {
    it('#slug 付きで到着すると詳細が最初から開いていて、トグルを押すと閉じて操作から外れる', async () => {
      window.history.replaceState(null, '', `#${detailWork.slug}`)
      renderDirectory()

      const toggle = within(cardOf(detailWork)).getByRole('button', { name: ui.work.hideDetail })
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(isInert(detailRegionOf(toggle))).toBe(false)

      await userEvent.click(toggle)
      await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(toggle.textContent).toBe(ui.work.showDetail)
      expect(isInert(detailRegionOf(toggle))).toBe(true)
    })

    it('ハッシュが無ければ詳細は閉じたまま始まる', () => {
      renderDirectory()

      const toggle = within(cardOf(detailWork)).getByRole('button', { name: ui.work.showDetail })
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      expect(isInert(detailRegionOf(toggle))).toBe(true)
    })

    it('別の作品の #slug で到着したときは、詳細は閉じたまま始まる', () => {
      const otherWork = pickWork(
        works,
        '詳細を持つ作品とは別の',
        work => work.slug !== detailWork.slug
      )
      window.history.replaceState(null, '', `#${otherWork.slug}`)
      renderDirectory()

      const toggle = within(cardOf(detailWork)).getByRole('button', { name: ui.work.showDetail })
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      expect(isInert(detailRegionOf(toggle))).toBe(true)
    })
  })

  describe('動きの出し分け(use-card-motion)', () => {
    it.each([
      ['動画', videoWork],
      ['リール', reelWork],
    ])('動きを控える設定では%sを流さず、一時停止のボタンも出さない', async (_kind, work) => {
      await preferReducedMotion()
      renderDirectory()

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
      renderDirectory()

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
  })

  describe('リンクの覆いの開閉(use-links-overlay)', () => {
    // タッチで見て、覆いを開いた状態から始める
    const renderOpenOverlay = async () => {
      viewAsTouch()
      renderDirectory()
      const trigger = within(shotOf(motionLinkWork)).getByRole('button', {
        name: ui.work.openLinks,
      })
      await userEvent.click(trigger)
      await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
      return trigger
    }

    it('タップで開いた覆いは Esc で閉じる', async () => {
      const trigger = await renderOpenOverlay()

      await userEvent.keyboard('{Escape}')
      await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('タップで開いた覆いは、キャプチャ枠の中を押しても閉じず、枠の外を押すと閉じる', async () => {
      const trigger = await renderOpenOverlay()

      // 押下の始まり(pointerdown)だけを送る。クリックまで送るとトリガー自身の開閉が混ざる
      act(() => {
        trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      })
      expect(trigger.getAttribute('aria-expanded')).toBe('true')

      // 枠の外(同じカードの題字)を押す
      await userEvent.click(within(cardOf(motionLinkWork)).getByRole('heading', { level: 3 }))
      await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('交差を観察できるかどうか(use-reveal・use-fully-visible)', () => {
    it('観察できる環境では、画面に入ったと通知されるまで隠したまま・灰色のまま', async () => {
      // 狭い画面では左列(プロフィール)が上に積まれ、最初のカードも最初の画面の外に出る
      await page.viewport(375, 667)
      renderDirectory()

      const card = cardOf(videoWork)
      expect(card.getBoundingClientRect().top, 'カードは最初の画面の外').toBeGreaterThan(
        window.innerHeight
      )
      await intersectionSettled(card)
      await settleNotice()

      expect(card.classList.contains(cardStyles.cardRevealed)).toBe(false)
      expect(videoIn(card).hasAttribute('src')).toBe(false)
      expect(shotOf(videoWork).classList.contains(shotStyles.shotInView)).toBe(false)

      // 画面に入れると通知が来て表示し、丸ごと収まれば色を戻す(上の「まま」が観察の故障でないことも見る)
      shotOf(videoWork).scrollIntoView({ block: 'center' })
      await expect
        .poll(() => card.classList.contains(cardStyles.cardRevealed), {
          message: '画面に入ったカードは表示する',
        })
        .toBe(true)
      await expect
        .poll(() => shotOf(videoWork).classList.contains(shotStyles.shotInView), {
          message: '丸ごと収まった枠は色を戻す',
        })
        .toBe(true)
    })
  })
})

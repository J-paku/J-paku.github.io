// 一覧の画面(コンテナ)の統合テスト(Vitest Browser Mode)。一覧を実際の Chromium で、フック・子と一緒に描き(ADR 0016)、
// 作品カード・キャプチャ枠の中身・リンクの覆い・下部パネルのリンク・担当業務の詳細の出し分けを、利用者に見える形
// (role・名前・aria-*・inert・行き先・要素の有無)で確かめる。CSS も Vite が実際に当てるので、押せるかどうかは本物の重なりで決まる。
// props は入口(index.tsx)と同じ組み方で container.fixture.ts が node で組み、inject で受け取る。
// 実データに無い形(リンクを持たない作品・節を欠いた経歴など)は、作品・経歴を差し替えた props の写しをテストが直接渡す。
// 差し替えるのはネットワーク(場面 SVG の取得)と時間(リールの自動送り)と、タッチ端末かどうかの問い合わせ1つだけ(理由は viewAsTouch の注釈)。
// 動きを控える設定は差し替えず、Chromium の模擬(CDP)で本物の media query を切り替える
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { inject } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import type {
  Career,
  CareerDetail as CareerDetailContent,
  CareerFact,
  Work,
} from '@content/types/content'
import { sceneCycleMs } from '@/utils/cycle-scenes'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import cardStyles from '@/components/Directory/components/WorkCard/work-card.module.css'
import shotStyles from '@/components/Directory/components/WorkCard/components/Shot/shot.module.css'
import workLinksStyles from '@/components/Directory/components/WorkCard/components/WorkLinks/work-links.module.css'
import playerStyles from '@/components/ui/ScenePlayer/scene-player.module.css'
import type { DirectoryData } from './container.fixture'
import DirectoryContainer from '@/components/Directory/container'

const directoryJa = inject('directoryJa')
const directoryKo = inject('directoryKo')
const { works, ui, profile } = directoryJa

const pickWork = (candidates: Work[], label: string, predicate: (work: Work) => boolean): Work => {
  const found = candidates.find(predicate)
  if (found === undefined) throw new Error(`${label}作品がcontentに無い`)
  return found
}

// 実操作デモ動画を持つ作品
const videoWork = pickWork(works, '動画を持つ', work => work.video !== undefined)
// ストーリー場面をサムネイル枠で循環させる作品
const reelWork = pickWork(
  works,
  'リールを持つ',
  work => work.storyReel === true && (work.story?.scenes.length ?? 0) > 0
)
const reelScenes = reelWork.story?.scenes ?? []
// 動画もリールも持たず、静止画だけを持つ作品
const stillWork = pickWork(
  works,
  '静止画だけを持つ',
  work => work.thumbnail !== undefined && work.video === undefined && work.storyReel !== true
)
// 公開ページとGitHubの両方を持ち、ストーリーは持たない作品(下部パネルのリンク)
const linkWork = pickWork(
  works,
  '公開ページとGitHubを持ちストーリーを持たない',
  work => work.links.live !== undefined && work.links.repo !== undefined && work.story === undefined
)
// 公開ページとGitHubの両方を持ち、動き(動画・リール)を持たない作品。覆いのトリガーはマウスでもタッチでも出る
const stillLinkWork = pickWork(
  works,
  '公開ページとGitHubを持つ動きの無い',
  work =>
    work.links.live !== undefined &&
    work.links.repo !== undefined &&
    work.video === undefined &&
    work.storyReel !== true
)
// 公開ページとGitHubの両方を持ち、動画を持つ作品。マウスでは全面トグル、タッチでは覆いの中の一時停止ボタンが出る
const motionLinkWork = pickWork(
  works,
  '公開ページとGitHubを持つ動画の',
  work => work.links.live !== undefined && work.links.repo !== undefined && work.video !== undefined
)
// 外部リンクを持たず、ストーリーだけを持つ作品(覆いはストーリーへの入口1つになる)
const isStoryOnly = (work: Work) =>
  work.links.live === undefined && work.links.repo === undefined && work.story !== undefined

// detailを持つ経歴だけを、detailを非undefinedの型で受け取る
type DetailedCareer = Career & { detail: CareerDetailContent }

const hasDetail = (career: Career): career is DetailedCareer => career.detail !== undefined

const detailedCareers = profile.careers.filter(hasDetail)

const pickCareer = (
  label: string,
  predicate: (detail: CareerDetailContent) => boolean
): DetailedCareer => {
  const found = detailedCareers.find(career => predicate(career.detail))
  if (found === undefined) throw new Error(`${label}経歴がcontentに無い`)
  return found
}

// 派遣先を持たない側の任意項目を全部持つ経歴
const fullCareer = pickCareer(
  '手順・判断の核・技術スタック・機能一覧・余談を全部持つ',
  detail =>
    detail.origin !== undefined &&
    detail.core !== undefined &&
    detail.stacks !== undefined &&
    detail.features !== undefined &&
    detail.asides !== undefined
)
// 派遣先を2件以上持つ経歴(節番号が並び順から振られることを見る)
const assignmentCareer = pickCareer(
  '派遣先を2件以上持つ',
  detail => (detail.assignments?.length ?? 0) >= 2
)

// 実データの経歴から任意項目を1つだけ外した写しを作る
const withoutField = (career: DetailedCareer, key: keyof CareerDetailContent): DetailedCareer => ({
  ...career,
  detail: { ...career.detail, [key]: undefined },
})

const renderDirectory = (data: DirectoryData = directoryJa) =>
  render(<DirectoryContainer {...data} />)

// 作品を1件差し替えた画面の props。同じ slug の作品と入れ替え、並び順は実データのまま
const withWork = (work: Work): DirectoryData => ({
  ...directoryJa,
  works: works.map(candidate => (candidate.slug === work.slug ? work : candidate)),
})

// 経歴を1件差し替えた画面の props。同じ id の経歴と入れ替える
const withCareer = (career: Career): DirectoryData => ({
  ...directoryJa,
  profile: {
    ...profile,
    careers: profile.careers.map(candidate => (candidate.id === career.id ? career : candidate)),
  },
})

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
// リンクの覆い。表示の切り替えは CSS が受け持ち、開いている印はクラスで見る
const overlayOf = (work: Work) => queryOrThrow(shotOf(work), `.${shotStyles.shotOverlay}`)
const isOverlayOpen = (overlay: HTMLElement) =>
  overlay.classList.contains(shotStyles.shotOverlayOpen)
// 事実のパネル(仕様表・タグ・リンク)。下部パネルのリンクはこの中に並ぶ
const factPanelOf = (work: Work) => queryOrThrow(cardOf(work), `.${cardStyles.panel}`)
const reelOf = (work: Work) => queryOrThrow(shotOf(work), `.${shotStyles.reel}`)

// 日本語はPhraseTextが文節ごとに<wbr>を挟む。flexの箱の中では<wbr>も箱になり、名前を組む
// dom-accessibility-apiが箱の境に空白を足す(実測: 作品一覧への戻り道が「作品一覧へ 戻る」になった)。
// 読み上げ名の実際はE2Eの領分とし、ここでは足された空白に左右されないよう空白を除いて比べる
const squash = (text: string) => text.replace(/\s+/g, '')
const nameIs = (expected: string) => (name: string) => squash(name) === squash(expected)

// 経歴1件のパネル。見出し(会社名)で名前の付いたregionとして出る
const panelOf = (career: Career) => screen.getByRole('region', { name: nameIs(career.company) })

// パネルの中の、見出し(h3)を持つ節。節の中だけを探すために使う
const sectionIn = (panel: HTMLElement, heading: string): HTMLElement => {
  const section = within(panel)
    .getByRole('heading', { level: 3, name: nameIs(heading) })
    .closest('section')
  if (section === null) throw new Error(`「${heading}」の節が無い`)
  return section
}

// 事実表の行を、見出し列(dt)と本文列(dd)の組として文書順に読む。本文列は見出し列のすぐ後に並ぶ
const factPairsIn = (root: HTMLElement) =>
  within(root)
    .getAllByRole('term')
    .map(term => {
      const value = term.nextElementSibling
      return [term.textContent, value?.tagName === 'DD' ? value.textContent : null]
    })

const pairsOf = (rows: CareerFact[]) => rows.map(row => [row.label, row.value])

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

// 場面 SVG の取得を、テストが手放すまで返さずに留める。手放すと失敗で返す。
// 失敗した取得は取得の覚え(src/lib/fetch-svg-source.ts)から消えるので、次のテストは空の覚えから始まる
const heldFetches: Array<(reason: Error) => void> = []
const releaseSceneFetches = () => {
  for (const reject of heldFetches.splice(0)) reject(new Error(NO_NETWORK))
}
const holdSceneFetches = () => {
  vi.stubGlobal(
    'fetch',
    () =>
      new Promise<Response>((_, reject) => {
        heldFetches.push(reject)
      })
  )
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
  releaseSceneFetches()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', originalUrl)
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
})

describe('キャプチャ枠の中身(ShotMedia)', () => {
  describe('動画', () => {
    it('画面に入るまでは、読み上げから外した動画にsrcを付けず、ポスターの静止画だけを出す', async () => {
      await page.viewport(375, 667)
      renderDirectory()

      const shot = shotOf(videoWork)
      expect(
        cardOf(videoWork).getBoundingClientRect().top,
        'カードは最初の画面の外'
      ).toBeGreaterThan(window.innerHeight)
      await intersectionSettled(shot)
      await settleNotice()

      const video = videoIn(shot)
      expect(video.getAttribute('aria-hidden')).toBe('true')
      expect(video.hasAttribute('src')).toBe(false)
      expect(video.getAttribute('poster')).toBe(videoWork.thumbnail)
      expect(shot.querySelector('img')).toBeNull()
    })

    it('画面に入った後は動画のsrcを付け、再生中なら自動再生を付ける', async () => {
      renderDirectory()

      const video = videoIn(shotOf(videoWork))
      await expect
        .poll(() => video.getAttribute('src'), {
          message: '最初の画面にあるカードの動画は読み込む',
        })
        .toBe(videoWork.video)
      expect(video.hasAttribute('autoplay')).toBe(true)
      // ブラウザは音の出る動画の自動再生を止めるので、消音で流す
      expect(video.muted).toBe(true)
    })

    it('画面に入った後に一時停止すると自動再生を外し、止める相手はこの動画', async () => {
      const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')
      renderDirectory()

      const shot = shotOf(videoWork)
      const video = videoIn(shot)
      await expect
        .poll(() => video.getAttribute('src'), {
          message: '最初の画面にあるカードの動画は読み込む',
        })
        .toBe(videoWork.video)

      await userEvent.click(within(shot).getByRole('button', { name: ui.work.pauseMotion }))
      await expect.poll(() => video.hasAttribute('autoplay')).toBe(false)
      expect(video.getAttribute('src')).toBe(videoWork.video)
      // 親の一時停止ボタンが止める相手(ShotMedia が受け取る videoRef)は、この枠の動画
      expect(pause.mock.contexts).toHaveLength(1)
      expect(pause.mock.contexts[0]).toBe(video)
    })
  })

  describe('リール', () => {
    it('読み上げから外した枠に場面を並べ、動画も静止画も出さない。取れない場面は準備中の文言に替わる', async () => {
      renderDirectory()

      const shot = shotOf(reelWork)
      const reel = reelOf(reelWork)
      expect(reel.getAttribute('aria-hidden')).toBe('true')
      expect(shot.querySelector('video')).toBeNull()
      expect(shot.querySelector('img')).toBeNull()
      expect(await within(reel).findAllByText(ui.work.shotPlaceholder)).toHaveLength(
        reelScenes.length
      )
    })

    it('自動送りで今の場面だけを見せる場面にし、ほかの場面は伏せる', () => {
      // 先頭以外を指す添字で見る(先頭固定の取り違えを見分けるため、場面が2つ以上ある前提)
      expect(reelScenes.length).toBeGreaterThanOrEqual(2)
      const activeIndex = reelScenes.length - 1
      // 時間だけを差し替え、場面ごとの周期で送る setTimeout を末尾の場面まで進める
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderDirectory()

      for (const scene of reelScenes.slice(0, activeIndex)) {
        act(() => {
          vi.advanceTimersByTime(sceneCycleMs(scene.id))
        })
      }
      const frames = [...reelOf(reelWork).querySelectorAll(`.${playerStyles.frame}`)]
      expect(frames.map(frame => frame.classList.contains(playerStyles.frameActive))).toEqual(
        reelScenes.map((_, index) => index === activeIndex)
      )
    })

    it('再生中は、どの場面の動きも止めない', async () => {
      // 場面 SVG の受け皿が止めた印を持つ。取得の失敗で文言へ替わると受け皿ごと消えるので、数え終わるまで取得を返さない
      holdSceneFetches()
      renderDirectory()

      const reel = reelOf(reelWork)
      expect(reel.querySelectorAll(`.${playerStyles.sceneSvg}`)).toHaveLength(reelScenes.length)
      expect(reel.querySelectorAll('[data-paused]')).toHaveLength(0)

      // 取れない場面は準備中の文言に替わる。待たずに終えると、失敗の通知がテストの外で状態を更新する
      releaseSceneFetches()
      await within(reel).findAllByText(ui.work.shotPlaceholder)
    })

    it('一時停止中は、すべての場面の動きを止める', async () => {
      holdSceneFetches()
      renderDirectory()

      const reel = reelOf(reelWork)
      await userEvent.click(
        within(shotOf(reelWork)).getByRole('button', { name: ui.work.pauseMotion })
      )
      await expect.poll(() => reel.querySelectorAll('[data-paused]').length).toBe(reelScenes.length)

      releaseSceneFetches()
      await within(reel).findAllByText(ui.work.shotPlaceholder)
    })
  })

  describe('静止画と準備中の文言', () => {
    const stillCases: [string, Work][] = [
      ['動きを持たない作品は', stillWork],
      // リールの指示だけを残して場面を外した写し。場面が無ければリールにならない
      ['リールの指示があっても場面を持たない作品は', { ...reelWork, story: undefined }],
    ]

    it.each(stillCases)('%s、作品の静止画を装飾として出す', (_label, work) => {
      renderDirectory(withWork(work))

      const shot = shotOf(work)
      const image = queryOrThrow(shot, 'img')
      expect(image.getAttribute('src')).toBe(work.thumbnail)
      expect(image.getAttribute('alt')).toBe('')
      expect(shot.querySelector('video')).toBeNull()
      expect(shot.querySelector(`.${shotStyles.reel}`)).toBeNull()
    })

    it('静止画も持たない作品では、準備中の文言を出す', () => {
      const work: Work = { ...stillWork, thumbnail: undefined }
      renderDirectory(withWork(work))

      const shot = shotOf(work)
      expect(within(shot).getByText(ui.work.shotPlaceholder)).toBeDefined()
      expect(shot.querySelector('img')).toBeNull()
    })
  })
})

describe('リンクの覆い(LinksOverlay)', () => {
  describe('覆いの有無', () => {
    it('リンクもストーリーも持たない作品では、トリガーも覆いも描かない', () => {
      // リンクもストーリーも持たない作品(準備中の作品の形)。いまの実データには無いので、実データから外して作る
      const bareWork: Work = { ...stillLinkWork, links: {}, story: undefined }
      viewAsTouch()
      renderDirectory(withWork(bareWork))

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
      renderDirectory()

      const trigger = within(shotOf(work)).getByRole('button', { name: ui.work.openLinks })
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    })

    it('動きを持つカードをマウスで見るときは、トリガーも覆い内の一時停止ボタンも置かず(全面トグルが担う)、覆いのリンクは置く', () => {
      renderDirectory()

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
      renderDirectory()

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
        renderDirectory(withWork(work))

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
      renderDirectory()

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
        renderDirectory(data)

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
      renderDirectory()

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
      renderDirectory()

      const shot = within(shotOf(stillLinkWork))
      expect(shot.queryByRole('button', { name: ui.work.pauseMotion })).toBeNull()
      expect(shot.queryByRole('button', { name: ui.work.resumeMotion })).toBeNull()
    })
  })
})

describe('下部パネルのリンク(WorkLinks)', () => {
  it('リンクもストーリーも持たない作品では何も描かない', () => {
    // リンクもストーリーも持たない作品(準備中の作品の形)。いまの実データには無いので、実データから外して作る
    const bareWork: Work = { ...linkWork, links: {}, story: undefined }
    renderDirectory(withWork(bareWork))

    const panel = factPanelOf(bareWork)
    expect(panel.querySelector(`.${workLinksStyles.links}`)).toBeNull()
    expect(within(panel).queryAllByRole('link')).toHaveLength(0)
  })

  const linkCases: [string, Work][] = [
    ['公開ページとGitHub', linkWork],
    ['公開ページだけ', { ...linkWork, links: { live: linkWork.links.live } }],
    ['GitHubだけ', { ...linkWork, links: { repo: linkWork.links.repo } }],
  ]

  it.each(linkCases)(
    '外部リンクが%sでストーリーを持たない作品は、持っているリンクだけを出す',
    (_label, work) => {
      renderDirectory(withWork(work))

      // 持たないリンクは要素ごと無い(行き先がundefinedのまま一致する)
      const panel = within(factPanelOf(work))
      const live = panel.queryByRole('link', { name: ui.work.live })
      const repo = panel.queryByRole('link', { name: ui.work.repo })
      expect(live?.getAttribute('href')).toBe(work.links.live)
      expect(repo?.getAttribute('href')).toBe(work.links.repo)
      expect(panel.queryByRole('link', { name: ui.work.story })).toBeNull()
    }
  )

  it('公開ページとGitHubへの外部リンクは、行き先へ参照元を渡さない(rel=noreferrer)', () => {
    renderDirectory()

    const panel = within(factPanelOf(linkWork))
    for (const name of [ui.work.live, ui.work.repo]) {
      expect(panel.getByRole('link', { name }).getAttribute('rel')).toBe('noreferrer')
    }
  })

  it.each([
    ['ja', directoryJa, ''],
    ['ko', directoryKo, '/ko'],
  ] as const)(
    'ストーリーを持つ作品は、その言語のストーリーページへのリンクを出す(%s)',
    (_locale, data, prefix) => {
      const work = pickWork(
        data.works,
        'ストーリーを持つ',
        candidate => candidate.story !== undefined
      )
      renderDirectory(data)

      const story = within(factPanelOf(work)).getByRole('link', { name: data.ui.work.story })
      expect(story.getAttribute('href')).toBe(`${prefix}/works/${work.slug}/`)
    }
  )

  it('外部リンクとストーリーの両方を持つ作品にも、ストーリーへの常設の入口を並べて出す', () => {
    const storyWork = pickWork(works, 'ストーリーを持つ', work => work.story !== undefined)
    const work: Work = { ...linkWork, story: storyWork.story }
    renderDirectory(withWork(work))

    expect(
      within(factPanelOf(work))
        .getAllByRole('link')
        .map(link => link.textContent)
    ).toEqual([ui.work.live, ui.work.repo, ui.work.story])
  })
})

describe('担当業務の詳細(CareerDetail)', () => {
  describe('パネルの有無と骨組み', () => {
    it('detailを持たない経歴には、パネルを描かない', () => {
      renderDirectory(withCareer({ ...fullCareer, detail: undefined }))

      expect(screen.queryByRole('region', { name: nameIs(fullCareer.company) })).toBeNull()
      expect(document.getElementById(`career-${fullCareer.id}`)).toBeNull()
      // 外したのはその経歴だけで、ほかの経歴のパネルは描かれている
      for (const career of detailedCareers.filter(other => other.id !== fullCareer.id)) {
        expect(panelOf(career)).toBeTruthy()
      }
    })

    it('会社名の見出しで名前の付いた領域として出て、経歴のidで飛べて、作品一覧へ戻るリンクを持つ', () => {
      renderDirectory()

      const panel = panelOf(fullCareer)
      // 左列の導線(#career-<id>)の飛び先。飛んだ後にフォーカスを受けられる
      expect(document.getElementById(`career-${fullCareer.id}`)).toBe(panel)
      expect(panel.getAttribute('tabindex')).toBe('-1')

      expect(
        within(panel).getByRole('heading', { level: 2, name: nameIs(fullCareer.company) })
      ).toBeTruthy()
      expect(within(panel).getByText(`${fullCareer.period} · ${fullCareer.role}`)).toBeTruthy()
      expect(
        within(panel).getByRole('heading', {
          level: 3,
          name: nameIs(fullCareer.detail.overview.title),
        })
      ).toBeTruthy()
      for (const fact of fullCareer.detail.facts) {
        expect(within(panel).getByText(fact.value)).toBeTruthy()
      }

      const back = within(panel).getByRole('link', { name: nameIs(ui.career.backToWorks) })
      expect(back.getAttribute('href')).toBe('#works')
    })

    it.each([
      ['技術スタックを持つ', fullCareer],
      ['派遣先を持つ', assignmentCareer],
    ])(
      '%s経歴の事実表は、見出し列と本文列の組で、事実・技術スタック・派遣先の順に全行を並べる',
      (_label, career) => {
        renderDirectory()

        const { facts, stacks, assignments } = career.detail
        expect(factPairsIn(panelOf(career))).toEqual(
          pairsOf([
            ...facts,
            ...(stacks?.groups.flatMap(group => group.rows) ?? []),
            ...(assignments?.flatMap(assignment => assignment.facts) ?? []),
          ])
        )
      }
    )

    it('同じページに全経歴を並べても、どのパネルも自分の会社名で名前が付く', () => {
      renderDirectory()

      // 名前の付いた領域は、経歴のパネルのほかに作品一覧の節がある
      const works = screen.getByRole('region', { name: nameIs(ui.work.index) })
      const panels = screen.getAllByRole('region').filter(region => region !== works)
      expect(panels).toHaveLength(detailedCareers.length)
      for (const career of detailedCareers) {
        expect(panelOf(career).id).toBe(`career-${career.id}`)
      }
    })
  })

  describe('任意項目の有無', () => {
    it.each([
      ['現場の手順(origin)', 'origin', fullCareer.detail.origin?.heading],
      ['技術スタック(stacks)', 'stacks', fullCareer.detail.stacks?.heading],
      ['機能一覧(features)', 'features', fullCareer.detail.features?.heading],
      ['余談(asides)', 'asides', fullCareer.detail.asides?.heading],
    ] as const)('%sを持てば節の見出しを出し、外すと節ごと消える', (_label, key, heading) => {
      if (heading === undefined) throw new Error(`${key}の見出しが無い`)

      const { unmount } = renderDirectory()
      expect(
        within(panelOf(fullCareer)).getByRole('heading', { level: 3, name: nameIs(heading) })
      ).toBeTruthy()
      unmount()

      renderDirectory(withCareer(withoutField(fullCareer, key)))
      // 外したのはその節だけで、パネル自体は描かれている
      expect(
        within(panelOf(fullCareer)).queryByRole('heading', { name: nameIs(heading) })
      ).toBeNull()
    })

    it('判断の核(core)を持てば主張と理由を出し、外すと両方消える', () => {
      const core = fullCareer.detail.core
      if (core === undefined) throw new Error('coreが無い')

      const { unmount } = renderDirectory()
      expect(within(panelOf(fullCareer)).getByText(core.claim)).toBeTruthy()
      expect(within(panelOf(fullCareer)).getByText(core.body)).toBeTruthy()
      unmount()

      renderDirectory(withCareer(withoutField(fullCareer, 'core')))
      const panel = within(panelOf(fullCareer))
      expect(panel.queryByText(core.claim)).toBeNull()
      expect(panel.queryByText(core.body)).toBeNull()
    })

    it('技術スタックは層ごとに小見出しを立て、層の行を並べる', () => {
      const stacks = fullCareer.detail.stacks
      if (stacks === undefined) throw new Error('stacksが無い')
      renderDirectory()

      const section = within(sectionIn(panelOf(fullCareer), stacks.heading))
      const layerTitles = section
        .getAllByRole('heading', { level: 4 })
        .map(title => title.textContent)
      expect(layerTitles).toEqual(stacks.groups.map(group => group.title))
      for (const row of stacks.groups.flatMap(group => group.rows)) {
        expect(section.getAllByText(row.value).length).toBeGreaterThan(0)
      }
    })

    it('派遣先(assignments)を持てば、派遣先ごとに並び順の節番号と題字を出す', () => {
      const assignments = assignmentCareer.detail.assignments ?? []
      renderDirectory()

      const panel = panelOf(assignmentCareer)
      const eyebrows = within(panel)
        .getAllByText(/^ASSIGNMENT \d+$/)
        .map(eyebrow => eyebrow.textContent)
      expect(eyebrows).toEqual(
        assignments.map((_, index) => `ASSIGNMENT ${String(index + 1).padStart(2, '0')}`)
      )
      for (const assignment of assignments) {
        expect(
          within(panel).getByRole('heading', { level: 3, name: nameIs(assignment.client) })
        ).toBeTruthy()
        // 派遣先の事実表は、その派遣先の節の中に置く
        expect(factPairsIn(sectionIn(panel, assignment.client))).toEqual(pairsOf(assignment.facts))
      }
    })

    it('派遣先を外すと、節番号も派遣先の題字も出さない', () => {
      const assignments = assignmentCareer.detail.assignments ?? []
      renderDirectory(withCareer(withoutField(assignmentCareer, 'assignments')))

      const panel = within(panelOf(assignmentCareer))
      expect(panel.queryByText(/^ASSIGNMENT \d+$/)).toBeNull()
      for (const assignment of assignments) {
        expect(panel.queryByRole('heading', { name: nameIs(assignment.client) })).toBeNull()
      }
    })
  })

  describe('節の中の出し分け', () => {
    it('手順のうち強調するコマだけをstrongで示す', () => {
      const origin = fullCareer.detail.origin
      if (origin === undefined) throw new Error('originが無い')
      // 強調するコマとしないコマの両方がある前提で見る
      expect(origin.flow.some(step => step.emphasis === true)).toBe(true)
      expect(origin.flow.some(step => step.emphasis !== true)).toBe(true)
      renderDirectory()

      const flow = within(within(sectionIn(panelOf(fullCareer), origin.heading)).getByRole('list'))
      for (const step of origin.flow) {
        const label = flow.getByText(step.label)
        expect(label.closest('strong') !== null).toBe(step.emphasis === true)
      }
    })

    it('機能ごとの工程バッジは、担当した工程に「担当」、しなかった工程に「担当外」を読み上げ用に添える', () => {
      const features = fullCareer.detail.features
      if (features === undefined) throw new Error('featuresが無い')
      // 担当外の工程を含む機能を選ぶ
      const partial = features.items.find(item => item.roles.length < 3)
      if (partial === undefined) throw new Error('担当外の工程を持つ機能がcontentに無い')
      renderDirectory()

      // 同じ名前の機能が並んでも取り違えないよう、日付も一致する行を選ぶ
      const item = within(sectionIn(panelOf(fullCareer), features.heading))
        .getAllByText(partial.name)
        .map(name => name.closest('li'))
        .find(row => row !== null && within(row).queryByText(partial.date) !== null)
      if (item === null || item === undefined) throw new Error('機能の行が無い')

      const labels = {
        design: ui.career.roleDesign,
        build: ui.career.roleBuild,
        release: ui.career.roleRelease,
      } as const
      for (const role of ['design', 'build', 'release'] as const) {
        const badge = within(item).getByText(labels[role])
        const expected = partial.roles.includes(role) ? ui.career.roleOwned : ui.career.roleNotOwned
        expect(badge.textContent).toBe(`${labels[role]}${expected}`)
      }
    })
  })
})

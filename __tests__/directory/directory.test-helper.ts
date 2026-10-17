// 一覧の統合テスト(__tests__/directory の下の *.integration.test.tsx)が共有する部品。
// container.fixture.ts が node で組んで provide した props と、そこから選んだ作品、カードの中を探す関数、
// ブラウザの環境の差し替えと戻し(各ファイルの beforeEach・afterEach が呼ぶ)を持つ。
// 差し替えるのはネットワーク(場面 SVG の取得)と時間(リールの自動送り)と、タッチ端末かどうかの問い合わせ1つだけ(理由は viewAsTouch の注釈)。
// 動きを控える設定は差し替えず、Chromium の模擬(CDP)で本物の media query を切り替える。
// 描く道具(@testing-library/react・react-dom)はここから import しない(npm run test:boundary)。
// 描いた物を外す cleanup は、各ファイルの afterEach が restoreEachTest より先に呼ぶ
import { inject } from 'vitest'
import { cdp, page } from 'vitest/browser'
import type { Work } from '@content/types/content'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import cardStyles from '@/components/Directory/components/WorkCard/work-card.module.css'
import shotStyles from '@/components/Directory/components/WorkCard/components/Shot/shot.module.css'
import type { DirectoryData } from './container.fixture'

export const directoryJa = inject('directoryJa')
export const directoryKo = inject('directoryKo')
export const { works, ui } = directoryJa

// カードだけを描くときの props。作品と、一覧の props の言語・文言を渡す。
// 番号は一覧の並び順で決まり(一覧の work-list.integration.test.tsx が見る)、カードの動きには関わらないので先頭(0)にする
export const cardProps = (work: Work, data: DirectoryData = directoryJa) => ({
  work,
  index: 0,
  locale: data.locale,
  ui: data.ui,
})

export const pickWork = (
  candidates: Work[],
  label: string,
  predicate: (work: Work) => boolean
): Work => {
  const found = candidates.find(predicate)
  if (found === undefined) throw new Error(`${label}作品がcontentに無い`)
  return found
}

// 詳細の開閉トグルを持つ作品
export const detailWork = pickWork(works, '詳細を持つ', work => work.detail !== undefined)
// 実操作デモ動画を持つ作品
export const videoWork = pickWork(works, '動画を持つ', work => work.video !== undefined)
// ストーリー場面をサムネイル枠で循環させる作品
export const reelWork = pickWork(
  works,
  'リールを持つ',
  work => work.storyReel === true && (work.story?.scenes.length ?? 0) > 0
)
export const reelScenes = reelWork.story?.scenes ?? []
// 動画もリールも持たず、静止画だけを持つ作品
export const stillWork = pickWork(
  works,
  '静止画だけを持つ',
  work => work.thumbnail !== undefined && work.video === undefined && work.storyReel !== true
)
// 公開ページとGitHubの両方を持ち、ストーリーは持たない作品(下部パネルのリンク)
export const linkWork = pickWork(
  works,
  '公開ページとGitHubを持ちストーリーを持たない',
  work => work.links.live !== undefined && work.links.repo !== undefined && work.story === undefined
)
// 公開ページとGitHubの両方を持ち、動き(動画・リール)を持たない作品。覆いのトリガーはマウスでもタッチでも出る
export const stillLinkWork = pickWork(
  works,
  '公開ページとGitHubを持つ動きの無い',
  work =>
    work.links.live !== undefined &&
    work.links.repo !== undefined &&
    work.video === undefined &&
    work.storyReel !== true
)
// 公開ページとGitHubの両方を持ち、動画を持つ作品。マウスでは全面トグル、タッチでは覆いの中の一時停止ボタンが出る
export const motionLinkWork = pickWork(
  works,
  '公開ページとGitHubを持つ動画の',
  work => work.links.live !== undefined && work.links.repo !== undefined && work.video !== undefined
)
// 外部リンクを持たず、ストーリーだけを持つ作品(覆いはストーリーへの入口1つになる)
export const isStoryOnly = (work: Work) =>
  work.links.live === undefined && work.links.repo === undefined && work.story !== undefined

export const queryOrThrow = (root: HTMLElement, selector: string): HTMLElement => {
  const element = root.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`${selector}が描かれていない`)
  return element
}

export const videoIn = (root: HTMLElement): HTMLVideoElement => {
  const video = root.querySelector('video')
  if (video === null) throw new Error('動画が描かれていない')
  return video
}

// カードは <article id="<slug>"> で描かれる。詳細の開閉・一時停止などはカードごとに同じ名前で並ぶので、カードの中で探す
export const cardOf = (work: Work): HTMLElement => {
  const card = document.getElementById(work.slug)
  if (card === null || card.tagName !== 'ARTICLE') {
    throw new Error(`${work.slug}のカードが描かれていない`)
  }
  return card
}

// 画面キャプチャの枠。リンクの覆いが外側の押下を判定する基準でもある
export const shotOf = (work: Work) => queryOrThrow(cardOf(work), `.${shotStyles.shot}`)
// 事実のパネル(仕様表・タグ・リンク)。下部パネルのリンクはこの中に並ぶ
export const factPanelOf = (work: Work) => queryOrThrow(cardOf(work), `.${cardStyles.panel}`)

// 最初の画面の外から始めるカードの置き場。上に画面の高さの2倍の余白を取り、中に描いたカードを画面の外へ押し出す。
// 一覧では狭い画面で左列(プロフィール)が上に積まれてカードが最初の画面の外に出るが、カードだけを描くときはこの余白が代わりをする。
// 置き場は body の直下に置くので、描いた後の cleanup(Testing Library)が置き場ごと外す
export const belowFold = (): HTMLElement => {
  const container = document.createElement('div')
  container.style.paddingTop = '200vh'
  document.body.append(container)
  return container
}

const NO_NETWORK = 'テストでは通信しない'
// カードのフックが問う「ホバーできる細かいポインタか」(use-card-motion.ts)
const FINE_POINTER = '(hover: hover) and (pointer: fine)'

// タッチ端末として見る。カードのフックが問う FINE_POINTER だけを「いいえ」と答え、ほかの問い合わせは本物へ渡す。
// Chromium のタッチの模擬(CDP の Emulation.setTouchEmulationEnabled)は使わない — 切った後もポインタもホバーも
// 無い端末のまま戻らず(2026-10-14 の実測)、同じページで続くテスト(村の枠の読み上げ名はポインタで変わる)へ漏れる。
// CSS の @media は本物のマウスのまま(ホバーで覆いが出て、動画カードの覆いは押下を通さない)なので、
// 覆いに重なるボタンはキーボードで押す
export const viewAsTouch = () => {
  const realMatchMedia = window.matchMedia.bind(window)
  vi.stubGlobal('matchMedia', (query: string) =>
    realMatchMedia(query === FINE_POINTER ? 'not all' : query)
  )
}

// 動きを控える設定にする。CSS の @media もフックの matchMedia も本物のまま切り替わる。戻すのは restoreEachTest
let isMediaEmulated = false
export const preferReducedMotion = async () => {
  isMediaEmulated = true
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
}

// 場面 SVG の取得を、テストが手放すまで返さずに留める。手放すと失敗で返す。
// 失敗した取得は取得の覚え(src/lib/fetch-svg-source.ts)から消えるので、次のテストは空の覚えから始まる
const heldFetches: Array<(reason: Error) => void> = []
export const releaseSceneFetches = () => {
  for (const reject of heldFetches.splice(0)) reject(new Error(NO_NETWORK))
}
export const holdSceneFetches = () => {
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
export const intersectionSettled = (target: Element) =>
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
export const settleNotice = async (frames = 5): Promise<void> => {
  if (frames === 0) return
  await nextFrame()
  await settleNotice(frames - 1)
}

const originalUrl = window.location.href

// 各ファイルの beforeEach が呼ぶ。既定は PC の画面・マウス・動きを許す設定。各テストが必要な条件だけ替える
export const prepareEachTest = async () => {
  await page.viewport(1280, 720)
  // 外へ通信させない。リールは場面 SVG を取りに行き、取れない場面は準備中の文言に替わる
  vi.stubGlobal('fetch', () => Promise.reject(new Error(NO_NETWORK)))
}

// 各ファイルの afterEach が、描いた物を cleanup で外した後に呼ぶ(effect の後始末が差し替えた環境のまま走るように)
export const restoreEachTest = async () => {
  releaseSceneFetches()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', originalUrl)
  if (isMediaEmulated) {
    isMediaEmulated = false
    await cdp().send('Emulation.setEmulatedMedia', { features: [] })
  }
}

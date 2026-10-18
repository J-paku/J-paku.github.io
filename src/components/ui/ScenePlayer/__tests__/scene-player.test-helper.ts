// 場面再生(ScenePlayer)と場面SVG(SceneSvg)の統合テストが共通で使う、場面の組み立て・場面SVGの通信の差し替え・見え方の読み方。
// 差し替えるのは場面SVGの通信(fetch)だけ。描くのは各テストで、ここはコンポーネントを描く道具を import しない
import { expect, vi } from 'vitest'
import { page } from 'vitest/browser'
import type { WorkStoryScene } from '@content/types/content'

// 取れなかった場面に出す文言。この部品は渡された文字列をそのまま出すだけなので、テストの値を渡す
export const PLACEHOLDER = 'scene unavailable'

// 場面ごとの絵の中の文字。シャドウルートの中に絵が出たかを、この文字で見る
export const ART = ['first scene art', 'second scene art', 'third scene art']

// 場面SVGの原文。中の文字に動きを付け、一時停止で止まるかを見られるようにする
export const svgOf = (art: string) =>
  `<svg viewBox='0 0 402 874'><style>@keyframes drift { to { transform: translateX(8px) } } .anim { animation: drift 2s linear infinite }</style><text class='anim' x='16' y='40'>${art}</text></svg>`

// 取得の覚え(src/lib/fetch-svg-source.ts)は URL ごとにモジュールの中へ残り、テストをまたいで効く。
// テストごとに別の URL を振り、前のテストが取った原文を引き継がないようにする
let round = 0
export const makeScenes = (): WorkStoryScene[] => {
  round += 1
  return ART.map((art, index) => ({
    id: `scene-${index + 1}`,
    title: art,
    body: art,
    chips: [],
    image: `/scene-player-test/${round}/scene-${index + 1}.svg`,
  }))
}

// 場面ごとの応答。ok は原文、unavailable は 503、offline は通信そのものの失敗
type Reply = 'ok' | 'unavailable' | 'offline'

// 場面SVGの取得を差し替え、問い合わせた URL を順に記録して返す。場面の外への問い合わせは断る。
// arts は場面の順に返す絵の文字(既定は ART)
export const stubSceneFetch = (
  scenes: WorkStoryScene[],
  replies: Record<string, Reply> = {},
  arts: string[] = ART
) => {
  const requested: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const { pathname } = new URL(new Request(input).url)
      requested.push(pathname)
      const index = scenes.findIndex(scene => scene.image === pathname)
      if (index === -1) throw new TypeError(`外への問い合わせは断る: ${pathname}`)
      const reply = replies[scenes[index].id] ?? 'ok'
      if (reply === 'offline') throw new TypeError('Failed to fetch')
      if (reply === 'unavailable') return new Response('unavailable', { status: 503 })
      return new Response(svgOf(arts[index]), { headers: { 'content-type': 'image/svg+xml' } })
    })
  )
  return requested
}

export const artOf = (art: string) => page.getByText(art, { exact: true })
export const placeholders = () => page.getByText(PLACEHOLDER, { exact: true })

// 利用者に見えているか。クロスフェードは opacity だけで切り替える(見せない場面も DOM に残す)ので、
// opacity 0 の場面も見えないものとして数える
export const isShown = (element: Element) => element.checkVisibility({ opacityProperty: true })

// 今見えている場面の絵(取れていない場面は絵が無いので数えない)
export const shownArt = () =>
  ART.filter(art => {
    const element = artOf(art).query()
    return element !== null && isShown(element)
  })

export const waitForArt = async (arts: string[]) => {
  for (const art of arts) await expect.element(artOf(art)).toBeInTheDocument()
}

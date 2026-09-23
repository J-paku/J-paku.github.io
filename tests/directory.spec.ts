// 一覧(/list/)の作品カードの E2E。不変ルール5「詳細ページを持たない作品はカードにリンクを
// 付けず、slug 直接アクセスは NotFound」の、実データで確かめられる側を押さえる。
//
// wip(status: 'wip')の作品は 2026-09-23 時点の content/{ja,ko}/works に 1 件も無い
// (3件とも published)。だから wip バッジそのものはここでは確かめられない。代わりに
// 「詳細ページを持たない作品」= story を持たない公開作品で、同じ2つの帰結
// (内部リンクを持たない・slug 直接アクセスで作品ページが出ない)を見る。
// wip を足したときは、その slug を下の NO_DETAIL_SLUGS へ入れれば同じ検査がそのまま効く
import { expect } from '@playwright/test'
// 天気を既定で晴れに固定した test を使う(他の spec と同じ土台に乗せる)。正本は village.helpers.ts
import { test } from './village.helpers'

// 作品の内訳。期待値を content/ から作らない — 検査対象で検査対象を測っても何も証明できないため、
// 実ブラウザで見た今の姿をそのまま書く。
// ★ 作品を足す・story を付ける/外すときは、この2つの表も一緒に直す
const DETAIL_SLUGS = ['meishi-cross-platform']
const NO_DETAIL_SLUGS = ['ai-harness', 'seatmap-demo']
const ALL_SLUGS = [...DETAIL_SLUGS, ...NO_DETAIL_SLUGS]

// カードは <article id="<slug>"> で並ぶ(WorkCard が slug をそのまま id にする)
const CARDS = '#works article'

const JOURNEYS = ['', '/ko']

for (const prefix of JOURNEYS) {
  const label = prefix === '' ? '/' : prefix

  test(`一覧のカードは詳細ページを持つ作品にだけ内部リンクを張る (${label})`, async ({ page }) => {
    await page.goto(`${prefix}/list/`)

    const cards = page.locator(CARDS)
    // 枚数を先に固定する。カードが消えていると「リンクを持つカードが1枚も無い」が
    // そのまま通ってしまい、何も証明しない検査になる
    await expect(cards, '表どおりの枚数のカードが並ぶ').toHaveCount(ALL_SLUGS.length)
    for (const slug of ALL_SLUGS) {
      await expect(page.locator(`${CARDS}#${slug}`), `${slug} のカードが一覧にある`).toHaveCount(1)
    }

    // 内部リンク = 自分の言語の /works/ 配下を指す href。外部の live / repo リンクは
    // 絶対 URL なのでここには入らない(ja のカードの '/works/…' は '/ko/works/' で始まらない)
    const linked = await cards.evaluateAll(
      (nodes, base) =>
        nodes
          .filter(node =>
            Array.from(node.querySelectorAll('a')).some(anchor => {
              const href = anchor.getAttribute('href')
              return href !== null && href.startsWith(base)
            })
          )
          .map(node => node.id),
      `${prefix}/works/`
    )

    expect([...linked].sort(), '詳細ページを持つ作品だけが内部リンクを持つ').toEqual(
      [...DETAIL_SLUGS].sort()
    )
  })

  test(`詳細ページを持つ作品だけが slug 直接アクセスで開く (${label})`, async ({ page }) => {
    // 6経路ぶん読み込み直すので既定の30秒では足りない回がある
    test.setTimeout(60_000)

    for (const slug of DETAIL_SLUGS) {
      const response = await page.goto(`${prefix}/works/${slug}/`)
      if (response === null) throw new Error(`${slug} の応答が取れなかった`)
      // 「出ない側」だけを見ると、経路の綴りを間違えただけの検査でも全部 404 で通ってしまう。
      // 出る側を同じ形で1本通して、経路の組み立てが正しいことを先に示す
      expect(response.status(), `${slug} の詳細ページは配信されている`).toBe(200)
      await expect(page.locator('main h1'), `${slug} の作品ページが描かれる`).toBeVisible()
    }

    for (const slug of NO_DETAIL_SLUGS) {
      const response = await page.goto(`${prefix}/works/${slug}/`)
      if (response === null) throw new Error(`${slug} の応答が取れなかった`)
      expect(response.status(), `${slug} の詳細ページは配信されていない`).toBe(404)
      // 応答コードだけだと、200 で空の器を返す形へ変わったときに取り逃がす。
      // 404.html は React を通さない素の HTML なので <main> を持たない
      await expect(page.locator('main'), `${slug} で作品ページは描かれない`).toHaveCount(0)
      await expect(page.locator('section[lang="ja"] h1'), '404 の案内が出る').toBeVisible()
    }
  })
}

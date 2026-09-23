// 404 の E2E。これまで out/404.html はブラウザで一度も開かれず、scripts/verify-export.mjs が
// lang="ja" / lang="ko" という文字列の有無を見ているだけだった。ここでは配信が実際に返す
// 応答コードと、二言語ぶんの案内がそろっていること、そこから村と一覧へ戻る導線が本当に動くことを見る。
// out/404.html の中身は React ではなく public/404.html の素の HTML(next build が英語の
// _not-found で上書きするのを verify-export が戻す)
import { expect } from '@playwright/test'
import { ui as uiJa } from '@content/ja/ui'
import { ui as uiKo } from '@content/ko/ui'
// 天気を既定で晴れに固定した test を使う(村へ戻る導線で村を開くため)。正本は village.helpers.ts
import { focusVillage, test } from './village.helpers'

// 存在しない経路。静的配信(GitHub Pages も手元の serve も)は out/ に該当ファイルが無ければ
// out/404.html を 404 で返すので、どの入口から外れても同じ1枚に落ちる。
// 言語の入口ごと・作品の経路ごとに1本ずつ置く — 作品の経路だけ別の受けに変わる改修を取り逃がさないため
const MISSING_PATHS = ['/no-such-page/', '/ko/no-such-page/', '/works/no-such-slug/']

// 言語ごとの区画。404.html は React を通さないので lang 属性そのものが取っ手になる
const JA_SECTION = 'section[lang="ja"]'
const KO_SECTION = 'section[lang="ko"]'

// 404 から戻る導線。区画ごとに行き先が違うので、区画を指定してから辿る。
// 利用者が見るのは文言なので、リンクは文言(アクセシブルネーム)で指し、行き先の href は別に突き合わせる。
// href で指すと、文言の取り違え(一覧と村の入れ替わり)を見逃し、行き先の誤りはクリック待ちの
// タイムアウトでしか落ちない。文言は content/ に無い(404.html だけの文字列)ので、ここに写しを置く
const RETURNS = [
  {
    section: JA_SECTION,
    locale: 'ja',
    village: { name: 'マップで見る', href: '/' },
    list: { name: '一覧で見る', href: '/list/' },
  },
  {
    section: KO_SECTION,
    locale: 'ko',
    village: { name: '마을로 보기', href: '/ko/' },
    list: { name: '웹으로 보기', href: '/ko/list/' },
  },
] as const

// 遷移先の経路。toHaveURL へ素の文字列を渡すと '/' が '/list/' にも当たってしまうので、
// 実際の URL から取り出した pathname を完全一致で突き合わせる
const pathnameOf = (url: string) => new URL(url).pathname

for (const target of MISSING_PATHS) {
  test(`存在しない経路 ${target} は 404 応答で二言語の案内を返す`, async ({ page }) => {
    const response = await page.goto(target)
    if (response === null) throw new Error(`${target} の応答が取れなかった`)

    // 200 で返すと、検索エンジンにも配信の検査スクリプト(応答コードで消えた経路を落とす作り)にも
    // 「在るページ」に見える。中身が 404 の案内であることと応答コードは別々に確かめる
    expect(response.status(), '配信が 404 を返す').toBe(404)

    // 片方の言語だけになっていないこと。文言は content/ の ui.notFound と同じものを出す約束なので、
    // 404.html だけ古い文言のまま取り残されたらここで落ちる
    await expect(page.locator(`${JA_SECTION} h1`), '日本語の見出しが出る').toHaveText(
      uiJa.notFound.title
    )
    await expect(page.locator(`${KO_SECTION} h1`), '韓国語の見出しが出る').toHaveText(
      uiKo.notFound.title
    )
    await expect(page.locator(JA_SECTION), '日本語の本文が出る').toContainText(uiJa.notFound.body)
    await expect(page.locator(KO_SECTION), '韓国語の本文が出る').toContainText(uiKo.notFound.body)
  })
}

for (const { section, locale, village, list } of RETURNS) {
  test(`404 の ${locale} の案内からマップへ戻ると村が開く`, async ({ page }) => {
    await page.goto('/no-such-page/')
    const link = page.locator(section).getByRole('link', { name: village.name, exact: true })
    // 文言と行き先の組を押す前に確かめる。入れ替わりや別の言語への行き先はここで名前付きで落ちる
    await expect(link, 'マップへ戻るリンクがマップの経路を指す').toHaveAttribute(
      'href',
      village.href
    )
    await link.click()

    // ブート演出が終わるところまで見る。経路が合っていても村が立ち上がらなければ戻れていない
    await focusVillage(page)
    await expect(page.locator('[data-village]')).toBeVisible()
    // 言語の取り違え(ko の案内から ja の村へ出てしまう等)をここで落とす
    await expect(page.locator('html'), 'その言語の村へ着く').toHaveAttribute('lang', locale)
    expect(pathnameOf(page.url()), 'マップの経路へ移る').toBe(village.href)
  })

  test(`404 の ${locale} の案内から一覧へ戻ると作品一覧が開く`, async ({ page }) => {
    await page.goto('/no-such-page/')
    const link = page.locator(section).getByRole('link', { name: list.name, exact: true })
    await expect(link, '一覧へ戻るリンクが一覧の経路を指す').toHaveAttribute('href', list.href)
    await link.click()

    await expect(page.locator('#works'), '作品一覧が出る').toBeVisible()
    await expect(page.locator('html'), 'その言語の一覧へ着く').toHaveAttribute('lang', locale)
    expect(pathnameOf(page.url()), '一覧の経路へ移る').toBe(list.href)
  })
}

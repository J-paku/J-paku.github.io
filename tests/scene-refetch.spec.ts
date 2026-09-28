// 作品ストーリーの場面の絵の取り直しの E2E。場面 SVG は src/lib/fetch-svg-source.ts が URL ごとに取得の
// Promise を覚え、失敗した時だけその覚えを捨てる。覚えはモジュール変数なので、ページを読み込み直すと
// 失敗の覚えも一緒に消え、「失敗が残って二度と出ない」不具合は再読み込みでは見えない。
// そこで同じページの中で開き直す。
// 場面を並べる ScenePlayer は、一度失敗した場面をその部品が消えるまでプレースホルダの文字のまま留め、
// 取り直さない。全画面モーダルは閉じると部品ごと消え、開くたびに新しく作られるので、
// 「開き直すと取り直して絵が出るか」はこのモーダルで確かめられる。
// 覚えそのものの振る舞い(失敗は捨てる・成功は覚える・取得中は待ち合わせる)は
// src/lib/fetch-svg-source.test.ts が見る。言語に依らないので ja だけで見る
import { expect, type Locator } from '@playwright/test'
import { ui } from '@content/ja/ui'
import { meishiCrossPlatform } from '@content/ja/works/meishi-cross-platform'
// 天気を既定で晴れに固定した test を使う(他の spec と同じ土台に乗せる)。正本は village.helpers.ts
import { test } from './village.helpers'

const scenes = meishiCrossPlatform.story?.scenes ?? []
const firstScene = scenes[0]
if (firstScene === undefined) throw new Error('名刺登録アプリの作品に場面が無い')

// 場面 1 の絵は、最初のこの回数だけ 503 で落とす。それより後は配信物をそのまま返す。
// 1 回目はページを開いた時のイントロのプレビュー、2 回目は最初に開いたモーダルが取りに行く分
const FAILED_REQUESTS = 2

// モーダルの中で、シャドウルートに <svg> が展開された場面の数。SceneSvg は取った原文を
// シャドウルートへ流し込み、失敗した場面は ScenePlayer がプレースホルダの文字に差し替える
const scenesWithSvg = (dialog: Locator) =>
  dialog.evaluate(root => {
    let count = 0
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot?.querySelector('svg')) count += 1
    }
    return count
  })

test('場面の絵の取得に失敗しても、モーダルを開き直すと取り直して絵が出る', async ({ page }) => {
  let requests = 0
  await page.route(
    url => url.pathname === firstScene.image,
    route => {
      requests += 1
      if (requests <= FAILED_REQUESTS) {
        return route.fulfill({ status: 503, contentType: 'text/plain', body: 'unavailable' })
      }
      return route.continue()
    }
  )
  await page.goto(`/works/${meishiCrossPlatform.slug}/`)
  // イントロの小さなプレビュー。本文の後ろの CTA と同じ名前のボタンで、DOM ではこちらが先に並ぶ。
  // 開いた時点で全場面を取りに行き、場面 1 は 1 回目の失敗でプレースホルダになる
  const preview = page.getByRole('button', { name: ui.workStory.viewScene }).first()
  const dialog = page.getByRole('dialog')
  const close = dialog.getByRole('button', { name: ui.workStory.close })
  await expect(preview).toContainText(ui.work.shotPlaceholder)
  expect(requests).toBe(1)

  // 最初に開いたモーダルは場面 1 を取り直す。2 回目も失敗させるので、ここもプレースホルダになる
  await preview.click()
  await expect(dialog).toContainText(ui.work.shotPlaceholder)
  expect(requests, 'モーダルは前の失敗を引き継がず取り直す').toBe(2)
  await close.click()
  await expect(dialog).toHaveCount(0)

  // 開き直すと取り直しが通り、全場面の絵がシャドウルートに出る
  await preview.click()
  await expect(dialog).toBeVisible()
  await expect
    .poll(() => scenesWithSvg(dialog), { message: '全場面の絵がシャドウルートに出る' })
    .toBe(scenes.length)
  await expect(dialog).not.toContainText(ui.work.shotPlaceholder)
  expect(requests, '失敗した後の取り直しは 1 回だけ').toBe(3)
  await close.click()
  await expect(dialog).toHaveCount(0)

  // 成功した絵は覚えているので、もう一度開いても取りに行かずに出る
  await preview.click()
  await expect(dialog).toBeVisible()
  await expect.poll(() => scenesWithSvg(dialog)).toBe(scenes.length)
  expect(requests, '成功した絵は取り直さない').toBe(3)
})

// 村の舞台レイアウト E2E。ko の文言でも、PC で一覧への出口が右下に固定されるかを見る。
// 舞台の寸法(PC・縦持ち・横持ち・タブレットの枠のマスと操作帯の配置)と ja の出口の配置は、
// 村の統合テスト(__tests__/village-page/village.integration.test.tsx)が見る。統合のフィクスチャは ja の props だけを
// 渡すので、ko の出口だけをここに残す(docs/decisions/0018-move-e2e-and-gate-all-hooks.md)。
// useStageScale が --cell を実測で書いてから測る
import { expect, type Page } from '@playwright/test'
// 村の E2E で共用する test。context に既定で晴れの応答を敷き、舞台を開いた時の天気の問い合わせを
// 実ネットワークへ出さない。正本は village.helpers.ts
import { test } from './village.helpers'

// ブート演出が消え、useStageScale が舞台の実測を --cell に書き込むまで待つ。
// CSS の既定値だけでも近い寸法になるため、インライン変数の有無で JS 側の実行を確かめる
const waitForStage = async (page: Page, path = '/') => {
  await page.goto(path)
  await page.waitForSelector('#boot', { state: 'detached', timeout: 5_000 })
  await page.waitForFunction(() => {
    const frame = document.querySelector('[data-village]')
    const root = frame?.closest<HTMLElement>('[style*="--cols"]')
    return root instanceof HTMLElement && root.style.getPropertyValue('--cell') !== ''
  })
}

const box = async (page: Page, selector: string) => {
  const rect = await page.locator(selector).boundingBox()
  if (rect === null) throw new Error(`${selector} が描かれていない`)
  return rect
}

// ko も同じ舞台レイアウトになることの最小確認(ロケール別のレイアウト崩れが無いか)。ja は統合テストが見る
for (const path of ['/ko/']) {
  test(`PC: 一覧への出口は右下に固定される (${path})`, async ({ page }) => {
    await waitForStage(page, path)
    const viewport = page.viewportSize()
    if (viewport === null) throw new Error('viewport 未設定')
    const exit = await box(page, '[data-village-exit]')
    const frame = await box(page, '[data-village]')
    expect(exit.x + exit.width).toBeLessThanOrEqual(viewport.width - 8)
    expect(exit.y + exit.height).toBeLessThanOrEqual(viewport.height - 8)
    expect(exit.y).toBeGreaterThan(frame.y + frame.height / 2)
    expect(exit.width).toBeLessThan(frame.width / 2)
  })
}

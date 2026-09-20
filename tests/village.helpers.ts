// 村を動かす E2E の共通手順。journey.spec と day-night.spec の両方がここから読む。
// Playwright が集めるのは testDir 直下の *.spec.ts / *.test.ts だけなので、この名前なら
// テスト本体として拾われない(中身に test() が無いので拾われると「テストが無い」で落ちる)。
// 部屋から町へ出る leaveRoom は 2 本で歩き方も確かめることも違うため、各 spec に置いたままにする
import type { Page } from '@playwright/test'

// 短押しは旋回だけ(TURN_MS 64ms)。旋回を越えて 1 マス分の移動を始めるまで押し、
// 始まった移動は離しても最後まで進む(CELL_MS 256ms)ので到着を待ってから次の 1 マスへ
export const HOLD_MS = 150
export const SETTLE_MS = 320

// ブート演出が消えるまで待ち、キー操作を受け取る村の枠へフォーカスする。
// 操作帯のスティックも role=application なので data-village で枠を指す
export const focusVillage = async (page: Page) => {
  await page.waitForSelector('#boot', { state: 'detached', timeout: 5_000 })
  await page.locator('[data-village]').focus()
}

export const openVillage = async (page: Page, prefix: string) => {
  await page.goto(`${prefix}/`)
  await focusVillage(page)
}

// 到着で新しい文言が出ると、Google Fonts の未取得サブセットがその場で読み込まれ、届いた瞬間に
// 舞台全体が再描画される。シートが SVG だった頃はこれで主スレッドが 244ms 止まり(ja の町到着で実測)、
// その間に押したキーは down/up が同じ隙間に落ちて旋回すら起きなかった。PNG 化で再描画は数 ms に
// なったが、遅いランナーでも同じ形で落ちないよう、書体が届いてその再描画が終わる
// (rAF 2 回 = 次フレームの描画完了後)まで待ってから次の入力へ進む
export const settleRender = (page: Page) =>
  page.evaluate(() =>
    document.fonts.ready.then(
      () =>
        new Promise<void>(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )
  )

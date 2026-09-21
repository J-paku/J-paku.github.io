// 村を動かす E2E の共通手順。村を開く・歩く・描画を待つ・天気を固定する、を各 spec がここから読む。
// Playwright が集めるのは testDir 直下の *.spec.ts / *.test.ts だけなので、この名前なら
// テスト本体として拾われない(中身は test を extend して渡すだけで test() を呼ばないので、
// 拾われると「テストが無い」で落ちる)。
// 部屋から町へ出る leaveRoom は spec ごとに歩き方も確かめることも違うため、各 spec に置いたままにする
import { errors, test as base, type BrowserContext, type Page } from '@playwright/test'
import { worldSet } from '@content/world'

// 短押しは旋回だけ(TURN_MS 64ms)。旋回を越えて 1 マス分の移動を始めるまで押し、
// 始まった移動は離しても最後まで進む(CELL_MS 256ms)ので到着を待ってから次の 1 マスへ。
// SETTLE_MS は離してから到着を待つ上限。旋回から始めても押してから 64 + 256ms 余りで着くので、
// これを過ぎても着かない回は、ぶつかって向きだけ変わった(= 進めなかった)とみなす
export const HOLD_MS = 150
export const SETTLE_MS = 320

// 位置の保存先。src/lib/preferences.ts の readPosition / writePosition と同じ組み立て
const POSITION_KEY = `village:${worldSet.id}:pos`

// Open-Meteo の問い合わせ先。src/lib/weather.ts が組み立てる URL の頭
const OPEN_METEO = 'https://api.open-meteo.com/**'

// 差し替える天気。error は失敗応答(500)で、村はそれを「降らない」に丸める
export type WeatherKind = 'clear' | 'rain' | 'error'

export type WeatherStub = { calls: () => number }

// 応答の形は src/lib/weather.ts の isOpenMeteoResponse が受け付けるもの。
// 降雪が 0 で降水が 0 より大きければ雨、両方 0 なら降らない
type CurrentWeather = { precipitation: number; snowfall: number }
const CURRENT: Record<Exclude<WeatherKind, 'error'>, CurrentWeather> = {
  clear: { precipitation: 0, snowfall: 0 },
  rain: { precipitation: 2.4, snowfall: 0 },
}

// Open-Meteo をテストの外へ出さず、決めた天気を返す。page にも context にも敷ける。
// 同じ URL に route が重なると後から敷いた方が勝ち、page の route は context の route より先に効く。
// なので下の test が context へ敷く既定の晴れは、spec が page へ敷いた天気で必ず上書きされる。
// 戻り値の calls() は実際に問い合わせが届いた回数。応答前に数えて空振りするのを防ぐのに使う
export const stubWeather = async (
  target: Page | BrowserContext,
  kind: WeatherKind
): Promise<WeatherStub> => {
  let calls = 0
  await target.route(OPEN_METEO, route => {
    calls += 1
    if (kind === 'error') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ current: CURRENT[kind] }),
    })
  })
  return { calls: () => calls }
}

// 村の E2E が使う test。どの context にも既定で晴れの応答を敷くので、CI を回した時刻の
// 実際の天気に結果が左右されず、外部 API の応答も待たない。天気そのものを確かめる spec は
// stubWeather(page, 'rain') などで上書きする
export const test = base.extend({
  // 渡す関数は Playwright の慣例では use と呼ぶが、React の Hook 規則(rules-of-hooks)に
  // 誤って拾われるので別名にする。位置で受け取る引数なので名前を変えても働きは同じ
  context: async ({ context }, provide) => {
    await stubWeather(context, 'clear')
    await provide(context)
  },
})

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

export type WalkKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

// 保存された位置が before から変わるまで待つ。位置は到着したマスでだけ書かれる(ぶつかった時・
// 向きだけ変えた時は書かれない)ので、変わったら 1 マス歩き終えたと分かる。描画ループではなく
// 保存を見るので、止まっている間は描画ループを休ませる作りでも判定は変わらない。
// SETTLE_MS を過ぎても変わらなければ進めなかったとみなして false を返す(ここでは落とさない)。
// timeout に 0 を渡すと Playwright は「上限なし」と解釈するので、SETTLE_MS を 0 にしてはいけない
const waitForArrival = async (page: Page, before: string | null): Promise<boolean> => {
  try {
    await page.waitForFunction(
      ([key, previous]) => sessionStorage.getItem(key) !== previous,
      [POSITION_KEY, before] as const,
      { polling: 'raf', timeout: SETTLE_MS }
    )
    return true
  } catch (error) {
    if (error instanceof errors.TimeoutError) return false
    throw error
  }
}

// 方向キーで cells マス歩く。1 マスごとに押して離し、到着(保存位置の変化)を待ってから次へ進む。
// 戻り値は実際に到着したマス数。cells と同じなら全部歩けた、少なければどこかで阻まれた
// (壁や水へ向きを変えただけの 1 回は数えない)
export const walk = async (page: Page, key: WalkKey, cells: number): Promise<number> => {
  let arrived = 0
  for (let i = 0; i < cells; i += 1) {
    const before = await page.evaluate(name => sessionStorage.getItem(name), POSITION_KEY)
    await page.keyboard.down(key)
    await page.waitForTimeout(HOLD_MS)
    await page.keyboard.up(key)
    if (await waitForArrival(page, before)) {
      arrived += 1
      // 到着と同じフレームで積まれた React の更新が描かれ、新しい文言のレイアウトで書体の読み込みが
      // 始まるまで 2 フレーム待つ。すぐに settleRender へ進むと、読み込みが始まる前の(解決済みの)
      // fonts.ready を見て通り抜ける。固定待ちの頃は到着から settleRender まで 130ms 以上空いていた
      await page.evaluate(
        () =>
          new Promise<void>(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          })
      )
    }
    await settleRender(page)
  }
  return arrived
}

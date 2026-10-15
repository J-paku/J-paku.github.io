// 村を動かす E2E の共通手順。村を開く・歩く・押す・部屋から町へ出る・描画を待つ・主人公の描かれた位置を測る・
// 保存された現在地を読む・歩行ループの眠りを待つ・天気を固定する、を各 spec がここから読む。
// Playwright が集めるのは testDir 直下の *.spec.ts / *.test.ts だけなので、この名前なら
// テスト本体として拾われない(中身は test を extend して渡すだけで test() を呼ばないので、
// 拾われると「テストが無い」で落ちる)。
// 部屋から町へ出る leaveRoom は開始マスから下へ 3 マス歩く形だけをここに置く。時計の前から出る clock.spec は、
// 歩き方が違うので spec に置いたままにする
import { errors, expect, test as base, type BrowserContext, type Page } from '@playwright/test'
import { worldSet } from '@content/world'

// 短押しは旋回だけ(TURN_MS 64ms)。旋回を越えて 1 マス分の移動を始めるまで押し、
// 始まった移動は離しても最後まで進む(CELL_MS 256ms)ので到着を待ってから次の 1 マスへ。
// SETTLE_MS は離してから到着を待つ上限。旋回から始めても押してから 64 + 256ms 余りで着くので、
// これを過ぎても着かない回は、ぶつかって向きだけ変わった(= 進めなかった)とみなす
export const HOLD_MS = 150
export const SETTLE_MS = 320

// 遅いランナーでは描画とタイマーの発火が少し後ろへずれる。待ち時間の定数にこの分だけ上乗せする
export const SLACK_MS = 3_000

// 位置の保存先。src/lib/preferences.ts の readPosition / writePosition と同じ組み立て
export const POS_KEY = `village:${worldSet.id}:pos`

// 昼(JST 12:00)の瞬間。村は訪問者のタイムゾーンを見ず、常に大阪時刻(JST = UTC+9 固定)で段階を決めるので
// UTC の瞬間だけを固定すれば足りる。JST 2026-09-20 12:00 = 昼の帯(7時〜17時)。時計を止める・固定する spec が
// 昼から始めるのに使う(day-night.spec の PHASE_CLOCKS の day と同じ瞬間)
export const NOON_JST = '2026-09-20T03:00:00Z'

// Open-Meteo の問い合わせ先。src/lib/weather.ts が組み立てる URL の頭
const OPEN_METEO = 'https://api.open-meteo.com/**'

// 差し替える天気。error は失敗応答(500)で、村はそれを「降らない」に丸める
export type WeatherKind = 'clear' | 'rain' | 'snow' | 'error'

export type WeatherStub = { calls: () => number }

// 応答の形は src/lib/weather.ts の isOpenMeteoResponse が受け付けるもの。
// 判定は降雪が先で、降雪が 0 より大きければ雪、そうでなく降水が 0 より大きければ雨、両方 0 なら降らない
type CurrentWeather = { precipitation: number; snowfall: number }
const CURRENT: Record<Exclude<WeatherKind, 'error'>, CurrentWeather> = {
  clear: { precipitation: 0, snowfall: 0 },
  rain: { precipitation: 2.4, snowfall: 0 },
  // 雪は降水にも 0 より大きい値を載せる。降雪を先に見る判定(weather.ts)が落ちたとき、
  // 同じ応答が「何も降らない」ではなく「雨」に化けるので、雪の検査が取り違えを突ける。
  // 降水を 0 にすると判定が壊れても層が 0 枚になるだけで、雨との入れ違いを見逃す
  snow: { precipitation: 1.2, snowfall: 0.8 },
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
      [POS_KEY, before] as const,
      { polling: 'raf', timeout: SETTLE_MS }
    )
    return true
  } catch (error) {
    if (error instanceof errors.TimeoutError) return false
    throw error
  }
}

// 次のフレームの描画が終わるまで待つ(rAF 2 回)。rAF で読まれる入力(スティックの向き・押しているキー)を
// 倒した・離した後に挟めば、少なくとも 1 フレームがその状態を読んでいる
export const waitTwoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )

// 方向キーで cells マス歩く。1 マスごとに押して離し、到着(保存位置の変化)を待ってから次へ進む。
// 戻り値は実際に到着したマス数。cells と同じなら全部歩けた、少なければどこかで阻まれた
// (壁や水へ向きを変えただけの 1 回は数えない)
export const walk = async (page: Page, key: WalkKey, cells: number): Promise<number> => {
  let arrived = 0
  for (let i = 0; i < cells; i += 1) {
    const before = await page.evaluate(name => sessionStorage.getItem(name), POS_KEY)
    await page.keyboard.down(key)
    await page.waitForTimeout(HOLD_MS)
    await page.keyboard.up(key)
    if (await waitForArrival(page, before)) {
      arrived += 1
      // 到着と同じフレームで積まれた React の更新が描かれ、新しい文言のレイアウトで書体の読み込みが
      // 始まるまで 2 フレーム待つ。すぐに settleRender へ進むと、読み込みが始まる前の(解決済みの)
      // fonts.ready を見て通り抜ける。固定待ちの頃は到着から settleRender まで 130ms 以上空いていた
      await waitTwoFrames(page)
    }
    await settleRender(page)
  }
  return arrived
}

// 村は自室の開始マス (4,4) から始まる。下端の 1 マスのマット (4,7) へ下へ 3 マス歩いて乗ると、
// 町の自宅前 (14,12) へ下向きで出る
export const leaveRoom = async (page: Page) => {
  await walk(page, 'ArrowDown', 3)
}

// 方向キーを 1 マス分だけ押して離す(walk と同じ押し方。始まった移動は離しても最後まで進む)。
// walk と違って到着(保存位置の変化)も描画も待たない。保存で到着を知れない spec(保存を塞ぐ
// storage-blocked)が使う
export const press = async (page: Page, key: WalkKey) => {
  await page.keyboard.down(key)
  await page.waitForTimeout(HOLD_MS)
  await page.keyboard.up(key)
}

// 主人公が枠の中で何マス目に立って見えるか(左上が 0)。シートは縦 1.5 マスで頭が半マス上へはみ出すので、
// 足元(下辺)から数える。マス寸法は枠の幅(10 列)から出す。
// 位置は丸めずに返し、枠の箱とマス寸法も添える。叩く位置をここから組み立てる spec があり、
// 丸めると叩く所も近さの判定(toBeCloseTo)もずれるので、丸めるかどうかは使う spec が決める
export const playerOnScreen = async (page: Page) => {
  const frame = await page.locator('[data-village]').boundingBox()
  const player = await page.locator('[data-village-player]').boundingBox()
  if (frame === null || player === null) throw new Error('村の枠か主人公が描かれていない')
  const cell = frame.width / 10
  return {
    frame,
    cell,
    x: (player.x - frame.x) / cell,
    y: (player.y + player.height - frame.y) / cell - 1,
  }
}

// 保存された現在地(ワールドとマス)を読む。村は 2 ワールドなのでマスだけでは位置が決まらない。
// 保存は到着したマスとワープの先でだけ走るので、通れない所へぶつかった時はここの値が変わらない
export const readCell = (page: Page) =>
  page.evaluate(key => {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return null
    const saved = JSON.parse(raw) as { worldId: string; cell: { x: number; y: number } }
    return { worldId: saved.worldId, cell: saved.cell }
  }, POS_KEY)

// 歩行ループが眠るまで待つ。歩き終えてカメラが追い付き、時間で替わるコマが無くなれば眠る。
// 起きる時の印(running)は入力を受けたその場で書かれるので、入力の後に見れば前の眠りを読み違えない
export const expectLoopIdle = (page: Page) =>
  expect(page.locator('[data-village]')).toHaveAttribute('data-village-loop', 'idle', {
    timeout: SLACK_MS,
  })

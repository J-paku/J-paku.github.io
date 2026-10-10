// 自動移動の直線飛行の E2E。地図の地点・地図の別ワールドの地点・会話窓の「次へ」で、出発のマスから降りるマスまで
// 家や木の上を越えて直線で飛び、舞台のタップと動きを控える設定では今までどおり歩くことを、画面に描かれたものだけで見る。
// 時間・曲線・高さ・入力の錠の規則は src/lib/village/ の flight.ts・flight-curve.ts・movement.ts の単体テストが固める。
// ここが守るのはフック(配線)の側 — どの移動で飛ぶかを選び、飛ぶ間は毎フレーム影と主人公とカメラをその通りに描き、
// 飛び立ったら出発の地点の吹き出しを下ろし、飛ぶ間は窓を開かせず(歩く間の地図は開かせ)、降りたマスで到着を 1 回だけ走らせているか。
// 町の上端の近くでは、浮き上がりで絵が枠の上へ出ない高さまでしか浮かないか。
// フックには単体テストを置かないので、フックの配線は E2E が見張る。飛ぶ間の配線はこのファイルが受け持ち、
// 歩き・会話窓・地図(journey)、眠り(idle-loop)、傘(umbrella)の配線はそれぞれの spec が見る。
// 飛ぶ間は通り過ぎるマスで到着しない(保存位置が変わらない)ので、walk のように保存の変化では進み具合を測れない。
// ページの rAF で毎フレーム、影([data-flight-shadow])・主人公・ワールドの層の transform と箱、コマ・吹き出しと窓の数・
// 保存位置を写し取り、後から調べる。飛び方は言語に依らないので ja だけで見る
import { expect, type Locator, type Page } from '@playwright/test'
import type { Cell, World } from '@content/types/world'
import { worldSet } from '@content/world'
import { village as text } from '@content/ja/village'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・1 マス分だけ押す press・天気の差し替えと、既定で晴れを敷く test は
// 他の村の spec と共用。正本は village.helpers.ts
import { openVillage, test, walk } from './village.helpers'

// 位置の保存先。src/lib/preferences.ts の readPosition / writePosition と同じ組み立て
const POS_KEY = `village:${worldSet.id}:pos`
// 飛ぶ間に地上の位置へ落とす影。data-flying は飛んでいる間だけ 'true'、それ以外は 'false'
const SHADOW = '[data-flight-shadow]'
// 遅いランナーでは描画とタイマーの発火が後ろへずれる。待ち時間にこの分を上乗せする
const SLACK_MS = 3_000
// 自動移動が着くまでの上限。町を横切って飛んでも、扉を通って別ワールドの地点へ移っても収まる
const ARRIVE_MS = 10_000

// ---- 村のデータ ----

const worldOf = (id: string): World => {
  const world = worldSet.worlds[id]
  if (world === undefined) throw new Error(`worldSet に ${id} が無い`)
  return world
}
const town = worldOf('town')
const room = worldOf('room')

const spotCell = (world: World, id: string): Cell => {
  const spot = world.spots.find(s => s.id === id)
  if (spot === undefined) throw new Error(`${world.id} に地点 ${id} が無い`)
  return spot.cell
}

// 部屋の出口のマットと、そこから出た町の自宅前(飛ぶテストはここから飛び立つ)
const exitWarp = room.warps.find(w => w.target.worldId === town.id)
if (exitWarp === undefined) throw new Error('部屋に町へ出るマットが無い')
const TOWN_ENTRY = exitWarp.target.cell

// 地点の立ち位置。経歴碑は自宅前から真上寄りで、直線は自宅の屋根と壁の上を通る。
// 研究所は自宅前から右上で、横の差の方が大きい。名刺工房 → 研究所は次へで巡る順
const MONUMENT = spotCell(town, 'monument')

// ---- 村の操作 ----

// 保存された現在地(ワールドとマス)を読む
const readCell = (page: Page) =>
  page.evaluate(key => {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return null
    const saved = JSON.parse(raw) as { worldId: string; cell: { x: number; y: number } }
    return { worldId: saved.worldId, cell: saved.cell }
  }, POS_KEY)

// 村を開き、部屋の出口のマットまで歩いて町の自宅前へ出る
const goToTown = async (page: Page) => {
  await openVillage(page, '')
  expect(await walk(page, 'ArrowDown', 3), '部屋の出口のマットまで歩いて町へ出る').toBe(3)
  expect(await readCell(page)).toEqual({ worldId: town.id, cell: TOWN_ENTRY })
}

// 歩行ループが眠るまで待つ。降りてカメラが追い付き、時間で替わるコマが無くなれば眠る
const expectLoopIdle = (page: Page) =>
  expect(page.locator('[data-village]')).toHaveAttribute('data-village-loop', 'idle', {
    timeout: SLACK_MS,
  })

const openMap = async (page: Page): Promise<Locator> => {
  await page.keyboard.press('m')
  const map = page.getByRole('dialog')
  await expect(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
  return map
}

// 地図の地点の印。読み上げ名は text.fastTravel の {place} を地点名に置き換えたもの
const spotButton = (map: Locator, place: string) =>
  map.getByRole('button', { name: text.fastTravel.replace('{place}', place) })

// 影が飛んでいる印を出す(飛び立った)まで待つ
const waitForTakeOff = (page: Page) =>
  page.waitForFunction(
    selector => document.querySelector(selector)?.getAttribute('data-flying') === 'true',
    SHADOW,
    { polling: 'raf', timeout: SLACK_MS }
  )

// ---- 地図で同じワールドの遠い地点へ ----

test('影は飛ぶ間だけ画面に見え、飛ぶ前と降りた後は隠れる', async ({ page }) => {
  // data-flying の値ではなく見えるかどうかを見る。隠す規則(scene.module.css の visibility)が壊れたらここで落ちる
  const shadow = page.locator(SHADOW)
  await goToTown(page)
  await expect(shadow, '飛ぶ前の影').toBeHidden()
  const map = await openMap(page)
  await spotButton(map, text.stops.monument.place).click()
  await expect(map).toHaveCount(0)
  await waitForTakeOff(page)
  await expect(shadow, '飛ぶ間の影').toBeVisible()
  const atMonument = { worldId: town.id, cell: MONUMENT }
  await expect.poll(() => readCell(page), { timeout: ARRIVE_MS }).toEqual(atMonument)
  await expectLoopIdle(page)
  await expect(shadow, '降りた後の影').toBeHidden()
})

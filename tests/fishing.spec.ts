// 釣りの E2E。池のほとりで A(E)を押すと確認窓が出て、投げると水面に浮きが出て
// 会話窓が「……」→「何かがかかった!」→「経験を釣り上げた!」と変わり、巻物が跳ねてから
// 現職の機能が結果窓に出ることを ja/ko 双方で確かめる。
// 併せて「投げている間は歩けない」「水に背を向けていれば釣れない」「池の中へは踏み込めない」を見る。
// 既存の地点(経歴碑など)の回帰は journey.spec が持つので、ここでは繰り返さない
import { expect, test, type Page } from '@playwright/test'
import type { VillageText } from '@content/types/world'
import { worldSet } from '@content/world'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
// 段階ごとの待ち時間は lib 側の定数が正本。ここに秒数を書き写すと片方だけ動いた時に気付けない
import { FISHING_BITE_MS, FISHING_CAST_MS, FISHING_LAND_MS } from '@/lib/village/fishing'
// 村を開く手順・歩きの間合い・描画待ちは journey.spec と共用。正本は village.helpers.ts
import { HOLD_MS, SETTLE_MS, openVillage, settleRender } from './village.helpers'

type Journey = { prefix: string; text: VillageText }

// 遅いランナーでは描画とタイマーの発火が少し後ろへずれる。待ち時間の定数にこの分だけ上乗せする
const SLACK_MS = 3_000

const JOURNEYS: Journey[] = [
  { prefix: '', text: villageJa },
  { prefix: '/ko', text: villageKo },
]

// 位置の保存先は lib/preferences と同じ組み立て
const POS_KEY = `village:${worldSet.id}:pos`

// walk・readCell・leaveRoom は journey.spec にも同じ物がある。spec から import すると
// 向こうの test() ごと読み込まれて二重に登録されるので、共有せずここへ写している
// (village.helpers.ts は test() を持たないので import してよい)

// 方向キーを 1 マス分だけ押し、到着まで待ってから次の 1 マスへ進む
const walk = async (page: Page, key: string, cells: number) => {
  for (let i = 0; i < cells; i += 1) {
    await page.keyboard.down(key)
    await page.waitForTimeout(HOLD_MS)
    await page.keyboard.up(key)
    await page.waitForTimeout(SETTLE_MS)
    await settleRender(page)
  }
}

// 保存された現在地(ワールドとマス)を読む。村は 2 ワールドなのでマスだけでは位置が決まらない。
// 保存は到着したマスでだけ走るので、通れない所へぶつかった時はここの値が変わらない
const readCell = (page: Page) =>
  page.evaluate(key => {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return null
    const saved = JSON.parse(raw) as { worldId: string; cell: { x: number; y: number } }
    return { worldId: saved.worldId, cell: saved.cell }
  }, POS_KEY)

// 現在の部屋は下端の1マスマットから外へ出る。出た先は町の自宅前 (14,12) で、向きは下
const leaveRoom = async (page: Page) => {
  await walk(page, 'ArrowDown', 3)
}

// 自宅前 (14,12) から池のほとり (5,13) へ。横道 y12 は道が続き、その 1 段下 y13 も道。
// 池は x0-5/y14-19 なので、(5,13) の真下 (5,14) が水面になる。着いた時の向きは下(= 水面)
const goToPondShore = async (page: Page) => {
  await leaveRoom(page)
  await walk(page, 'ArrowLeft', 9)
  await walk(page, 'ArrowDown', 1)
}

for (const { prefix, text } of JOURNEYS) {
  const label = prefix === '' ? '/' : prefix
  const fishing = text.fishing

  test(`池のほとりで確認窓が出て、投げると経験が釣れる (${label})`, async ({ page }) => {
    // 部屋から池まで 13 マス歩いたうえで、投げてからかかるまでの間合いも待つ
    test.setTimeout(45_000)
    await openVillage(page, prefix)
    await goToPondShore(page)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
    // 水は通れないので、もう一度下を押しても足は止まったまま向きだけ水面へ向く
    await walk(page, 'ArrowDown', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
    const dialog = page.getByRole('dialog')
    const speech = page.getByRole('status')
    // 水面に出る 1 枚(浮き → 巻物)と、竿を持つコマに変わる主人公
    const float = page.locator('[data-village-float]')
    const player = page.locator('[data-village-player]')
    await page.keyboard.press('e')
    await expect(dialog.getByRole('heading', { name: fishing.prompt })).toBeVisible()
    await expect(dialog).toContainText(fishing.lure)
    // 確認窓の間はまだ何も投げていないので水面は空のまま
    await expect(float).toHaveCount(0)
    // 確認窓の「次へ」が釣り糸を投げる手
    await dialog.getByRole('button', { name: fishing.go }).click()
    await expect(dialog).toHaveCount(0)
    await expect(speech).toContainText(fishing.cast)
    // 投げた先の水のマスに浮きが出て、主人公は歩行コマから竿を持つコマへ変わる
    await expect(float).toHaveAttribute('data-float-phase', 'casting')
    await expect(player).toHaveAttribute('data-sprite', 'player-fish-down')
    // 投げている間は窓が無くても移動が止まる(押しても保存された位置が変わらない)
    await walk(page, 'ArrowUp', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
    // かかると浮きが沈む絵へ差し替わる
    await expect(speech).toContainText(fishing.bite, { timeout: FISHING_CAST_MS + SLACK_MS })
    await expect(float).toHaveAttribute('data-float-phase', 'bite')
    // そのあと巻物が水から跳ね、浮いている間だけ会話窓が「釣り上げた」に変わる。
    // 機能は複数あるので 1 匹目で全部は揃わない(揃った時だけ complete が出る)。
    // landing は FISHING_LAND_MS しか続かないので、遅いランナーでは caught まで進んだ後に
    // 数えることがある。跳ねる絵が出たことだけを見て、どちらでも通す
    await expect(float).toHaveAttribute('data-float-phase', /landing|caught/, {
      timeout: FISHING_BITE_MS + SLACK_MS,
    })
    await expect(speech).toContainText(fishing.landed)
    // 釣れた中身は機能一覧から選ぶので題は決まらない。場所名で結果窓だと分かる。
    // 巻物は窓の裏に残したままにする
    await expect(dialog).toContainText(fishing.caughtPlace, { timeout: FISHING_LAND_MS + SLACK_MS })
    await expect(float).toHaveAttribute('data-float-phase', 'caught')
    await dialog.getByRole('button', { name: text.close }).click()
    await expect(dialog).toHaveCount(0)
    // 閉じれば水面が片付き、主人公も歩行コマ(下向きの待ち)へ戻る
    await expect(float).toHaveCount(0)
    await expect(player).toHaveAttribute('data-sprite', 'player-down-0')
    // 錠も外れ、また歩ける
    await walk(page, 'ArrowUp', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 12 } })
  })

  test(`水に向いていなければ釣れない (${label})`, async ({ page }) => {
    // 池まで 10 マス歩く。1 マスごとに描画待ちを挟むので既定の制限では足りない
    test.setTimeout(45_000)
    await openVillage(page, prefix)
    await leaveRoom(page)
    // 右隣 (6,13) を経由してほとり (5,13) へ入る。立つマスは同じで、向きだけ水面から外れる。
    // 隣が水というだけで釣れてしまう作りなら、ここで確認窓が出て落ちる
    await walk(page, 'ArrowLeft', 8)
    await walk(page, 'ArrowDown', 1)
    await walk(page, 'ArrowLeft', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
    await page.keyboard.press('e')
    // 話せる相手がいない時の一言が出てから、窓が出ていないことを見る(順を逆にすると
    // 窓が描かれる前に数えてしまい、出ていても通ってしまう)
    await expect(
      page.locator('[data-village-bubble][data-village-bubble-kind="thought"]')
    ).toContainText(text.noTarget)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test(`池の中へは踏み込めない (${label})`, async ({ page }) => {
    // 池のほとりまで歩いたうえで、岸を回り込む分だけ余計に歩く
    test.setTimeout(45_000)
    await openVillage(page, prefix)
    await goToPondShore(page)
    await walk(page, 'ArrowDown', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
    // 東の岸 (6,15) からも同じ。左隣 (5,15) は水面
    await walk(page, 'ArrowRight', 1)
    await walk(page, 'ArrowDown', 2)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 6, y: 15 } })
    await walk(page, 'ArrowLeft', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 6, y: 15 } })
  })
}

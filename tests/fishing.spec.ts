// 釣りの E2E。池の吹き出しから直接投げると水面に浮きが出て(竿を振り終えると糸も渡る)
// 会話窓が「……」→「何かがかかった!」→「経験を釣り上げた!」と変わり、巻物が跳ねてから
// 現職の機能が結果窓に出ることを ja/ko 双方で確かめる。
// 併せて「投げている間は歩けない」「水に背を向けていれば釣れない」「池の中へは踏み込めない」
// 「東の岸から左の水面へ投げると糸が左右反転する」
// 「全部釣り上げた後は考え事の吹き出しに替わり、もう投げない」を見る。
// 既存の地点(経歴碑など)の回帰は journey.spec が持つので、ここでは繰り返さない
import { expect, type Locator, type Page } from '@playwright/test'
import type { Profile } from '@content/types/content'
import type { VillageText } from '@content/types/world'
import { worldSet } from '@content/world'
import { profile as profileJa } from '@content/ja/profile'
import { profile as profileKo } from '@content/ko/profile'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
// 段階ごとの待ち時間は lib 側の定数が正本。ここに秒数を書き写すと片方だけ動いた時に気付けない
import { FISHING_BITE_MS, FISHING_CAST_MS, FISHING_LAND_MS } from '@/lib/village/fishing'
// 竿を振る長さ(その間は糸を隠す)も同じく lib 側の定数が正本
import { FISHING_SWING_MS } from '@/lib/village/player-pose'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・描画待ち・既定で晴れを敷く test は
// 他の村の spec と共用。正本は village.helpers.ts
import { openVillage, settleRender, test, walk } from './village.helpers'

type Journey = { prefix: string; text: VillageText; profile: Profile }

// 遅いランナーでは描画とタイマーの発火が少し後ろへずれる。待ち時間の定数にこの分だけ上乗せする
const SLACK_MS = 3_000

const JOURNEYS: Journey[] = [
  { prefix: '', text: villageJa, profile: profileJa },
  { prefix: '/ko', text: villageKo, profile: profileKo },
]

// 位置の保存先は lib/preferences と同じ組み立て
const POS_KEY = `village:${worldSet.id}:pos`

// 池で釣れる中身の数。VillagePage が村へ渡すのと同じく、現職の機能一覧から数える。
// 数を書き写すと、機能を足した時に揃い切る前で投げるのをやめてしまう
const catchCountOf = (profile: Profile): number =>
  profile.careers.find(c => c.id === 'current')?.detail?.features?.items.length ?? 0

// 主人公に描かれたコマを data-observed-poses へ順に書き足す。短いモーションも取りこぼさない
const recordPoses = (player: Locator) =>
  player.evaluate(element => {
    element.setAttribute('data-observed-poses', '')
    new MutationObserver(() => {
      const pose = element.getAttribute('data-sprite') ?? ''
      const seen = element.getAttribute('data-observed-poses') ?? ''
      if (!seen.split(',').includes(pose))
        element.setAttribute('data-observed-poses', `${seen},${pose}`)
    }).observe(element, { attributes: true, attributeFilter: ['data-sprite'] })
  })

// ワールドの層へ糸が差し込まれた瞬間の見え方(visibility)を data-observed-line へ順に書き足す。
// 竿を振っている間は隠すので、差し込まれたその場では hidden のはず。見えるようになってから
// 数えても、隠しが終わったのか最初から見えていたのかは区別できない
const recordLineMounts = (world: Locator) =>
  world.evaluate(element => {
    element.setAttribute('data-observed-line', '')
    new MutationObserver(records => {
      for (const node of records.flatMap(record => [...record.addedNodes])) {
        if (!(node instanceof Element) || !node.matches('[data-village-line]')) continue
        const seen = element.getAttribute('data-observed-line') ?? ''
        const visibility = getComputedStyle(node).visibility
        const next = seen === '' ? visibility : `${seen},${visibility}`
        element.setAttribute('data-observed-line', next)
      }
    }).observe(element, { childList: true })
  })

// readCell・leaveRoom は journey.spec にも同じ物がある。spec から import すると
// 向こうの test() ごと読み込まれて二重に登録されるので、共有せずここへ写している。
// 歩く walk は village.helpers.ts から読む(helpers は test を extend して渡すだけで
// test() を呼ばないので import してよい)

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

for (const { prefix, text, profile } of JOURNEYS) {
  const label = prefix === '' ? '/' : prefix
  const fishing = text.fishing

  test(`池の吹き出しから直接投げると経験が釣れる (${label})`, async ({ page }) => {
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
    // 水面に出る 1 枚(浮き → 巻物)と、竿の先から浮きへ渡る糸、竿を持つコマに変わる主人公
    const float = page.locator('[data-village-float]')
    const line = page.locator('[data-village-line]')
    const player = page.locator('[data-village-player]')
    const world = page.locator('[data-world]')
    const bubble = page.locator('[data-village-bubble]').filter({ hasText: fishing.prompt })
    await expect(bubble).toBeVisible()
    await expect(dialog).toHaveCount(0)
    await expect(float).toHaveCount(0)
    await expect(line).toHaveCount(0)
    // 短いモーションも取りこぼさず、実際に描かれたコマを記録する。
    // 糸も差し込まれた瞬間の見え方を記録する(投げる前に掛けないと最初の 1 本を見逃す)
    await recordPoses(player)
    await recordLineMounts(world)
    // キーボードの Z と吹き出しのボタンで直接投げる
    if (prefix === '') await page.keyboard.press('z')
    else await bubble.getByRole('button', { name: fishing.go }).click()
    await expect(dialog).toHaveCount(0)
    await expect(bubble).toHaveCount(0)
    await expect(speech).toContainText(fishing.cast)
    // 投げた先の水のマスに浮きが出て、主人公は歩行コマから竿を持つコマへ変わる
    await expect(float).toHaveAttribute('data-float-phase', 'casting')
    // 糸は浮きと同時に置かれる。この要素に印を付け、かかった後も同じ要素のままかを後で見る
    // (作り直されると隠す動きが頭からやり直しになり、かかった瞬間に糸が一度消える)
    await line.evaluate(element => element.setAttribute('data-e2e-cast', ''))
    // 印を付けたのが投げている間だったことを確かめる。かかった後に付けると作り直しを見逃す
    expect(await float.getAttribute('data-float-phase')).toBe('casting')
    await expect(player).toHaveAttribute('data-sprite', 'player-fish-down')
    await expect(player).toHaveAttribute(
      'data-observed-poses',
      /player-fish-down-backswing,player-fish-down-cast,player-fish-down/
    )
    // 竿を振り終えると、竿の先から浮きまで糸が見える(振っている間は隠れている)。
    // 水面を向いた下向きの糸を描く
    await expect(line).toBeVisible()
    await expect(line).toHaveAttribute('data-line-facing', 'down')
    // 見えるようになる前、差し込まれた瞬間は隠れていた。2 本以上差し込まれていても落ちる
    await expect(world).toHaveAttribute('data-observed-line', 'hidden')
    // 隠していたのは竿を振る長さ(FISHING_SWING_MS)の動き。keyframes の名前は CSS Modules が
    // ハッシュ付きへ変えるので部分一致で見る。長さは計算値が秒で返る
    await expect(line).toHaveCSS('animation-name', /village-line-wait/)
    await expect(line).toHaveCSS('animation-duration', `${FISHING_SWING_MS / 1000}s`)
    // 投げている間は窓が無くても移動が止まる(押しても保存された位置が変わらない)
    await walk(page, 'ArrowUp', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
    // かかると浮きが沈む絵へ差し替わる。糸は沈んだ浮きへ渡ったまま
    await expect(speech).toContainText(fishing.bite, { timeout: FISHING_CAST_MS + SLACK_MS })
    await expect(float).toHaveAttribute('data-float-phase', 'bite')
    // 投げている間に付けた印が残っている = 糸は作り直されず、同じ要素のまま沈んだ浮きへ渡っている
    await expect(line).toHaveAttribute('data-e2e-cast', '')
    await expect(line).toBeVisible()
    // そのあと巻物が水から跳ね、浮いている間だけ会話窓が「釣り上げた」に変わる。
    // 機能は複数あるので 1 匹目で全部は揃わない(揃った時だけ complete が出る)。
    // landing は FISHING_LAND_MS しか続かないので、遅いランナーでは caught まで進んだ後に
    // 数えることがある。跳ねる絵が出たことだけを見て、どちらでも通す
    await expect(float).toHaveAttribute('data-float-phase', /landing|caught/, {
      timeout: FISHING_BITE_MS + SLACK_MS,
    })
    // 巻物が跳ねた後は浮きが無いので、糸も消える
    await expect(line).toHaveCount(0)
    await expect(speech).toContainText(fishing.landed)
    // 釣れた中身は機能一覧から選ぶので題は決まらない。場所名で結果窓だと分かる。
    // 巻物は窓の裏に残したままにする
    await expect(dialog).toContainText(fishing.caughtPlace, { timeout: FISHING_LAND_MS + SLACK_MS })
    await expect(float).toHaveAttribute('data-float-phase', 'caught')
    await expect(line).toHaveCount(0)
    await dialog.getByRole('button', { name: text.close }).click()
    await expect(dialog).toHaveCount(0)
    // 閉じれば水面が片付き、主人公も歩行コマ(下向きの待ち)へ戻る
    await expect(float).toHaveCount(0)
    await expect(line).toHaveCount(0)
    await expect(player).toHaveAttribute('data-sprite', 'player-down-0')
    // 錠も外れ、また歩ける
    await walk(page, 'ArrowUp', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 12 } })
  })

  test(`すべて釣り上げた後は、水辺で考え事の吹き出しが出てもう投げない (${label})`, async ({
    page,
  }) => {
    // 池まで 13 マス歩いたうえで、機能の数だけ投げては閉じる(1 回およそ 3 秒)
    test.setTimeout(150_000)
    const total = catchCountOf(profile)
    // 中身が無いと 1 回も投げずに後半の確認へ進み、何も確かめないまま通ってしまう
    expect(total).toBeGreaterThan(0)
    await openVillage(page, prefix)
    await goToPondShore(page)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
    const dialog = page.getByRole('dialog')
    const speech = page.getByRole('status')
    const float = page.locator('[data-village-float]')
    const player = page.locator('[data-village-player]')
    const prompt = page.locator('[data-village-bubble]').filter({ hasText: fishing.prompt })
    const speechBubble = page.locator('[data-village-bubble][data-village-bubble-kind="speech"]')
    const thought = page
      .locator('[data-village-bubble][data-village-bubble-kind="thought"]')
      .filter({ hasText: fishing.exhausted })
    // まだ釣っていない物を先に出すので、機能の数だけ投げれば全部が揃う。
    // どれが釣れるかは乱数で決まるので題は見ず、揃った瞬間の文言だけを見る
    for (let count = 1; count <= total; count += 1) {
      // 揃うまでは台詞の吹き出しのまま。考え事は出ない
      await expect(prompt).toBeVisible()
      await expect(thought).toHaveCount(0)
      if (prefix === '') await page.keyboard.press('z')
      else await prompt.getByRole('button', { name: fishing.go }).click()
      await expect(speech).toContainText(fishing.cast)
      await expect(speech).toContainText(fishing.bite, { timeout: FISHING_CAST_MS + SLACK_MS })
      await expect(float).toHaveAttribute('data-float-phase', /landing|caught/, {
        timeout: FISHING_BITE_MS + SLACK_MS,
      })
      // 最後の 1 匹で揃った時だけ complete。それまでは普段の釣り上げ文。
      // complete は landed を中に含む(「すべての経験を…」)ので、揃う前は complete でないことも見る
      await expect(speech).toContainText(count === total ? fishing.complete : fishing.landed)
      if (count < total) await expect(speech).not.toContainText(fishing.complete)
      await expect(dialog).toContainText(fishing.caughtPlace, {
        timeout: FISHING_LAND_MS + SLACK_MS,
      })
      // 最後の 1 匹の結果窓は、もう投げないので「もう一度投げると…」の一言を出さない
      if (count === total) await expect(dialog).not.toContainText(fishing.caughtHook)
      else await expect(dialog).toContainText(fishing.caughtHook)
      await dialog.getByRole('button', { name: text.close }).click()
      await expect(dialog).toHaveCount(0)
      await expect(float).toHaveCount(0)
      await settleRender(page)
    }
    // 揃えて閉じると、水辺の吹き出しはボタン付きの台詞からボタンの無い考え事へ替わる
    await expect(thought).toBeVisible()
    await expect(thought.getByRole('button')).toHaveCount(0)
    await expect(speechBubble).toHaveCount(0)
    // Z と E を押しても投げない。竿を持つコマが一瞬でも出たら記録に残る
    await recordPoses(player)
    // 焦点を枠へ置いてから押す。押した後に歩けることで、キーが村へ届いていたことも確かめる
    await page.locator('[data-village]').focus()
    await page.keyboard.press('z')
    await settleRender(page)
    await expect(float).toHaveCount(0)
    await expect(speech).not.toContainText(fishing.cast)
    await page.keyboard.press('e')
    await settleRender(page)
    await expect(float).toHaveCount(0)
    await expect(speech).not.toContainText(fishing.cast)
    // 投げていれば結果窓が出ている頃まで待ってから、窓も竿のコマも出ていないことを見る
    await page.waitForTimeout(FISHING_CAST_MS + FISHING_BITE_MS + FISHING_LAND_MS)
    await expect(dialog).toHaveCount(0)
    await expect(float).toHaveCount(0)
    await expect(player).not.toHaveAttribute('data-sprite', /player-fish-/)
    await expect(player).not.toHaveAttribute('data-observed-poses', /player-fish-/)
    // 錠は掛かっていない。1 マス離れて水に背を向けると考え事は消え、戻って水面を向けばまた出る
    await walk(page, 'ArrowUp', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 12 } })
    await expect(thought).toHaveCount(0)
    await walk(page, 'ArrowDown', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
    await expect(thought).toBeVisible()
    await expect(speechBubble).toHaveCount(0)
  })

  test(`水に向いていなければ釣れない (${label})`, async ({ page }) => {
    // 池まで 10 マス歩く。1 マスごとに描画待ちを挟むので既定の制限では足りない
    test.setTimeout(45_000)
    await openVillage(page, prefix)
    await leaveRoom(page)
    // 右隣 (6,13) を経由してほとり (5,13) へ入る。立つマスは同じで、向きだけ水面から外れる。
    // 隣が水というだけでは吹き出しも釣りも始まらない
    await walk(page, 'ArrowLeft', 8)
    await walk(page, 'ArrowDown', 1)
    await walk(page, 'ArrowLeft', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
    await expect(
      page.locator('[data-village-bubble]').filter({ hasText: fishing.prompt })
    ).toHaveCount(0)
    await page.keyboard.press('e')
    // 話せる相手がいない時の一言が出てから、窓が出ていないことを見る(順を逆にすると
    // 窓が描かれる前に数えてしまい、出ていても通ってしまう)
    await expect(
      page.locator('[data-village-bubble][data-village-bubble-kind="thought"]')
    ).toContainText(text.noTarget)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test(`池の中へは踏み込めない (${label})`, async ({ page }) => {
    // 池のほとりまで歩いたうえで、岸を回り込む分だけ余計に歩き、最後に左の水面へ 1 回投げる
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
    // 足は止まったまま左の水面を向いているので、ここからも投げられる。糸は右向きの絵を
    // 左右反転して渡す。村で反転した糸が出るのはこの向きだけなので、反転はここで確かめる
    const dialog = page.getByRole('dialog')
    const line = page.locator('[data-village-line]')
    const bubble = page.locator('[data-village-bubble]').filter({ hasText: fishing.prompt })
    await expect(bubble).toBeVisible()
    if (prefix === '') await page.keyboard.press('z')
    else await bubble.getByRole('button', { name: fishing.go }).click()
    await expect(line).toBeVisible()
    await expect(line).toHaveAttribute('data-line-facing', 'left')
    // インラインの scaleX(-1) は計算値では行列で返る
    await expect(line).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)')
    // 結果窓が出るまで待って閉じ、水面が片付くところまで見る
    await expect(dialog).toContainText(fishing.caughtPlace, {
      timeout: FISHING_CAST_MS + FISHING_BITE_MS + FISHING_LAND_MS + SLACK_MS,
    })
    await dialog.getByRole('button', { name: text.close }).click()
    await expect(dialog).toHaveCount(0)
    await expect(line).toHaveCount(0)
  })
}

test.describe('タッチ操作の釣り', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('画面の A で直接投げ、B で中断して再び投げられる', async ({ page }) => {
    test.setTimeout(45_000)
    await openVillage(page, '/ko')
    await goToPondShore(page)
    const bubble = page
      .locator('[data-village-bubble]')
      .filter({ hasText: villageKo.fishing.prompt })
    const float = page.locator('[data-village-float]')
    await expect(bubble).toBeVisible()
    await page.getByRole('button', { name: villageKo.buttonA, exact: true }).click()
    await expect(float).toHaveAttribute('data-float-phase', 'casting')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: villageKo.buttonB, exact: true }).click()
    await expect(float).toHaveCount(0)
    await expect(bubble).toBeVisible()
    await page.waitForTimeout(FISHING_CAST_MS + FISHING_BITE_MS + FISHING_LAND_MS)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: villageKo.buttonA, exact: true }).click()
    await expect(float).toHaveAttribute('data-float-phase', 'casting')
    await page.getByRole('button', { name: villageKo.buttonB, exact: true }).click()
    // 歩かず水面へ向き直った時も吹き出しを更新する
    await expect(bubble).toBeVisible()
    await page.locator('[data-village]').focus()
    await page.keyboard.press('ArrowRight', { delay: 40 })
    await expect(bubble).toHaveCount(0)
    await page.keyboard.press('ArrowDown', { delay: 40 })
    await expect(bubble).toBeVisible()
  })
})

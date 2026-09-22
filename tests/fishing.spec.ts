// 釣りの E2E。池の吹き出しから直接投げると水面に浮きが出て(竿を振り終えると糸も渡る)
// 会話窓が「……」→「何かがかかった!」→「経験を釣り上げた!」と変わり、巻物が跳ねてから
// 現職の機能が結果窓に出ることを ja/ko 双方で確かめる。
// 併せて「投げている間は歩けない」「水に背を向けていれば釣れない」「池の中へは踏み込めない」
// 「東の岸から左の水面へ投げると糸が左右反転する」
// 「全部釣り上げた後は考え事の吹き出しに替わり、もう投げない」を見る。
// 主人公の体は「投げる 4 コマ → 構え → かかった合図(張る・引かれる)→ 釣り上げ(引き上げる・掲げる)」の順に描かれる。
// 浮きが沈む合図の CSS は、体が引かれる合図と同じ長さ(FISHING_BITE_TUG_MS)で 2 度。
// 時計(page.clock)を止めて左向きの各コマの実画面を撮り、構えのコマと比べて体の画素だけが変わり、足元と立ち位置は動かない。
// 動き終えれば歩行ループが眠る(振りかぶりの間は回っている)。
// 動きを控える設定では時間で替わるコマを出さず、段階ごとの静止コマ(構え・張る・掲げる)だけを描く。
// 左向きでは動くコマの間も右向きのシートを反転したまま描く。
// B で中断すれば歩行コマへ戻り、投げ直すと振りかぶりから描き直す。
// 既存の地点(経歴碑など)の回帰は journey.spec が持つので、ここでは繰り返さない
import { expect, type Locator, type Page } from '@playwright/test'
import type { Profile } from '@content/types/content'
import type { VillageText } from '@content/types/world'
import { worldSet } from '@content/world'
import { profile as profileJa } from '@content/ja/profile'
import { profile as profileKo } from '@content/ko/profile'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
// 主人公のシートの寸法(幅 16・高さ 24)。足元の帯とドット 1 粒の大きさをここから出す
import { PLAYER_HEIGHT } from '@/lib/pixel/actors'
import { TILE } from '@/lib/pixel/art'
// 段階ごとの待ち時間は lib 側の定数が正本。ここに秒数を書き写すと片方だけ動いた時に気付けない
import { FISHING_BITE_MS, FISHING_CAST_MS, FISHING_LAND_MS } from '@/lib/village/fishing'
// 竿を振る長さ(その間は糸を隠す)・かかった合図の 1 周期と力む長さと回数・引き上げる長さも同じく lib 側の定数が正本
import {
  BITE_BRACE_MS,
  BITE_TUGS,
  FISHING_BITE_TUG_MS,
  FISHING_PULL_MS,
  FISHING_SWING_MS,
} from '@/lib/village/player-pose'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・描画待ち・既定で晴れを敷く test は
// 他の村の spec と共用。正本は village.helpers.ts
import { openVillage, settleRender, test, walk } from './village.helpers'

type Journey = { prefix: string; text: VillageText; profile: Profile }

// 遅いランナーでは描画とタイマーの発火が少し後ろへずれる。待ち時間の定数にこの分だけ上乗せする
const SLACK_MS = 3_000

// 釣りのコマの名前(シートのキーの末尾)。向き d のキーは player-fish-{d}-{名前} で、構え(待ち)だけは
// 末尾の無い player-fish-{d}。左向きは右向きのキーを反転して描く。
// どの段階のどの時刻にどのコマを出すか(時間割)の正本は src/lib/village/player-pose.ts
type FishFacing = 'up' | 'down' | 'right'
// 投げる 4 コマ。振りかぶり → 竿を後ろへ引く → 振り下ろす → 振り抜く。FISHING_SWING_MS を 4 等分して順に出す
const CAST_FRAMES = ['windup', 'backswing', 'cast', 'follow'] as const
// かかった合図。張る(tense)と引かれる(bite)
const BITE_FRAMES = ['tense', 'bite'] as const
// 釣り上げ。引き上げる(pull)と掲げる(hoist)
const LAND_FRAMES = ['pull', 'hoist'] as const

const fishKey = (facing: FishFacing, frame?: string) =>
  frame === undefined ? `player-fish-${facing}` : `player-fish-${facing}-${frame}`

// 投げてから結果窓が出るまでに、初めて描かれる順のコマ。投げる 4 コマ → 構え → かかった合図 → 釣り上げ。
// 合図の頭の構えと 2 周目は既に描いたコマなので、recordPoses の記録には増えない
const firstSeenPoses = (facing: FishFacing) => [
  ...CAST_FRAMES.map(frame => fishKey(facing, frame)),
  fishKey(facing),
  ...BITE_FRAMES.map(frame => fishKey(facing, frame)),
  ...LAND_FRAMES.map(frame => fishKey(facing, frame)),
]
// そのうち投げている間(構えのコマで止まるまで)の分
const castPoses = (facing: FishFacing) => firstSeenPoses(facing).slice(0, CAST_FRAMES.length + 1)

// recordPoses が書き足した後の data-observed-poses の値。空から始めて「,キー」を 1 つずつ足す
const observedPoses = (keys: readonly string[]) => keys.map(key => `,${key}`).join('')
// 記録がこの並びで始まっているか。末尾を「,」か終端で切らないと、構えの player-fish-down が
// player-fish-down-tense の頭に一致して、構えを飛ばした並びまで通してしまう。キーは英小文字と - だけ
const startsWithPoses = (keys: readonly string[]) => new RegExp(`^${observedPoses(keys)}(,|$)`)

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

// 主人公のコマか transform が替わるたびに「コマ:反転の有無」を data-observed-facing へ書き足す。
// 両方とも歩行ループが同じフレームで書くので、通知を受けた時点の transform がそのコマを描いた時の向き
const recordFacing = (player: Locator) =>
  player.evaluate(element => {
    element.setAttribute('data-observed-facing', '')
    new MutationObserver(() => {
      const pose = element.getAttribute('data-sprite') ?? ''
      const flip = element.style.transform.includes('scaleX(-1)') ? 'flip' : 'none'
      const seen = element.getAttribute('data-observed-facing') ?? ''
      const entry = `${pose}:${flip}`
      element.setAttribute('data-observed-facing', seen === '' ? entry : `${seen},${entry}`)
    }).observe(element, { attributes: true, attributeFilter: ['data-sprite', 'style'] })
  })

// 主人公の transform から左右反転を除いた位置の部分。釣っている間は歩かないので、どのコマでも同じはず
const shiftOf = (player: Locator) =>
  player.evaluate(element => element.style.transform.replace(' scaleX(-1)', ''))

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

// ---- 時計を止めて実画面のコマを撮る検査の道具 ----

// 昼(JST 12:00)の瞬間。clock.spec・day-night.spec と同じ。時計を入れ替えると日付も偽物になるので、
// 撮る途中で昼夜の段階が替わって(シートごと色が変わり足元まで違って見える)落ちないよう昼に固定する
const NOON_JST = '2026-09-20T03:00:00Z'
// 止める時刻を今より少し先に取る。pauseAt は過去を指すと投げるので、今の時刻を読んでから止めるまでの往復分の余裕
const PAUSE_LEAD_MS = 1_000
// 止めた時計の rAF は、runFor で進めた分だけ 16ms 刻みで呼ばれる(Playwright の偽の rAF の間隔)
const FAKE_FRAME_MS = 16
// 見えている経過のずれの上限。段階が替わってから最初のフレームまでで最大 1 フレーム遅れて数え始め
// (段階が替わった瞬間から数える作りならずれない)、描かれているコマは今の時刻より最大 1 フレーム前のもの
const FRAME_LAG_MS = FAKE_FRAME_MS * 2
// 時間割の窓 [from, to)(段階に入ってからの ms)の中で、上のずれが出ても窓からはみ出さない真ん中の時刻
const sampleIn = (from: number, to: number) => {
  if (to - from <= FRAME_LAG_MS) {
    throw new Error(`${from}〜${to}ms の窓はフレームのずれより狭く狙えない`)
  }
  return Math.round((from + FRAME_LAG_MS + to) / 2)
}

// 撮る間だけ隠す物。どれも主人公の枠に重なりうるうえ、page.clock では止まらない実時間の CSS アニメーションを
// 持つか、段階で出入りする。写り込むと同じコマでも撮る瞬間で画素が変わる。
// 糸は竿先から枠の中へ入り(振る間は実時間で隠れる)、巻物は跳ねて足元の高さまで上がり、吹き出しは頭上に重なる。
// !important は CSS アニメーションが書く visibility にも勝つ
const SHOT_STYLE =
  '[data-village-line], [data-village-float], [data-village-bubble] { visibility: hidden !important }'

// 足元の行数。シートは 16×24 で最下の 2 行が足(actors.ts)。投げても合図に引かれても釣り上げても
// 足は動かさない約束なので、この帯は構えのコマと 1 画素も違わないはず(竿が足元へ下りない横向きで比べる)
const FEET_ROWS = 2

type Shot = { key: string; png: Buffer; shift: string }
type PixelDiff = { width: number; body: number; feet: number }

// 撮った PNG をブラウザの中で画素へ戻し(新しい依存を足さず createImageBitmap と canvas だけで読む)、
// 構えのコマと違う画素を体の帯と足元の帯に分けて数える。
// 比べる 2 枚は同じ位置・同じ背景で撮っているので、背景の地面は完全に打ち消し合い、違いは人物の絵と
// その白い縁取り(scene.module.css の drop-shadow)からしか出ない。縁取りは絵の外へ 1 CSS px にじむので、
// 体の最下行の縁取りが足元の帯の最上段へ落ちてくる。足元はその段(devicePixelRatio 分)を除いて比べ、
// 体の描き分けを「足が動いた」と取り違えないようにする。枠の外へにじむ縁取りは撮る範囲(要素の箱)で
// 切れるが、どちらの 1 枚でも同じ所で切れるので差にならない
const diffFromReady = (page: Page, ready: Buffer, shot: Buffer): Promise<PixelDiff> =>
  page.evaluate(
    async ([readyBase64, shotBase64, feetRows, sheetRows]) => {
      const decode = async (base64: string) => {
        const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext('2d')
        if (context === null) throw new Error('2d の描画面が取れない')
        context.drawImage(bitmap, 0, 0)
        return context.getImageData(0, 0, bitmap.width, bitmap.height)
      }
      const [before, after] = await Promise.all([decode(readyBase64), decode(shotBase64)])
      if (before.width !== after.width || before.height !== after.height) {
        throw new Error('撮った大きさが構えのコマと違う(立ち位置か枠の大きさが変わった)')
      }
      const { width, height } = after
      const feetTop = (height * (sheetRows - feetRows)) / sheetRows
      const bodyEnd = Math.floor(feetTop)
      const feetStart = Math.ceil(feetTop) + Math.ceil(devicePixelRatio)
      let body = 0
      let feet = 0
      for (let y = 0; y < height; y += 1) {
        const inBody = y < bodyEnd
        if (!inBody && y < feetStart) continue
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const same =
            before.data[i] === after.data[i] &&
            before.data[i + 1] === after.data[i + 1] &&
            before.data[i + 2] === after.data[i + 2] &&
            before.data[i + 3] === after.data[i + 3]
          if (same) continue
          if (inBody) body += 1
          else feet += 1
        }
      }
      return { width, body, feet }
    },
    [ready.toString('base64'), shot.toString('base64'), FEET_ROWS, PLAYER_HEIGHT] as const
  )

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
    // 投げる 4 コマを順に描き、構えのコマで止まる
    await expect(player).toHaveAttribute('data-sprite', fishKey('down'))
    await expect(player).toHaveAttribute('data-observed-poses', startsWithPoses(castPoses('down')))
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
    // 浮きが沈む合図は、主人公が引かれる合図の 1 周期(FISHING_BITE_TUG_MS)と同じ長さで、引かれる回数(BITE_TUGS)だけ繰り返す。
    // CSS に秒数や回数を書き写すと片方だけ動いた時に体と浮きの拍がずれる。長さは計算値が秒で返る
    await expect(float).toHaveCSS('animation-duration', `${FISHING_BITE_TUG_MS / 1000}s`)
    await expect(float).toHaveCSS('animation-iteration-count', String(BITE_TUGS))
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
    // 結果窓が出ている間は竿を掲げたコマのまま
    await expect(player).toHaveAttribute('data-sprite', fishKey('down', 'hoist'))
    // ここまでに描かれたコマは、投げる 4 コマ・構え・かかった合図(張る・引かれる)・釣り上げ(引き上げる・掲げる)で、
    // それ以外は一瞬も出ていない。並びは投げる 4 コマと構えまで(上の startsWithPoses)しか見ず、残りは揃っているかだけを見る。
    // 実時間では合図の最初の張る窓が BITE_BRACE_MS(50ms)しかなく、フレームがそれより遅れると張るより先に
    // 引かれるコマが記録される(張るは後の窓で記録される)。何 ms にどのコマかという順は、時計を止めた検査と
    // player-pose.test.ts が決定的に見ている
    const drawn = ((await player.getAttribute('data-observed-poses')) ?? '')
      .split(',')
      .filter(key => key !== '')
    expect(drawn.toSorted()).toEqual(firstSeenPoses('down').toSorted())
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
    const player = page.locator('[data-village-player]')
    const bubble = page.locator('[data-village-bubble]').filter({ hasText: fishing.prompt })
    await expect(bubble).toBeVisible()
    // 主人公も左向きは右向きのシートを反転して描く。動くコマの間も右向きのコマ・反転のまま替わるかを、
    // 投げる前からコマが替わるたびに控える
    await recordFacing(player)
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
    // 投げてから結果窓が出るまでに描いたコマは、どれも右向きの釣りのシートを反転したもの。
    // 釣りのコマを 1 つも描かずに通っていないよう、段階ごとに止まるコマ(構え・張る・掲げる)が反転して記録にあることも見る。
    // 投げる 4 コマ(各 120ms)や引かれるコマ(100ms)のような短い窓のコマは、実時間ではフレームが遅れると
    // 一度も描かれないことがあるので、全部が記録にあることまでは求めない。どの時刻にどのコマを反転して描くかは、
    // 同じ東の岸から左の水面へ投げる、時計を止めた検査が決定的に見ている
    const facing = ((await player.getAttribute('data-observed-facing')) ?? '').split(',')
    expect(
      facing.filter(entry => !/^player-fish-right(-[a-z]+)?:flip$/.test(entry)),
      '右向きの釣りのシート・反転以外で描いたコマ'
    ).toEqual([])
    for (const pose of [fishKey('right'), fishKey('right', 'tense'), fishKey('right', 'hoist')]) {
      expect(facing, `${pose} も反転して描いた`).toContain(`${pose}:flip`)
    }
    await dialog.getByRole('button', { name: text.close }).click()
    await expect(dialog).toHaveCount(0)
    await expect(line).toHaveCount(0)
  })
}

// 体の動きは言語に依らないので、時計を止めて撮る検査と動きを控える設定の検査は ja だけで見る
test('投げる・かかる・釣り上げるの各コマは足元と立ち位置を残して体だけが動き、動き終えれば歩行ループが眠る', async ({
  page,
}) => {
  // 池の東の岸まで 16 マス余り歩いたうえで、止めた時計を段階ごとに進めて撮る
  test.setTimeout(45_000)
  // 時計はページを開く前に入れる。歩く間は実時間どおりに流し、投げる直前に止める
  await page.clock.install({ time: new Date(NOON_JST) })
  await openVillage(page, '')
  await goToPondShore(page)
  // 東の岸 (6,15) へ回り込み、左の水面 (5,15) を向いて撮る。正面(下向き)の構えのコマは竿の穂先を
  // マスの下辺(足元の 2 行)まで下ろしている(actors.ts の downRod)ので、竿を振り上げたコマと比べると
  // 足元の帯が穂先の分だけ必ず違う。横向きの竿は足元へ下りない(前下はランタンの席)ので、足が動かないことを
  // 画素で確かめられる。左向きは右向きのシートの反転で、どのコマも同じく反転して描くので比べ方は変わらない
  await walk(page, 'ArrowRight', 1)
  await walk(page, 'ArrowDown', 2)
  await walk(page, 'ArrowLeft', 1)
  expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 6, y: 15 } })
  const frame = page.locator('[data-village]')
  const player = page.locator('[data-village-player]')
  const float = page.locator('[data-village-float]')
  const dialog = page.getByRole('dialog')
  await expect(
    page.locator('[data-village-bubble]').filter({ hasText: villageJa.fishing.prompt })
  ).toBeVisible()
  // 歩き終えてカメラも追い付き、ループが眠ってから止める(動いている途中で止めると、その途中の絵で固まる)
  await expect(frame).toHaveAttribute('data-village-loop', 'idle')
  // ここから先は runFor で進めた分しか時間が経たない。page.clock はページの rAF・performance.now・
  // setTimeout を偽物にするので、それを待つ settleRender・walk はもう呼ばない(expect の待ちは偽物に触れない)
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + PAUSE_LEAD_MS)
  await page.keyboard.press('z')
  await expect(float).toHaveAttribute('data-float-phase', 'casting')
  // 投げた瞬間に起こされる。まだ 1 フレームも進めていない
  await expect(frame).toHaveAttribute('data-village-loop', 'running')

  // 投げてからの経過(ms)。止めた後は runFor で進めた分だけ進む
  let elapsed = 0
  const runTo = async (at: number) => {
    await page.clock.runFor(at - elapsed)
    elapsed = at
  }
  const shots: Shot[] = []
  const shoot = async (at: number, key: string) => {
    await runTo(at)
    // 撮る前にコマの名前を見る。時間割がずれていれば、画素の比較ではなくここで「何 ms に何のコマだったか」付きで落ちる
    await expect(player, `投げてから ${at}ms のコマ`).toHaveAttribute('data-sprite', key)
    // 左向きなので右向きのシートを反転して描く。実時間の検査は短い窓のコマを取りこぼしうるので、
    // 動くコマごとの反転はここで見る。歩行ループは transform をコマと同じ呼び出しの中で先に書く
    expect(
      await player.evaluate(element => element.style.transform),
      `投げてから ${at}ms のコマの反転`
    ).toContain('scaleX(-1)')
    shots.push({
      key,
      png: await player.screenshot({ style: SHOT_STYLE }),
      shift: await shiftOf(player),
    })
  }

  // 投げる 4 コマ。振っている間はコマが時間で替わるので、どのコマの時点でもループは眠らない
  const castStep = FISHING_SWING_MS / CAST_FRAMES.length
  for (const [index, name] of CAST_FRAMES.entries()) {
    await shoot(sampleIn(castStep * index, castStep * (index + 1)), fishKey('right', name))
    await expect(frame).toHaveAttribute('data-village-loop', 'running')
  }
  // 振り終えたら構えのコマで止まり、時間で替わる物が無くなるのでループは眠る。比べる基準はここで撮る
  await runTo(sampleIn(FISHING_SWING_MS, FISHING_CAST_MS))
  await expect(player).toHaveAttribute('data-sprite', fishKey('right'))
  await expect(frame).toHaveAttribute('data-village-loop', 'idle')
  const ready = {
    png: await player.screenshot({ style: SHOT_STYLE }),
    shift: await shiftOf(player),
  }

  // かかった瞬間まで進め、段階が替わって眠っていたループが起こされるのを待ってから先へ進める。
  // 境目を runFor 1 回で跨ぐと、段階の切り替え(React の描画は実時間で走る)が進め終えた後に回り、
  // 合図の始まりが進めた先の時刻へずれる
  await runTo(FISHING_CAST_MS)
  await expect(float).toHaveAttribute('data-float-phase', 'bite')
  await expect(frame).toHaveAttribute('data-village-loop', 'running')
  // 合図の 1 周期は 構え → 張る → 引かれる → 張る。浮きは周期の後半に沈み(CSS の steps(1) は 50% で切り替わる)、
  // 体はその沈み始めに引かれ、前後の BITE_BRACE_MS を張る。区切りは lib の時間割と同じ定数から出す
  const tug = FISHING_BITE_TUG_MS
  const sink = tug / 2
  await runTo(FISHING_CAST_MS + sampleIn(0, sink - BITE_BRACE_MS))
  await expect(player).toHaveAttribute('data-sprite', fishKey('right'))
  await shoot(FISHING_CAST_MS + sampleIn(sink - BITE_BRACE_MS, sink), fishKey('right', 'tense'))
  await shoot(FISHING_CAST_MS + sampleIn(sink, tug - BITE_BRACE_MS), fishKey('right', 'bite'))
  // BITE_TUGS 周したら張ったコマのまま止まり、ループは眠る
  await runTo(FISHING_CAST_MS + sampleIn(tug * BITE_TUGS, FISHING_BITE_MS))
  await expect(player).toHaveAttribute('data-sprite', fishKey('right', 'tense'))
  await expect(frame).toHaveAttribute('data-village-loop', 'idle')

  // 巻物が跳ねる瞬間まで進め、同じく起こされるのを待つ。引き上げてから掲げる
  const landAt = FISHING_CAST_MS + FISHING_BITE_MS
  await runTo(landAt)
  await expect(float).toHaveAttribute('data-float-phase', 'landing')
  await expect(frame).toHaveAttribute('data-village-loop', 'running')
  await shoot(landAt + sampleIn(0, FISHING_PULL_MS), fishKey('right', 'pull'))
  await shoot(landAt + sampleIn(FISHING_PULL_MS, FISHING_LAND_MS), fishKey('right', 'hoist'))

  // 結果窓が出る瞬間まで進める。見出しへ焦点が移った = 結果窓を出した描画の effect が走り終えた。
  // 段階の切り替えで歩行ループを起こす effect も同じ描画のものなので、ここから進めればその後のフレームを見られる
  const caughtAt = landAt + FISHING_LAND_MS
  await runTo(caughtAt)
  await expect(dialog).toContainText(villageJa.fishing.caughtPlace)
  await expect(float).toHaveAttribute('data-float-phase', 'caught')
  await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused()
  // 掲げたコマのまま窓の裏に残り、替わる物が無いのでループは眠る
  await runTo(caughtAt + FAKE_FRAME_MS * 4)
  await expect(player).toHaveAttribute('data-sprite', fishKey('right', 'hoist'))
  await expect(frame).toHaveAttribute('data-village-loop', 'idle')

  // 撮った各コマを構えのコマと比べる。体の帯で「コマが違う」と言える最小の差はドット 1 粒ぶん
  // (1 粒 = 撮った幅 / 16 の正方形)。同じ絵なら 0 画素なので、構えを写しただけのコマや
  // 添字の書き忘れはここで落ちる。足元の帯は 1 画素も違わず、立ち位置(transform の位置)も同じ
  for (const shot of shots) {
    const diff = await diffFromReady(page, ready.png, shot.png)
    const dot = Math.floor((diff.width / TILE) ** 2)
    expect(diff.body, `${shot.key} の体が構えと違う`).toBeGreaterThanOrEqual(dot)
    expect(diff.feet, `${shot.key} の足元は構えのコマと同じ`).toBe(0)
    expect(shot.shift, `${shot.key} の立ち位置は構えのコマと同じ`).toBe(ready.shift)
  }
})

test.describe('動きを控える設定の釣り', () => {
  test.use({ reducedMotion: 'reduce' })

  test('時間で替わるコマを出さず、段階ごとの静止コマ(構え・張る・掲げる)だけを描く', async ({
    page,
  }) => {
    // 池まで 13 マス歩いたうえで、投げてから結果窓が出るまで待つ
    test.setTimeout(45_000)
    const fishing = villageJa.fishing
    await openVillage(page, '')
    await goToPondShore(page)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
    const player = page.locator('[data-village-player]')
    const float = page.locator('[data-village-float]')
    const dialog = page.getByRole('dialog')
    await expect(
      page.locator('[data-village-bubble]').filter({ hasText: fishing.prompt })
    ).toBeVisible()
    await recordPoses(player)
    await page.keyboard.press('z')
    // 投げた瞬間から構えのコマ。振りかぶり〜振り抜きの 4 コマは描かない
    await expect(float).toHaveAttribute('data-float-phase', 'casting')
    await expect(player).toHaveAttribute('data-sprite', fishKey('down'))
    // かかれば張ったコマのまま。構えと引かれるコマを行き来しない
    await expect(float).toHaveAttribute('data-float-phase', 'bite', {
      timeout: FISHING_CAST_MS + SLACK_MS,
    })
    await expect(player).toHaveAttribute('data-sprite', fishKey('down', 'tense'))
    // 巻物が跳ねれば、引き上げるコマを飛ばして掲げたコマ。結果窓が出ても同じ
    await expect(float).toHaveAttribute('data-float-phase', /landing|caught/, {
      timeout: FISHING_BITE_MS + SLACK_MS,
    })
    await expect(player).toHaveAttribute('data-sprite', fishKey('down', 'hoist'))
    await expect(dialog).toContainText(fishing.caughtPlace, { timeout: FISHING_LAND_MS + SLACK_MS })
    await expect(player).toHaveAttribute('data-sprite', fishKey('down', 'hoist'))
    // 結果窓が出るまでに描いたコマはこの 3 つだけ。一瞬でも他のコマが出れば記録に残る
    await expect(player).toHaveAttribute(
      'data-observed-poses',
      observedPoses([fishKey('down'), fishKey('down', 'tense'), fishKey('down', 'hoist')])
    )
  })
})

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
    const player = page.locator('[data-village-player]')
    await expect(bubble).toBeVisible()
    await page.getByRole('button', { name: villageKo.buttonA, exact: true }).click()
    await expect(float).toHaveAttribute('data-float-phase', 'casting')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: villageKo.buttonB, exact: true }).click()
    await expect(float).toHaveCount(0)
    // 中断すれば竿を下ろし、下向きの歩行コマ(待ち)へ戻る
    await expect(player).toHaveAttribute('data-sprite', 'player-down-0')
    await expect(bubble).toBeVisible()
    await page.waitForTimeout(FISHING_CAST_MS + FISHING_BITE_MS + FISHING_LAND_MS)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // 投げ直すと竿の振りを頭から描き直す。前の回の経過を持ち越すと、振りかぶりを飛ばして
    // 構えのコマから始まる。記録は投げ直す直前から取り直す
    await recordPoses(player)
    await page.getByRole('button', { name: villageKo.buttonA, exact: true }).click()
    await expect(float).toHaveAttribute('data-float-phase', 'casting')
    await expect(player).toHaveAttribute('data-observed-poses', startsWithPoses(castPoses('down')))
    await page.getByRole('button', { name: villageKo.buttonB, exact: true }).click()
    await expect(player).toHaveAttribute('data-sprite', 'player-down-0')
    // 歩かず水面へ向き直った時も吹き出しを更新する
    await expect(bubble).toBeVisible()
    await page.locator('[data-village]').focus()
    await page.keyboard.press('ArrowRight', { delay: 40 })
    await expect(bubble).toHaveCount(0)
    await page.keyboard.press('ArrowDown', { delay: 40 })
    await expect(bubble).toBeVisible()
  })
})

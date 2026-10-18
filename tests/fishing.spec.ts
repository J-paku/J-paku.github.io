// 釣りの E2E。池の東の岸から左の水面へ投げ、主人公の体のコマを実画面の画素で見る。
// 体は「投げる 4 コマ → 構え → かかった合図(張る・引かれる)→ 釣り上げ(引き上げる・掲げる)」の順に描かれる。
// 時計(page.clock)を止めて左向きの各コマの実画面を撮り、構えのコマと比べて体の画素だけが変わり、足元と立ち位置は動かない。
// 動き終えれば歩行ループが眠る(振りかぶりの間は回っている)。
// 画素を比べるには、ビルドが焼くシート(/sprites/ の PNG)とローダーが差し込むスプライトの背景が要るので E2E に残す。
// 釣りの流れ(浮き・糸・巻物・結果窓・考え事の吹き出し・タッチの A/B・動きを控える設定)と、コマの時間割・左右反転・立ち位置・
// 歩行ループの眠りは、村の統合テスト(src/components/VillagePage/__tests__/fishing.integration.test.tsx)が見る
// (docs/decisions/0018-move-e2e-and-gate-all-hooks.md)
import { expect, type Locator, type Page } from '@playwright/test'
import { village as villageJa } from '@content/ja/village'
// 主人公のシートの寸法(幅 16・高さ 24)。足元の帯とドット 1 粒の大きさをここから出す
import { PLAYER_HEIGHT } from '@/lib/pixel/actors'
import { TILE } from '@/lib/pixel/art'
// 段階ごとの待ち時間は lib 側の定数が正本。ここに秒数を書き写すと片方だけ動いた時に気付けない
import { FISHING_BITE_MS, FISHING_CAST_MS, FISHING_LAND_MS } from '@/lib/village/fishing'
// 竿を振る長さ・かかった合図の 1 周期と力む長さと回数・引き上げる長さも同じく lib 側の定数が正本
import {
  BITE_BRACE_MS,
  BITE_TUGS,
  FISHING_BITE_TUG_MS,
  FISHING_PULL_MS,
  FISHING_SWING_MS,
} from '@/lib/village/player-pose'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・部屋から町へ出る leaveRoom・保存された現在地を読む readCell・
// 昼の瞬間・既定で晴れを敷く test は他の村の spec と共用。正本は village.helpers.ts
import { NOON_JST, leaveRoom, openVillage, readCell, test, walk } from './village.helpers'

// 釣りのコマの名前(シートのキーの末尾)。向き d のキーは player-fish-{d}-{名前} で、構え(待ち)だけは
// 末尾の無い player-fish-{d}。左向きは右向きのキーを反転して描く。
// どの段階のどの時刻にどのコマを出すか(時間割)の正本は src/lib/village/player-pose.ts
type FishFacing = 'up' | 'down' | 'right'
// 投げる 4 コマ。振りかぶり → 竿を後ろへ引く → 振り下ろす → 振り抜く。FISHING_SWING_MS を 4 等分して順に出す
const CAST_FRAMES = ['windup', 'backswing', 'cast', 'follow'] as const

const fishKey = (facing: FishFacing, frame?: string) =>
  frame === undefined ? `player-fish-${facing}` : `player-fish-${facing}-${frame}`

// 主人公の transform から左右反転を除いた位置の部分。釣っている間は歩かないので、どのコマでも同じはず
const shiftOf = (player: Locator) =>
  player.evaluate(element => element.style.transform.replace(' scaleX(-1)', ''))

// 自宅前 (14,12) から池のほとり (5,13) へ。横道 y12 は道が続き、その 1 段下 y13 も道。
// 池は x0-5/y14-19 なので、(5,13) の真下 (5,14) が水面になる。着いた時の向きは下(= 水面)
const goToPondShore = async (page: Page) => {
  await leaveRoom(page)
  await walk(page, 'ArrowLeft', 9)
  await walk(page, 'ArrowDown', 1)
}

// ---- 時計を止めて実画面のコマを撮る検査の道具 ----

// 時計を入れ替えると日付も偽物になるので、撮る途中で昼夜の段階が替わって(シートごと色が変わり足元まで
// 違って見える)落ちないよう、昼の瞬間 NOON_JST(village.helpers.ts)に固定する

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

// 体の動きは言語に依らないので ja だけで見る
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

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
import { isWalkable } from '@/lib/village/collision'
// 飛ぶ長さと飛ぶ最小の直線距離は lib 側が正本。ここに数値を書き写すと片方だけ動いた時に気付けない
import { FLIGHT_MIN_DISTANCE, flightDurationMs } from '@/lib/village/flight-curve'
// 1 マスの px は、歩行ループ(paint-camera)と同じく枠の幅をこの列数で割って出す
import { VIEW_COLS } from '@/components/VillagePage/components/Village/utils/stage-scale'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・1 マス分だけ押す press・天気の差し替えと、既定で晴れを敷く test は
// 他の村の spec と共用。正本は village.helpers.ts
import { openVillage, test, walk } from './village.helpers'

// 位置の保存先。src/lib/preferences.ts の readPosition / writePosition と同じ組み立て
const POS_KEY = `village:${worldSet.id}:pos`
const PLAYER = '[data-village-player]'
// 飛ぶ間に地上の位置へ落とす影。data-flying は飛んでいる間だけ 'true'、それ以外は 'false'
const SHADOW = '[data-flight-shadow]'
// 地点の上の吹き出しと、話せる相手がいない時の頭上の考え事(どちらも TalkBubble)
const BUBBLE = '[data-village-bubble]'
// 飛ぶコマの頭。続きは向き(down / up / right。左は right の反転)と羽ばたきの 0 / 1
const FLY_PREFIX = 'player-fly-'
// 遅いランナーでは描画とタイマーの発火が後ろへずれる。待ち時間にこの分を上乗せする
const SLACK_MS = 3_000
// 自動移動が着くまでの上限。町を横切って飛んでも、扉を通って別ワールドの地点へ移っても収まる
const ARRIVE_MS = 10_000
// 影の位置が、出発と着地を結ぶ線分から外れてよい距離(マス)
const LINE_TOLERANCE = 0.15
// 1 フレームのカメラの動きが、同じフレームの影と主人公の動きの大きい方を超えてよい倍率と、
// 層の位置を整数 px へ丸める分の余裕(px)
const CAMERA_SLACK = 1.2
const ROUND_PX = 2
// 箱が枠の中に収まるかを見る時に、小数 px の丸めとして許すはみ出し(px)
const EDGE_PX = 1

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

// 町で最も上(y が最小)の地点。北の道の突き当たりにあり、カメラは町の上端で止まる
const TOP_SPOT = town.spots.reduce((top, spot) => (spot.cell.y < top.cell.y ? spot : top))
const topSpotText = text.stops[TOP_SPOT.id]
if (topSpotText === undefined) throw new Error(`地点 ${TOP_SPOT.id} の文言が無い`)
const TOP_PLACE = topSpotText.place

// ---- 毎フレームの記録 ----

// transform を行列にした時の平行移動(px)・縦の倍率・左右反転。落ちた時に何が書かれていたか読めるよう文字列も残す
type Placement = { transform: string; x: number; y: number; scale: number; flipped: boolean }

// 画面上の箱(getBoundingClientRect の px)
type Box = { left: number; top: number; right: number; bottom: number }

// 1 フレーム分の写し。at は rAF の時刻(ms)で、同じフレームの rAF はどれも同じ時刻を受け取る(歩行ループの経過と同じ時計)。
// camera はワールドの層([data-world])の transform で、カメラ原点を負にした px。
// 行列にできなかった transform(ワールドを替えた直後に React が書く calc 入り)は placement を null にし、文字列を unparsed に残す
type FrameSample = {
  at: number
  world: string | null
  loop: string | null
  sprite: string | null
  flying: string | null
  shadow: Placement | null
  player: Placement | null
  camera: Placement | null
  frameBox: Box | null
  playerBox: Box | null
  shadowBox: Box | null
  bubbles: number
  dialogs: number
  unparsed: string[]
  saved: string | null
}

// cell は記録を始めた時の 1 マスの px
type Recording = { cell: number; samples: FrameSample[] }
type RecorderWindow = Window & { flightRecording?: Recording; flightRecordingOn?: boolean }

// 毎フレームの写し取りを始める。最初の 1 枚を写してから戻るので、この後の操作は必ず記録の中に入る。
// 始め直すと前の記録のループは自分が古くなったのを見て止まる
const startRecording = (page: Page) =>
  page.evaluate(
    ([shadowSelector, playerSelector, bubbleSelector, key, cols]) =>
      new Promise<void>((resolve, reject) => {
        const host: RecorderWindow = window
        const frame = document.querySelector<HTMLElement>('[data-village]')
        if (frame === null) {
          reject(new Error('村の枠が無い'))
          return
        }
        const recording: Recording = { cell: frame.clientWidth / cols, samples: [] }
        host.flightRecording = recording
        host.flightRecordingOn = true
        // 行列にして読むのは、translate の書き方(1 つにまとめる・軸ごとに分ける・反転を後ろに足す)に依らず位置を読むため。
        // ワールドを替えた直後は React が translate(calc(var(--cell) * n), …) を書き、DOMMatrixReadOnly はそれを読めずに投げる。
        // 投げたまま tick を抜けると次の rAF を頼めずに記録が止まるので、その時は null にして文字列を unparsed に残す
        const placementOf = (
          name: string,
          element: HTMLElement | null,
          unparsed: string[]
        ): Placement | null => {
          if (element === null || element.style.transform === '') return null
          const transform = element.style.transform
          try {
            const matrix = new DOMMatrixReadOnly(transform)
            return { transform, x: matrix.e, y: matrix.f, scale: matrix.d, flipped: matrix.a < 0 }
          } catch {
            unparsed.push(`${name}: ${transform}`)
            return null
          }
        }
        const boxOf = (element: Element | null): Box | null => {
          if (element === null) return null
          const { left, top, right, bottom } = element.getBoundingClientRect()
          return { left, top, right, bottom }
        }
        const tick = (at: number) => {
          if (host.flightRecording !== recording || host.flightRecordingOn !== true) return
          const shadow = document.querySelector<HTMLElement>(shadowSelector)
          const player = document.querySelector<HTMLElement>(playerSelector)
          const layer = document.querySelector<HTMLElement>('[data-world]')
          const unparsed: string[] = []
          recording.samples.push({
            at,
            world: layer?.getAttribute('data-world') ?? null,
            loop: frame.dataset.villageLoop ?? null,
            sprite: player?.dataset.sprite ?? null,
            flying: shadow?.dataset.flying ?? null,
            shadow: placementOf('shadow', shadow, unparsed),
            player: placementOf('player', player, unparsed),
            camera: placementOf('camera', layer, unparsed),
            frameBox: boxOf(frame),
            playerBox: boxOf(player),
            shadowBox: boxOf(shadow),
            bubbles: document.querySelectorAll(bubbleSelector).length,
            dialogs: document.querySelectorAll('[role="dialog"]').length,
            unparsed,
            saved: sessionStorage.getItem(key),
          })
          resolve()
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    [SHADOW, PLAYER, BUBBLE, POS_KEY, VIEW_COLS] as const
  )

// 写し取りを止めて記録を返す。歩行ループが最後に書いた値を写すフレームを 2 回挟んでから止める
const stopRecording = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Recording>((resolve, reject) => {
        const host: RecorderWindow = window
        const recording = host.flightRecording
        if (recording === undefined) {
          reject(new Error('記録を始めていない'))
          return
        }
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            host.flightRecordingOn = false
            resolve(recording)
          })
        )
      })
  )

// ---- 記録の読み方 ----

type Point = { x: number; y: number }
type Saved = { worldId: string; cell: Cell }

// 影の落ちる地上の位置(マス。マスの左上が整数)
const groundOf = (sample: FrameSample, cell: number): Point => {
  if (sample.shadow === null) throw new Error('影の transform が書かれていないフレームがある')
  return { x: sample.shadow.x / cell, y: sample.shadow.y / cell }
}

// 主人公の描かれた位置(マス)。飛んでいる間は地上の位置より浮き上がりの分だけ上
const drawnOf = (sample: FrameSample, cell: number): Point => {
  if (sample.player === null) throw new Error('主人公の transform が書かれていないフレームがある')
  return { x: sample.player.x / cell, y: sample.player.y / cell }
}

const isFlyingSprite = (sample: FrameSample) => (sample.sprite ?? '').startsWith(FLY_PREFIX)

// 写したコマの名前を重複なしで並べる
const distinct = (values: readonly (string | null)[]) =>
  [...new Set(values.map(value => value ?? ''))].sort()

// 影の中心が乗るマス。影の位置はマスの左上なので、半マス足して切り捨てる
const cellUnder = (p: Point): Cell => ({ x: Math.floor(p.x + 0.5), y: Math.floor(p.y + 0.5) })

// 線分 from→to に対する p の位置。along は線分の向きの割合(0 が出発・1 が着地)、off は線分からの距離(マス)
const onSegment = (p: Point, from: Point, to: Point) => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const along = ((p.x - from.x) * dx + (p.y - from.y) * dy) / (dx * dx + dy * dy)
  const t = Math.min(1, Math.max(0, along))
  return { along, off: Math.hypot(p.x - (from.x + dx * t), p.y - (from.y + dy * t)) }
}

const distanceBetween = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

// 前のフレームから平行移動した距離(px)。label は落ちた時にどの要素か分かるように付ける
const stepOf = (from: Placement | null, to: Placement | null, label: string) => {
  if (from === null || to === null)
    throw new Error(`${label}の transform を行列で読めないフレームがある`)
  return Math.hypot(to.x - from.x, to.y - from.y)
}

// 主人公の絵(32×32 の画布)の箱。体の箱(1×1.5 マス)の左右と上へ半マスずつ広げた 2×2 マス
// (scene.module.css の .player::before)
const spriteBoxOf = (sample: FrameSample, cell: number): Box => {
  if (sample.playerBox === null) throw new Error('主人公の箱を測れていないフレームがある')
  const { left, top, right, bottom } = sample.playerBox
  return { left: left - cell / 2, top: top - cell / 2, right: right + cell / 2, bottom }
}

const withinFrame = (box: Box, frame: Box) =>
  box.left >= frame.left - EDGE_PX &&
  box.top >= frame.top - EDGE_PX &&
  box.right <= frame.right + EDGE_PX &&
  box.bottom <= frame.bottom + EDGE_PX

// 主人公の絵か地上の影が村の枠からはみ出したフレーム。どちらがはみ出したかと、枠の上辺から絵の上端までのマス数を添える
const outsideFrame = (frames: readonly FrameSample[], cell: number) =>
  frames.flatMap(sample => {
    const { frameBox, shadowBox } = sample
    if (frameBox === null || shadowBox === null)
      throw new Error('枠か影の箱を測れていないフレームがある')
    const sprite = spriteBoxOf(sample, cell)
    const spriteOut = !withinFrame(sprite, frameBox)
    const shadowOut = !withinFrame(shadowBox, frameBox)
    if (!spriteOut && !shadowOut) return []
    const spriteTop = Math.round(((sprite.top - frameBox.top) / cell) * 100) / 100
    return [{ at: sample.at, spriteOut, shadowOut, spriteTop }]
  })

// 町の上端の近くで、浮き上がりのせいで主人公の絵が村の枠の上辺より上へ出たフレーム。
// 上端の行では立っているだけで絵が枠の上辺を越えるので、上辺と「同じ地上の位置に立った時の絵の上端」の高い方までは許す。
// 立った時の絵の上端は、描かれた絵の上端を浮き上がり(影と主人公の transform の縦の差)だけ下ろした所。
// 絵の左右・下辺と地上の影は、ほかのテストと同じく枠の中に収まるかを見る。上辺から絵の上端と立った時の上端までのマス数を添える
const raisedPastTop = (frames: readonly FrameSample[], cell: number) =>
  frames.flatMap(sample => {
    const { frameBox, shadowBox, shadow, player } = sample
    if (frameBox === null || shadowBox === null)
      throw new Error('枠か影の箱を測れていないフレームがある')
    if (shadow === null || player === null)
      throw new Error('影か主人公の transform を行列で読めないフレームがある')
    const sprite = spriteBoxOf(sample, cell)
    const standingTop = sprite.top + (shadow.y - player.y)
    const topOut = sprite.top < Math.min(frameBox.top, standingTop) - EDGE_PX
    const sidesOut = !withinFrame({ ...sprite, top: frameBox.top }, frameBox)
    const shadowOut = !withinFrame(shadowBox, frameBox)
    if (!topOut && !sidesOut && !shadowOut) return []
    const cellsBelowTop = (top: number) => Math.round(((top - frameBox.top) / cell) * 100) / 100
    return [
      {
        at: sample.at,
        topOut,
        sidesOut,
        shadowOut,
        spriteTop: cellsBelowTop(sprite.top),
        standingTop: cellsBelowTop(standingTop),
      },
    ]
  })

// 直線 from→to が上を通る、歩いては立てないマス(content/world.ts の配置から求める)
const blockedOnSegment = (world: World, from: Point, to: Point): Cell[] => {
  const steps = 256
  const found = new Map<string, Cell>()
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const cell = cellUnder({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
    if (!isWalkable(world, cell)) found.set(`${cell.x},${cell.y}`, cell)
  }
  return [...found.values()]
}

// 保存位置が変わった順の (ワールド, マス)。保存は到着したマスとワープの先でだけ走るので、到着の並びになる
const savedCells = (samples: readonly FrameSample[]): Saved[] => {
  const visited: Saved[] = []
  for (const { saved } of samples) {
    if (saved === null) continue
    const parsed = JSON.parse(saved) as Saved
    const last = visited.at(-1)
    const same =
      last !== undefined &&
      last.worldId === parsed.worldId &&
      last.cell.x === parsed.cell.x &&
      last.cell.y === parsed.cell.y
    if (same) continue
    visited.push({ worldId: parsed.worldId, cell: { x: parsed.cell.x, y: parsed.cell.y } })
  }
  return visited
}

// 同じワールドの中で 1 回飛んだ記録の区切り。before は飛ぶ直前、landed は降りた後の最初のフレーム
type FlightFrames = { before: FrameSample; flying: FrameSample[]; landed: FrameSample }
const flightOf = (samples: readonly FrameSample[]): FlightFrames => {
  const first = samples.findIndex(s => s.flying === 'true')
  const last = samples.findLastIndex(s => s.flying === 'true')
  expect(first, '飛ぶ前から記録し、飛ぶフレームを写せている').toBeGreaterThan(0)
  const flying = samples.slice(first, last + 1)
  const gaps = flying.filter(s => s.flying !== 'true')
  expect(gaps, '飛んでいる間が途切れずに 1 回だけ続く').toEqual([])
  const landed = samples[last + 1]
  if (landed === undefined) throw new Error('降りた後のフレームを記録していない')
  return { before: samples[first - 1], flying, landed }
}

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

// 地図の地点の印を押し、着いて歩行ループが眠るまでを記録する
const travelOnMap = async (page: Page, place: string, goal: Saved): Promise<Recording> => {
  const map = await openMap(page)
  await startRecording(page)
  await spotButton(map, place).click()
  await expect(map).toHaveCount(0)
  await expect.poll(() => readCell(page), { timeout: ARRIVE_MS }).toEqual(goal)
  await expectLoopIdle(page)
  return stopRecording(page)
}

// 自宅前から地図で経歴碑へ移る。直線が自宅の上を通る移動で、飛ぶ形を測るテストが共通に使う
const travelToMonument = async (page: Page) => {
  await goToTown(page)
  return travelOnMap(page, text.stops.monument.place, { worldId: town.id, cell: MONUMENT })
}

// 影が飛んでいる印を出す(飛び立った)まで待つ
const waitForTakeOff = (page: Page) =>
  page.waitForFunction(
    selector => document.querySelector(selector)?.getAttribute('data-flying') === 'true',
    SHADOW,
    { polling: 'raf', timeout: SLACK_MS }
  )

// ---- 地図で同じワールドの遠い地点へ ----

test('地図で遠い地点を選ぶと飛んで向かい、降りると歩く姿と地上の影に戻り、降りたマスだけが保存される', async ({
  page,
}) => {
  // 経歴碑は自宅前から縦の差の方が大きい上にあるので、上を向いて飛ぶ
  const rise = TOWN_ENTRY.y - MONUMENT.y
  expect(rise, '経歴碑は自宅前の上寄り').toBeGreaterThan(Math.abs(MONUMENT.x - TOWN_ENTRY.x))
  const { samples } = await travelToMonument(page)
  const { before, flying } = flightOf(samples)
  expect(before.flying, '飛ぶ前の影は地上の印').toBe('false')
  // 飛ぶ間は上向きの羽ばたく 2 コマを交互に出す
  const flyingSprites = distinct(flying.map(s => s.sprite))
  expect(flyingSprites, '飛ぶ間のコマ').toEqual(['player-fly-up-0', 'player-fly-up-1'])
  // 飛ぶコマと影の印は、記録したどのフレームでも揃う(片方だけ書き忘れる・遅れる配線はここで落ちる)
  const mismatched = samples.filter(s => isFlyingSprite(s) !== (s.flying === 'true'))
  expect(mismatched, '飛ぶコマと影の印が食い違ったフレーム').toEqual([])
  // 飛んでいる間も歩行ループは眠らない
  const asleep = flying.filter(s => s.loop !== 'running')
  expect(asleep, '飛んでいる間に眠ったフレーム').toEqual([])
  // 通り過ぎるマスでは到着せず(保存位置が変わらない)、降りたマスで 1 回だけ到着する
  expect(savedCells(samples), '保存位置が変わった順').toEqual([
    { worldId: town.id, cell: TOWN_ENTRY },
    { worldId: town.id, cell: MONUMENT },
  ])
  // 降りた後は上向きの立ち姿と、地上の影
  const rest = samples[samples.length - 1]
  expect(rest.sprite, '降りた後のコマ').toBe('player-up-0')
  expect(rest.flying, '降りた後の影').toBe('false')
  await expect(page.locator(PLAYER)).toHaveAttribute('data-sprite', 'player-up-0')
  await expect(page.locator(SHADOW)).toHaveAttribute('data-flying', 'false')
  expect(await readCell(page)).toEqual({ worldId: town.id, cell: MONUMENT })
})

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

test('出発と着地を結ぶ直線の上を飛び、歩いては通れない家の上も越える', async ({ page }) => {
  // 自宅前から経歴碑への直線は自宅の上を通る。配置が変わって通らなくなったら、測る前にここで落とす
  const blocked = blockedOnSegment(town, TOWN_ENTRY, MONUMENT)
  expect(blocked.length, '直線が歩いては立てないマスの上を通る').toBeGreaterThan(0)
  const { cell, samples } = await travelToMonument(page)
  const grounds = flightOf(samples).flying.map(s => groundOf(s, cell))
  const placed = grounds.map(p => onSegment(p, TOWN_ENTRY, MONUMENT))
  const strayed = placed.filter(p => p.off > LINE_TOLERANCE)
  expect(strayed, '出発と着地を結ぶ線分から外れた影').toEqual([])
  // 出発から着地へ戻らずに進み、最後は降りるマスの上
  const backwards = placed.filter((p, i) => i > 0 && p.along < placed[i - 1].along - 1e-3)
  expect(backwards, '後戻りした影').toEqual([])
  const landingGap = distanceBetween(grounds[grounds.length - 1], MONUMENT)
  expect(landingGap, '飛ぶ最後の影から降りるマスまで').toBeLessThanOrEqual(LINE_TOLERANCE)
  // 歩いては立てないマスの上を通ったフレームがある(歩けば遠回りする道を、飛んで真っすぐ越えた)
  const overBlocked = grounds.filter(p => !isWalkable(town, cellUnder(p)))
  expect(overBlocked.length, '家の上を通ったフレームの数').toBeGreaterThan(0)
})

test('飛ぶ速さは飛び立ちが最も速く降りる前に緩み、飛ぶ長さは距離で決まる', async ({ page }) => {
  const { cell, samples } = await travelToMonument(page)
  const { flying, landed } = flightOf(samples)
  const start = flying[0].at
  const span = landed.at - start
  // 出発のマスから影までの直線距離(マス)
  const travelled = (sample: FrameSample) => distanceBetween(groundOf(sample, cell), TOWN_ENTRY)
  // at 以前で最後に飛んでいたフレーム
  const lastAtOrBefore = (at: number) => {
    const hit = flying.findLast(s => s.at <= at)
    if (hit === undefined) throw new Error(`${at}ms 以前に飛んでいるフレームが無い`)
    return hit
  }
  // 経過時間の前の 1/3 と後ろの 1/3 に進んだ距離。減速なら前が後ろの何倍にもなる(等速なら同じ)
  const firstThird = travelled(lastAtOrBefore(start + span / 3)) - travelled(flying[0])
  const lastThird = travelled(landed) - travelled(lastAtOrBefore(landed.at - span / 3))
  expect(lastThird, '後ろの 1/3 も止まらずに進む').toBeGreaterThan(0)
  expect(firstThird, '前の 1/3 に進んだマス数').toBeGreaterThan(lastThird * 3)
  // 飛び立ってから降りるまでの長さは、直線距離から決まる長さと 1 フレームの揺れの内で一致する。
  // 歩行ループへ渡す経過の取り違え(秒と ms・1 フレームに 2 回進める)はここで落ちる
  const expected = flightDurationMs(distanceBetween(MONUMENT, TOWN_ENTRY))
  const frames = [...flying, landed]
  const longest = Math.max(...frames.slice(1).map((s, i) => s.at - frames[i].at))
  const drift = Math.abs(span - expected)
  const note = `飛んだ ${span}ms・距離で決まる長さ ${expected}ms・最長の 1 フレーム ${longest}ms`
  expect(drift, note).toBeLessThanOrEqual(longest * 2 + 5)
})

test('飛んでいる間は主人公が影より上に浮き、影は高いほど小さく、降りると影と重なる', async ({
  page,
}) => {
  const { cell, samples } = await travelToMonument(page)
  const { flying, landed } = flightOf(samples)
  const onePx = 1 / cell
  // 浮くのは上へだけ。横にはずれず、影より下にも描かない
  const sideways = flying.filter(s => Math.abs(drawnOf(s, cell).x - groundOf(s, cell).x) > onePx)
  expect(sideways, '主人公と影が横にずれたフレーム').toEqual([])
  const sunk = flying.filter(s => drawnOf(s, cell).y > groundOf(s, cell).y + onePx)
  expect(sunk, '主人公が影より下に描かれたフレーム').toEqual([])
  // 飛ぶ時間の真ん中に最も近いフレームでは高く浮き、影は等倍より小さい
  const middleAt = (flying[0].at + landed.at) / 2
  const fromMiddle = flying.map(s => Math.abs(s.at - middleAt))
  const middle = flying[fromMiddle.indexOf(Math.min(...fromMiddle))]
  const lift = groundOf(middle, cell).y - drawnOf(middle, cell).y
  expect(lift, '飛ぶ途中で影より上に浮く高さ(マス)').toBeGreaterThan(1)
  expect(middle.shadow?.scale, '飛ぶ途中の影の倍率').toBeLessThan(0.9)
  // 降りて眠った後は主人公と影が同じ位置に重なり、影は等倍
  const rest = samples[samples.length - 1]
  const restGap = {
    x: Math.abs(drawnOf(rest, cell).x - groundOf(rest, cell).x),
    y: Math.abs(drawnOf(rest, cell).y - groundOf(rest, cell).y),
  }
  expect(restGap.x, '降りた後の主人公と影の横の差').toBeLessThanOrEqual(onePx)
  expect(restGap.y, '降りた後の主人公と影の縦の差').toBeLessThanOrEqual(onePx)
  expect(rest.shadow?.scale, '降りた後の影の倍率').toBeCloseTo(1, 2)
})

test('飛ぶ間のカメラは主人公に付いて動き、1 フレームで影と主人公の動いた分を超えて跳ばない', async ({
  page,
}) => {
  const { cell, samples } = await travelToMonument(page)
  const { before, landed } = flightOf(samples)
  // 飛ぶ直前のフレームから、降りて眠るまでの隣り合うフレームを比べる
  const span = samples.slice(samples.indexOf(before))
  const steps = span.slice(1).map((sample, i) => ({
    at: sample.at,
    camera: stepOf(span[i].camera, sample.camera, 'ワールドの層'),
    ground: stepOf(span[i].shadow, sample.shadow, '影'),
    drawn: stepOf(span[i].player, sample.player, '主人公'),
  }))
  // カメラは地上の影と浮いた主人公のちょうど間(浮いた高さの半分だけ上)を狙うので、1 フレームに動く距離は
  // 影と主人公の動いた距離の大きい方を超えない。影だけと比べないのは、上へ飛ぶ時は持ち上げの分だけカメラが
  // 影より速く動くため(経歴碑へは飛び立ちで影の約 1.33 倍)。追従が遅れて 1.5 マスで補間をやめ、
  // 目標へ一気に飛ぶ壊れ方はここで落ちる
  const jumps = steps.filter(s => s.camera > Math.max(s.ground, s.drawn) * CAMERA_SLACK + ROUND_PX)
  expect(jumps, '1 フレームで跳んだカメラ(px)').toEqual([])
  // 対照: 層の transform を写せていて、カメラは記録の中で実際に上へ動いた
  // (自宅前の原点 8 行目から、町の上端で止まる 0 行目まで)
  const beforeCamera = before.camera
  const landedCamera = landed.camera
  if (beforeCamera === null || landedCamera === null) throw new Error('層の位置を写せていない')
  const rose = (landedCamera.y - beforeCamera.y) / cell
  expect(rose, 'カメラが上へ動いたマス数').toBeGreaterThan(4)
})

test('飛ぶ間のどのフレームでも、主人公の絵と地上の影は村の枠の中に収まる', async ({ page }) => {
  const { cell, samples } = await travelToMonument(page)
  const { flying } = flightOf(samples)
  expect(outsideFrame(flying, cell), '枠からはみ出したフレーム').toEqual([])
})

test('町で最も上の地点へ飛ぶ間も、浮き上がりで絵が枠の上辺より上へ出ず(立っているだけで出る所では浮かない)、影は枠の中に収まる', async ({
  page,
}) => {
  // カメラは町の上端より上を映せないので、上端の行へ降りる飛行は主人公の絵の逃げ場が最も少ない。
  // 上端の近くでは枠に残った分だけ浮き、上端の行のように立っているだけで絵が枠の上へ出る所では浮かない
  expect(TOP_SPOT.cell.y, '最も上の地点は町の上端の行').toBe(0)
  const reach = distanceBetween(TOP_SPOT.cell, TOWN_ENTRY)
  expect(reach, '飛ぶ最小の直線距離に届く').toBeGreaterThanOrEqual(FLIGHT_MIN_DISTANCE)
  await goToTown(page)
  const goal = { worldId: town.id, cell: TOP_SPOT.cell }
  const { cell, samples } = await travelOnMap(page, TOP_PLACE, goal)
  const { flying } = flightOf(samples)
  expect(raisedPastTop(flying, cell), '浮き上がりで枠の上辺より上へ出たフレーム').toEqual([])
  // 上限で浮き上がりを抑えても飛ぶこと自体は残る。飛ぶ間は上向きの羽ばたくコマで、途中では高く浮く
  const flyingSprites = distinct(flying.map(s => s.sprite))
  expect(flyingSprites, '最も上の地点へ飛ぶ間のコマ').toEqual([
    'player-fly-up-0',
    'player-fly-up-1',
  ])
  const lifts = flying.map(s => groundOf(s, cell).y - drawnOf(s, cell).y)
  expect(Math.max(...lifts), '最も上の地点へ飛ぶ間に最も高く浮いたマス数').toBeGreaterThan(1)
  // 対照: 立っているだけで絵が枠の上辺を越える所(上端の行の近く)を飛ぶフレームを記録できている
  const overWhenStanding = flying.filter(s => {
    const { frameBox } = s
    if (frameBox === null) throw new Error('枠の箱を測れていないフレームがある')
    const lifted = groundOf(s, cell).y - drawnOf(s, cell).y
    return spriteBoxOf(s, cell).top + lifted * cell < frameBox.top - EDGE_PX
  })
  expect(
    overWhenStanding.length,
    '立っているだけで絵が枠の上辺を越える所を飛んだフレーム数'
  ).toBeGreaterThan(0)
})

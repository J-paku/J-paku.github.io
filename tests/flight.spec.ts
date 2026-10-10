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

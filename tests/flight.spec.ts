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
import { findPath } from '@/lib/village/path'
import { routeToWarp } from '@/lib/village/warp'
// 飛ぶ長さと飛ぶ最小の直線距離は lib 側が正本。ここに数値を書き写すと片方だけ動いた時に気付けない
import { FLIGHT_MIN_DISTANCE } from '@/lib/village/flight-curve'
// 1 マスの px は、歩行ループ(paint-camera)と同じく枠の幅をこの列数で割って出す
import { VIEW_COLS } from '@/components/VillagePage/components/Village/utils/stage-scale'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・1 マス分だけ押す press・天気の差し替えと、既定で晴れを敷く test、
// 位置の保存先 POS_KEY・保存された現在地を読む readCell・歩行ループの眠りを待つ expectLoopIdle・待ち時間の上乗せ SLACK_MS は
// 他の村の spec と共用。正本は village.helpers.ts
import {
  POS_KEY,
  expectLoopIdle,
  openVillage,
  readCell,
  stubWeather,
  test,
  walk,
} from './village.helpers'

const PLAYER = '[data-village-player]'
// 飛ぶ間に地上の位置へ落とす影。data-flying は飛んでいる間だけ 'true'、それ以外は 'false'
const SHADOW = '[data-flight-shadow]'
// 地点の上の吹き出しと、話せる相手がいない時の頭上の考え事(どちらも TalkBubble)
const BUBBLE = '[data-village-bubble]'
// 飛ぶコマの頭。続きは向き(down / up / right。左は right の反転)と、雲の縁だけが変わる 0 / 1
const FLY_PREFIX = 'player-fly-'
// 普段の歩きのコマのうち足を出したもの(1・2)。歩いた証拠に使う。左向きは right の反転なので up / down / right だけ
const WALKING = /^player-(up|down|right)-[12]$/
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
const EXIT_MAT = exitWarp.cell
const TOWN_ENTRY = exitWarp.target.cell
// 町の自宅の扉(壁の扉。通れないマス)と、ぶつかった時に戻る部屋の出口手前
const doorWarp = town.warps.find(w => w.target.worldId === room.id)
if (doorWarp === undefined) throw new Error('町に部屋へ戻る扉が無い')
const HOME_DOOR = doorWarp.cell
const ROOM_ENTRY = doorWarp.target.cell

// 地点の立ち位置。経歴碑は自宅前から真上寄りで、直線は自宅の屋根と壁の上を通る。
// 研究所は自宅前から右上で、横の差の方が大きい。名刺工房 → 研究所は次へで巡る順
const MONUMENT = spotCell(town, 'monument')
const LAB = spotCell(town, 'lab')
const MEISHI = spotCell(town, 'meishi')
const PC = spotCell(room, 'home')

// 町で最も上(y が最小)の地点。北の道の突き当たりにあり、カメラは町の上端で止まる
const TOP_SPOT = town.spots.reduce((top, spot) => (spot.cell.y < top.cell.y ? spot : top))
const topSpotText = text.stops[TOP_SPOT.id]
if (topSpotText === undefined) throw new Error(`地点 ${TOP_SPOT.id} の文言が無い`)

// 舞台を押して歩く先。自宅前から横か縦へまっすぐ 4 マス(無ければ 3 マス)先の、歩けて扉でも地点の立ち位置でもないマス。
// 直線距離が飛ぶ最小の距離に届くので、押した移動を自動移動と取り違えていれば飛んでしまう。
// 自宅前ではカメラが端で止まらず、枠には主人公から上下左右へ 4 マスまでが映る
const TAP_GOAL = (() => {
  const offsets = [4, 3].flatMap(n => [
    { x: n, y: 0 },
    { x: -n, y: 0 },
    { x: 0, y: n },
    { x: 0, y: -n },
  ])
  const picked = offsets
    .map(d => ({ x: TOWN_ENTRY.x + d.x, y: TOWN_ENTRY.y + d.y }))
    .find(cell => {
      if (!isWalkable(town, cell)) return false
      if (town.warps.some(w => w.cell.x === cell.x && w.cell.y === cell.y)) return false
      if (town.spots.some(s => s.cell.x === cell.x && s.cell.y === cell.y)) return false
      const route = findPath(town, TOWN_ENTRY, cell)
      const straight = Math.abs(cell.x - TOWN_ENTRY.x) + Math.abs(cell.y - TOWN_ENTRY.y)
      return route !== null && route.length === straight
    })
  if (picked === undefined) throw new Error('自宅前からまっすぐ押して歩けるマスが無い')
  return picked
})()

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

// 線分 from→to に対する p の位置。along は線分の向きの割合(0 が出発・1 が着地)、off は線分からの距離(マス)
const onSegment = (p: Point, from: Point, to: Point) => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const along = ((p.x - from.x) * dx + (p.y - from.y) * dy) / (dx * dx + dy * dy)
  const t = Math.min(1, Math.max(0, along))
  return { along, off: Math.hypot(p.x - (from.x + dx * t), p.y - (from.y + dy * t)) }
}

const distanceBetween = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

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

// 村を開き、部屋の出口のマットまで歩いて町の自宅前へ出る
const goToTown = async (page: Page) => {
  await openVillage(page, '')
  expect(await walk(page, 'ArrowDown', 3), '部屋の出口のマットまで歩いて町へ出る').toBe(3)
  expect(await readCell(page)).toEqual({ worldId: town.id, cell: TOWN_ENTRY })
}

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

// ワールド層の位置が数フレーム動かなくなるまで待ち、その原点と --cell からマスの真ん中の画面位置を返す
const settledCellPoint = (page: Page, target: Cell) =>
  page.locator('[data-world]').evaluate(async (layer, cell) => {
    let previous = ''
    let still = 0
    while (still < 5) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      const rect = layer.getBoundingClientRect()
      const position = `${rect.x},${rect.y}`
      still = position === previous ? still + 1 : 0
      previous = position
    }
    const rect = layer.getBoundingClientRect()
    const size = parseFloat(getComputedStyle(layer).getPropertyValue('--cell'))
    return { x: rect.x + (cell.x + 0.5) * size, y: rect.y + (cell.y + 0.5) * size }
  }, target)

// 押す位置が村の枠の中にあり、ボタン・リンク(ミニマップなど)に重なっていないか
// (枠の外ならページを、ボタンの上ならそのボタンを押してしまい、舞台のタップにならない)
const tappableOnStage = (page: Page, point: Point) =>
  page.evaluate(({ x, y }) => {
    const frame = document.querySelector('[data-village]')
    if (frame === null) return false
    const box = frame.getBoundingClientRect()
    const inside = x > box.left && x < box.right && y > box.top && y < box.bottom
    return inside && document.elementFromPoint(x, y)?.closest('button, a') === null
  }, point)

test.describe('動きを控える設定', () => {
  test.use({ reducedMotion: 'reduce' })

  test('地図で遠い地点を選んでも飛ばず、今までどおり 1 マスずつ歩いて着く', async ({ page }) => {
    const route = findPath(town, TOWN_ENTRY, MONUMENT)
    if (route === null) throw new Error('自宅前から経歴碑へ歩けない')
    const { samples } = await travelToMonument(page)
    const raised = samples.filter(s => s.flying === 'true')
    expect(raised, '影が飛んでいる印を出したフレーム').toEqual([])
    expect(samples.filter(isFlyingSprite), '飛ぶコマを描いたフレーム').toEqual([])
    // 道のりのマスに 1 つずつ到着しながら進む(家の上を飛び越さない)
    const visited = savedCells(samples).map(saved => saved.cell)
    expect(visited, '保存位置が変わった順').toEqual([TOWN_ENTRY, ...route])
  })
})

// ---- 別のワールドへ ----

test('地図で番号 1 の自室を選ぶと、町では扉の隣まで飛んでから扉へ入り、部屋の PC の前に着く', async ({
  page,
}) => {
  // 自宅前から右へ 3 マスの道から向かう。扉までの経路は扉で終わり、その手前の自宅前が降りるマス
  const start = { x: TOWN_ENTRY.x + 3, y: TOWN_ENTRY.y }
  const route = routeToWarp(town, start, room.id)
  if (route === null) throw new Error('自宅前の右から扉への経路が無い')
  const landingIndex = route.findLastIndex(c => isWalkable(town, c))
  const landing = route[landingIndex]
  expect(route.slice(landingIndex + 1), '降りた後に歩くのは扉への 1 歩').toEqual([HOME_DOOR])
  expect(landing, '降りるのは扉の隣の自宅前').toEqual(TOWN_ENTRY)
  const reach = distanceBetween(start, landing)
  expect(reach, '飛ぶ最小の直線距離に届く').toBeGreaterThanOrEqual(FLIGHT_MIN_DISTANCE)

  await goToTown(page)
  expect(await walk(page, 'ArrowRight', 3), '自宅前から右へ 3 マス').toBe(3)
  expect(await readCell(page)).toEqual({ worldId: town.id, cell: start })
  const toPc = { worldId: room.id, cell: PC }
  const { cell, samples } = await travelOnMap(page, text.stops.home.place, toPc)
  await expect(page.locator('[data-world]')).toHaveAttribute('data-world', room.id)

  // 町で飛んだフレーム。扉の隣へ降りたフレームで扉を通り、部屋のタイルが載るまで歩行ループは描き直さないが、
  // その間も影の飛ぶ印は下ろす。ワールドを替えた直後に React が書く calc 入りの transform は行列にできず
  // placement が null になるが、そのフレームは部屋([data-world] が room)なのでここには入らない
  const townFlying = samples.filter(s => s.world === town.id && s.flying === 'true')
  expect(townFlying.length, '町で飛んだフレームの数').toBeGreaterThan(0)
  const unparsedInTown = samples.filter(s => s.world === town.id && s.unparsed.length > 0)
  expect(unparsedInTown, '町のフレームで行列にできなかった transform').toEqual([])
  // 左向きは右向きの飛ぶコマを左右反転して描く
  const townSprites = distinct(townFlying.map(s => s.sprite))
  expect(townSprites, '町で飛ぶ間のコマ').toEqual(['player-fly-right-0', 'player-fly-right-1'])
  const unflipped = townFlying.filter(s => s.player?.flipped !== true)
  expect(unflipped, '左へ飛ぶのに反転していないフレーム').toEqual([])
  // 飛び立ったマスと扉の隣を結ぶ線分の上だけを通る(扉のマスへは飛び込まない)
  const grounds = townFlying.map(s => groundOf(s, cell))
  const strayed = grounds.filter(p => onSegment(p, start, landing).off > LINE_TOLERANCE)
  expect(strayed, '飛び立ったマスと扉の隣を結ぶ線分から外れた影').toEqual([])
  const landingGap = distanceBetween(grounds[grounds.length - 1], landing)
  expect(landingGap, '町で飛んだ最後の影から扉の隣まで').toBeLessThanOrEqual(LINE_TOLERANCE)
  // 部屋でも出口手前から PC の前へ飛ぶ。部屋で飛ぶ印を出したフレームの影は、その線分の上にだけある。
  // 町で飛んでいた印と位置を、部屋のタイルを待つ間に下ろし忘れると、部屋に町の座標の影が残ってここで落ちる
  const roomGrounds = samples
    .filter(s => s.world === room.id && s.flying === 'true')
    .map(s => groundOf(s, cell))
  const stale = roomGrounds.filter(p => onSegment(p, ROOM_ENTRY, PC).off > LINE_TOLERANCE)
  expect(stale, '部屋で飛ぶ印を出したのに、出口手前と PC の前を結ぶ線分から外れた影').toEqual([])

  // 町では飛び立ったマスと扉の隣のほかで到着しない(扉の隣の到着は、同じフレームで扉を通った保存に
  // 上書きされて記録に残らないこともある)。部屋では出口手前から PC の前へ着く
  const visited = savedCells(samples)
  const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y
  const endpoints = [start, landing]
  const inTown = visited.filter(v => v.worldId === town.id).map(v => v.cell)
  const midway = inTown.filter(c => !endpoints.some(e => sameCell(e, c)))
  expect(midway, '町で途中のマスに到着した記録').toEqual([])
  const inRoom = visited.filter(v => v.worldId === room.id).map(v => v.cell)
  expect(inRoom[0], '扉を通って最初に立つ部屋のマス').toEqual(ROOM_ENTRY)
  expect(inRoom[inRoom.length - 1], '最後に着く部屋のマス').toEqual(PC)
})

// ---- 会話窓の「次へ」 ----

test('会話窓の「次へ」でも飛ぶ。部屋では出口のマットへ、町では次の地点へ直線で飛ぶ', async ({
  page,
}) => {
  const { home, meishi, lab } = text.stops
  await openVillage(page, '')
  const dialog = page.getByRole('dialog')
  await page.keyboard.press('e')
  await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()

  // 自室の次は町の名刺工房。部屋では PC の前から出口のマットまで飛び、町へ出て名刺工房の前で会話窓が開く
  await startRecording(page)
  await dialog.getByRole('button', { name: home.next }).click()
  const meishiTitle = dialog.getByRole('heading', { name: meishi.title })
  await expect(meishiTitle).toBeVisible({ timeout: ARRIVE_MS })
  const toMeishi = await stopRecording(page)
  expect(await readCell(page)).toEqual({ worldId: town.id, cell: MEISHI })
  const roomFlying = toMeishi.samples.filter(s => s.world === room.id && s.flying === 'true')
  expect(roomFlying.length, '部屋で飛んだフレームの数').toBeGreaterThan(0)
  const roomSprites = distinct(roomFlying.map(s => s.sprite))
  expect(roomSprites, '部屋で飛ぶ間のコマ').toEqual(['player-fly-down-0', 'player-fly-down-1'])
  const roomGrounds = roomFlying.map(s => groundOf(s, toMeishi.cell))
  const roomStrayed = roomGrounds.filter(p => onSegment(p, PC, EXIT_MAT).off > LINE_TOLERANCE)
  expect(roomStrayed, 'PC の前と出口のマットを結ぶ線分から外れた影').toEqual([])
  // 部屋の中のマスでは到着しない(歩けば出口手前までの 2 マスで到着する)
  const roomArrivals = savedCells(toMeishi.samples).filter(v => v.worldId === room.id)
  expect(roomArrivals, '部屋の中で到着した記録').toEqual([])

  // 名刺工房の次は同じ町の研究所。名刺工房の前から研究所の前まで直線で飛び、着くと会話窓が開く
  await startRecording(page)
  await dialog.getByRole('button', { name: meishi.next }).click()
  const labTitle = dialog.getByRole('heading', { name: lab.title })
  await expect(labTitle).toBeVisible({ timeout: ARRIVE_MS })
  await expectLoopIdle(page)
  const toLab = await stopRecording(page)
  expect(await readCell(page)).toEqual({ worldId: town.id, cell: LAB })
  const { flying } = flightOf(toLab.samples)
  const townSprites = distinct(flying.map(s => s.sprite))
  expect(townSprites, '町で飛ぶ間のコマ').toEqual(['player-fly-right-0', 'player-fly-right-1'])
  const townGrounds = flying.map(s => groundOf(s, toLab.cell))
  const townStrayed = townGrounds.filter(p => onSegment(p, MEISHI, LAB).off > LINE_TOLERANCE)
  expect(townStrayed, '名刺工房の前と研究所の前を結ぶ線分から外れた影').toEqual([])
  expect(savedCells(toLab.samples), '保存位置が変わった順').toEqual([
    { worldId: town.id, cell: MEISHI },
    { worldId: town.id, cell: LAB },
  ])
})

// ---- 雨の日 ----

test('雨の日も飛ぶ間は傘を差さない飛ぶコマで、降りると傘を差した姿へ戻る', async ({ page }) => {
  await stubWeather(page, 'rain')
  await goToTown(page)
  // 町へ出ると戸口で傘を開く。開き終えて歩行ループが眠る(傘のコマも入力の錠も終わる)まで待つ
  await expect(page.locator(PLAYER)).toHaveAttribute('data-sprite', 'player-umbrella-down-0')
  await expectLoopIdle(page)
  const toMonument = { worldId: town.id, cell: MONUMENT }
  const { samples } = await travelOnMap(page, text.stops.monument.place, toMonument)
  const sprites = distinct(flightOf(samples).flying.map(s => s.sprite))
  expect(sprites, '雨の日に飛ぶ間のコマ').toEqual(['player-fly-up-0', 'player-fly-up-1'])
  const rest = samples[samples.length - 1]
  expect(rest.sprite, '降りた後のコマ').toBe('player-umbrella-up-0')
  await expect(page.locator(PLAYER)).toHaveAttribute('data-sprite', 'player-umbrella-up-0')
})

// ---- 舞台のタップ ----

test('舞台の遠いマスを押した時は飛ばず、1 マスずつ歩いて着く', async ({ page }) => {
  const reach = distanceBetween(TAP_GOAL, TOWN_ENTRY)
  expect(reach, '自動移動なら飛ぶ直線距離').toBeGreaterThanOrEqual(FLIGHT_MIN_DISTANCE)
  const route = findPath(town, TOWN_ENTRY, TAP_GOAL)
  if (route === null) throw new Error('自宅前から押すマスへ歩けない')
  await goToTown(page)
  const point = await settledCellPoint(page, TAP_GOAL)
  expect(await tappableOnStage(page, point), '押す位置は枠の中でボタンに重ならない').toBe(true)
  await startRecording(page)
  await page.mouse.click(point.x, point.y)
  const atGoal = { worldId: town.id, cell: TAP_GOAL }
  await expect.poll(() => readCell(page), { timeout: ARRIVE_MS }).toEqual(atGoal)
  await expectLoopIdle(page)
  const { samples } = await stopRecording(page)
  const raised = samples.filter(s => s.flying === 'true')
  expect(raised, '影が飛んでいる印を出したフレーム').toEqual([])
  expect(samples.filter(isFlyingSprite), '飛ぶコマを描いたフレーム').toEqual([])
  // 道のりのマスに 1 つずつ到着し、足を出した歩きのコマも描く
  const visited = savedCells(samples).map(saved => saved.cell)
  expect(visited, '保存位置が変わった順').toEqual([TOWN_ENTRY, ...route])
  const stepping = samples.filter(s => WALKING.test(s.sprite ?? ''))
  expect(stepping.length, '足を出した歩きのコマのフレーム数').toBeGreaterThan(0)
})

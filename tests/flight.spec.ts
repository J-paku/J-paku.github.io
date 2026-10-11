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
import { FLIGHT_MIN_DISTANCE, flightDurationMs } from '@/lib/village/flight-curve'
// 1 マスの px は、歩行ループ(paint-camera)と同じく枠の幅をこの列数で割って出す
import { VIEW_COLS } from '@/components/VillagePage/components/Village/utils/stage-scale'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・1 マス分だけ押す press・天気の差し替えと、既定で晴れを敷く test は
// 他の村の spec と共用。正本は village.helpers.ts
import { openVillage, press, stubWeather, test, walk } from './village.helpers'

// 位置の保存先。src/lib/preferences.ts の readPosition / writePosition と同じ組み立て
const POS_KEY = `village:${worldSet.id}:pos`
const PLAYER = '[data-village-player]'
// 飛ぶ間に地上の位置へ落とす影。data-flying は飛んでいる間だけ 'true'、それ以外は 'false'
const SHADOW = '[data-flight-shadow]'
// 地点の上の吹き出しと、話せる相手がいない時の頭上の考え事(どちらも TalkBubble)
const BUBBLE = '[data-village-bubble]'
// 飛ぶコマの頭。続きは向き(down / up / right。左は right の反転)と、雲の縁だけが変わる 0 / 1
const FLY_PREFIX = 'player-fly-'
// 普段の歩きのコマのうち足を出したもの(1・2)。歩いた証拠に使う。左向きは right の反転なので up / down / right だけ
const WALKING = /^player-(up|down|right)-[12]$/
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
// 写した飛ぶ長さが、距離で決まる長さから外れてよい幅(ms)。飛ぶ長さは、飛ぶ直前に地上で写したフレームから
// 降りた後の最初のフレームまでで測る。飛び立った最初のフレームから測ると、飛び立ちのフレーム(地図を閉じる処理と
// 飛び立ちの処理が重なる重いフレーム)の長さだけ短く出る。2026-10-11 の CPU 減速の probe 実測(経歴碑へ飛ぶ移動を
// 4 倍・6 倍の減速で各 20 回)では、飛び立った最初のフレームから測ったずれはどれも短い側で、4 倍で最大 92ms・
// 6 倍で最大 208.8ms(20 回中 5 回が 100ms 超え)。そのずれに飛び立ちのフレームの長さを足すと 40 回すべて
// 24.5〜24.6ms で、着地の側の 2 つの間隔は最長 16.8ms だった。いまの測り方ではずれが 4 倍・6 倍の減速でも約 25ms で
// 一定なので、20fps(1 フレーム 50ms)の 2 フレーム分の固定値にし、測ったフレームの長さからは決めない(重いランナーで
// 幅が広がり、取り違えを見逃すため。最長の 1 フレーム × 2 + 5ms の幅は 6 倍の減速で落ち、4 倍でも幅 38.6ms に対し
// ずれ 58.7ms の回があった)。1 フレームに 2 回進める取り違えは飛ぶ長さが半分(約 871ms 短く)になり、この幅でも落ちる
const FLIGHT_SPAN_SLACK_MS = 100

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
const MAILBOX = spotCell(town, 'mailbox')
const PC = spotCell(room, 'home')

// 町で最も上(y が最小)の地点。北の道の突き当たりにあり、カメラは町の上端で止まる
const TOP_SPOT = town.spots.reduce((top, spot) => (spot.cell.y < top.cell.y ? spot : top))
const topSpotText = text.stops[TOP_SPOT.id]
if (topSpotText === undefined) throw new Error(`地点 ${TOP_SPOT.id} の文言が無い`)
const TOP_PLACE = topSpotText.place

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

// 飛ぶ間のフレームのうち hit に当たったもの。index は飛ぶ間の何枚目か(0 が飛び立った最初のフレーム)で、
// 落ちた時に「飛び立ち直後の 1 枚だけ残った」のか「途中からずっと出ていた」のかを読み分けられるように添える
type FlyingHit = { index: number; at: number; bubbles: number; dialogs: number }
const flyingHits = (flying: readonly FrameSample[], hit: (sample: FrameSample) => boolean) =>
  flying.flatMap((sample, index): FlyingHit[] => {
    if (!hit(sample)) return []
    return [{ index, at: sample.at, bubbles: sample.bubbles, dialogs: sample.dialogs }]
  })

// 当たったフレームの index と at をメッセージの後ろへ書き足す。当たりが無ければ label のまま
const hitsNote = (label: string, flying: readonly FrameSample[], hits: readonly FlyingHit[]) => {
  if (hits.length === 0) return label
  const where = hits.map(h => `index ${h.index} at ${h.at.toFixed(1)}ms`).join('・')
  return `${label}(飛ぶ ${flying.length} フレームのうち ${where})`
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

// 押し離し・クリックの瞬間に、影が飛んでいる印を出していたかを控える。捕捉の段階で窓に付けるので村の枠より先に読む。
// クリックは key を 'click' として控える
type KeyMark = { type: string; key: string; flying: string | null }
type KeyWindow = Window & { flightKeys?: KeyMark[] }
const recordKeys = (page: Page) =>
  page.evaluate(selector => {
    const host: KeyWindow = window
    const marks: KeyMark[] = []
    host.flightKeys = marks
    const flyingNow = () => document.querySelector<HTMLElement>(selector)?.dataset.flying ?? null
    for (const type of ['keydown', 'keyup'] as const) {
      window.addEventListener(
        type,
        event => {
          if (event.repeat) return
          marks.push({ type, key: event.key, flying: flyingNow() })
        },
        true
      )
    }
    window.addEventListener(
      'click',
      () => {
        marks.push({ type: 'click', key: 'click', flying: flyingNow() })
      },
      true
    )
  }, SHADOW)

const readKeys = (page: Page, key: string) =>
  page.evaluate(wanted => {
    const host: KeyWindow = window
    return (host.flightKeys ?? []).filter(mark => mark.key === wanted)
  }, key)

// 影が飛んでいる印を出す(飛び立った)まで待つ
const waitForTakeOff = (page: Page) =>
  page.waitForFunction(
    selector => document.querySelector(selector)?.getAttribute('data-flying') === 'true',
    SHADOW,
    { polling: 'raf', timeout: SLACK_MS }
  )

// ---- 地図で同じワールドの遠い地点へ ----

// 自宅前から経歴碑へ地図で飛ぶ 1 回を写し、その記録から飛ぶ形を段(test.step)ごとに確かめる。
// 同じ移動を確かめることごとに走らせ直さない(所要と、並列に走る他のテストへの負荷を減らす)。
// 段は記録を読むだけで村を操作しないので、並べる順に意味は無い。前の段が落ちると後の段は走らない
test('地図で遠い地点を選んで飛ぶ 1 回の記録で、降りた姿と保存・道筋・速さ・浮き・カメラ・枠を確かめる', async ({
  page,
}) => {
  // 経歴碑は自宅前から縦の差の方が大きい上にあるので、上を向いて飛ぶ
  const rise = TOWN_ENTRY.y - MONUMENT.y
  expect(rise, '経歴碑は自宅前の上寄り').toBeGreaterThan(Math.abs(MONUMENT.x - TOWN_ENTRY.x))
  // 自宅前から経歴碑への直線は自宅の上を通る。配置が変わって通らなくなったら、測る前にここで落とす
  const blocked = blockedOnSegment(town, TOWN_ENTRY, MONUMENT)
  expect(blocked.length, '直線が歩いては立てないマスの上を通る').toBeGreaterThan(0)
  const { cell, samples } = await travelToMonument(page)
  const { before, flying, landed } = flightOf(samples)

  await test.step('飛んで向かい、降りると歩く姿と地上の影に戻り、降りたマスだけが保存される', async () => {
    expect(before.flying, '飛ぶ前の影は地上の印').toBe('false')
    // 飛ぶ間は上向きの雲に座った 2 コマを交互に出す
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

  await test.step('出発と着地を結ぶ直線の上を飛び、歩いては通れない家の上も越える', () => {
    const grounds = flying.map(s => groundOf(s, cell))
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

  await test.step('飛ぶ速さは飛び立ちと降りる前に緩く真ん中で最も速く、降りる前は横にも縦にも緩み、飛ぶ長さは距離で決まる', () => {
    const start = flying[0].at
    const span = landed.at - start
    // 飛ぶ間と、降りた後の最初のフレーム。隣り合う 2 フレームの間の長さの最長が 1 フレームの揺れ
    const frames = [...flying, landed]
    const longest = Math.max(...frames.slice(1).map((s, i) => s.at - frames[i].at))
    // 出発のマスから影までの直線距離と、影から主人公が浮いた高さ(どちらもマス)
    const travelled = (sample: FrameSample) => distanceBetween(groundOf(sample, cell), TOWN_ENTRY)
    const lifted = (sample: FrameSample) => groundOf(sample, cell).y - drawnOf(sample, cell).y
    // 飛ぶ長さの ratio(0 が飛び立ち・1 が降りた後の最初のフレーム)の時点の値。その時刻を挟む 2 フレームを
    // 時刻で線形に補う。区切りを近くのフレームへ寄せないので、遅いフレームでも区切りが前後へずれない
    const valueAt = (ratio: number, value: (sample: FrameSample) => number) => {
      // 浮動小数点の丸めで降りた後のフレームを越えないように抑える
      const at = Math.min(start + span * ratio, landed.at)
      const after = frames.findIndex(s => s.at >= at)
      if (after < 0) throw new Error(`${at}ms より後に記録したフレームが無い`)
      if (after === 0) return value(frames[0])
      const prev = frames[after - 1]
      const next = frames[after]
      const share = (at - prev.at) / (next.at - prev.at)
      return value(prev) + (value(next) - value(prev)) * share
    }
    // ratios の隣り合う区切りの間に、value が増えた量
    const gains = (ratios: readonly number[], value: (sample: FrameSample) => number) => {
      const points = ratios.map(ratio => valueAt(ratio, value))
      return points.slice(1).map((point, i) => point - points[i])
    }
    // 時間の前・真ん中・後ろの 1/3 に進んだマス数。今の曲線(離着陸で速さも加速度も 0 の五次)では 17 : 47 : 17。
    // 等速なら 1 : 1 : 1、飛び立ちが最も速い減速なら前が最も長く、着地へ向けて速まるなら後ろが最も長い
    const [firstThird, middleThird, lastThird] = gains([0, 1 / 3, 2 / 3, 1], travelled)
    expect(firstThird, '前の 1/3 に進んだマス数').toBeGreaterThan(0)
    expect(lastThird, '後ろの 1/3 に進んだマス数').toBeGreaterThan(0)
    expect(middleThird, '真ん中の 1/3 と前の 1/3 の 2 倍').toBeGreaterThan(firstThird * 2)
    expect(middleThird, '真ん中の 1/3 と後ろの 1/3 の 2 倍').toBeGreaterThan(lastThird * 2)
    // 前と後ろの 1/3 は同じだけ進む。2 つの区切りがそれぞれ最長の 1 フレームずれ、その間を最も速く進んだとしても
    // 収まる差まで許す。1 フレームの速さは、その間に進んだマス数を間の長さ(ms)で割る
    const speedBetween = (from: FrameSample, to: FrameSample) =>
      (travelled(to) - travelled(from)) / (to.at - from.at)
    const fastest = Math.max(...frames.slice(1).map((s, i) => speedBetween(frames[i], s)))
    const allowed = fastest * longest * 2
    const uneven = Math.abs(firstThird - lastThird)
    expect(uneven, '前と後ろの 1/3 に進んだマス数の差').toBeLessThanOrEqual(allowed)
    // 降りる前の 1/4 は、横(影の進み)も縦(浮いた高さ)も速さを落としながら座ったまま降りる。
    // 今の曲線では 3/4 の時点で残りの距離は全体の約 10%、高さは最も高い時の約 42% で、続く 1/8 ずつに
    // 進む距離は全体の約 8.7% → 1.6%、下りる高さは最も高い時の約 34% → 8%。後の 1/8 は前の 1/8 の半分に届かない
    const [earlyAlong, lateAlong] = gains([3 / 4, 7 / 8, 1], travelled)
    const [earlyDrop, lateDrop] = gains([3 / 4, 7 / 8, 1], s => -lifted(s))
    expect(lateAlong, '降りる前の最後の 1/8 に進んだマス数').toBeLessThan(earlyAlong / 2)
    expect(lateDrop, '降りる前の最後の 1/8 に下りたマス数').toBeLessThan(earlyDrop / 2)
    // 飛ぶ直前に地上で写したフレームから降りた後の最初のフレームまでの長さは、直線距離から決まる長さと
    // FLIGHT_SPAN_SLACK_MS の内で一致する。飛び立った最初のフレームから測らないのは、飛び立ちのフレームの
    // 長さだけ短く出るため(実測は FLIGHT_SPAN_SLACK_MS の注釈)。
    // 歩行ループへ渡す経過の取り違え(秒と ms・1 フレームに 2 回進める)はここで落ちる。
    // 幅は最長のフレームから決めない。決めると重いランナーほど幅が広がり、取り違えを通してしまう
    const expected = flightDurationMs(distanceBetween(MONUMENT, TOWN_ENTRY))
    const flown = landed.at - before.at
    const drift = Math.abs(flown - expected)
    const note = `飛んだ ${flown}ms・距離で決まる長さ ${expected}ms・最長の 1 フレーム ${longest}ms`
    expect(drift, note).toBeLessThanOrEqual(FLIGHT_SPAN_SLACK_MS)
  })

  await test.step('飛んでいる間は主人公が影より上に浮き、影は高いほど小さく、降りると影と重なる', () => {
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

  await test.step('飛ぶ間のカメラは主人公に付いて動き、1 フレームで影と主人公の動いた分を超えて跳ばない', () => {
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
    // 影より速く動くため(経歴碑へは飛び立ちで影の約 1.76 倍)。追従が遅れて 1.5 マスで補間をやめ、
    // 目標へ一気に飛ぶ壊れ方はここで落ちる
    const jumps = steps.filter(
      s => s.camera > Math.max(s.ground, s.drawn) * CAMERA_SLACK + ROUND_PX
    )
    expect(jumps, '1 フレームで跳んだカメラ(px)').toEqual([])
    // 対照: 層の transform を写せていて、カメラは記録の中で実際に上へ動いた
    // (自宅前の原点 8 行目から、町の上端で止まる 0 行目まで)
    const beforeCamera = before.camera
    const landedCamera = landed.camera
    if (beforeCamera === null || landedCamera === null) throw new Error('層の位置を写せていない')
    const rose = (landedCamera.y - beforeCamera.y) / cell
    expect(rose, 'カメラが上へ動いたマス数').toBeGreaterThan(4)
  })

  await test.step('飛ぶ間のどのフレームでも、主人公の絵と地上の影は村の枠の中に収まる', () => {
    expect(outsideFrame(flying, cell), '枠からはみ出したフレーム').toEqual([])
  })
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
  // 上限で浮き上がりを抑えても飛ぶこと自体は残る。飛ぶ間は上向きの雲に座ったコマで、途中では高く浮く
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

test('飛んでいる間に方向キーを押しても、降りるマスも向きも変わらない', async ({ page }) => {
  // 研究所は自宅前から右上で横の差の方が大きいので、右を向いて飛び、右を向いたまま降りる
  const run = LAB.x - TOWN_ENTRY.x
  expect(run, '研究所は自宅前の右寄り').toBeGreaterThan(Math.abs(LAB.y - TOWN_ENTRY.y))
  // 降りた後に下へ 1 マス歩けるか(キーが村へ届いていることの対照に使う)
  const belowLab = { x: LAB.x, y: LAB.y + 1 }
  expect(isWalkable(town, belowLab), '研究所の前の 1 マス下は歩ける').toBe(true)
  await goToTown(page)
  await recordKeys(page)
  const map = await openMap(page)
  await spotButton(map, text.stops.lab.place).click()
  await expect(map).toHaveCount(0)
  // 飛び立ったのを見てから、下へ 1 マス分押す。錠が無ければ歩き出すか下を向く
  await page.waitForFunction(
    selector => document.querySelector(selector)?.getAttribute('data-flying') === 'true',
    SHADOW,
    { polling: 'raf', timeout: SLACK_MS }
  )
  await press(page, 'ArrowDown')
  const atLab = { worldId: town.id, cell: LAB }
  await expect.poll(() => readCell(page), { timeout: ARRIVE_MS }).toEqual(atLab)
  await expectLoopIdle(page)
  // 押したのも離したのも飛んでいる間だった。遅いランナーで降りた後に押した回を「無視された」と取り違えない
  expect(await readKeys(page, 'ArrowDown'), '下を押し離した時の影の印').toEqual([
    { type: 'keydown', key: 'ArrowDown', flying: 'true' },
    { type: 'keyup', key: 'ArrowDown', flying: 'true' },
  ])
  expect(await readCell(page), '降りた後も研究所の前から動かない').toEqual(atLab)
  // 押した下ではなく、飛んだ右を向いたまま立つ
  const standing = page.locator(PLAYER)
  await expect(standing, '右向きのまま立つ').toHaveAttribute('data-sprite', 'player-right-0')
  // 対照: 降りた後は同じキーで歩ける。キーが村の枠へ届いていなかったせいで動かなかったのではない
  expect(await walk(page, 'ArrowDown', 1), '降りた後は下へ 1 マス歩ける').toBe(1)
  expect(await readCell(page)).toEqual({ worldId: town.id, cell: belowLab })
})

test('地点から飛び立つと、出発の地点の吹き出しは飛び立った最初のフレームから降りるまで出ない', async ({
  page,
}) => {
  // 経歴碑の前に立つと経歴碑の吹き出し(行動ボタン付き)が出る。そこから地図で研究所へ飛ぶ
  await travelToMonument(page)
  await expect(page.locator(BUBBLE), '経歴碑の前の吹き出し').toHaveCount(1)
  const atLab = { worldId: town.id, cell: LAB }
  const { samples } = await travelOnMap(page, text.stops.lab.place, atLab)
  const { before, flying } = flightOf(samples)
  // 対照: 飛ぶ直前までは出発の地点の吹き出しが出ている(消えたのは飛び立ったから)
  expect(before.bubbles, '飛ぶ直前の吹き出しの数').toBe(1)
  // 飛ぶ間は途中のマスに到着しないので、飛び立った時に下ろさないと降りるまで出発の吹き出しが残る
  const shown = flyingHits(flying, s => s.bubbles !== 0)
  expect(shown, hitsNote('飛ぶ間に吹き出しが出ていたフレーム', flying, shown)).toEqual([])
  // 降りた研究所では研究所の吹き出しが出る
  await expect(page.locator(BUBBLE), '研究所の前の吹き出し').toHaveCount(1)
})

test('飛んでいる間に Z・M・ミニマップを押しても、窓も吹き出しも出ず、降りるマスも変わらない', async ({
  page,
}) => {
  // 名刺工房の前からポストの前へ町を横切って飛ぶ。押す 3 つが飛ぶ間に収まる長さがある
  const reach = distanceBetween(MEISHI, MAILBOX)
  expect(flightDurationMs(reach), '名刺工房からポストへ飛ぶ長さ(ms)').toBeGreaterThan(1000)
  await goToTown(page)
  await travelOnMap(page, text.stops.meishi.place, { worldId: town.id, cell: MEISHI })
  const map = await openMap(page)
  await startRecording(page)
  await spotButton(map, text.stops.mailbox.place).click()
  await expect(map).toHaveCount(0)
  // 地図の地点を押したクリックは控えない。控えるのはここから後の押し離しとクリック
  await recordKeys(page)
  await waitForTakeOff(page)
  // Z は A と同じ(歩いている時は話しかける)。M とミニマップは地図を開く。
  // M で地図が開いてしまうとミニマップは覆われて押せないので、待ちは短く切る
  await page.keyboard.press('KeyZ')
  await page.keyboard.press('KeyM')
  await page.getByRole('button', { name: text.openMap }).click({ timeout: SLACK_MS })
  // 押したのも離したのもクリックも飛んでいる間だった(遅いランナーで降りた後に押した回を取り違えない)
  const pressed = [
    ...(await readKeys(page, 'z')),
    ...(await readKeys(page, 'm')),
    ...(await readKeys(page, 'click')),
  ]
  expect(pressed, '押し離し・クリックの時の影の印').toEqual([
    { type: 'keydown', key: 'z', flying: 'true' },
    { type: 'keyup', key: 'z', flying: 'true' },
    { type: 'keydown', key: 'm', flying: 'true' },
    { type: 'keyup', key: 'm', flying: 'true' },
    { type: 'click', key: 'click', flying: 'true' },
  ])
  // 地図が開けば錠が掛かって飛ぶのが止まり、着かない。先に窓が無いことを見てから着くのを待つ
  await expect(page.getByRole('dialog'), '飛ぶ間に押した後の窓').toHaveCount(0)
  const atMailbox = { worldId: town.id, cell: MAILBOX }
  await expect.poll(() => readCell(page), { timeout: ARRIVE_MS }).toEqual(atMailbox)
  await expectLoopIdle(page)
  const { samples } = await stopRecording(page)
  const { flying } = flightOf(samples)
  const opened = flyingHits(flying, s => s.dialogs !== 0)
  expect(opened, hitsNote('飛ぶ間に窓が開いていたフレーム', flying, opened)).toEqual([])
  // Z で話しかけていれば、話せる相手のいない空中で頭上の考え事が出る
  const bubbled = flyingHits(flying, s => s.bubbles !== 0)
  expect(bubbled, hitsNote('飛ぶ間に吹き出しが出ていたフレーム', flying, bubbled)).toEqual([])
  await expect(page.getByRole('dialog'), '降りた後も窓は開いていない').toHaveCount(0)
  expect(await readCell(page), '降りたのはポストの前').toEqual(atMailbox)
})

// M を押し下ろした時刻(performance.now()。rAF に渡る時刻と同じ時計)を控える。捕捉の段階で窓に付けるので村の枠より先に読む
type MapKeyWindow = Window & { mapKeyAt?: number[] }
const recordMapKeyTimes = (page: Page) =>
  page.evaluate(() => {
    const host: MapKeyWindow = window
    const times: number[] = []
    host.mapKeyAt = times
    window.addEventListener(
      'keydown',
      event => {
        if (event.key === 'm' && !event.repeat) times.push(performance.now())
      },
      true
    )
  })

test('方向キーを押したまま歩いている間に M を押すと地図が開く(地図を止めるのは飛ぶ間だけ)', async ({
  page,
}) => {
  // 自宅前から右へは横道が続くので、押したままなら 1 マスずつ歩き続ける
  const nextRight = { x: TOWN_ENTRY.x + 1, y: TOWN_ENTRY.y }
  const secondRight = { x: TOWN_ENTRY.x + 2, y: TOWN_ENTRY.y }
  expect(isWalkable(town, nextRight), '自宅前の右隣は歩ける').toBe(true)
  expect(isWalkable(town, secondRight), '自宅前の 2 つ右も歩ける').toBe(true)
  await goToTown(page)
  await recordKeys(page)
  await recordMapKeyTimes(page)
  await startRecording(page)
  const before = await page.evaluate(key => sessionStorage.getItem(key), POS_KEY)
  await page.keyboard.down('ArrowRight')
  // 右隣に着いた(保存位置が変わった)のを rAF ごとに見て、すぐ押す。押したままなので、その時には次の 1 マスへ歩いている途中
  await page.waitForFunction(
    ([key, previous]) => sessionStorage.getItem(key) !== previous,
    [POS_KEY, before] as const,
    { polling: 'raf', timeout: SLACK_MS }
  )
  await page.keyboard.press('m')
  const map = page.getByRole('dialog')
  await expect(
    map.getByRole('heading', { name: text.mapTitle }),
    '歩いている間に開いた地図'
  ).toBeVisible()
  await page.keyboard.up('ArrowRight')
  const { samples } = await stopRecording(page)
  // 最初に着いたのは右隣(歩いて進んだ)
  expect(savedCells(samples).slice(0, 2), '保存位置が変わった順').toEqual([
    { worldId: town.id, cell: TOWN_ENTRY },
    { worldId: town.id, cell: nextRight },
  ])
  // M を押したのは飛んでいない時だった
  expect(await readKeys(page, 'm'), 'M を押し離した時の影の印').toEqual([
    { type: 'keydown', key: 'm', flying: 'false' },
    { type: 'keyup', key: 'm', flying: 'false' },
  ])
  // 対照: 押す直前のフレームで主人公の描かれた位置が動いていた(止まってから押したのではない)。
  // 押した時刻と同じフレームの写しは押した後に撮られることがあるので、直前の 3 フレームを見て、位置が 2 通り以上あること
  const keyTimes = await page.evaluate(() => {
    const host: MapKeyWindow = window
    return host.mapKeyAt ?? []
  })
  expect(keyTimes.length, 'M を押し下ろした回数').toBe(1)
  const recent = samples.filter(s => s.at < keyTimes[0]).slice(-3)
  expect(recent.length, 'M を押す前に写したフレーム数').toBe(3)
  const placements = distinct(recent.map(s => s.player?.transform ?? null))
  expect(placements.length, 'M を押す直前の 3 フレームで主人公が描かれた位置の数').toBeGreaterThan(
    1
  )
})

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

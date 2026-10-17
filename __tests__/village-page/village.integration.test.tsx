// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { page } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import { userEvent } from 'vitest/browser'
import type { Cell, Direction, Spot, World, WorldSet } from '@content/types/world'
import { readVisited, writePosition, writeVisited } from '@/lib/preferences'
import { isWalkable } from '@/lib/village/collision'
import { FLIGHT_MIN_DISTANCE, flightDurationMs } from '@/lib/village/flight-curve'
import { findPath } from '@/lib/village/path'
import { objectSpotAt } from '@/lib/village/spot'
import { routeToWarp } from '@/lib/village/warp'
import { CLOCK_FOCUSABLE_SELECTOR, STOP_FOCUSABLE_SELECTOR } from '@/utils/focusables'
import {
  FRAME_MS,
  SETTLE_MS,
  SLACK_MS,
  advanceUntil,
  cellCenter,
  click,
  emulateReducedMotion,
  expectLoopIdle,
  focusIndex,
  focusVillage,
  isVisible,
  leaveRoom,
  loopState,
  mouse,
  playerOnScreen,
  press,
  readCell,
  runFor,
  stubWeather,
  tapHeld,
  villageFrame,
  villagePlayer,
  walk,
  worldLayer,
} from './village-walk.test-helper'
import { recordKeyDownTimes, recordKeys } from './village-walk-record.test-helper'
import {
  blockedOnSegment,
  cellUnder,
  distanceBetween,
  distinct,
  drawnOf,
  flightOf,
  flyingHits,
  groundOf,
  hitsNote,
  isFlyingSprite,
  onSegment,
  outsideFrame,
  overTopWhenStanding,
  raisedPastTop,
  savedCells,
  startRecording,
  stepOf,
  stopRecording,
  type FrameSample,
  type Recording,
  type Saved,
} from './village-walk-flight.test-helper'
import { PHASE_CLOCKS, startVillageClock } from './village-time.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// ---- 歩く・待つ・釣り・傘・飛ぶ ----
// E2E が見ていた歩行ループの眠りと目覚め・池での釣り・雨の日の傘・自動移動の直線飛行を、E2E からこの統合テストへ移したもの
// (ADR 0016 の「統合へ移す」)と、
// それが通らないフックの分岐を確かめる検査(各 describe の末尾と「村の入力と道中の配線」)。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date。E2E の page.clock と同じく時間として替える)で止め、
// テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)、スティックと舞台を押すのは CDP の Input で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('歩く・待つ・釣り・傘・飛ぶ', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa

  // 描いて、起動の覆いが外れたら枠へ焦点を置く(E2E の openVillage)。既定は E2E と同じ PC の 1280×720
  const openVillage = async (width = 1280, height = 720) => {
    await page.viewport(width, height)
    render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
  }

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

  describe('自動移動の直線飛行', () => {
    // 普段の歩きのコマのうち足を出したもの(1・2)。歩いた証拠に使う。左向きは right の反転なので up / down / right だけ
    const WALKING = /^player-(up|down|right)-[12]$/
    // 自動移動が着くまでの上限(偽の時計の ms)。町を横切って飛んでも、扉を通って別ワールドの地点へ移っても収まる
    const ARRIVE_MS = 10_000
    // 影の位置が、出発と着地を結ぶ線分から外れてよい距離(マス)
    const LINE_TOLERANCE = 0.15
    // 1 フレームのカメラの動きが、同じフレームの影と主人公の動きの大きい方を超えてよい倍率と、
    // 層の位置を整数 px へ丸める分の余裕(px)
    const CAMERA_SLACK = 1.2
    const ROUND_PX = 2
    // 写した飛ぶ長さが、距離で決まる長さから外れてよい幅(ms)。E2E と同じ幅(実時間の揺れの分。偽の時計では揺れない)
    const FLIGHT_SPAN_SLACK_MS = 100

    // ---- 村のデータ(content/world.ts の配置から引く) ----
    const { worldSet } = villageJa
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
    const placeOf = (id: string) => {
      const stop = text.stops[id]
      if (stop === undefined) throw new Error(`地点 ${id} の文言が無い`)
      return stop.place
    }
    // 舞台を押して歩く先。自宅前から横か縦へまっすぐ 4 マス(無ければ 3 マス)先の、歩けて扉でも地点の立ち位置でもないマス。
    // 直線距離が飛ぶ最小の距離に届くので、押した移動を自動移動と取り違えていれば飛んでしまう
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

    // ---- 村の操作 ----

    const shadowEl = () => document.querySelector<HTMLElement>('[data-flight-shadow]')
    const flyingNow = () => shadowEl()?.dataset.flying
    const sprite = () => villagePlayer().dataset.sprite
    const sameSaved = (goal: Saved) => () =>
      JSON.stringify(readCell(setId)) === JSON.stringify(goal)
    const map = page.getByRole('dialog')

    // 村を開き、部屋の出口のマットまで歩いて町の自宅前へ出る
    const goToTown = async () => {
      await openVillage()
      expect(await walk(setId, 'ArrowDown', 3), '部屋の出口のマットまで歩いて町へ出る').toBe(3)
      expect(readCell(setId)).toEqual({ worldId: town.id, cell: TOWN_ENTRY })
    }

    const openMap = async () => {
      await userEvent.keyboard('m')
      await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    }

    // 地図の地点の印。読み上げ名は text.fastTravel の {place} を地点名に置き換えたもの
    const spotButton = (place: string) =>
      map.getByRole('button', { name: text.fastTravel.replace('{place}', place) })

    // 地図の地点の印を押し、着いて歩行ループが眠るまでを記録する
    const travelOnMap = async (place: string, goal: Saved): Promise<Recording> => {
      await openMap()
      const recording = startRecording(setId)
      await spotButton(place).click()
      await expect.element(map).not.toBeInTheDocument()
      await advanceUntil(sameSaved(goal), `${place} へ着く`, ARRIVE_MS)
      await expectLoopIdle()
      return stopRecording(recording)
    }

    // 自宅前から地図で経歴碑へ移る。直線が自宅の上を通る移動で、飛ぶ形を測るテストが共通に使う
    const travelToMonument = async () => {
      await goToTown()
      return travelOnMap(placeOf('monument'), { worldId: town.id, cell: MONUMENT })
    }

    // 飛び立つ(影が飛んでいる印を出す)まで時計を進める
    const waitForTakeOff = () => advanceUntil(() => flyingNow() === 'true', '飛び立つ')

    // ---- 地図で同じワールドの遠い地点へ ----

    // 自宅前から経歴碑へ地図で飛ぶ 1 回を写し、その記録から飛ぶ形を順に確かめる。
    // 同じ移動を確かめることごとに走らせ直さない。後の塊は記録を読むだけで村を操作しない
    test('地図で遠い地点を選んで飛ぶ 1 回の記録で、降りた姿と保存・道筋・速さ・浮き・カメラ・枠を確かめる', async () => {
      // 経歴碑は自宅前から縦の差の方が大きい上にあるので、上を向いて飛ぶ
      const rise = TOWN_ENTRY.y - MONUMENT.y
      expect(rise, '経歴碑は自宅前の上寄り').toBeGreaterThan(Math.abs(MONUMENT.x - TOWN_ENTRY.x))
      // 自宅前から経歴碑への直線は自宅の上を通る。配置が変わって通らなくなったら、測る前にここで落とす
      const blocked = blockedOnSegment(town, TOWN_ENTRY, MONUMENT)
      expect(blocked.length, '直線が歩いては立てないマスの上を通る').toBeGreaterThan(0)
      const { cell, samples } = await travelToMonument()
      const { before, flying, landed } = flightOf(samples)

      // 飛んで向かい、降りると歩く姿と地上の影に戻り、降りたマスだけが保存される
      expect(before.flying, '飛ぶ前の影は地上の印').toBe('false')
      // 飛ぶ間は上向きの雲に座った 2 コマを交互に出す
      expect(distinct(flying.map(s => s.sprite)), '飛ぶ間のコマ').toEqual([
        'player-fly-up-0',
        'player-fly-up-1',
      ])
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
      expect(sprite()).toBe('player-up-0')
      expect(flyingNow()).toBe('false')
      expect(readCell(setId)).toEqual({ worldId: town.id, cell: MONUMENT })

      // 出発と着地を結ぶ直線の上を飛び、歩いては通れない家の上も越える
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

      // 飛ぶ速さは飛び立ちと降りる前に緩く真ん中で最も速く、降りる前は横にも縦にも緩み、飛ぶ長さは距離で決まる
      const start = flying[0].at
      const span = landed.at - start
      const frames = [...flying, landed]
      const longest = Math.max(...frames.slice(1).map((s, i) => s.at - frames[i].at))
      // 出発のマスから影までの直線距離と、影から主人公が浮いた高さ(どちらもマス)
      const travelled = (sample: FrameSample) => distanceBetween(groundOf(sample, cell), TOWN_ENTRY)
      const lifted = (sample: FrameSample) => groundOf(sample, cell).y - drawnOf(sample, cell).y
      // 飛ぶ長さの ratio(0 が飛び立ち・1 が降りた後の最初のフレーム)の時点の値。その時刻を挟む 2 フレームを時刻で線形に補う
      const valueAt = (ratio: number, value: (sample: FrameSample) => number) => {
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
      // 時間の前・真ん中・後ろの 1/3 に進んだマス数。今の曲線(離着陸で速さも加速度も 0 の五次)では 17 : 47 : 17
      const [firstThird, middleThird, lastThird] = gains([0, 1 / 3, 2 / 3, 1], travelled)
      expect(firstThird, '前の 1/3 に進んだマス数').toBeGreaterThan(0)
      expect(lastThird, '後ろの 1/3 に進んだマス数').toBeGreaterThan(0)
      expect(middleThird, '真ん中の 1/3 と前の 1/3 の 2 倍').toBeGreaterThan(firstThird * 2)
      expect(middleThird, '真ん中の 1/3 と後ろの 1/3 の 2 倍').toBeGreaterThan(lastThird * 2)
      // 前と後ろの 1/3 は同じだけ進む。2 つの区切りがそれぞれ最長の 1 フレームずれ、その間を最も速く進んだとしても収まる差まで許す
      const speedBetween = (from: FrameSample, to: FrameSample) =>
        (travelled(to) - travelled(from)) / (to.at - from.at)
      const fastest = Math.max(...frames.slice(1).map((s, i) => speedBetween(frames[i], s)))
      const uneven = Math.abs(firstThird - lastThird)
      expect(uneven, '前と後ろの 1/3 に進んだマス数の差').toBeLessThanOrEqual(fastest * longest * 2)
      // 降りる前の 1/4 は、横(影の進み)も縦(浮いた高さ)も速さを落としながら座ったまま降りる。後の 1/8 は前の 1/8 の半分に届かない
      const [earlyAlong, lateAlong] = gains([3 / 4, 7 / 8, 1], travelled)
      const [earlyDrop, lateDrop] = gains([3 / 4, 7 / 8, 1], s => -lifted(s))
      expect(lateAlong, '降りる前の最後の 1/8 に進んだマス数').toBeLessThan(earlyAlong / 2)
      expect(lateDrop, '降りる前の最後の 1/8 に下りたマス数').toBeLessThan(earlyDrop / 2)
      // 飛ぶ直前に地上で写したフレームから降りた後の最初のフレームまでの長さは、直線距離から決まる長さと
      // FLIGHT_SPAN_SLACK_MS の内で一致する。歩行ループへ渡す経過の取り違え(秒と ms・1 フレームに 2 回進める)はここで落ちる
      const expected = flightDurationMs(distanceBetween(MONUMENT, TOWN_ENTRY))
      const flown = landed.at - before.at
      const note = `飛んだ ${flown}ms・距離で決まる長さ ${expected}ms・最長の 1 フレーム ${longest}ms`
      expect(Math.abs(flown - expected), note).toBeLessThanOrEqual(FLIGHT_SPAN_SLACK_MS)

      // 飛んでいる間は主人公が影より上に浮き、影は高いほど小さく、降りると影と重なる
      const onePx = 1 / cell
      // 浮くのは上へだけ。横にはずれず、影より下にも描かない
      const sideways = flying.filter(
        s => Math.abs(drawnOf(s, cell).x - groundOf(s, cell).x) > onePx
      )
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
      expect(
        Math.abs(drawnOf(rest, cell).x - groundOf(rest, cell).x),
        '降りた後の主人公と影の横の差'
      ).toBeLessThanOrEqual(onePx)
      expect(
        Math.abs(drawnOf(rest, cell).y - groundOf(rest, cell).y),
        '降りた後の主人公と影の縦の差'
      ).toBeLessThanOrEqual(onePx)
      expect(rest.shadow?.scale, '降りた後の影の倍率').toBeCloseTo(1, 2)

      // 飛ぶ間のカメラは主人公に付いて動き、1 フレームで影と主人公の動いた分を超えて跳ばない
      const tracked = samples.slice(samples.indexOf(before))
      const steps = tracked.slice(1).map((sample, i) => ({
        at: sample.at,
        camera: stepOf(tracked[i].camera, sample.camera, 'ワールドの層'),
        ground: stepOf(tracked[i].shadow, sample.shadow, '影'),
        drawn: stepOf(tracked[i].player, sample.player, '主人公'),
      }))
      // カメラは地上の影と浮いた主人公のちょうど間を狙うので、1 フレームに動く距離は影と主人公の動いた距離の大きい方を超えない
      const jumps = steps.filter(
        s => s.camera > Math.max(s.ground, s.drawn) * CAMERA_SLACK + ROUND_PX
      )
      expect(jumps, '1 フレームで跳んだカメラ(px)').toEqual([])
      // 対照: 層の transform を写せていて、カメラは記録の中で実際に上へ動いた
      if (before.camera === null || landed.camera === null)
        throw new Error('層の位置を写せていない')
      const rose = (landed.camera.y - before.camera.y) / cell
      expect(rose, 'カメラが上へ動いたマス数').toBeGreaterThan(4)

      // 飛ぶ間のどのフレームでも、主人公の絵と地上の影は村の枠の中に収まる
      expect(outsideFrame(flying, cell), '枠からはみ出したフレーム').toEqual([])
    }, 30_000)

    test('影は飛ぶ間だけ画面に見え、飛ぶ前と降りた後は隠れる', async () => {
      // data-flying の値ではなく見えるかどうかを見る。隠す規則(scene.module.css の visibility)が壊れたらここで落ちる
      await goToTown()
      expect(isVisible(shadowEl()), '飛ぶ前の影').toBe(false)
      await openMap()
      await spotButton(placeOf('monument')).click()
      await expect.element(map).not.toBeInTheDocument()
      await waitForTakeOff()
      expect(isVisible(shadowEl()), '飛ぶ間の影').toBe(true)
      await advanceUntil(sameSaved({ worldId: town.id, cell: MONUMENT }), '経歴碑へ着く', ARRIVE_MS)
      await expectLoopIdle()
      expect(isVisible(shadowEl()), '降りた後の影').toBe(false)
    }, 30_000)

    test('町で最も上の地点へ飛ぶ間も、浮き上がりで絵が枠の上辺より上へ出ず(立っているだけで出る所では浮かない)、影は枠の中に収まる', async () => {
      // カメラは町の上端より上を映せないので、上端の行へ降りる飛行は主人公の絵の逃げ場が最も少ない
      expect(TOP_SPOT.cell.y, '最も上の地点は町の上端の行').toBe(0)
      const reach = distanceBetween(TOP_SPOT.cell, TOWN_ENTRY)
      expect(reach, '飛ぶ最小の直線距離に届く').toBeGreaterThanOrEqual(FLIGHT_MIN_DISTANCE)
      await goToTown()
      const goal = { worldId: town.id, cell: TOP_SPOT.cell }
      const { cell, samples } = await travelOnMap(placeOf(TOP_SPOT.id), goal)
      const { flying } = flightOf(samples)
      expect(raisedPastTop(flying, cell), '浮き上がりで枠の上辺より上へ出たフレーム').toEqual([])
      // 上限で浮き上がりを抑えても飛ぶこと自体は残る。飛ぶ間は上向きの雲に座ったコマで、途中では高く浮く
      expect(distinct(flying.map(s => s.sprite)), '最も上の地点へ飛ぶ間のコマ').toEqual([
        'player-fly-up-0',
        'player-fly-up-1',
      ])
      const lifts = flying.map(s => groundOf(s, cell).y - drawnOf(s, cell).y)
      expect(Math.max(...lifts), '最も上の地点へ飛ぶ間に最も高く浮いたマス数').toBeGreaterThan(1)
      // 対照: 立っているだけで絵が枠の上辺を越える所(上端の行の近く)を飛ぶフレームを記録できている
      expect(
        overTopWhenStanding(flying, cell).length,
        '立っているだけで絵が枠の上辺を越える所を飛んだフレーム数'
      ).toBeGreaterThan(0)
    }, 30_000)

    test('飛んでいる間に方向キーを押しても、降りるマスも向きも変わらない', async () => {
      // 研究所は自宅前から右上で横の差の方が大きいので、右を向いて飛び、右を向いたまま降りる
      expect(LAB.x - TOWN_ENTRY.x, '研究所は自宅前の右寄り').toBeGreaterThan(
        Math.abs(LAB.y - TOWN_ENTRY.y)
      )
      // 降りた後に下へ 1 マス歩けるか(キーが村へ届いていることの対照に使う)
      const belowLab = { x: LAB.x, y: LAB.y + 1 }
      expect(isWalkable(town, belowLab), '研究所の前の 1 マス下は歩ける').toBe(true)
      await goToTown()
      const keys = recordKeys()
      await openMap()
      await spotButton(placeOf('lab')).click()
      await expect.element(map).not.toBeInTheDocument()
      // 飛び立ったのを見てから、下へ 1 マス分押す。錠が無ければ歩き出すか下を向く
      await waitForTakeOff()
      await press('ArrowDown')
      const atLab = { worldId: town.id, cell: LAB }
      await advanceUntil(sameSaved(atLab), '研究所へ着く', ARRIVE_MS)
      await expectLoopIdle()
      // 押したのも離したのも飛んでいる間だった
      expect(
        keys.filter(mark => mark.key === 'ArrowDown'),
        '下を押し離した時の影の印'
      ).toEqual([
        { type: 'keydown', key: 'ArrowDown', flying: 'true' },
        { type: 'keyup', key: 'ArrowDown', flying: 'true' },
      ])
      expect(readCell(setId), '降りた後も研究所の前から動かない').toEqual(atLab)
      // 押した下ではなく、飛んだ右を向いたまま立つ
      expect(sprite(), '右向きのまま立つ').toBe('player-right-0')
      // 対照: 降りた後は同じキーで歩ける。キーが村の枠へ届いていなかったせいで動かなかったのではない
      expect(await walk(setId, 'ArrowDown', 1), '降りた後は下へ 1 マス歩ける').toBe(1)
      expect(readCell(setId)).toEqual({ worldId: town.id, cell: belowLab })
    }, 30_000)

    test('地点から飛び立つと、出発の地点の吹き出しは飛び立った最初のフレームから降りるまで出ない', async () => {
      // 経歴碑の前に立つと経歴碑の吹き出し(行動ボタン付き)が出る。そこから地図で研究所へ飛ぶ
      await travelToMonument()
      await expect
        .poll(() => document.querySelectorAll('[data-village-bubble]').length, {
          message: '経歴碑の前の吹き出し',
        })
        .toBe(1)
      const { samples } = await travelOnMap(placeOf('lab'), { worldId: town.id, cell: LAB })
      const { before, flying } = flightOf(samples)
      // 対照: 飛ぶ直前までは出発の地点の吹き出しが出ている(消えたのは飛び立ったから)
      expect(before.bubbles, '飛ぶ直前の吹き出しの数').toBe(1)
      // 飛ぶ間は途中のマスに到着しないので、飛び立った時に下ろさないと降りるまで出発の吹き出しが残る。
      // 写すのは rAF を呼び終えた直後(React が確定する前)なので、飛び立ったフレームに残った 1 枚もここで落ちる
      const shown = flyingHits(flying, s => s.bubbles !== 0)
      expect(shown, hitsNote('飛ぶ間に吹き出しが出ていたフレーム', flying, shown)).toEqual([])
      // 降りた研究所では研究所の吹き出しが出る
      await expect
        .poll(() => document.querySelectorAll('[data-village-bubble]').length, {
          message: '研究所の前の吹き出し',
        })
        .toBe(1)
    }, 30_000)

    test('飛んでいる間に Z・M・ミニマップを押しても、窓も吹き出しも出ず、降りるマスも変わらない', async () => {
      // 名刺工房の前からポストの前へ町を横切って飛ぶ。押す 3 つが飛ぶ間に収まる長さがある
      const reach = distanceBetween(MEISHI, MAILBOX)
      expect(flightDurationMs(reach), '名刺工房からポストへ飛ぶ長さ(ms)').toBeGreaterThan(1000)
      await goToTown()
      await travelOnMap(placeOf('meishi'), { worldId: town.id, cell: MEISHI })
      await openMap()
      const recording = startRecording(setId)
      await spotButton(placeOf('mailbox')).click()
      await expect.element(map).not.toBeInTheDocument()
      // 地図の地点を押したクリックは控えない。控えるのはここから後の押し離しとクリック
      const keys = recordKeys()
      await waitForTakeOff()
      // Z は A と同じ(歩いている時は話しかける)。M とミニマップは地図を開く。
      // M で地図が開いてしまうとミニマップは覆われて押せないので、押す待ちは短く切る(本物の時計の ms)
      await userEvent.keyboard('z')
      await userEvent.keyboard('m')
      await page.getByRole('button', { name: text.openMap }).click({ timeout: SLACK_MS })
      // 押したのも離したのもクリックも飛んでいる間だった
      expect(
        keys.filter(mark => ['z', 'm', 'click'].includes(mark.key)),
        '押し離し・クリックの時の影の印'
      ).toEqual([
        { type: 'keydown', key: 'z', flying: 'true' },
        { type: 'keyup', key: 'z', flying: 'true' },
        { type: 'keydown', key: 'm', flying: 'true' },
        { type: 'keyup', key: 'm', flying: 'true' },
        { type: 'click', key: 'click', flying: 'true' },
      ])
      // 地図が開けば錠が掛かって飛ぶのが止まり、着かない。先に窓が無いことを見てから着くのを待つ
      expect(map.query(), '飛ぶ間に押した後の窓').toBeNull()
      const atMailbox = { worldId: town.id, cell: MAILBOX }
      await advanceUntil(sameSaved(atMailbox), 'ポストへ着く', ARRIVE_MS)
      await expectLoopIdle()
      const { samples } = await stopRecording(recording)
      const { flying } = flightOf(samples)
      const opened = flyingHits(flying, s => s.dialogs !== 0)
      expect(opened, hitsNote('飛ぶ間に窓が開いていたフレーム', flying, opened)).toEqual([])
      // Z で話しかけていれば、話せる相手のいない空中で頭上の考え事が出る
      const bubbled = flyingHits(flying, s => s.bubbles !== 0)
      expect(bubbled, hitsNote('飛ぶ間に吹き出しが出ていたフレーム', flying, bubbled)).toEqual([])
      expect(map.query(), '降りた後も窓は開いていない').toBeNull()
      expect(readCell(setId), '降りたのはポストの前').toEqual(atMailbox)
    }, 30_000)

    test('方向キーを押したまま歩いている間に M を押すと地図が開く(地図を止めるのは飛ぶ間だけ)', async () => {
      // 自宅前から右へは横道が続くので、押したままなら 1 マスずつ歩き続ける
      const nextRight = { x: TOWN_ENTRY.x + 1, y: TOWN_ENTRY.y }
      const secondRight = { x: TOWN_ENTRY.x + 2, y: TOWN_ENTRY.y }
      expect(isWalkable(town, nextRight), '自宅前の右隣は歩ける').toBe(true)
      expect(isWalkable(town, secondRight), '自宅前の 2 つ右も歩ける').toBe(true)
      await goToTown()
      const keys = recordKeys()
      const mapKeyTimes = recordKeyDownTimes('m')
      const recording = startRecording(setId)
      const before = JSON.stringify(readCell(setId))
      await userEvent.keyboard('{ArrowRight>}')
      // 右隣に着いた(保存位置が変わった)のをフレームごとに見て、すぐ押す。押したままなので、その時には次の 1 マスへ歩いている途中
      await advanceUntil(() => JSON.stringify(readCell(setId)) !== before, '右隣に着く')
      await userEvent.keyboard('m')
      await expect
        .element(map.getByRole('heading', { name: text.mapTitle }), {
          message: '歩いている間に開いた地図',
        })
        .toBeVisible()
      await userEvent.keyboard('{/ArrowRight}')
      const { samples } = await stopRecording(recording)
      // 最初に着いたのは右隣(歩いて進んだ)
      expect(savedCells(samples).slice(0, 2), '保存位置が変わった順').toEqual([
        { worldId: town.id, cell: TOWN_ENTRY },
        { worldId: town.id, cell: nextRight },
      ])
      // M を押したのは飛んでいない時だった
      expect(
        keys.filter(mark => mark.key === 'm'),
        'M を押し離した時の影の印'
      ).toEqual([
        { type: 'keydown', key: 'm', flying: 'false' },
        { type: 'keyup', key: 'm', flying: 'false' },
      ])
      // 対照: 押す直前のフレームで主人公の描かれた位置が動いていた(止まってから押したのではない)。
      // 押した時刻より前に写した 3 フレームで、位置が 2 通り以上あること
      expect(mapKeyTimes.length, 'M を押し下ろした回数').toBe(1)
      const recent = samples.filter(s => s.at < mapKeyTimes[0]).slice(-3)
      expect(recent.length, 'M を押す前に写したフレーム数').toBe(3)
      const placements = distinct(recent.map(s => s.player?.transform ?? null))
      expect(
        placements.length,
        'M を押す直前の 3 フレームで主人公が描かれた位置の数'
      ).toBeGreaterThan(1)
    }, 30_000)

    describe('動きを控える設定', () => {
      test('地図で遠い地点を選んでも飛ばず、今までどおり 1 マスずつ歩いて着く', async () => {
        const route = findPath(town, TOWN_ENTRY, MONUMENT)
        if (route === null) throw new Error('自宅前から経歴碑へ歩けない')
        await emulateReducedMotion()
        const { samples } = await travelToMonument()
        const raised = samples.filter(s => s.flying === 'true')
        expect(raised, '影が飛んでいる印を出したフレーム').toEqual([])
        expect(samples.filter(isFlyingSprite), '飛ぶコマを描いたフレーム').toEqual([])
        // 道のりのマスに 1 つずつ到着しながら進む(家の上を飛び越さない)
        const visited = savedCells(samples).map(saved => saved.cell)
        expect(visited, '保存位置が変わった順').toEqual([TOWN_ENTRY, ...route])
      }, 30_000)
    })

    // ---- 別のワールドへ ----

    test('地図で番号 1 の自室を選ぶと、町では扉の隣まで飛んでから扉へ入り、部屋の PC の前に着く', async () => {
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

      await goToTown()
      expect(await walk(setId, 'ArrowRight', 3), '自宅前から右へ 3 マス').toBe(3)
      expect(readCell(setId)).toEqual({ worldId: town.id, cell: start })
      const { cell, samples } = await travelOnMap(placeOf('home'), { worldId: room.id, cell: PC })
      expect(worldLayer().dataset.world).toBe(room.id)

      // 町で飛んだフレーム。扉の隣へ降りたフレームで扉を通り、部屋のタイルが載るまで歩行ループは描き直さないが、
      // その間も影の飛ぶ印は下ろす
      const townFlying = samples.filter(s => s.world === town.id && s.flying === 'true')
      expect(townFlying.length, '町で飛んだフレームの数').toBeGreaterThan(0)
      const unparsedInTown = samples.filter(s => s.world === town.id && s.unparsed.length > 0)
      expect(unparsedInTown, '町のフレームで行列にできなかった transform').toEqual([])
      // 左向きは右向きの飛ぶコマを左右反転して描く
      expect(distinct(townFlying.map(s => s.sprite)), '町で飛ぶ間のコマ').toEqual([
        'player-fly-right-0',
        'player-fly-right-1',
      ])
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
      expect(stale, '部屋で飛ぶ印を出したのに、出口手前と PC の前を結ぶ線分から外れた影').toEqual(
        []
      )
      // 町では飛び立ったマスと扉の隣のほかで到着しない。部屋では出口手前から PC の前へ着く
      const visited = savedCells(samples)
      const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y
      const endpoints = [start, landing]
      const inTown = visited.filter(v => v.worldId === town.id).map(v => v.cell)
      const midway = inTown.filter(c => !endpoints.some(e => sameCell(e, c)))
      expect(midway, '町で途中のマスに到着した記録').toEqual([])
      const inRoom = visited.filter(v => v.worldId === room.id).map(v => v.cell)
      expect(inRoom[0], '扉を通って最初に立つ部屋のマス').toEqual(ROOM_ENTRY)
      expect(inRoom[inRoom.length - 1], '最後に着く部屋のマス').toEqual(PC)
    }, 30_000)

    // ---- 会話窓の「次へ」 ----

    test('会話窓の「次へ」でも飛ぶ。部屋では出口のマットへ、町では次の地点へ直線で飛ぶ', async () => {
      const { home, meishi, lab } = text.stops
      await openVillage()
      const dialog = page.getByRole('dialog')
      await userEvent.keyboard('e')
      await expect.element(dialog.getByRole('heading', { name: home.title })).toBeVisible()
      const headingShown = (title: string) => () =>
        dialog.getByRole('heading', { name: title }).query() !== null

      // 自室の次は町の名刺工房。部屋では PC の前から出口のマットまで飛び、町へ出て名刺工房の前で会話窓が開く
      const toMeishiRecording = startRecording(setId)
      await dialog.getByRole('button', { name: home.next }).click()
      await advanceUntil(headingShown(meishi.title), '名刺工房の会話窓が開く', ARRIVE_MS)
      const toMeishi = await stopRecording(toMeishiRecording)
      expect(readCell(setId)).toEqual({ worldId: town.id, cell: MEISHI })
      const roomFlying = toMeishi.samples.filter(s => s.world === room.id && s.flying === 'true')
      expect(roomFlying.length, '部屋で飛んだフレームの数').toBeGreaterThan(0)
      expect(distinct(roomFlying.map(s => s.sprite)), '部屋で飛ぶ間のコマ').toEqual([
        'player-fly-down-0',
        'player-fly-down-1',
      ])
      const roomGrounds = roomFlying.map(s => groundOf(s, toMeishi.cell))
      const roomStrayed = roomGrounds.filter(p => onSegment(p, PC, EXIT_MAT).off > LINE_TOLERANCE)
      expect(roomStrayed, 'PC の前と出口のマットを結ぶ線分から外れた影').toEqual([])
      // 部屋の中のマスでは到着しない(歩けば出口手前までの 2 マスで到着する)
      const roomArrivals = savedCells(toMeishi.samples).filter(v => v.worldId === room.id)
      expect(roomArrivals, '部屋の中で到着した記録').toEqual([])

      // 名刺工房の次は同じ町の研究所。名刺工房の前から研究所の前まで直線で飛び、着くと会話窓が開く
      const toLabRecording = startRecording(setId)
      await dialog.getByRole('button', { name: meishi.next }).click()
      await advanceUntil(headingShown(lab.title), '研究所の会話窓が開く', ARRIVE_MS)
      await expectLoopIdle()
      const toLab = await stopRecording(toLabRecording)
      expect(readCell(setId)).toEqual({ worldId: town.id, cell: LAB })
      const { flying } = flightOf(toLab.samples)
      expect(distinct(flying.map(s => s.sprite)), '町で飛ぶ間のコマ').toEqual([
        'player-fly-right-0',
        'player-fly-right-1',
      ])
      const townGrounds = flying.map(s => groundOf(s, toLab.cell))
      const townStrayed = townGrounds.filter(p => onSegment(p, MEISHI, LAB).off > LINE_TOLERANCE)
      expect(townStrayed, '名刺工房の前と研究所の前を結ぶ線分から外れた影').toEqual([])
      expect(savedCells(toLab.samples), '保存位置が変わった順').toEqual([
        { worldId: town.id, cell: MEISHI },
        { worldId: town.id, cell: LAB },
      ])
    }, 30_000)

    // ---- 雨の日 ----

    test('雨の日も飛ぶ間は傘を差さない飛ぶコマで、降りると傘を差した姿へ戻る', async () => {
      stubWeather('rain')
      await goToTown()
      // 町へ出ると戸口で傘を開く。開き終えて歩行ループが眠る(傘のコマも入力の錠も終わる)まで待つ
      await advanceUntil(() => sprite() === 'player-umbrella-down-0', '傘を差した下向きの立ち姿')
      await expectLoopIdle()
      const { samples } = await travelOnMap(placeOf('monument'), {
        worldId: town.id,
        cell: MONUMENT,
      })
      expect(distinct(flightOf(samples).flying.map(s => s.sprite)), '雨の日に飛ぶ間のコマ').toEqual(
        ['player-fly-up-0', 'player-fly-up-1']
      )
      expect(samples[samples.length - 1].sprite, '降りた後のコマ').toBe('player-umbrella-up-0')
      expect(sprite()).toBe('player-umbrella-up-0')
    }, 30_000)

    // ---- 舞台のタップ ----

    test('舞台の遠いマスを押した時は飛ばず、1 マスずつ歩いて着く', async () => {
      const reach = distanceBetween(TAP_GOAL, TOWN_ENTRY)
      expect(reach, '自動移動なら飛ぶ直線距離').toBeGreaterThanOrEqual(FLIGHT_MIN_DISTANCE)
      const route = findPath(town, TOWN_ENTRY, TAP_GOAL)
      if (route === null) throw new Error('自宅前から押すマスへ歩けない')
      await goToTown()
      // カメラが追い付いて層が止まってから、層の原点と --cell から押すマスの真ん中の画面位置を出す
      await expectLoopIdle()
      const point = cellCenter(TAP_GOAL)
      // 押す位置が村の枠の中にあり、ボタン・リンク(ミニマップなど)に重なっていない
      const frameBox = villageFrame().getBoundingClientRect()
      const inside =
        point.x > frameBox.left &&
        point.x < frameBox.right &&
        point.y > frameBox.top &&
        point.y < frameBox.bottom
      const covering = document.elementFromPoint(point.x, point.y)?.closest('button, a')
      expect(inside && covering === null, '押す位置は枠の中でボタンに重ならない').toBe(true)
      const recording = startRecording(setId)
      await click(point.x, point.y)
      const atGoal = { worldId: town.id, cell: TAP_GOAL }
      await advanceUntil(sameSaved(atGoal), '押したマスへ着く', ARRIVE_MS)
      await expectLoopIdle()
      const { samples } = await stopRecording(recording)
      const raised = samples.filter(s => s.flying === 'true')
      expect(raised, '影が飛んでいる印を出したフレーム').toEqual([])
      expect(samples.filter(isFlyingSprite), '飛ぶコマを描いたフレーム').toEqual([])
      // 道のりのマスに 1 つずつ到着し、足を出した歩きのコマも描く
      const visited = savedCells(samples).map(saved => saved.cell)
      expect(visited, '保存位置が変わった順').toEqual([TOWN_ENTRY, ...route])
      const stepping = samples.filter(s => WALKING.test(s.sprite ?? ''))
      expect(stepping.length, '足を出した歩きのコマのフレーム数').toBeGreaterThan(0)
    }, 30_000)
  })

  // E2E を移した上の検査が通らないフックの分岐を、利用者に見える振る舞いで確かめる
  // (保存の復元・地図の開け閉めと地形からの移動・押したまま動かす指・物を押して話しかける・
  // スティックでの本文送り・天気の問い合わせの中断・会話窓のキー・コースの完走)
  describe('村の入力と道中の配線', () => {
    const room = villageJa.worldSet.worlds.room
    const town = villageJa.worldSet.worlds.town
    const dialog = page.getByRole('dialog')
    const speech = () => page.getByRole('status').element().textContent ?? ''
    const sameCell = (goal: { worldId: string; cell: Cell }) => () =>
      JSON.stringify(readCell(setId)) === JSON.stringify(goal)

    test('描き直した村は保存した位置から始め、読めない保存(知らないワールド・歩けないマス)は捨てて開始地点から始める', async () => {
      await openVillage()
      expect(await walk(setId, 'ArrowDown', 1)).toBe(1)
      expect(readCell(setId)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
      // 村を離れて戻る(作品ページから戻った時と同じく、同じ読み込みの中で描き直す)
      cleanup()
      render(<VillagePageContainer {...villageJa} />)
      await focusVillage()
      await expectLoopIdle()
      // 部屋は枠に収まりカメラは動かないので、描かれた位置がそのままマス
      expect(playerOnScreen().x).toBeCloseTo(4, 1)
      expect(playerOnScreen().y, '保存した (4,5) から始める').toBeCloseTo(5, 1)
      const wall = { x: 0, y: 0 }
      expect(isWalkable(room, wall), '部屋の左上の角は歩けない').toBe(false)
      const unreadable = [
        { worldId: 'nowhere', cell: { x: 4, y: 5 }, facing: 'down' },
        { worldId: 'room', cell: wall, facing: 'down' },
      ] as const
      for (const saved of unreadable) {
        cleanup()
        writePosition(setId, saved)
        render(<VillagePageContainer {...villageJa} />)
        await focusVillage()
        await expectLoopIdle()
        const where = `${saved.worldId} (${saved.cell.x},${saved.cell.y})`
        expect(playerOnScreen().y, `${where} の保存は捨てて開始地点 (4,4) から`).toBeCloseTo(4, 1)
      }
    })

    test('地図は屋内では M を押しても開かず、町では地図の中で M をもう一度押すと閉じる', async () => {
      await openVillage()
      await userEvent.keyboard('m')
      await runFor(FRAME_MS * 2)
      expect(dialog.query(), '自室では地図を開かない').toBeNull()
      expect(await leaveRoom(setId)).toBe(3)
      await userEvent.keyboard('m')
      await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
      await userEvent.keyboard('m')
      await expect.element(dialog).not.toBeInTheDocument()
      // 閉じた後は錠が外れて歩ける
      expect(await walk(setId, 'ArrowRight', 1)).toBe(1)
    })

    test('地図で今立っている地点を選ぶとその場で着いたことにし、地形のマスを押すと地点でなくても向かう', async () => {
      const monument = town.spots.find(spot => spot.id === 'monument')
      if (monument === undefined) throw new Error('町に経歴碑の地点が無い')
      const place = text.stops.monument.place
      const spotButton = () =>
        dialog.getByRole('button', { name: text.fastTravel.replace('{place}', place) })
      const atMonument = { worldId: town.id, cell: monument.cell }
      await openVillage()
      expect(await leaveRoom(setId)).toBe(3)
      await userEvent.keyboard('m')
      await spotButton().click()
      await advanceUntil(sameCell(atMonument), '経歴碑へ着く', 10_000)
      await expectLoopIdle()
      // 今立っている地点をもう一度選ぶ。地図を閉じ、歩きも飛びもせずにその場に立つ
      await userEvent.keyboard('m')
      await spotButton().click()
      await expect.element(dialog).not.toBeInTheDocument()
      await runFor(FRAME_MS * 4)
      expect(loopState(), '動かない').toBe('idle')
      expect(readCell(setId)).toEqual(atMonument)
      // 地図の地形のうち、地点でも扉でもない歩けるマスを押す。経歴碑の前から 3 マス離れた所を選ぶ
      const target = [
        { x: 3, y: 0 },
        { x: -3, y: 0 },
        { x: 0, y: 3 },
        { x: 0, y: -3 },
      ]
        .map(d => ({ x: monument.cell.x + d.x, y: monument.cell.y + d.y }))
        .find(
          cell =>
            isWalkable(town, cell) &&
            !town.spots.some(s => s.cell.x === cell.x && s.cell.y === cell.y) &&
            !town.warps.some(w => w.cell.x === cell.x && w.cell.y === cell.y)
        )
      if (target === undefined) throw new Error('経歴碑の前から 3 マス先に歩ける地形が無い')
      const before = speech()
      await userEvent.keyboard('m')
      await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
      const canvas = [...dialog.element().querySelectorAll<HTMLElement>('div')].find(
        element => element.style.getPropertyValue('--map-w') !== ''
      )
      if (canvas === undefined) throw new Error('地図の地形が無い')
      const box = canvas.getBoundingClientRect()
      await page.elementLocator(canvas).click({
        position: {
          x: ((target.x + 0.5) / town.width) * box.width,
          y: ((target.y + 0.5) / town.height) * box.height,
        },
      })
      await expect.element(dialog).not.toBeInTheDocument()
      await advanceUntil(
        sameCell({ worldId: town.id, cell: target }),
        '押した地形のマスへ着く',
        10_000
      )
      // 地点でない所へは地点名を言えないので、行き先の案内は出さない
      expect(speech(), '案内文は押す前のまま').toBe(before)
    }, 30_000)

    test('舞台を押したまま指先を別のマスへ動かすと、行き先を指先のマスへ移してそこへ着く', async () => {
      await openVillage()
      expect(await leaveRoom(setId)).toBe(3)
      await expectLoopIdle()
      // 自宅前 (14,12) から右へは横道が続く
      const first = { x: 16, y: 12 }
      const second = { x: 17, y: 12 }
      expect(isWalkable(town, first) && isWalkable(town, second), '自宅前の右の道').toBe(true)
      const from = cellCenter(first)
      await mouse.move(from.x, from.y, false)
      await mouse.down(from.x, from.y)
      await runFor(FRAME_MS * 2)
      // 押している指先は同じマスの中でも少し揺れる。揺れてもそのまま押し続ける
      await mouse.move(from.x + 2, from.y + 2, true)
      await runFor(FRAME_MS * 2)
      const to = cellCenter(second)
      await mouse.move(to.x, to.y, true)
      await advanceUntil(sameCell({ worldId: town.id, cell: second }), '指先のマスへ着く')
      await mouse.up(to.x, to.y)
      await expectLoopIdle()
      expect(readCell(setId)).toEqual({ worldId: town.id, cell: second })
    })

    test('自室で机を押すと、もう話しかけられるマスに立っていれば歩かずに会話窓を開く', async () => {
      await openVillage()
      await expectLoopIdle()
      const home = room.spots.find(spot => spot.id === 'home')
      if (home === undefined) throw new Error('自室に自宅の地点が無い')
      // 対照: 歩いて届かず地点の物でもないマス(部屋の左上の角の壁)を押しても、歩きも話しもしない
      const wall = { x: 0, y: 0 }
      expect(isWalkable(room, wall) || objectSpotAt(room, wall) !== null).toBe(false)
      const corner = cellCenter(wall)
      await click(corner.x, corner.y)
      await runFor(SETTLE_MS)
      expect(dialog.query(), '壁を押しても窓は開かない').toBeNull()
      expect(readCell(setId), '壁を押しても歩かない').toBeNull()
      // 開始地点は自宅の地点の立ち位置で、上を向いた先の 1 マスが机
      const desk = { x: home.cell.x, y: home.cell.y - 1 }
      expect(objectSpotAt(room, desk)?.id, '上の 1 マスは自宅の地点の物').toBe('home')
      const point = cellCenter(desk)
      await click(point.x, point.y)
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }))
        .toBeVisible()
      expect(readCell(setId), '歩いていない').toBeNull()
    })

    test('話せる相手がいない所で話しかけた時の一言は、2.5 秒経つと消える', async () => {
      await openVillage()
      // 開始地点 (4,4) から 1 マス下は地点の立ち位置ではない
      expect(await walk(setId, 'ArrowDown', 1)).toBe(1)
      const hint = () =>
        [...document.querySelectorAll('[data-village-bubble-kind="thought"]')].find(bubble =>
          (bubble.textContent ?? '').includes(text.noTarget)
        ) ?? null
      await userEvent.keyboard('e')
      await expect.poll(hint, { message: '話せる相手がいない時の一言' }).not.toBeNull()
      await runFor(2_400)
      expect(hint(), '2.5 秒より前は出ている').not.toBeNull()
      await runFor(FRAME_MS * 8)
      expect(hint(), '2.5 秒経つと消える').toBeNull()
    })

    test('会話窓が開いている間は方向キー以外のキーでは閉じず、X で閉じる', async () => {
      await openVillage()
      await userEvent.keyboard('e')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }))
        .toBeVisible()
      await userEvent.keyboard('q')
      await runFor(FRAME_MS * 2)
      expect(dialog.query(), 'Q では閉じない').not.toBeNull()
      await userEvent.keyboard('x')
      await expect.element(dialog).not.toBeInTheDocument()
    })

    test('天気が届く前に村を離れると、天気の問い合わせを中断する', async () => {
      const signals: (AbortSignal | null | undefined)[] = []
      vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
        signals.push(init?.signal)
        return Response.json({ current: { precipitation: 2.4, snowfall: 0 } })
      })
      await page.viewport(1280, 720)
      render(<VillagePageContainer {...villageJa} />)
      expect(signals.length, '描いた時に天気を問い合わせる').toBe(1)
      cleanup()
      expect(signals[0]?.aborted, '離れた時に問い合わせを中断する').toBe(true)
      // 中断した後に届いた応答は使わない(描く先の無い村の状態を書き換えない)
      await runFor(FRAME_MS * 2)
    })

    test('コースの全地点で話して最後の会話窓を閉じると、案内が一覧への誘いに替わり、一覧への出口へ焦点が移る', async () => {
      // コースの地点(order を持つ地点)を巡る順に並べる
      const course = Object.values(villageJa.worldSet.worlds)
        .flatMap(world => world.spots)
        .filter(spot => spot.order !== undefined)
        .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
      const titleOf = (id: string) => text.stops[id]?.title ?? id
      const headingShown = (id: string) => () =>
        dialog.getByRole('heading', { name: titleOf(id) }).query() !== null
      await openVillage()
      // 同じ地点で 2 回話しても訪問は 1 回に数える(完走の判定がずれない)
      await userEvent.keyboard('e')
      await expect.element(dialog.getByRole('heading', { name: titleOf('home') })).toBeVisible()
      await dialog.getByRole('button', { name: text.close }).click()
      await expect.element(dialog).not.toBeInTheDocument()
      await userEvent.keyboard('e')
      await expect.element(dialog.getByRole('heading', { name: titleOf('home') })).toBeVisible()
      // 次へで残りの地点を順に巡る
      for (const [index, spot] of course.slice(0, -1).entries()) {
        const next = course[index + 1]
        await dialog.getByRole('button', { name: text.stops[spot.id]?.next ?? spot.id }).click()
        await advanceUntil(headingShown(next.id), `${next.id} の会話窓が開く`, 10_000)
      }
      const allSeen = text.allSeen.replaceAll('{list}', () => text.toList)
      expect(speech(), '最後の会話窓を閉じるまでは完走の案内を出さない').not.toBe(allSeen)
      await dialog.getByRole('button', { name: text.close }).click()
      await expect.element(dialog).not.toBeInTheDocument()
      await runFor(FRAME_MS * 2)
      expect(speech()).toBe(allSeen)
      const exit = document.querySelector<HTMLElement>('[data-village-exit]')
      expect(document.activeElement, '一覧への出口へ焦点が移る').toBe(exit)
      expect(exit?.hasAttribute('data-bounce'), '出口が跳ねる').toBe(true)
    }, 60_000)

    // ---- ここから下は、ほかの検査が通らない村のフックの分岐を、画面の操作で通す ----

    // 地点の並びを差し替えた版の村。実際のコンテンツでは作れない配置(次の地点が同じマス・歩いて届かない地点・地点の無い町)を作る
    const withSpots = (
      worldId: 'room' | 'town',
      edit: (spots: readonly Spot[]) => Spot[]
    ): WorldSet => {
      const { worlds } = villageJa.worldSet
      return {
        ...villageJa.worldSet,
        worlds: {
          ...worlds,
          [worldId]: { ...worlds[worldId], spots: edit(worlds[worldId].spots) },
        },
      }
    }
    const moveSpot = (spots: readonly Spot[], id: string, cell: Cell): Spot[] =>
      spots.map(spot => (spot.id === id ? { ...spot, cell } : spot))
    const spotOf = (world: World, id: string): Spot => {
      const spot = world.spots.find(candidate => candidate.id === id)
      if (spot === undefined) throw new Error(`${world.id} に ${id} の地点が無い`)
      return spot
    }
    // 保存した位置から村を描く。読み込み直後の最初の描画は保存を捨てるので、先に一度描いて外してから保存を置く
    // (このテストだけを走らせた時も同じ所から始めるため)
    const openAt = async (
      saved: { worldId: string; cell: Cell; facing: Direction },
      worldSet: WorldSet = villageJa.worldSet
    ) => {
      await page.viewport(1280, 720)
      render(<VillagePageContainer {...villageJa} />)
      cleanup()
      writePosition(setId, saved)
      render(<VillagePageContainer {...villageJa} worldSet={worldSet} />)
      await focusVillage()
      await expectLoopIdle()
    }

    test('会話窓で下を押したまま閉じて開き直すと、本文が窓に収まっていても押し直すまで焦点を操作へ渡さない', async () => {
      await openVillage()
      const title = dialog.getByRole('heading', { name: text.stops.home.title })
      await userEvent.keyboard('e')
      await expect.element(title).toHaveFocus()
      const panel = dialog.element().querySelector('[data-village-panel]')
      if (panel === null) throw new Error('会話窓の本文が無い')
      expect(panel.scrollHeight, '本文が窓に収まっている(送る余地が無い)').toBeLessThanOrEqual(
        panel.clientHeight
      )
      const firstAction = () => dialog.element().querySelector(STOP_FOCUSABLE_SELECTOR)
      // 収まっているので、下を押した瞬間に先頭の操作へ渡る
      await userEvent.keyboard('{ArrowDown>}')
      await advanceUntil(
        () => document.activeElement === firstAction(),
        '押した瞬間に先頭の操作へ渡る'
      )
      // 下を押したまま X で閉じ、E で開き直す
      await userEvent.keyboard('x')
      await expect.element(dialog).not.toBeInTheDocument()
      await userEvent.keyboard('e')
      await expect.element(title).toHaveFocus()
      await runFor(FRAME_MS * 10)
      expect(document.activeElement, '開く前から押していた下では見出しに留まる').toBe(
        title.element()
      )
      // 離したのを 1 フレームで読ませてから押し直すと渡る
      await userEvent.keyboard('{/ArrowDown}')
      await runFor(FRAME_MS * 2)
      await tapHeld('ArrowDown')
      await advanceUntil(
        () => document.activeElement === firstAction(),
        '押し直すと先頭の操作へ渡る'
      )
    })

    test('池で舞台を押したまま釣り始め、釣っている間に指先を別のマスへ動かしても、やめた後はその場に留まる', async () => {
      const pond = spotOf(town, 'pond')
      await openAt({ worldId: town.id, cell: pond.cell, facing: pond.facing })
      // 立っているマスを押したままにする(行き先が今のマスなので歩き出さない)
      const here = cellCenter(pond.cell)
      await mouse.move(here.x, here.y, false)
      await mouse.down(here.x, here.y)
      await runFor(FRAME_MS * 2)
      // 釣り始める。釣りの間は窓を出さないので、焦点は枠に残り、押している指も外れない
      await userEvent.keyboard('e')
      await advanceUntil(() => speech() === text.fishing.cast, '投げ始める')
      // 釣っている間に、押したままの指先を歩いて行けるマスへ動かす
      const elsewhere = { x: 8, y: 13 }
      expect(isWalkable(town, elsewhere), '動かした先は歩いて行ける').toBe(true)
      const there = cellCenter(elsewhere)
      await mouse.move(there.x, there.y, true)
      await runFor(FRAME_MS * 4)
      // やめる。釣っている間の指先の動きは読まないので、行き先は押した時のマス(今のマス)のまま
      await userEvent.keyboard('x')
      await runFor(SETTLE_MS * 2)
      expect(readCell(setId), '釣っている間に動かした指先のマスへは歩かない').toEqual({
        worldId: town.id,
        cell: pond.cell,
      })
      await mouse.up(there.x, there.y)
      await expectLoopIdle()
    })

    // タブの切り替えはヘッドレスの Chromium では起こせない(CDP にページの見え方を変える命令が無い)。
    // ブラウザの環境の設定として document の visibilityState を隠れた値に差し替え、ブラウザと同じく visibilitychange を送る
    test('方向キーを押したままタブが隠れると、離した知らせが届かなくても歩くのを止め、見えている間の知らせでは止めない', async () => {
      await openVillage()
      await expectLoopIdle()
      const column = () => readCell(setId)?.cell.x ?? 4
      // 開始地点 (4,4) の行は右の壁際 (9,4) まで床
      await userEvent.keyboard('{ArrowRight>}')
      await advanceUntil(() => column() === 5, '右へ歩き出す')
      // 見えている間の知らせ(タブが見えるようになった時と同じ)では止めない。知らせた時に歩きかけていた 1 マス(6)の
      // 先まで歩き続ける
      document.dispatchEvent(new Event('visibilitychange'))
      await advanceUntil(() => column() === 7, '見えている間は歩き続ける')
      // タブが隠れる。離した知らせ(keyup)は届かず、キーは押されたまま
      const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      hidden.mockRestore()
      // 歩きかけの 1 マスは最後まで進み、そこで止まって眠る
      await expectLoopIdle()
      const stopped = column()
      await runFor(SETTLE_MS * 2)
      expect(column(), '隠れた後は歩かない').toBe(stopped)
      expect(stopped, '右の壁際より手前で止まる').toBeLessThan(9)
      await userEvent.keyboard('{/ArrowRight}')
    })

    test('地点の無い町では地図を開いても焦点が枠に残り、枠で M をもう一度押すと閉じる', async () => {
      // 実際のコンテンツには地点の無い町が無いので、町の地点と自室のコースの地点を外した版を渡す(地図に印が 1 つも並ばない)
      const bare = withSpots('town', () => [])
      const worldSet = {
        ...bare,
        worlds: {
          ...bare.worlds,
          room: { ...room, spots: room.spots.filter(spot => spot.order === undefined) },
        },
      }
      await page.viewport(1280, 720)
      render(<VillagePageContainer {...villageJa} worldSet={worldSet} />)
      await focusVillage()
      expect(await leaveRoom(setId)).toBe(3)
      await userEvent.keyboard('m')
      await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
      expect(
        dialog.element().querySelectorAll('[data-spot-id]').length,
        '地図に地点の印が無い'
      ).toBe(0)
      await runFor(FRAME_MS * 2)
      expect(document.activeElement, '焦点を置く地点が無いので枠に残る').toBe(villageFrame())
      await userEvent.keyboard('m')
      await expect.element(dialog).not.toBeInTheDocument()
    })

    test('次の地点にもう立っている時の「次へ」は、歩かずにその場で次の地点へ話しかけ、訪れたことにする', async () => {
      // 実際のコンテンツでは地点どうしの立ち位置が重ならないので、研究所の立ち位置を名刺工房と同じマスへ動かした版を渡す
      const meishi = spotOf(town, 'meishi')
      const worldSet = withSpots('town', spots => moveSpot(spots, 'lab', meishi.cell))
      await openAt({ worldId: town.id, cell: meishi.cell, facing: meishi.facing }, worldSet)
      await userEvent.keyboard('e')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.meishi.title }))
        .toBeVisible()
      expect(readVisited(setId), '前提: 研究所はまだ訪れていない').not.toContain('lab')
      await dialog.getByRole('button', { name: text.stops.meishi.next }).click()
      // 同じマスに立つ研究所へ話しかける。会話窓は閉じずに開いたまま、研究所を訪れたことに数える
      await expect
        .poll(() => readVisited(setId), { message: '研究所を訪れたことにする' })
        .toContain('lab')
      expect(document.querySelector('[role="dialog"]'), '会話窓は開いたまま').not.toBeNull()
      await runFor(SETTLE_MS)
      expect(readCell(setId), '歩いていない').toEqual({ worldId: town.id, cell: meishi.cell })
      expect(loopState(), '歩行ループは眠ったまま').toBe('idle')
    })

    test('コースの最後の会話窓を閉じた直後に村を離れても、一覧への出口へ焦点を移す処理は外れた後に何もしない', async () => {
      // 自室の地点のほかは話し終えた状態から始める(読み込み直後の最初の描画は保存を捨てるので、一度描いて外してから置く)
      const others = Object.values(villageJa.worldSet.worlds)
        .flatMap(world => world.spots)
        .filter(spot => spot.order !== undefined && spot.id !== 'home')
        .map(spot => spot.id)
      await page.viewport(1280, 720)
      render(<VillagePageContainer {...villageJa} />)
      cleanup()
      writeVisited(setId, others)
      await openVillage()
      await userEvent.keyboard('e')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }))
        .toBeVisible()
      await dialog.getByRole('button', { name: text.close }).click()
      await expect.element(dialog).not.toBeInTheDocument()
      // 閉じた時点で完走の案内に替わり、出口へ焦点を移すのは次のフレーム。その前に村を離れる
      expect(speech()).toBe(text.allSeen.replaceAll('{list}', () => text.toList))
      cleanup()
      await runFor(FRAME_MS * 2)
      expect(document.querySelector('[data-village-exit]'), '出口はもう無い').toBeNull()
      expect(document.activeElement, '焦点はどこへも移さない').toBe(document.body)
    })

    // 村を外した commit の中で、外した部品の後片付けの effect より前に時計を ms 進める。ページを移って村を外すと、
    // ref は commit の中で外れ、押しっぱなしのループを止める後片付けは commit の後に回るので、その間にフレームが来うる。
    // フレームの中で投げた物は errors へ集める(投げると、ページを移る時に外れた窓を触って落ちたことになる)
    function AdvanceAfterLeaving({ ms, errors }: { ms: number; errors: string[] }) {
      useLayoutEffect(() => {
        try {
          vi.advanceTimersByTime(ms)
        } catch (error) {
          errors.push(String(error))
        }
      }, [ms, errors])
      return null
    }

    test('会話窓で下を押したまま村を離れ、後片付けより先にフレームが来ても、本文送りは外れた窓を触らない', async () => {
      await page.viewport(1280, 720)
      const view = render(<VillagePageContainer {...villageJa} />)
      await focusVillage()
      await userEvent.keyboard('e')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }))
        .toHaveFocus()
      // 下を押したままにする。押している間は本文送りのループが毎フレーム回る
      await userEvent.keyboard('{ArrowDown>}')
      await runFor(FRAME_MS * 2)
      const errors: string[] = []
      view.rerender(<AdvanceAfterLeaving ms={FRAME_MS} errors={errors} />)
      expect(errors, '外れた後のフレームで投げない').toEqual([])
      expect(document.querySelector('[role="dialog"]'), '窓はもう無い').toBeNull()
      await userEvent.keyboard('{/ArrowDown}')
    })

    test('卓上時計の窓で下(S)を押したまま村を離れ、後片付けより先に繰り返しの時刻が来ても、外れた窓の焦点を動かさない', async () => {
      // 1 段目でスティック・WASD を倒し続けた時に、焦点を次のボタンへ移し直す間隔(ClockModal/utils/step-clock-time.ts の CHOOSE_REPEAT_MS)
      const CHOOSE_REPEAT_MS = 300
      await page.viewport(1280, 720)
      const view = render(<VillagePageContainer {...villageJa} />)
      await focusVillage()
      // 部屋の開始マス (4,4) から時計の前 (7,3) へ
      expect(await walk(setId, 'ArrowRight', 3), '時計と同じ列まで歩けた').toBe(3)
      expect(await walk(setId, 'ArrowUp', 1), '時計の前まで歩けた').toBe(1)
      await userEvent.keyboard('e')
      const clockWindow = page.getByRole('dialog', { name: text.clock.place })
      await expect.element(clockWindow).toHaveAttribute('data-step', 'choose')
      await expect.element(clockWindow.getByRole('button').first()).toHaveFocus()
      // S を押したままにする。窓は矢印だけを自分で受け、S は枠が押しっぱなしの向き(下)として読む
      await userEvent.keyboard('{s>}')
      await advanceUntil(
        () => focusIndex(clockWindow.element(), CLOCK_FOCUSABLE_SELECTOR) === 1,
        '押した瞬間に次のボタンへ移る'
      )
      const errors: string[] = []
      // 押し続けた時の次の 1 つの時刻を過ぎるまで進める
      view.rerender(<AdvanceAfterLeaving ms={CHOOSE_REPEAT_MS + FRAME_MS} errors={errors} />)
      expect(errors, '外れた後のフレームで投げない').toEqual([])
      expect(document.querySelector('[role="dialog"]'), '窓はもう無い').toBeNull()
      await userEvent.keyboard('{/s}')
    })

    test('描いた直後、枠の幅の最初の知らせが届く前に村を離れ、後片付けより先に最初のフレームが来ても、歩行ループは外れた枠を読まない', async () => {
      await page.viewport(1280, 720)
      // 描いてから離れるまで await を挟まず、同じタスクの中で済ませる。枠の幅を覚える ResizeObserver の知らせは
      // 本物の描画の段で届くので、その間には届かず、歩行ループの最初のフレームは枠そのものの幅を読みに行く
      const view = render(<VillagePageContainer {...villageJa} />)
      // 描いた時に頼んだ最初のフレームは、偽の時計を 1 度も進めていないのでまだ来ていない
      expect(loopState(), '前提: 最初のフレームを頼んで待っている').toBe('running')
      const errors: string[] = []
      // 偽の rAF は時計を入れた時の本物の時刻から 16ms 刻みで来る。日付を本物の今日より前(昼の瞬間)へ戻して止めているので、
      // 最初のフレームは 16ms 以上 32ms 未満の先になる。2 フレーム分進めて、最初のフレームを必ず来させる
      view.rerender(<AdvanceAfterLeaving ms={FRAME_MS * 2} errors={errors} />)
      expect(errors, '外れた後のフレームで投げない').toEqual([])
      expect(document.querySelector('[data-village]'), '村はもう無い').toBeNull()
    })
  })
})

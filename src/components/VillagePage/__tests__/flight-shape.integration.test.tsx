// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage'
import { isWalkable } from '@/lib/village/collision'
import { FLIGHT_MIN_DISTANCE, flightDurationMs } from '@/lib/village/flight-curve'
import {
  advanceUntil,
  expectLoopIdle,
  focusVillage,
  isVisible,
  readCell,
  stubWeather,
} from './village-walk.test-helper'
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
  stepOf,
  type FrameSample,
} from './village-walk-flight.test-helper'
import {
  ARRIVE_MS,
  LAB,
  LINE_TOLERANCE,
  MONUMENT,
  TOP_SPOT,
  TOWN_ENTRY,
  flyingNow,
  map,
  openMap,
  placeOf,
  sameSaved,
  shadowEl,
  spotButton,
  sprite,
  town,
  travelOnMap,
  waitForTakeOff,
  walkOutToTown,
} from './flight.test-helper'
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

// ---- 自動移動の直線飛行(飛ぶ形) ----
// E2E が見ていた自動移動の直線飛行のうち、飛ぶ間の姿・道筋・速さ・浮き・カメラ・影・吹き出しと雨の日のコマを、
// E2E からこの統合テストへ移したもの(ADR 0016 の「統合へ移す」)。
// 飛ぶ間の入力は flight-input.integration.test.tsx、飛ぶ所と飛ばない所は flight-route.integration.test.tsx。
// 村の配置と地図で移る手順は flight.test-helper.ts。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date。E2E の page.clock と同じく時間として替える)で止め、
// テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('自動移動の直線飛行(飛ぶ形)', () => {
  const setId = villageJa.worldSet.id

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

  // 1 フレームのカメラの動きが、同じフレームの影と主人公の動きの大きい方を超えてよい倍率と、
  // 層の位置を整数 px へ丸める分の余裕(px)
  const CAMERA_SLACK = 1.2
  const ROUND_PX = 2
  // 写した飛ぶ長さが、距離で決まる長さから外れてよい幅(ms)。E2E と同じ幅(実時間の揺れの分。偽の時計では揺れない)
  const FLIGHT_SPAN_SLACK_MS = 100

  // 村を開き、部屋の出口のマットまで歩いて町の自宅前へ出る
  const goToTown = async () => {
    await openVillage()
    await walkOutToTown()
  }

  // 自宅前から地図で経歴碑へ移る。直線が自宅の上を通る移動で、飛ぶ形を測るテストが共通に使う
  const travelToMonument = async () => {
    await goToTown()
    return travelOnMap(placeOf('monument'), { worldId: town.id, cell: MONUMENT })
  }

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
    if (before.camera === null || landed.camera === null) throw new Error('層の位置を写せていない')
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
    expect(distinct(flightOf(samples).flying.map(s => s.sprite)), '雨の日に飛ぶ間のコマ').toEqual([
      'player-fly-up-0',
      'player-fly-up-1',
    ])
    expect(samples[samples.length - 1].sprite, '降りた後のコマ').toBe('player-umbrella-up-0')
    expect(sprite()).toBe('player-umbrella-up-0')
  }, 30_000)
})

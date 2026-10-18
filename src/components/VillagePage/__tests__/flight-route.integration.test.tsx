// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell } from '@content/types/world'
import VillagePageContainer from '@/components/VillagePage'
import { isWalkable } from '@/lib/village/collision'
import { FLIGHT_MIN_DISTANCE } from '@/lib/village/flight-curve'
import { findPath } from '@/lib/village/path'
import { routeToWarp } from '@/lib/village/warp'
import {
  advanceUntil,
  cellCenter,
  click,
  emulateReducedMotion,
  expectLoopIdle,
  focusVillage,
  readCell,
  villageFrame,
  walk,
  worldLayer,
} from './village-walk.test-helper'
import {
  distanceBetween,
  distinct,
  flightOf,
  groundOf,
  isFlyingSprite,
  onSegment,
  savedCells,
  startRecording,
  stopRecording,
} from './village-walk-flight.test-helper'
import {
  ARRIVE_MS,
  EXIT_MAT,
  HOME_DOOR,
  LAB,
  LINE_TOLERANCE,
  MEISHI,
  MONUMENT,
  PC,
  ROOM_ENTRY,
  TOWN_ENTRY,
  placeOf,
  room,
  sameSaved,
  town,
  travelOnMap,
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

// ---- 自動移動の直線飛行(飛ぶ所と飛ばない所) ----
// E2E が見ていた自動移動の直線飛行のうち、動きを控える設定では飛ばないこと・扉を通って別のワールドへ移る飛行・
// 会話窓の「次へ」の飛行・舞台を押した時は飛ばないことを、E2E からこの統合テストへ移したもの(ADR 0016 の「統合へ移す」)。
// 飛ぶ形は flight-shape.integration.test.tsx、飛ぶ間の入力は flight-input.integration.test.tsx。
// 村の配置と地図で移る手順は flight.test-helper.ts。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date。E2E の page.clock と同じく時間として替える)で止め、
// テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)、舞台を押すのは CDP の Input で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('自動移動の直線飛行(飛ぶ所と飛ばない所)', () => {
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

  // 普段の歩きのコマのうち足を出したもの(1・2)。歩いた証拠に使う。左向きは right の反転なので up / down / right だけ
  const WALKING = /^player-(up|down|right)-[12]$/

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

  // 村を開き、部屋の出口のマットまで歩いて町の自宅前へ出る
  const goToTown = async () => {
    await openVillage()
    await walkOutToTown()
  }

  // 自宅前から地図で経歴碑へ移る。直線が自宅の上を通る移動(飛ぶ形は flight-shape.integration.test.tsx が同じ移動で測る)
  const travelToMonument = async () => {
    await goToTown()
    return travelOnMap(placeOf('monument'), { worldId: town.id, cell: MONUMENT })
  }

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
    expect(stale, '部屋で飛ぶ印を出したのに、出口手前と PC の前を結ぶ線分から外れた影').toEqual([])
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

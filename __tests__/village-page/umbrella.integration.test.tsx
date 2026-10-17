// 雨の日の傘の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import { UMBRELLA_CLOSE_MS, UMBRELLA_OPEN_MS } from '@/lib/village/player-pose'
import {
  FRAME_MS,
  SLACK_MS,
  advanceUntil,
  emulateReducedMotion,
  expectLoopIdle,
  focusVillage,
  press,
  readCell,
  runFor,
  stepFrame,
  stubWeather,
  villageFrame,
  villagePlayer,
  walk,
  worldLayer,
  type WeatherKind,
} from './village-walk.test-helper'
import {
  recordTimeline,
  type TimelineEntry,
  type TimelineKind,
} from './village-walk-record.test-helper'
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

// E2E が見ていた雨の日の傘を、E2E からこの統合テストへ移したもの(ADR 0016 の「統合へ移す」)と、
// それが通らないフックの分岐を確かめる検査(describe の末尾)。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date。E2E の page.clock と同じく時間として替える)で止め、
// テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts。末尾の 1 本だけは setTimeout を本物のまま残す)。
// 歩く・押すは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える)・差し替えた天気は、ファイル先頭の afterEach が戻す
describe('雨の日の傘', () => {
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

  // 村は自室から始まる。自室の出口のマット (4,7) に乗ると町の自宅前 (14,12) へ下向きで出て、
  // 自宅前で上を押すと自宅の扉 (14,11) にぶつかり、自室の出口手前 (4,6) へ上向きで戻る。
  // 自宅前の右 (15,12) と下 (14,13) はどちらも道
  const START_WORLD = 'room'
  const DOORSTEP = { worldId: 'town', cell: { x: 14, y: 12 } }
  const EAST_OF_DOORSTEP = { worldId: 'town', cell: { x: 15, y: 12 } }
  const ROOM_ENTRY = { worldId: 'room', cell: { x: 4, y: 6 } }
  // 取り出して開く 5 コマと、畳んでしまう 5 コマ。並びは傘の動きの設計の時間割どおり。
  // シートの UMBRELLA_OPEN_STEPS / UMBRELLA_CLOSE_STEPS から組まない — 並びを取り違えた定数から期待値を作ると、
  // 実装と期待が一緒に入れ替わって何も検出しない
  const OPEN_KEYS = ['reach', 'draw', 'extend', 'half', 'raise'].map(
    step => `player-umbrella-open-${step}`
  )
  const CLOSE_KEYS = ['lower', 'half', 'closed', 'compact', 'stow'].map(
    step => `player-umbrella-close-${step}`
  )
  const OPEN_PREFIX = 'player-umbrella-open-'
  const CLOSE_PREFIX = 'player-umbrella-close-'
  // 傘のコマ全部の頭。開く・畳むの途中のコマも含む
  const UMBRELLA_PREFIX = 'player-umbrella-'
  // 傘を差した下向きの立ち姿。開き終えるとこのコマになる
  const STAND_DOWN = 'player-umbrella-down-0'
  // 傘を差して立つ・歩くコマ。上下は 0 が立ち・1 と 2 が足を替えた歩き、横は 0 が立ち・1 が歩き
  const UMBRELLA_POSE = /^player-umbrella-(up|down|right|left)-[0-2]$/
  // 動かなかった時の主人公の位置のずれの許容(px)。1 マス動けばマス寸法の下限(12px)以上ずれる
  const POSITION_TOLERANCE_PX = 1

  // 描いたコマを、描いた時に DOM に載っていたワールドごとに区切る(ワールドへ入るたびに 1 区切り)。
  // ワールドが替わる描画では React も主人公へ新しいワールドの開始の向きのコマ(傘の無いコマ)を書く。
  // それが data-world の前後どちらで記録されても判定が変わらないよう、各判定は傘のコマか押した時刻を起点に見る
  type Drawn = { key: string; at: number }
  type Visit = { world: string; enteredAt: number; keys: Drawn[] }
  const visitsOf = (timeline: readonly TimelineEntry[]): Visit[] => {
    const visits: Visit[] = [{ world: START_WORLD, enteredAt: 0, keys: [] }]
    for (const entry of timeline) {
      const current = visits[visits.length - 1]
      if (entry.kind === 'world' && entry.value !== current.world) {
        visits.push({ world: entry.value, enteredAt: entry.at, keys: [] })
      } else if (entry.kind === 'sprite') {
        current.keys.push({ key: entry.value, at: entry.at })
      }
    }
    return visits
  }
  // 描いたコマのうち、名前が head で始まるものの名前
  const keysStartingWith = (drawn: readonly Drawn[], head: string) =>
    drawn.map(({ key }) => key).filter(key => key.startsWith(head))
  // 最初に描いた傘のコマから後のコマの名前。傘のコマが無ければ空
  const fromFirstUmbrella = (drawn: readonly Drawn[]): string[] => {
    const start = drawn.findIndex(({ key }) => key.startsWith(UMBRELLA_PREFIX))
    return start < 0 ? [] : drawn.slice(start).map(({ key }) => key)
  }
  const firstDrawnAt = (drawn: readonly Drawn[], key: string): number => {
    const hit = drawn.find(entry => entry.key === key)
    if (hit === undefined) throw new Error(`${key} を描いた記録が無い`)
    return hit.at
  }
  const lastKeyAt = (timeline: readonly TimelineEntry[], value: string): number => {
    const hit = timeline.findLast(entry => entry.kind === 'key' && entry.value === value)
    if (hit === undefined) throw new Error(`${value} の記録が無い`)
    return hit.at
  }
  // kind の記録のうち、値が head で始まる最初の 1 件から ms 経つまで時計を進める(ms が 0 ならその 1 件が記録されるまで)。
  // 動きの始まりはその動きの最初のコマを描いた時刻より前なので、最初のコマから動きの長さが経てば動きも入力の錠も終わっている。
  // 満たした後に 1 フレーム進める。E2E はページの rAF ごとに見て待つので、待ち終えた時には記録の付いた描画の次のフレーム
  // (ワールドへ入った後の最初のフレームなら、押しっぱなしを捨てる印を下ろすフレーム)を必ず過ぎている
  const waitSince = async (
    timeline: readonly TimelineEntry[],
    kind: TimelineKind,
    head: string,
    ms: number
  ) => {
    await advanceUntil(
      () => {
        const first = timeline.find(entry => entry.kind === kind && entry.value.startsWith(head))
        return first !== undefined && performance.now() - first.at >= ms
      },
      `${head} の記録から ${ms}ms`,
      ms + SLACK_MS
    )
    await stepFrame()
  }
  // 主人公がワールドの層のどこに描かれているか(px)。層の左上からの差で測るので、カメラが動いても変わらない
  const positionInWorld = () => {
    const box = villagePlayer().getBoundingClientRect()
    const origin = worldLayer().getBoundingClientRect()
    return { x: box.x - origin.x, y: box.y - origin.y }
  }
  const worldShown = () => worldLayer().dataset.world
  const cellText = () => JSON.stringify(readCell(setId))

  // 記録を仕掛け、天気を敷いて村を開く。記録は描く前に仕掛け、扉を踏んだ直後の最初のコマから取りこぼさない。
  // 実際の通信ではなくこの応答を見て描くことを、扉を出る前に押さえる
  const openInWeather = async (kind: WeatherKind) => {
    const timeline = recordTimeline(document.body)
    const weather = stubWeather(kind)
    await openVillage()
    await expect.poll(() => weather.calls(), { message: '天気を問い合わせた' }).toBeGreaterThan(0)
    return timeline
  }

  test('雨の日に部屋から町へ出ると、戸口で傘を取り出して開き、開き終えるまでは動かず、その後は傘を差して歩く', async () => {
    const timeline = await openInWeather('rain')
    // 出口のマット (4,7) の 1 つ手前 (4,6) まで歩き、マットへの最後の 1 歩は press で踏む
    expect(await walk(setId, 'ArrowDown', 2)).toBe(2)
    await press('ArrowDown')
    // 町で最初の取り出すコマが描かれるまで進める。このフレームで主人公は自宅前に置き直されている
    await waitSince(timeline, 'sprite', OPEN_PREFIX, 0)
    expect(readCell(setId)).toEqual(DOORSTEP)
    const before = positionInWorld()
    // 開いている間に下を押す。もう下を向いているので向き直りは挟まず、錠が掛かっていなければ道の (14,13) へ進む
    await press('ArrowDown')
    // 開き終える(最初の取り出すコマから UMBRELLA_OPEN_MS)のと、ループが眠るのを待つ
    await waitSince(timeline, 'sprite', OPEN_PREFIX, UMBRELLA_OPEN_MS)
    await expectLoopIdle()
    expect(villagePlayer().dataset.sprite).toBe(STAND_DOWN)
    // 押したのが本当に開いている途中だったかを先に確かめる。傘を差した立ち姿は開く動きの最後の窓で初めて出て、
    // 錠はそれより後(UMBRELLA_OPEN_MS)まで続く。立ち姿より前に離していれば、押していた間はずっと錠の中だった
    const early = [...timeline]
    const released = lastKeyAt(early, 'keyup:ArrowDown')
    const standAt = firstDrawnAt(visitsOf(early)[1].keys, STAND_DOWN)
    expect(released, '開いている間に押し終えている').toBeLessThan(standAt)
    // 開いている間に押しても、立つマスも描かれる位置も変わらない
    expect(readCell(setId), '開いている間に押しても自宅前から動かない').toEqual(DOORSTEP)
    const after = positionInWorld()
    const moved = Math.max(Math.abs(after.x - before.x), Math.abs(after.y - before.y))
    expect(moved, '押しても位置が変わらない').toBeLessThanOrEqual(POSITION_TOLERANCE_PX)
    // 開き終えれば歩ける
    expect(await walk(setId, 'ArrowRight', 1), '開き終えた後は歩ける').toBe(1)
    expect(readCell(setId)).toEqual(EAST_OF_DOORSTEP)

    const visits = visitsOf(timeline)
    expect(visits.map(visit => visit.world)).toEqual(['room', 'town'])
    const drawn = fromFirstUmbrella(visits[1].keys)
    // 取り出す 5 コマを順に 1 度ずつ描き、傘を差した立ち姿になる。間に他のコマは挟まらない
    const opening = drawn.slice(0, OPEN_KEYS.length + 1)
    expect(opening, '町へ出てから描いた傘のコマの並び').toEqual([...OPEN_KEYS, STAND_DOWN])
    // 開き終えた後は、立つのも歩くのも傘を差したコマだけ。歩きのコマも描いている(本当に歩いた)
    const walked = drawn.slice(OPEN_KEYS.length + 1)
    const bare = walked.filter(key => !UMBRELLA_POSE.test(key))
    expect(bare, '開き終えた後に傘を差していないコマ').toEqual([])
    expect(walked, '傘を差したまま横へ歩くコマ').toContain('player-umbrella-right-1')
  })

  test('雨の日に町から自宅の扉へ入ると、町に留まったまま傘を畳んでしまい、それから部屋へ移って傘の無いコマに戻る', async () => {
    const timeline = await openInWeather('rain')
    expect(await walk(setId, 'ArrowDown', 3)).toBe(3)
    expect(worldShown()).toBe('town')
    // 開き終えて錠が外れるまで待ってから扉へ向かう
    await waitSince(timeline, 'sprite', OPEN_PREFIX, UMBRELLA_OPEN_MS)
    // 上を 1 回押すと上へ向き直り、自宅の扉 (14,11) にぶつかる。畳み終えるまで部屋へは移らない
    await press('ArrowUp')
    await advanceUntil(() => worldShown() === 'room', '部屋へ移る', UMBRELLA_CLOSE_MS + SLACK_MS)
    await advanceUntil(() => cellText() === JSON.stringify(ROOM_ENTRY), '部屋の出口手前に立つ')
    // 部屋では傘を差さない。1 マス歩いても傘の無いコマのまま
    expect(await walk(setId, 'ArrowUp', 1)).toBe(1)
    await advanceUntil(() => villagePlayer().dataset.sprite === 'player-up-0', '上向きの立ち姿')

    const visits = visitsOf(timeline)
    expect(visits.map(visit => visit.world)).toEqual(['room', 'town', 'room'])
    const [, town, back] = visits
    // 畳んでしまう 5 コマを、町にいる間(data-world が town)に順に 1 度ずつ描く。
    // 扉にぶつかってすぐ部屋へ移る作りなら、畳むコマは部屋で描かれるか 1 つも描かれない
    expect(keysStartingWith(town.keys, CLOSE_PREFIX), '町で畳んだコマの並び').toEqual(CLOSE_KEYS)
    // 畳む 5 コマの間に他のコマは挟まらない
    const townKeys = town.keys.map(({ key }) => key)
    const closeFrom = townKeys.indexOf(CLOSE_KEYS[0])
    expect(townKeys.slice(closeFrom, closeFrom + CLOSE_KEYS.length)).toEqual(CLOSE_KEYS)
    // 部屋へ移った後は傘のコマ(畳む途中のコマも)を 1 つも描かない。歩きのコマは描いている(本当に歩いた)
    expect(keysStartingWith(back.keys, UMBRELLA_PREFIX), '部屋で描いた傘のコマ').toEqual([])
    const roomKeys = back.keys.map(({ key }) => key)
    expect(roomKeys, '部屋で上へ歩くコマ').toContainEqual(expect.stringMatching(/^player-up-[12]$/))
  })

  // 降らない日と雪の日は傘を出さない(雨の検査の対照)。天気の層で、差し替えた応答が効いていることも確かめる
  const DRY_DAYS = [
    { kind: 'clear', name: '晴れ', layers: '[data-weather]', count: 0 },
    // 雪の応答は降水も 0 より大きい。降水の有無で傘を決める取り違えはここで落ちる。降っている間の層は 2 枚
    { kind: 'snow', name: '雪', layers: '[data-weather=snow]', count: 2 },
  ] as const

  for (const day of DRY_DAYS) {
    test(`${day.name}の日は部屋を出ても自宅の扉へ入っても傘を出さず、扉は畳む長さを待たずに通る`, async () => {
      const timeline = await openInWeather(day.kind)
      expect(await walk(setId, 'ArrowDown', 3)).toBe(3)
      expect(worldShown()).toBe('town')
      await expect
        .poll(() => document.querySelectorAll(day.layers).length, { message: '天気の層の数' })
        .toBe(day.count)
      // 雨なら開き終えている頃まで待ってから見る。すぐ見ると、遅れて開き始める壊れ方を通してしまう
      await waitSince(timeline, 'world', 'town', UMBRELLA_OPEN_MS)
      expect(villagePlayer().dataset.sprite).toBe('player-down-0')
      await press('ArrowUp')
      await advanceUntil(() => worldShown() === 'room', '部屋へ移る')
      await advanceUntil(() => cellText() === JSON.stringify(ROOM_ENTRY), '部屋の出口手前に立つ')

      const visits = visitsOf(timeline)
      expect(visits.map(visit => visit.world)).toEqual(['room', 'town', 'room'])
      const drawnAll = visits.flatMap(visit => visit.keys)
      expect(keysStartingWith(drawnAll, UMBRELLA_PREFIX), '描いた傘のコマ').toEqual([])
      // 扉にぶつかってから部屋が描かれるまで、畳む長さを待たない
      const entering = visits[2].enteredAt - lastKeyAt(timeline, 'keydown:ArrowUp')
      expect(entering, '上を押してから部屋が描かれるまでの ms').toBeLessThan(UMBRELLA_CLOSE_MS)
    })
  }

  describe('動きを控える設定の傘', () => {
    test('雨でも取り出す・畳むコマを出さず、町へ出た最初のコマから傘を差し、出てすぐ歩けて扉もすぐ通る', async () => {
      await emulateReducedMotion()
      const timeline = await openInWeather('rain')
      expect(await walk(setId, 'ArrowDown', 2)).toBe(2)
      await press('ArrowDown')
      await waitSince(timeline, 'world', 'town', 0)
      // 入力の錠も掛けない。町が描かれてすぐ右を押せば 1 マス進む
      await press('ArrowRight')
      await advanceUntil(() => cellText() === JSON.stringify(EAST_OF_DOORSTEP), '右へ 1 マス進む')
      // 押したのが、錠が掛かっていたなら確かに効いている間だったか。開く長さの半分までに離し終えたことを求める
      const early = [...timeline]
      const released = lastKeyAt(early, 'keyup:ArrowRight') - visitsOf(early)[1].enteredAt
      expect(released, '町が描かれてから右を離すまでの ms').toBeLessThan(UMBRELLA_OPEN_MS / 2)
      // 動きを控える設定では歩きのコマを出さないので、横向きの立ち姿のまま
      await advanceUntil(
        () => villagePlayer().dataset.sprite === 'player-umbrella-right-0',
        '傘を差した横向きの立ち姿'
      )
      // 自宅前へ戻り、扉へ入る
      expect(await walk(setId, 'ArrowLeft', 1)).toBe(1)
      await press('ArrowUp')
      await advanceUntil(() => worldShown() === 'room', '部屋へ移る')
      await advanceUntil(() => cellText() === JSON.stringify(ROOM_ENTRY), '部屋の出口手前に立つ')

      const visits = visitsOf(timeline)
      expect(visits.map(visit => visit.world)).toEqual(['room', 'town', 'room'])
      const [, town, back] = visits
      const drawnAll = visits.flatMap(visit => visit.keys)
      expect(keysStartingWith(drawnAll, OPEN_PREFIX), '取り出す途中のコマ').toEqual([])
      expect(keysStartingWith(drawnAll, CLOSE_PREFIX), '畳む途中のコマ').toEqual([])
      // 町では最初の傘のコマが下向きの立ち姿で、扉へ向けて押すまで傘を差したコマだけを描く
      const doorPressedAt = lastKeyAt(timeline, 'keydown:ArrowUp')
      const inTown = fromFirstUmbrella(town.keys.filter(({ at }) => at < doorPressedAt))
      expect(inTown[0], '町で最初に描いた傘のコマ').toBe(STAND_DOWN)
      const bare = inTown.filter(key => !UMBRELLA_POSE.test(key))
      expect(bare, '町で傘を差していないコマ').toEqual([])
      // 部屋では傘を差さず、扉にぶつかってから部屋が描かれるまで畳む長さを待たない
      expect(keysStartingWith(back.keys, UMBRELLA_PREFIX), '部屋で描いた傘のコマ').toEqual([])
      const entering = back.enteredAt - doorPressedAt
      expect(entering, '上を押してから部屋が描かれるまでの ms').toBeLessThan(UMBRELLA_CLOSE_MS)
    })
  })

  // ここから下は E2E に無い分岐(畳む途中で地図を開く・村を離れる)。use-village-umbrella の待っている扉の処理を見る

  // 扉にぶつかって畳み始めるまで進める。畳む最初のコマが記録されたら畳む途中
  const startClosingAtDoor = async (timeline: readonly TimelineEntry[]) => {
    expect(await walk(setId, 'ArrowDown', 3)).toBe(3)
    await waitSince(timeline, 'sprite', OPEN_PREFIX, UMBRELLA_OPEN_MS)
    await press('ArrowUp')
    await waitSince(timeline, 'sprite', CLOSE_PREFIX, 0)
    expect(worldShown(), '畳んでいる間は町に留まる').toBe('town')
  }

  test('雨の日に扉の前で傘を畳んでいる間に地図を開くと、部屋へは入らず、閉じた後は傘を差した姿で町に残る', async () => {
    const timeline = await openInWeather('rain')
    await startClosingAtDoor(timeline)
    // 地図は屋外でしか描かないので、開いた地図の下で部屋へ入ると窓の無いまま移動だけ止まってしまう
    await userEvent.keyboard('m')
    const map = page.getByRole('dialog')
    await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    await runFor(UMBRELLA_CLOSE_MS + FRAME_MS * 4)
    expect(worldShown(), '畳み終える頃を過ぎても町のまま').toBe('town')
    expect(readCell(setId), '自宅前に立ったまま').toEqual(DOORSTEP)
    await userEvent.keyboard('m')
    await expect.element(map).not.toBeInTheDocument()
    // 扉の前に戻した姿は、傘を差して扉(上)を向いた立ち姿
    await advanceUntil(
      () => villagePlayer().dataset.sprite === 'player-umbrella-up-0',
      '傘を差した上向きの立ち姿'
    )
  })

  test('雨の日に扉の前で傘を畳んでいる間に村を離れると、待っていた扉の処理は後から走らない', async () => {
    const timeline = await openInWeather('rain')
    await startClosingAtDoor(timeline)
    cleanup()
    // 待っていた扉の処理が残っていれば、畳み終える頃に部屋へ移った位置を保存する
    await runFor(UMBRELLA_CLOSE_MS * 2)
    expect(readCell(setId), '離れた後も保存は自宅前のまま').toEqual(DOORSTEP)
  })

  // 畳み終える時刻と、部屋へ移す処理を待たせたタイマーの時刻は同じ。実機ではその時刻のフレームがタイマーより先に来ることがあり
  // (タイマーが遅れて走る)、押しっぱなしの足はそのフレームで扉へもう一度ぶつかる。偽の時計(frames)ではタイマーが先に走るので、
  // setTimeout だけを本物の時計に残してフレームを先に進め、その順を作る
  test('雨の日に扉の前で畳み終えた後、部屋へ移るまで扉を押し続けても、傘を畳み直さずに 1 回だけ部屋へ入る', async () => {
    vi.useRealTimers()
    startVillageClock(PHASE_CLOCKS.day, 'frames-real-timeouts')
    const timeline = recordTimeline(document.body)
    const weather = stubWeather('rain')
    await page.viewport(1280, 720)
    render(<VillagePageContainer {...villageJa} />)
    // 起動の覆いは setTimeout で外れるので、この時計では本物の時間で待つ
    await expect
      .poll(() => document.getElementById('boot'), {
        message: '起動の覆いが外れる',
        timeout: SLACK_MS,
      })
      .toBeNull()
    villageFrame().focus()
    await expect.poll(() => weather.calls(), { message: '天気を問い合わせた' }).toBeGreaterThan(0)
    expect(await walk(setId, 'ArrowDown', 3)).toBe(3)
    await waitSince(timeline, 'sprite', OPEN_PREFIX, UMBRELLA_OPEN_MS)
    // 上を押したままにする。上へ向き直って自宅の扉 (14,11) にぶつかり、畳み始める
    await userEvent.keyboard('{ArrowUp>}')
    await waitSince(timeline, 'sprite', CLOSE_PREFIX, 0)
    // 畳み終えるまでフレームを進める。本物の時間はほとんど経たないので、部屋へ移すタイマーはまだ走らない
    await advanceUntil(
      () => villagePlayer().dataset.sprite === 'player-up-0',
      '畳み終えて傘の無い上向きの立ち姿になる',
      UMBRELLA_CLOSE_MS + SLACK_MS
    )
    expect(worldShown(), '前提: 畳み終えた時はまだ町にいる(タイマーより先にフレームが来た)').toBe(
      'town'
    )
    const closedAt = performance.now()
    // 畳み終えた後も押し続ける。足は扉へぶつかり続けるが、部屋へ移す処理を待っている間は畳み直さない
    await runFor(FRAME_MS * 10)
    expect(worldShown(), '前提: 押し続けた間もまだ町にいる').toBe('town')
    // 本物の時間でタイマーが走るのを待ち、部屋へ移す
    await new Promise(resolve => setTimeout(resolve, UMBRELLA_CLOSE_MS))
    await advanceUntil(() => worldShown() === 'room', '部屋へ移る')
    await advanceUntil(() => cellText() === JSON.stringify(ROOM_ENTRY), '部屋の出口手前に立つ')
    await userEvent.keyboard('{/ArrowUp}')

    const visits = visitsOf(timeline)
    expect(
      visits.map(visit => visit.world),
      '部屋へは 1 回だけ入る'
    ).toEqual(['room', 'town', 'room'])
    const afterClosed = visits[1].keys.filter(({ at }) => at >= closedAt)
    expect(
      keysStartingWith(afterClosed, UMBRELLA_PREFIX),
      '畳み終えた後に町で描いた傘のコマ'
    ).toEqual([])
  })
})

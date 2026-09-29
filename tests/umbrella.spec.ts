// 雨の日の傘の E2E。雨の日に自室から町へ扉を出ると、戸口で下を向いたまま傘を取り出して開き
// (手を入れる → 引き出す → 伸ばす → 半開き → 掲げる → 傘を差した立ち姿)、開き終えるまでは方向キーを押しても動かず、
// その後は傘を差したコマのまま歩くことを見る。町から自宅の扉へ入る時は、町に留まったまま上を向いて傘を畳んでしまい
// (下ろす → すぼめる → 閉じる → 縮める → しまう)、それから部屋へ移って傘の無いコマに戻ることを見る。
// 晴れと雪では出しも畳みもせず、扉も畳む長さを待たずに通る(雨の検査の対照)。
// 動きを控える設定では途中のコマも入力の錠も無く、町へ出た最初のコマから傘を差している。
// どのコマも 120〜180ms しか出ないので、ときどき抜き取るだけでは取りこぼす。ページが読まれる前に MutationObserver を
// 仕掛け、主人公の data-sprite・ワールドの data-world・キーの押し離しを 1 本の時系列に書き足して、後から並びを調べる。
// 傘の動きは言語に依らないので ja だけで見る
import { expect, type Page } from '@playwright/test'
import { worldSet } from '@content/world'
// 開く・畳む長さは lib 側の定数が正本。ここに ms を書き写すと片方だけ動いた時に気付けない
import { UMBRELLA_CLOSE_MS, UMBRELLA_OPEN_MS } from '@/lib/village/player-pose'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・1 マス分だけ押す press・天気の差し替えと、既定で晴れを敷く
// test は他の村の spec と共用。正本は village.helpers.ts。
// 扉を通る 1 歩と、開いている間の 1 押しは walk ではなく press で押す。walk は着いた後に描画を待つので、
// 戻る頃には動きが進んでしまう。畳む間は扉を踏んでからワールドが替わるまでが延びるので、
// 保存位置で到着を見る walk の判定ともずれうる
import { openVillage, press, stubWeather, test, walk, type WeatherKind } from './village.helpers'

// 遅いランナーでは描画とタイマーの発火が少し後ろへずれる。待ち時間の定数にこの分だけ上乗せする
const SLACK_MS = 3_000

// 位置の保存先は lib/preferences と同じ組み立て
const POS_KEY = `village:${worldSet.id}:pos`

const PLAYER = '[data-village-player]'
// ワールドの層。data-world に描画済みのワールドが載る
const WORLD = '[data-world]'

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
// (傘を差した左向きは原画の左向きの行を写したコマで、右の反転ではない)
const UMBRELLA_POSE = /^player-umbrella-(up|down|right|left)-[0-2]$/

// 動かなかった時の主人公の位置のずれの許容(px)。同じマスなら実測のまるめしか出ず、1 マス動けば
// Village/utils/stage-scale.ts の下限(CELL_MIN = 12px)以上ずれるので取り違えようがない
const POSITION_TOLERANCE_PX = 1

// ---- 時系列の記録 ----

// sprite は主人公の data-sprite、world はワールドの層の data-world、key は「keydown:ArrowUp」の形の押し離し。
// at はページの performance.now()(歩行ループが傘の経過を数える時計と同じ)
type TimelineKind = 'sprite' | 'world' | 'key'
type TimelineEntry = { kind: TimelineKind; value: string; at: number }
type TimelineWindow = Window & { umbrellaTimeline?: TimelineEntry[] }

// ページのどのスクリプトよりも先に記録を仕掛ける。扉を踏んだ直後の最初のコマから取りこぼさないため、
// 村を開く前(openVillage より先)に呼ぶ。主人公の要素がいつ差し込まれても拾えるよう document ごと見る
const recordTimeline = (page: Page) =>
  page.addInitScript(() => {
    const host: TimelineWindow = window
    const timeline: TimelineEntry[] = []
    host.umbrellaTimeline = timeline
    new MutationObserver(records => {
      const at = performance.now()
      records.forEach((record, index) => {
        const target = record.target
        const name = record.attributeName
        if (!(target instanceof Element) || name === null) return
        const isWorld = name === 'data-world'
        if (!isWorld && !target.matches('[data-village-player]')) return
        // 同じ通知に同じ属性の書き換えが続けて入っていれば、この回に書かれた値は次の記録の「書き換え前の値」
        const rest = records.slice(index + 1)
        const later = rest.find(next => next.target === target && next.attributeName === name)
        const value = (later === undefined ? target.getAttribute(name) : later.oldValue) ?? ''
        timeline.push({ kind: isWorld ? 'world' : 'sprite', value, at })
      })
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['data-sprite', 'data-world'],
    })
    for (const type of ['keydown', 'keyup'] as const) {
      window.addEventListener(
        type,
        event => {
          if (!event.repeat) {
            timeline.push({ kind: 'key', value: `${type}:${event.key}`, at: performance.now() })
          }
        },
        true
      )
    }
  })

const readTimeline = (page: Page) =>
  page.evaluate(() => {
    const host: TimelineWindow = window
    return host.umbrellaTimeline ?? []
  })

// 描いたコマを、描いた時に DOM に載っていたワールドごとに区切る(ワールドへ入るたびに 1 区切り)。
// ワールドが替わる描画では React も主人公の data-sprite へ新しいワールドの開始の向きのコマ(傘の無いコマ)を書く。
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

// kind の記録のうち、値が head で始まる最初の 1 件から ms 経つまで待つ(ms が 0 ならその 1 件が記録されるまで)。
// 動きの始まり(since)はその動きの最初のコマを描いた時刻より前なので、最初のコマから動きの長さが経てば
// 動きも入力の錠も必ず終わっている。固定の待ち時間を置かず、ページの時計で測る
const waitSince = (page: Page, kind: TimelineKind, head: string, ms: number) =>
  page.waitForFunction(
    ([wantedKind, wantedHead, length]) => {
      const host: TimelineWindow = window
      const hit = (entry: TimelineEntry) =>
        entry.kind === wantedKind && entry.value.startsWith(wantedHead)
      const first = (host.umbrellaTimeline ?? []).find(hit)
      return first !== undefined && performance.now() - first.at >= length
    },
    [kind, head, ms] as const,
    { polling: 'raf', timeout: ms + SLACK_MS }
  )

// ---- 村の操作 ----

// 保存された現在地(ワールドとマス)を読む。保存は到着したマスとワープの先でだけ走る
const readCell = (page: Page) =>
  page.evaluate(key => {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return null
    const saved = JSON.parse(raw) as { worldId: string; cell: { x: number; y: number } }
    return { worldId: saved.worldId, cell: saved.cell }
  }, POS_KEY)

// 主人公がワールドの層のどこに描かれているか(px)。層の左上からの差で測るので、カメラが動いても変わらない。
// 左右反転(scaleX(-1))は箱の位置を変えない
const positionInWorld = (page: Page) =>
  page.evaluate(
    ([playerSelector, worldSelector]) => {
      const player = document.querySelector(playerSelector)
      const layer = document.querySelector(worldSelector)
      if (player === null || layer === null) throw new Error('主人公かワールドの層が無い')
      const box = player.getBoundingClientRect()
      const origin = layer.getBoundingClientRect()
      return { x: box.x - origin.x, y: box.y - origin.y }
    },
    [PLAYER, WORLD] as const
  )

// 歩行ループが眠るまで待つ。開き終えて時間で替わるコマが無くなり、歩いてもいなければ眠る
const expectLoopIdle = (page: Page) =>
  expect(page.locator('[data-village]')).toHaveAttribute('data-village-loop', 'idle', {
    timeout: SLACK_MS,
  })

// 記録を仕掛け、天気を敷いて村を開く。実ネットワークではなくこの応答を見て描くことを、扉を出る前に押さえる
const openInWeather = async (page: Page, kind: WeatherKind) => {
  await recordTimeline(page)
  const weather = await stubWeather(page, kind)
  await openVillage(page, '')
  await expect.poll(() => weather.calls(), { timeout: 10_000 }).toBeGreaterThan(0)
}

test('雨の日に部屋から町へ出ると、戸口で傘を取り出して開き、開き終えるまでは動かず、その後は傘を差して歩く', async ({
  page,
}) => {
  await openInWeather(page, 'rain')
  // 出口のマット (4,7) の 1 つ手前 (4,6) まで歩き、マットへの最後の 1 歩は press で踏む
  expect(await walk(page, 'ArrowDown', 2)).toBe(2)
  await press(page, 'ArrowDown')
  // 町で最初の取り出すコマが描かれるのを待つ。このフレームで主人公は自宅前に置き直されている
  await waitSince(page, 'sprite', OPEN_PREFIX, 0)
  expect(await readCell(page)).toEqual(DOORSTEP)
  const before = await positionInWorld(page)

  // 開いている間に下を押す。もう下を向いているので向き直りは挟まず、錠が掛かっていなければ道の (14,13) へ進む
  await press(page, 'ArrowDown')
  // 開き終える(最初の取り出すコマから UMBRELLA_OPEN_MS)のと、ループが眠るのを待つ。
  // 錠が掛かっていなければ、その間に 1 マス歩き終えている
  await waitSince(page, 'sprite', OPEN_PREFIX, UMBRELLA_OPEN_MS)
  await expectLoopIdle(page)
  await expect(page.locator(PLAYER)).toHaveAttribute('data-sprite', STAND_DOWN)

  // 押したのが本当に開いている途中だったかを先に確かめる。傘を差した立ち姿は開く動きの最後の窓で初めて出て、
  // 錠はそれより後(UMBRELLA_OPEN_MS)まで続く。立ち姿より前に離していれば、押していた間はずっと錠の中だった。
  // 遅いランナーで押すのが間に合わなかった回を「押しても動かなかった」と取り違えないための裏取り
  const early = await readTimeline(page)
  const released = lastKeyAt(early, 'keyup:ArrowDown')
  const standAt = firstDrawnAt(visitsOf(early)[1].keys, STAND_DOWN)
  expect(released, '開いている間に押し終えている').toBeLessThan(standAt)
  // 開いている間に押しても、立つマスも描かれる位置も変わらない
  expect(await readCell(page), '開いている間に押しても自宅前から動かない').toEqual(DOORSTEP)
  const after = await positionInWorld(page)
  const moved = Math.max(Math.abs(after.x - before.x), Math.abs(after.y - before.y))
  expect(moved, '押しても位置が変わらない').toBeLessThanOrEqual(POSITION_TOLERANCE_PX)

  // 開き終えれば歩ける
  expect(await walk(page, 'ArrowRight', 1), '開き終えた後は歩ける').toBe(1)
  expect(await readCell(page)).toEqual(EAST_OF_DOORSTEP)

  const visits = visitsOf(await readTimeline(page))
  expect(visits.map(visit => visit.world)).toEqual(['room', 'town'])
  const drawn = fromFirstUmbrella(visits[1].keys)
  // 取り出す 5 コマを順に 1 度ずつ描き、傘を差した立ち姿になる。間に他のコマ(傘の無いコマ・順の違うコマ)は挟まらない
  const opening = drawn.slice(0, OPEN_KEYS.length + 1)
  expect(opening, '町へ出てから描いた傘のコマの並び').toEqual([...OPEN_KEYS, STAND_DOWN])
  // 開き終えた後は、立つのも歩くのも傘を差したコマだけ。歩きのコマも描いている(本当に歩いた)
  const walked = drawn.slice(OPEN_KEYS.length + 1)
  const bare = walked.filter(key => !UMBRELLA_POSE.test(key))
  expect(bare, '開き終えた後に傘を差していないコマ').toEqual([])
  expect(walked, '傘を差したまま横へ歩くコマ').toContain('player-umbrella-right-1')
})

test('雨の日に町から自宅の扉へ入ると、町に留まったまま傘を畳んでしまい、それから部屋へ移って傘の無いコマに戻る', async ({
  page,
}) => {
  await openInWeather(page, 'rain')
  const worldLayer = page.locator(WORLD)
  expect(await walk(page, 'ArrowDown', 3)).toBe(3)
  await expect(worldLayer).toHaveAttribute('data-world', 'town')
  // 開き終えて錠が外れるまで待ってから扉へ向かう
  await waitSince(page, 'sprite', OPEN_PREFIX, UMBRELLA_OPEN_MS)
  // 上を 1 回押すと上へ向き直り、自宅の扉 (14,11) にぶつかる。畳み終えるまで部屋へは移らない
  await press(page, 'ArrowUp')
  await expect(worldLayer).toHaveAttribute('data-world', 'room', {
    timeout: UMBRELLA_CLOSE_MS + SLACK_MS,
  })
  await expect.poll(() => readCell(page)).toEqual(ROOM_ENTRY)
  // 部屋では傘を差さない。1 マス歩いても傘の無いコマのまま
  expect(await walk(page, 'ArrowUp', 1)).toBe(1)
  await expect(page.locator(PLAYER)).toHaveAttribute('data-sprite', 'player-up-0')

  const visits = visitsOf(await readTimeline(page))
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
  // 雪の応答は降水も 0 より大きい(village.helpers.ts)。降水の有無で傘を決める取り違えはここで落ちる。
  // 降っている間の層は 2 コマぶんの 2 枚(day-night.spec の WEATHER_LAYER_COUNT)
  { kind: 'snow', name: '雪', layers: '[data-weather=snow]', count: 2 },
] as const

for (const day of DRY_DAYS) {
  test(`${day.name}の日は部屋を出ても自宅の扉へ入っても傘を出さず、扉は畳む長さを待たずに通る`, async ({
    page,
  }) => {
    await openInWeather(page, day.kind)
    const worldLayer = page.locator(WORLD)
    expect(await walk(page, 'ArrowDown', 3)).toBe(3)
    await expect(worldLayer).toHaveAttribute('data-world', 'town')
    await expect(page.locator(day.layers)).toHaveCount(day.count)
    // 雨なら開き終えている頃まで待ってから見る。すぐ見ると、遅れて開き始める壊れ方を通してしまう
    await waitSince(page, 'world', 'town', UMBRELLA_OPEN_MS)
    await expect(page.locator(PLAYER)).toHaveAttribute('data-sprite', 'player-down-0')
    await press(page, 'ArrowUp')
    await expect(worldLayer).toHaveAttribute('data-world', 'room')
    await expect.poll(() => readCell(page)).toEqual(ROOM_ENTRY)

    const timeline = await readTimeline(page)
    const visits = visitsOf(timeline)
    expect(visits.map(visit => visit.world)).toEqual(['room', 'town', 'room'])
    const drawnAll = visits.flatMap(visit => visit.keys)
    expect(keysStartingWith(drawnAll, UMBRELLA_PREFIX), '描いた傘のコマ').toEqual([])
    // 扉にぶつかってから部屋が描かれるまで、畳む長さを待たない
    const entering = visits[2].enteredAt - lastKeyAt(timeline, 'keydown:ArrowUp')
    expect(entering, '上を押してから部屋が描かれるまでの ms').toBeLessThan(UMBRELLA_CLOSE_MS)
  })
}

test.describe('動きを控える設定の傘', () => {
  test.use({ reducedMotion: 'reduce' })

  test('雨でも取り出す・畳むコマを出さず、町へ出た最初のコマから傘を差し、出てすぐ歩けて扉もすぐ通る', async ({
    page,
  }) => {
    await openInWeather(page, 'rain')
    const worldLayer = page.locator(WORLD)
    expect(await walk(page, 'ArrowDown', 2)).toBe(2)
    await press(page, 'ArrowDown')
    await waitSince(page, 'world', 'town', 0)
    // 入力の錠も掛けない。町が描かれてすぐ右を押せば 1 マス進む
    await press(page, 'ArrowRight')
    await expect.poll(() => readCell(page), { timeout: SLACK_MS }).toEqual(EAST_OF_DOORSTEP)
    // 押したのが、錠が掛かっていたなら確かに効いている間だったか。開く動きの始まりは町を描く前
    // (扉を踏んだ時)かもしれないので、開く長さの半分までに離し終えたことを求める
    const early = await readTimeline(page)
    const released = lastKeyAt(early, 'keyup:ArrowRight') - visitsOf(early)[1].enteredAt
    expect(released, '町が描かれてから右を離すまでの ms').toBeLessThan(UMBRELLA_OPEN_MS / 2)
    // 動きを控える設定では歩きのコマを出さないので、横向きの立ち姿のまま
    await expect(page.locator(PLAYER)).toHaveAttribute('data-sprite', 'player-umbrella-right-0')
    // 自宅前へ戻り、扉へ入る
    expect(await walk(page, 'ArrowLeft', 1)).toBe(1)
    await press(page, 'ArrowUp')
    await expect(worldLayer).toHaveAttribute('data-world', 'room')
    await expect.poll(() => readCell(page)).toEqual(ROOM_ENTRY)

    const timeline = await readTimeline(page)
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

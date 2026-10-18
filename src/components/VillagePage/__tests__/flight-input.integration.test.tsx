// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import { isWalkable } from '@/lib/village/collision'
import { flightDurationMs } from '@/lib/village/flight-curve'
import {
  SLACK_MS,
  advanceUntil,
  expectLoopIdle,
  focusVillage,
  press,
  readCell,
  walk,
} from './village-walk.test-helper'
import { recordKeyDownTimes, recordKeys } from './village-walk-record.test-helper'
import {
  distanceBetween,
  distinct,
  flightOf,
  flyingHits,
  hitsNote,
  savedCells,
  startRecording,
  stopRecording,
} from './village-walk-flight.test-helper'
import {
  ARRIVE_MS,
  LAB,
  MAILBOX,
  MEISHI,
  TOWN_ENTRY,
  map,
  openMap,
  placeOf,
  sameSaved,
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

// ---- 自動移動の直線飛行(飛ぶ間の入力) ----
// E2E が見ていた自動移動の直線飛行のうち、飛ぶ間に押した方向キー・Z・M・ミニマップを受けないことと、
// 地図を止めるのは飛ぶ間だけであることを、E2E からこの統合テストへ移したもの(ADR 0016 の「統合へ移す」)。
// 飛ぶ形は flight-shape.integration.test.tsx、飛ぶ所と飛ばない所は flight-route.integration.test.tsx。
// 村の配置と地図で移る手順は flight.test-helper.ts。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date。E2E の page.clock と同じく時間として替える)で止め、
// テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('自動移動の直線飛行(飛ぶ間の入力)', () => {
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

  // 村を開き、部屋の出口のマットまで歩いて町の自宅前へ出る
  const goToTown = async () => {
    await openVillage()
    await walkOutToTown()
  }

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
})

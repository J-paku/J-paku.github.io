// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { page } from 'vitest/browser'
import { clearVillageProgress } from '@/lib/preferences'
import VillagePageContainer from '@/components/VillagePage/container'
import { userEvent } from 'vitest/browser'
import type { Cell, Direction, Spot, World, WorldSet } from '@content/types/world'
import { readVisited, writePosition, writeVisited } from '@/lib/preferences'
import { isWalkable } from '@/lib/village/collision'
import { FLIGHT_MIN_DISTANCE, flightDurationMs } from '@/lib/village/flight-curve'
import { mapEntries, type MapEntry } from '@/lib/village/map-entries'
import { findPath } from '@/lib/village/path'
import { objectSpotAt } from '@/lib/village/spot'
import { routeToWarp } from '@/lib/village/warp'
import { DAY_PHASES } from '@/utils/day-phase'
import { FISHING_BITE_MS, FISHING_CAST_MS, FISHING_LAND_MS } from '@/lib/village/fishing'
import {
  BITE_BRACE_MS,
  BITE_TUGS,
  FISHING_BITE_TUG_MS,
  FISHING_PULL_MS,
  FISHING_SWING_MS,
  UMBRELLA_CLOSE_MS,
  UMBRELLA_OPEN_MS,
} from '@/lib/village/player-pose'
import {
  CELL_MIN,
  cellMax,
  computeCell,
} from '@/components/VillagePage/components/Village/utils/stage-scale'
import {
  CLOCK_FOCUSABLE_SELECTOR,
  MAP_FOCUSABLE_SELECTOR,
  STOP_FOCUSABLE_SELECTOR,
} from '@/utils/focusables'
import { spotToward } from '@/components/VillagePage/components/Village/components/WorldMap/utils/spot-navigation'
import {
  FRAME_MS,
  HOLD_MS,
  SETTLE_MS,
  SLACK_MS,
  advanceUntil,
  cellCenter,
  click,
  emulateReducedMotion,
  emulateTouch,
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
  runFrames,
  stepFrame,
  stubWeather,
  tap,
  tapHeld,
  villageFrame,
  villagePlayer,
  walk,
  worldLayer,
  type WalkKey,
  type WeatherKind,
} from './village-walk.test-helper'
import {
  firstSeen,
  recordAttribute,
  recordFacing,
  recordKeyDownTimes,
  recordKeys,
  recordLineMounts,
  recordTimeline,
  type TimelineEntry,
  type TimelineKind,
} from './village-walk-record.test-helper'
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
import { PHASE_CLOCKS, RealImage, routeSheets, startVillageClock } from './village-time.test-helper'
import { frameSize, prepareVillage, resetVillage, villageJa } from './village.test-helper'

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

  describe('歩行ループの眠りと目覚め', () => {
    // 眠っていても 1 秒で頼んでよい rAF の数。吹き出しの位置合わせ(rAF 2 回)のような一度きりの分の遊び
    const IDLE_RAF_ALLOWANCE = 2

    // 1 秒のあいだにアプリが頼んだ rAF の数。回っていれば約 60、眠っていれば 0。
    // rAF は偽の時計のものをそのまま呼び通し、数えるだけにする
    const rafRequestsInOneSecond = async () => {
      const requests = vi.spyOn(window, 'requestAnimationFrame')
      await runFor(1_000)
      const count = requests.mock.calls.length
      requests.mockRestore()
      return count
    }

    test('止まっている間は歩行ループが眠り、最初の方向キー 1 回で 1 マス歩く', async () => {
      await openVillage()
      await expectLoopIdle()
      expect(await rafRequestsInOneSecond(), '眠っている間に頼んだ rAF').toBeLessThanOrEqual(
        IDLE_RAF_ALLOWANCE
      )
      expect(loopState()).toBe('idle')
      // 起きて眠り直すまでの印の移り変わりを控える。一瞬だけの running も取りこぼさない
      const observed = recordAttribute(villageFrame(), 'data-village-loop')
      // 開いた直後は開始地点 (4,4) にいて、まだ何も保存していない
      expect(readCell(setId)).toBeNull()
      // 眠っている所へ押した最初の 1 回が読まれ、1 マス下へ着く(起こし忘れると 1 歩も動かない)
      expect(await walk(setId, 'ArrowDown', 1)).toBe(1)
      expect(readCell(setId)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
      // 歩き終えたらまた眠る。途中で一度は起きていた
      await expectLoopIdle()
      expect(observed.map(mark => mark.value).join(','), '起きて眠り直すまでの印').toMatch(
        /^running(,.+)?,idle$/
      )
    })

    test('会話窓を開いている間は 2 本のループとも眠り、閉じた後の最初の入力で歩き出す', async () => {
      // PC 原寸の枠(640×576)だと自宅の本文が窓に収まり、送る余地が残らないことがある。
      // 高さを詰めて枠ごと縮め、本文を必ずあふれさせる(E2E と同じ寸法)
      await openVillage(1280, 480)
      const dialog = page.getByRole('dialog')
      await userEvent.keyboard('e')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }))
        .toHaveFocus()
      // 窓が開いている間は歩かないので歩行ループは眠り、本文送りのループも押すまでは眠る
      await expectLoopIdle()
      expect(
        await rafRequestsInOneSecond(),
        '窓を開いて眠っている間に頼んだ rAF'
      ).toBeLessThanOrEqual(IDLE_RAF_ALLOWANCE)
      // 眠っていた本文送りが下キーで起き、本文が送られる
      const panel = dialog.element().querySelector('[data-village-panel]')
      if (panel === null) throw new Error('会話窓の本文が無い')
      await userEvent.keyboard('{ArrowDown>}')
      await advanceUntil(() => panel.scrollTop > 0, '下キーで本文が送られる')
      await userEvent.keyboard('{/ArrowDown}')
      await dialog.getByRole('button', { name: text.close }).click()
      await expect.element(dialog).not.toBeInTheDocument()
      // 閉じて錠が外れた後も、眠っている所へ押した最初の 1 回で歩く
      await expectLoopIdle()
      expect(await walk(setId, 'ArrowDown', 1)).toBe(1)
      expect(readCell(setId)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
    })

    test('眠っている間に画面の大きさが変わると、起きて新しいマス寸法で描き直す', async () => {
      await openVillage()
      // 町ではカメラが動く(自宅前 (14,12) で原点 (10,8))ので、人物と世界の層の両方を描き直したかを見られる
      expect(await walk(setId, 'ArrowDown', 3)).toBe(3)
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 14, y: 12 } })
      // ワープの後も、新しいタイルが載ってカメラが追い付けば眠る
      await expectLoopIdle()
      const before = playerOnScreen()
      // カメラは人物を枠の左から 5 番目・上から 5 番目のマスへ置く
      expect(before.x).toBeCloseTo(4, 1)
      expect(before.y).toBeCloseTo(4, 1)
      // 高さで決まる 50px 以下のマスへ縮める(PC 原寸は 64px)
      await page.viewport(800, 450)
      await advanceUntil(() => playerOnScreen().cell < before.cell, '小さいマス寸法へ描き直す')
      // 描き直さなければ人物も世界の層も 64px 基準の位置に残り、5.1 マス目や 1.2 マス目を指す
      const nearCell4 = (value: number) => Math.abs(value - 4) < 0.05
      await advanceUntil(
        () => nearCell4(playerOnScreen().x) && nearCell4(playerOnScreen().y),
        '縮めた後も人物は左から 5 番目・上から 5 番目のマス'
      )
      await expectLoopIdle()
    })

    describe('縦持ちのスマートフォン', () => {
      test('眠っている間にスティックを倒した 1 回と、タップした 1 回でそれぞれ歩く', async () => {
        // E2E の isMobile・hasTouch に当たるタッチ端末(pointer: coarse)にしてから描く
        await emulateTouch()
        await openVillage(390, 664)
        await expectLoopIdle()
        const stick = page
          .getByRole('application', { name: text.joystick })
          .element()
          .getBoundingClientRect()
        const x = stick.x + stick.width / 2
        const y = stick.y + stick.height / 2
        // 下へ倒して 1 マス分だけ押し、中央へ戻して離す
        await mouse.move(x, y, false)
        await mouse.down(x, y)
        await mouse.move(x, y + 30, true)
        await runFor(HOLD_MS)
        await mouse.move(x, y, true)
        await mouse.up(x, y)
        await runFor(SETTLE_MS)
        expect(readCell(setId)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
        await expectLoopIdle()
        // 眠っている所で 1 マス上 (4,4) を叩くと、そこへ歩いて戻る。部屋は枠に収まりカメラは動かない
        const { frame, cell, x: column, y: row } = playerOnScreen()
        await tap(frame.x + (column + 0.5) * cell, frame.y + (row - 0.5) * cell)
        const backHome = () => JSON.stringify(readCell(setId))
        await advanceUntil(
          () => backHome() === JSON.stringify({ worldId: 'room', cell: { x: 4, y: 4 } }),
          '叩いた 1 マス上へ歩いて戻る'
        )
        await expectLoopIdle()
      })
    })
  })

  describe('池での釣り', () => {
    const fishing = text.fishing
    // 釣りのコマの名前(シートのキーの末尾)。向き d のキーは player-fish-{d}-{名前} で、構え(待ち)だけは
    // 末尾の無い player-fish-{d}。左向きは右向きのキーを反転して描く(時間割の正本は src/lib/village/player-pose.ts)
    type FishFacing = 'up' | 'down' | 'right'
    // 投げる 4 コマ。振りかぶり → 竿を後ろへ引く → 振り下ろす → 振り抜く。FISHING_SWING_MS を 4 等分して順に出す
    const CAST_FRAMES = ['windup', 'backswing', 'cast', 'follow'] as const
    // かかった合図。張る(tense)と引かれる(bite)
    const BITE_FRAMES = ['tense', 'bite'] as const
    // 釣り上げ。引き上げる(pull)と掲げる(hoist)
    const LAND_FRAMES = ['pull', 'hoist'] as const
    const fishKey = (facing: FishFacing, frame?: string) =>
      frame === undefined ? `player-fish-${facing}` : `player-fish-${facing}-${frame}`
    // 投げてから結果窓が出るまでに、初めて描かれる順のコマ。投げる 4 コマ → 構え → かかった合図 → 釣り上げ
    const firstSeenPoses = (facing: FishFacing) => [
      ...CAST_FRAMES.map(frame => fishKey(facing, frame)),
      fishKey(facing),
      ...BITE_FRAMES.map(frame => fishKey(facing, frame)),
      ...LAND_FRAMES.map(frame => fishKey(facing, frame)),
    ]
    // そのうち投げている間(構えのコマで止まるまで)の分
    const castPoses = (facing: FishFacing) =>
      firstSeenPoses(facing).slice(0, CAST_FRAMES.length + 1)

    // 水面に出る 1 枚(浮き → 巻物)と、竿の先から浮きへ渡る糸。どちらも E2E と同じ取っ手で引く
    const floatEl = () => document.querySelector<HTMLElement>('[data-village-float]')
    const lineEl = () => document.querySelector<HTMLElement>('[data-village-line]')
    const floatPhase = () => floatEl()?.dataset.floatPhase
    const sprite = () => villagePlayer().dataset.sprite
    // 吹き出し。kind を渡すと台詞(speech)か考え事(thought)の一方だけ
    const bubbles = (kind?: 'speech' | 'thought') => [
      ...document.querySelectorAll<HTMLElement>(
        kind === undefined
          ? '[data-village-bubble]'
          : `[data-village-bubble][data-village-bubble-kind="${kind}"]`
      ),
    ]
    const bubbleWith = (words: string, kind?: 'speech' | 'thought') =>
      bubbles(kind).find(bubble => (bubble.textContent ?? '').includes(words)) ?? null
    const promptBubble = () => bubbleWith(fishing.prompt)
    const thoughtBubble = () => bubbleWith(fishing.exhausted, 'thought')
    // 枠の下端の案内文(role=status)と、枠に重ねる窓
    const speech = () => page.getByRole('status').element().textContent ?? ''
    const dialog = page.getByRole('dialog')
    const dialogText = () => dialog.query()?.textContent ?? ''

    // 自宅前 (14,12) から池のほとり (5,13) へ。横道 y12 は道が続き、その 1 段下 y13 も道。
    // 池は x0-5/y14-19 なので、(5,13) の真下 (5,14) が水面になる。着いた時の向きは下(= 水面)
    const goToPondShore = async () => {
      await leaveRoom(setId)
      await walk(setId, 'ArrowLeft', 9)
      await walk(setId, 'ArrowDown', 1)
    }

    // 池のほとりから東の岸 (6,15) へ回り込み、左の水面 (5,15) を向く
    const goToEastShore = async () => {
      await walk(setId, 'ArrowRight', 1)
      await walk(setId, 'ArrowDown', 2)
      await walk(setId, 'ArrowLeft', 1)
    }

    // 直接投げる入力の経路。E2E は ja を Z、ko を吹き出しのボタンで通す。ここは言語ではなく経路で 2 本に分ける
    type CastVia = 'key' | 'bubble'
    const castFrom = async (via: CastVia) => {
      if (via === 'key') {
        await userEvent.keyboard('z')
        return
      }
      const bubble = promptBubble()
      if (bubble === null) throw new Error('水辺の吹き出しが無い')
      await page.elementLocator(bubble).getByRole('button', { name: fishing.go }).click()
    }
    const CAST_INPUTS: readonly { via: CastVia; label: string }[] = [
      { via: 'key', label: 'Z キー' },
      { via: 'bubble', label: '吹き出しのボタン' },
    ]

    for (const { via, label } of CAST_INPUTS) {
      test(`池の吹き出しから直接投げると経験が釣れる(${label}で投げる)`, async () => {
        await openVillage()
        await goToPondShore()
        expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
        // 水は通れないので、もう一度下を押しても足は止まったまま向きだけ水面へ向く
        await walk(setId, 'ArrowDown', 1)
        expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
        expect(isVisible(promptBubble()), '水辺の吹き出し').toBe(true)
        expect(dialog.query()).toBeNull()
        expect(floatEl()).toBeNull()
        expect(lineEl()).toBeNull()
        // 短いモーションも取りこぼさず、実際に描かれたコマを記録する。
        // 糸も差し込まれた瞬間の見え方を記録する(投げる前に掛けないと最初の 1 本を見逃す)
        const poses = recordAttribute(villagePlayer(), 'data-sprite')
        const lineMounts = recordLineMounts(worldLayer())
        await castFrom(via)
        await expect.poll(() => dialog.query(), { message: '投げても窓は出ない' }).toBeNull()
        await expect
          .poll(() => promptBubble(), { message: '投げたら水辺の吹き出しを下ろす' })
          .toBeNull()
        await expect.poll(speech).toContain(fishing.cast)
        // 投げた先の水のマスに浮きが出る。糸は浮きと同時に置かれる。この要素を控え、かかった後も同じ要素のままかを後で見る
        // (作り直されると隠す動きが頭からやり直しになり、かかった瞬間に糸が一度消える)
        await expect.poll(floatPhase).toBe('casting')
        const castLine = lineEl()
        expect(castLine, '投げている間の糸').not.toBeNull()
        // 投げる 4 コマを順に描き、構えのコマで止まる
        await advanceUntil(() => sprite() === fishKey('down'), '構えのコマで止まる')
        expect(firstSeen(poses).slice(0, CAST_FRAMES.length + 1), '投げる 4 コマと構え').toEqual(
          castPoses('down')
        )
        // 竿を振り終えると、竿の先から浮きまで糸が見える(振っている間は隠れている)。
        // 隠すのは CSS の動き(実時間)なので、見えるまでは本物の時計で待つ
        await expect.poll(() => isVisible(lineEl()), { timeout: SLACK_MS }).toBe(true)
        expect(lineEl()?.dataset.lineFacing, '水面を向いた下向きの糸').toBe('down')
        // 見えるようになる前、差し込まれた瞬間は隠れていた。2 本以上差し込まれていても落ちる
        expect(lineMounts, '差し込まれた瞬間の糸の見え方').toEqual(['hidden'])
        // 隠していたのは竿を振る長さ(FISHING_SWING_MS)の動き。長さは計算値が秒で返る
        expect(getComputedStyle(castLine ?? document.body).animationDuration).toBe(
          `${FISHING_SWING_MS / 1000}s`
        )
        // 投げている間は窓が無くても移動が止まる(押しても保存された位置が変わらない)
        await walk(setId, 'ArrowUp', 1)
        expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
        // かかると浮きが沈む絵へ差し替わる。糸は沈んだ浮きへ渡ったまま
        await advanceUntil(
          () => speech().includes(fishing.bite),
          'かかった合図の文言',
          FISHING_CAST_MS + SLACK_MS
        )
        await expect.poll(floatPhase).toBe('bite')
        // 浮きが沈む合図は、主人公が引かれる合図の 1 周期と同じ長さで、引かれる回数だけ繰り返す
        const floatStyle = getComputedStyle(floatEl() ?? document.body)
        expect(floatStyle.animationDuration).toBe(`${FISHING_BITE_TUG_MS / 1000}s`)
        expect(floatStyle.animationIterationCount).toBe(String(BITE_TUGS))
        // 投げている間の糸がそのまま残っている = 作り直されず、同じ要素のまま沈んだ浮きへ渡っている
        expect(lineEl(), 'かかった後も投げた時と同じ糸').toBe(castLine)
        expect(isVisible(lineEl()), 'かかった後の糸').toBe(true)
        // そのあと巻物が水から跳ね、浮いている間だけ会話窓が「釣り上げた」に変わる
        await advanceUntil(
          () => /landing|caught/.test(floatPhase() ?? ''),
          '巻物が跳ねる',
          FISHING_BITE_MS + SLACK_MS
        )
        // 巻物が跳ねた後は浮きが無いので、糸も消える
        expect(lineEl()).toBeNull()
        expect(speech()).toContain(fishing.landed)
        // 釣れた中身は機能一覧から選ぶので題は決まらない。場所名で結果窓だと分かる。巻物は窓の裏に残したまま
        await advanceUntil(
          () => dialogText().includes(fishing.caughtPlace),
          '結果窓',
          FISHING_LAND_MS + SLACK_MS
        )
        expect(floatPhase()).toBe('caught')
        expect(lineEl()).toBeNull()
        // 結果窓が出ている間は竿を掲げたコマのまま
        expect(sprite()).toBe(fishKey('down', 'hoist'))
        // ここまでに描かれたコマは、投げる 4 コマ・構え・かかった合図(張る・引かれる)・釣り上げ(引き上げる・掲げる)で、
        // それ以外は一瞬も出ていない
        expect(firstSeen(poses).toSorted()).toEqual(firstSeenPoses('down').toSorted())
        await dialog.getByRole('button', { name: text.close }).click()
        await expect.element(dialog).not.toBeInTheDocument()
        // 閉じれば水面が片付き、主人公も歩行コマ(下向きの待ち)へ戻る
        expect(floatEl()).toBeNull()
        expect(lineEl()).toBeNull()
        await advanceUntil(() => sprite() === 'player-down-0', '歩行コマ(下向きの待ち)へ戻る')
        // 錠も外れ、また歩ける
        await walk(setId, 'ArrowUp', 1)
        expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 12 } })
      }, 30_000)

      test(`すべて釣り上げた後は、水辺で考え事の吹き出しが出てもう投げない(${label}で投げる)`, async () => {
        const total = villageJa.catches.length
        // 中身が無いと 1 回も投げずに後半の確認へ進み、何も確かめないまま通ってしまう
        expect(total).toBeGreaterThan(0)
        await openVillage()
        await goToPondShore()
        expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
        // まだ釣っていない物を先に出すので、機能の数だけ投げれば全部が揃う。
        // どれが釣れるかは乱数で決まるので題は見ず、揃った瞬間の文言だけを見る
        for (let count = 1; count <= total; count += 1) {
          // 揃うまでは台詞の吹き出しのまま。考え事は出ない
          expect(isVisible(promptBubble()), `${count} 匹目の前の水辺の吹き出し`).toBe(true)
          expect(thoughtBubble()).toBeNull()
          await castFrom(via)
          await expect.poll(speech).toContain(fishing.cast)
          await runFor(FISHING_CAST_MS)
          await expect.poll(speech).toContain(fishing.bite)
          await runFor(FISHING_BITE_MS)
          await expect.poll(floatPhase).toMatch(/landing|caught/)
          // 最後の 1 匹で揃った時だけ complete。それまでは普段の釣り上げ文。
          // complete は landed を中に含む(「すべての経験を…」)ので、揃う前は complete でないことも見る
          expect(speech()).toContain(count === total ? fishing.complete : fishing.landed)
          if (count < total) expect(speech()).not.toContain(fishing.complete)
          await runFor(FISHING_LAND_MS)
          await expect.poll(dialogText).toContain(fishing.caughtPlace)
          // 最後の 1 匹の結果窓は、もう投げないので「もう一度投げると…」の一言を出さない
          if (count === total) expect(dialogText()).not.toContain(fishing.caughtHook)
          else expect(dialogText()).toContain(fishing.caughtHook)
          await dialog.getByRole('button', { name: text.close }).click()
          await expect.element(dialog).not.toBeInTheDocument()
          expect(floatEl()).toBeNull()
          await runFor(FRAME_MS * 2)
        }
        // 揃えて閉じると、水辺の吹き出しはボタン付きの台詞からボタンの無い考え事へ替わる
        expect(isVisible(thoughtBubble()), '考え事の吹き出し').toBe(true)
        expect(thoughtBubble()?.querySelectorAll('button').length).toBe(0)
        expect(bubbles('speech')).toEqual([])
        // Z と E を押しても投げない。竿を持つコマが一瞬でも出たら記録に残る
        const poses = recordAttribute(villagePlayer(), 'data-sprite')
        villageFrame().focus()
        await userEvent.keyboard('z')
        await runFor(FRAME_MS * 2)
        expect(floatEl()).toBeNull()
        expect(speech()).not.toContain(fishing.cast)
        await userEvent.keyboard('e')
        await runFor(FRAME_MS * 2)
        expect(floatEl()).toBeNull()
        expect(speech()).not.toContain(fishing.cast)
        // 投げていれば結果窓が出ている頃まで時計を進めてから、窓も竿のコマも出ていないことを見る
        await runFor(FISHING_CAST_MS + FISHING_BITE_MS + FISHING_LAND_MS)
        expect(dialog.query()).toBeNull()
        expect(floatEl()).toBeNull()
        expect(sprite()).not.toMatch(/player-fish-/)
        expect(firstSeen(poses).filter(pose => pose.startsWith('player-fish-'))).toEqual([])
        // 錠は掛かっていない。1 マス離れて水に背を向けると考え事は消え、戻って水面を向けばまた出る
        await walk(setId, 'ArrowUp', 1)
        expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 12 } })
        expect(thoughtBubble()).toBeNull()
        await walk(setId, 'ArrowDown', 1)
        expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
        expect(isVisible(thoughtBubble()), '戻った水辺の考え事の吹き出し').toBe(true)
        expect(bubbles('speech')).toEqual([])
      }, 60_000)

      test(`池の中へは踏み込めず、東の岸から左の水面へ投げると糸と主人公を左右反転して描く(${label}で投げる)`, async () => {
        await openVillage()
        await goToPondShore()
        await walk(setId, 'ArrowDown', 1)
        expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
        // 東の岸 (6,15) からも同じ。左隣 (5,15) は水面
        await walk(setId, 'ArrowRight', 1)
        await walk(setId, 'ArrowDown', 2)
        expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 6, y: 15 } })
        await walk(setId, 'ArrowLeft', 1)
        expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 6, y: 15 } })
        // 足は止まったまま左の水面を向いているので、ここからも投げられる。糸は右向きの絵を左右反転して渡す
        expect(isVisible(promptBubble()), '東の岸の水辺の吹き出し').toBe(true)
        // 主人公も左向きは右向きのシートを反転して描く。投げる前からコマが替わるたびに控える
        const facing = recordFacing(villagePlayer())
        await castFrom(via)
        await expect.poll(() => isVisible(lineEl()), { timeout: SLACK_MS }).toBe(true)
        expect(lineEl()?.dataset.lineFacing).toBe('left')
        // インラインの scaleX(-1) は計算値では行列で返る
        expect(getComputedStyle(lineEl() ?? document.body).transform).toBe(
          'matrix(-1, 0, 0, 1, 0, 0)'
        )
        await advanceUntil(
          () => dialogText().includes(fishing.caughtPlace),
          '結果窓',
          FISHING_CAST_MS + FISHING_BITE_MS + FISHING_LAND_MS + SLACK_MS
        )
        // 投げてから結果窓が出るまでに描いたコマは、どれも右向きの釣りのシートを反転したもの。
        // 釣りのコマを 1 つも描かずに通っていないよう、段階ごとに止まるコマ(構え・張る・掲げる)が反転して記録にあることも見る
        expect(
          facing.filter(entry => !/^player-fish-right(-[a-z]+)?:flip$/.test(entry)),
          '右向きの釣りのシート・反転以外で描いたコマ'
        ).toEqual([])
        for (const pose of [
          fishKey('right'),
          fishKey('right', 'tense'),
          fishKey('right', 'hoist'),
        ]) {
          expect(facing, `${pose} も反転して描いた`).toContain(`${pose}:flip`)
        }
        await dialog.getByRole('button', { name: text.close }).click()
        await expect.element(dialog).not.toBeInTheDocument()
        expect(lineEl()).toBeNull()
      }, 30_000)
    }

    test('水に向いていなければ釣れない', async () => {
      await openVillage()
      await leaveRoom(setId)
      // 右隣 (6,13) を経由してほとり (5,13) へ入る。立つマスは同じで、向きだけ水面から外れる。
      // 隣が水というだけでは吹き出しも釣りも始まらない
      await walk(setId, 'ArrowLeft', 8)
      await walk(setId, 'ArrowDown', 1)
      await walk(setId, 'ArrowLeft', 1)
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
      expect(promptBubble()).toBeNull()
      await userEvent.keyboard('e')
      // 話せる相手がいない時の一言が出てから、窓が出ていないことを見る
      await expect.poll(() => bubbleWith(text.noTarget, 'thought')).not.toBeNull()
      expect(dialog.query()).toBeNull()
      expect(floatEl()).toBeNull()
    }, 30_000)

    // E2E の同じ検査はさらに各コマの実画面を撮り、構えのコマと比べて体の画素だけが変わり足元は動かないことを見る。
    // その画素は `npm run build` が焼くスプライトシート(public/sprites/。git は追わない)からしか描けず、
    // 統合ではシートの URL が読めない(2026-10-15 の実測で 8 枚とも decode が EncodingError)ので、画素の比較は E2E に残る
    test('投げる・かかる・釣り上げるの各コマは時間割どおりに替わり、立ち位置を残して左右反転のまま描き、動き終えれば歩行ループが眠る', async () => {
      await openVillage()
      await goToPondShore()
      // 東の岸 (6,15) へ回り込み、左の水面 (5,15) を向く。左向きは右向きのシートの反転で、どのコマも同じく反転して描く
      await goToEastShore()
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 6, y: 15 } })
      expect(isVisible(promptBubble())).toBe(true)
      // 歩き終えてカメラも追い付き、ループが眠ってから投げる(動いている途中だと、その途中の絵が混ざる)
      await expectLoopIdle()
      const player = villagePlayer()
      // 主人公の transform から左右反転を除いた位置の部分。釣っている間は歩かないので、どのコマでも同じはず
      const shift = () => player.style.transform.replace(' scaleX(-1)', '')
      await userEvent.keyboard('z')
      expect(floatPhase()).toBe('casting')
      // 投げた瞬間に起こされる。まだ 1 フレームも進めていない
      expect(loopState()).toBe('running')

      // 投げてからの経過(ms)。偽の時計は止まっていて、進めた分だけ経つ
      const castAt = performance.now()
      const runTo = (at: number) => runFor(at - (performance.now() - castAt))
      // 見えている経過のずれの上限。段階が替わってから最初のフレームまでで最大 1 フレーム遅れて数え始め、
      // 描かれているコマは今の時刻より最大 1 フレーム前のもの
      const FRAME_LAG_MS = FRAME_MS * 2
      // 時間割の窓 [from, to)(段階に入ってからの ms)の中で、上のずれが出ても窓からはみ出さない真ん中の時刻
      const sampleIn = (from: number, to: number) => {
        if (to - from <= FRAME_LAG_MS)
          throw new Error(`${from}〜${to}ms の窓はフレームのずれより狭く狙えない`)
        return Math.round((from + FRAME_LAG_MS + to) / 2)
      }
      const shifts: { key: string; shift: string }[] = []
      const expectPoseAt = async (at: number, key: string) => {
        await runTo(at)
        // 時間割がずれていれば「何 ms に何のコマだったか」付きで落ちる
        expect(sprite(), `投げてから ${at}ms のコマ`).toBe(key)
        // 左向きなので右向きのシートを反転して描く。歩行ループは transform をコマと同じ呼び出しの中で先に書く
        expect(player.style.transform, `投げてから ${at}ms のコマの反転`).toContain('scaleX(-1)')
        shifts.push({ key, shift: shift() })
      }

      // 投げる 4 コマ。振っている間はコマが時間で替わるので、どのコマの時点でもループは眠らない
      const castStep = FISHING_SWING_MS / CAST_FRAMES.length
      for (const [index, name] of CAST_FRAMES.entries()) {
        await expectPoseAt(
          sampleIn(castStep * index, castStep * (index + 1)),
          fishKey('right', name)
        )
        expect(loopState(), `${name} の間のループ`).toBe('running')
      }
      // 振り終えたら構えのコマで止まり、時間で替わる物が無くなるのでループは眠る。比べる基準はここで控える
      await runTo(sampleIn(FISHING_SWING_MS, FISHING_CAST_MS))
      expect(sprite()).toBe(fishKey('right'))
      expect(loopState(), '構えで止まったループ').toBe('idle')
      const readyShift = shift()

      // かかった瞬間まで進め、段階が替わって眠っていたループが起こされるのを見てから先へ進める
      await runTo(FISHING_CAST_MS)
      await expect.poll(floatPhase).toBe('bite')
      expect(loopState(), 'かかった時に起こされたループ').toBe('running')
      // 合図の 1 周期は 構え → 張る → 引かれる → 張る。浮きは周期の後半に沈み(CSS の steps(1) は 50% で切り替わる)、
      // 体はその沈み始めに引かれ、前後の BITE_BRACE_MS を張る
      const tug = FISHING_BITE_TUG_MS
      const sink = tug / 2
      await runTo(FISHING_CAST_MS + sampleIn(0, sink - BITE_BRACE_MS))
      expect(sprite()).toBe(fishKey('right'))
      await expectPoseAt(
        FISHING_CAST_MS + sampleIn(sink - BITE_BRACE_MS, sink),
        fishKey('right', 'tense')
      )
      await expectPoseAt(
        FISHING_CAST_MS + sampleIn(sink, tug - BITE_BRACE_MS),
        fishKey('right', 'bite')
      )
      // BITE_TUGS 周したら張ったコマのまま止まり、ループは眠る
      await runTo(FISHING_CAST_MS + sampleIn(tug * BITE_TUGS, FISHING_BITE_MS))
      expect(sprite()).toBe(fishKey('right', 'tense'))
      expect(loopState(), '合図を終えたループ').toBe('idle')

      // 巻物が跳ねる瞬間まで進め、同じく起こされるのを見る。引き上げてから掲げる
      const landAt = FISHING_CAST_MS + FISHING_BITE_MS
      await runTo(landAt)
      await expect.poll(floatPhase).toBe('landing')
      expect(loopState(), '巻物が跳ねた時に起こされたループ').toBe('running')
      await expectPoseAt(landAt + sampleIn(0, FISHING_PULL_MS), fishKey('right', 'pull'))
      await expectPoseAt(
        landAt + sampleIn(FISHING_PULL_MS, FISHING_LAND_MS),
        fishKey('right', 'hoist')
      )

      // 結果窓が出る瞬間まで進める。見出しへ焦点が移った = 結果窓を出した描画の effect が走り終えた
      const caughtAt = landAt + FISHING_LAND_MS
      await runTo(caughtAt)
      await expect.poll(dialogText).toContain(fishing.caughtPlace)
      expect(floatPhase()).toBe('caught')
      await expect.element(dialog.getByRole('heading', { level: 2 })).toHaveFocus()
      // 掲げたコマのまま窓の裏に残り、替わる物が無いのでループは眠る
      await runTo(caughtAt + FRAME_MS * 4)
      expect(sprite()).toBe(fishKey('right', 'hoist'))
      expect(loopState(), '結果窓の裏のループ').toBe('idle')
      // どのコマでも立ち位置(transform の位置)は構えのコマと同じ
      for (const { key, shift: drawn } of shifts) {
        expect(drawn, `${key} の立ち位置は構えのコマと同じ`).toBe(readyShift)
      }
    }, 30_000)

    // ここから下の 2 本は E2E に無い分岐(かかった後・巻物が跳ねた後の中断と、釣り場の地点で全部を釣り上げた後)。
    // use-village-fishing の待っているタイマーの片付けと、use-village-overlay の釣り場の地点の止め方を見る

    test('かかった後や巻物が跳ねた後に X で中断すると、待っていた釣り上げと結果窓は後から出ない', async () => {
      await openVillage()
      await goToPondShore()
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
      // かかった後(釣り上げを待つタイマーが残っている)で中断する
      await userEvent.keyboard('z')
      await advanceUntil(() => floatPhase() === 'bite', 'かかる', FISHING_CAST_MS + SLACK_MS)
      await userEvent.keyboard('x')
      await expect.poll(floatEl, { message: 'X で中断すると浮きを片付ける' }).toBeNull()
      await runFor(FISHING_BITE_MS + FISHING_LAND_MS)
      expect(dialog.query(), 'かかった後に中断した回の結果窓').toBeNull()
      expect(speech()).not.toContain(fishing.landed)
      // 巻物が跳ねた後(結果窓を待つタイマーが残っている)で中断する
      await userEvent.keyboard('z')
      await advanceUntil(
        () => floatPhase() === 'landing',
        '巻物が跳ねる',
        FISHING_CAST_MS + FISHING_BITE_MS + SLACK_MS
      )
      await userEvent.keyboard('x')
      await expect.poll(floatEl, { message: 'X で中断すると巻物を片付ける' }).toBeNull()
      await runFor(FISHING_LAND_MS * 2)
      expect(dialog.query(), '巻物が跳ねた後に中断した回の結果窓').toBeNull()
    }, 30_000)

    test('釣り場の地点(東の岸)でも、全部を釣り上げた後は Z を押しても投げない', async () => {
      const total = villageJa.catches.length
      expect(total).toBeGreaterThan(0)
      await openVillage()
      await goToPondShore()
      await goToEastShore()
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 6, y: 15 } })
      for (let count = 1; count <= total; count += 1) {
        await userEvent.keyboard('z')
        await advanceUntil(
          () => dialogText().includes(fishing.caughtPlace),
          `${count} 匹目の結果窓`,
          FISHING_CAST_MS + FISHING_BITE_MS + FISHING_LAND_MS + SLACK_MS
        )
        await dialog.getByRole('button', { name: text.close }).click()
        await expect.element(dialog).not.toBeInTheDocument()
        await runFor(FRAME_MS * 2)
      }
      // 揃えた後の釣り場の地点は考え事の吹き出しになり、Z を押しても投げず、移動も止めない
      expect(isVisible(thoughtBubble()), '釣り場の地点の考え事の吹き出し').toBe(true)
      await userEvent.keyboard('z')
      await runFor(FISHING_CAST_MS)
      expect(floatEl()).toBeNull()
      expect(speech()).not.toContain(fishing.cast)
      expect(await walk(setId, 'ArrowUp', 1), '投げていないので歩ける').toBe(1)
    }, 60_000)

    describe('動きを控える設定の釣り', () => {
      test('時間で替わるコマを出さず、段階ごとの静止コマ(構え・張る・掲げる)だけを描く', async () => {
        await emulateReducedMotion()
        await openVillage()
        await goToPondShore()
        expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 5, y: 13 } })
        expect(isVisible(promptBubble())).toBe(true)
        const poses = recordAttribute(villagePlayer(), 'data-sprite')
        await userEvent.keyboard('z')
        // 投げた瞬間から構えのコマ。振りかぶり〜振り抜きの 4 コマは描かない
        await expect.poll(floatPhase).toBe('casting')
        await advanceUntil(() => sprite() === fishKey('down'), '構えのコマ')
        // かかれば張ったコマのまま。構えと引かれるコマを行き来しない
        await advanceUntil(() => floatPhase() === 'bite', 'かかる', FISHING_CAST_MS + SLACK_MS)
        await advanceUntil(() => sprite() === fishKey('down', 'tense'), '張ったコマ')
        // 巻物が跳ねれば、引き上げるコマを飛ばして掲げたコマ。結果窓が出ても同じ
        await advanceUntil(
          () => /landing|caught/.test(floatPhase() ?? ''),
          '巻物が跳ねる',
          FISHING_BITE_MS + SLACK_MS
        )
        await advanceUntil(() => sprite() === fishKey('down', 'hoist'), '掲げたコマ')
        await advanceUntil(
          () => dialogText().includes(fishing.caughtPlace),
          '結果窓',
          FISHING_LAND_MS + SLACK_MS
        )
        expect(sprite()).toBe(fishKey('down', 'hoist'))
        // 結果窓が出るまでに描いたコマはこの 3 つだけ。一瞬でも他のコマが出れば記録に残る
        expect(firstSeen(poses)).toEqual([
          fishKey('down'),
          fishKey('down', 'tense'),
          fishKey('down', 'hoist'),
        ])
      }, 30_000)
    })

    describe('タッチ操作の釣り', () => {
      test('画面の A で直接投げ、B で中断して再び投げられる', async () => {
        await emulateTouch()
        await openVillage(390, 844)
        await goToPondShore()
        const buttonA = page.getByRole('button', { name: text.buttonA, exact: true })
        const buttonB = page.getByRole('button', { name: text.buttonB, exact: true })
        expect(isVisible(promptBubble())).toBe(true)
        await buttonA.click()
        await expect.poll(floatPhase).toBe('casting')
        expect(dialog.query()).toBeNull()
        await buttonB.click()
        await expect.poll(floatEl).toBeNull()
        // 中断すれば竿を下ろし、下向きの歩行コマ(待ち)へ戻る
        await advanceUntil(() => sprite() === 'player-down-0', '下向きの歩行コマへ戻る')
        expect(isVisible(promptBubble())).toBe(true)
        // 中断した回のタイマーが残っていれば結果窓が出ている頃まで進める
        await runFor(FISHING_CAST_MS + FISHING_BITE_MS + FISHING_LAND_MS)
        expect(dialog.query()).toBeNull()
        // 投げ直すと竿の振りを頭から描き直す。前の回の経過を持ち越すと、振りかぶりを飛ばして
        // 構えのコマから始まる。記録は投げ直す直前から取り直す
        const poses = recordAttribute(villagePlayer(), 'data-sprite')
        await buttonA.click()
        await expect.poll(floatPhase).toBe('casting')
        await advanceUntil(
          () => firstSeen(poses).length > CAST_FRAMES.length,
          '投げ直した後に構えまで描く'
        )
        expect(firstSeen(poses).slice(0, CAST_FRAMES.length + 1)).toEqual(castPoses('down'))
        await buttonB.click()
        await advanceUntil(() => sprite() === 'player-down-0', '下向きの歩行コマへ戻る')
        // 歩かず水面へ向き直った時も吹き出しを更新する
        expect(isVisible(promptBubble())).toBe(true)
        villageFrame().focus()
        await userEvent.keyboard('{ArrowRight>}')
        await runFor(40)
        await userEvent.keyboard('{/ArrowRight}')
        await advanceUntil(() => promptBubble() === null, '水面から向きを外すと吹き出しを下ろす')
        await userEvent.keyboard('{ArrowDown>}')
        await runFor(40)
        await userEvent.keyboard('{/ArrowDown}')
        await advanceUntil(() => isVisible(promptBubble()), '水面へ向き直ると吹き出しを出す')
      }, 30_000)
    })
  })

  describe('雨の日の傘', () => {
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
      expect(roomKeys, '部屋で上へ歩くコマ').toContainEqual(
        expect.stringMatching(/^player-up-[12]$/)
      )
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

test('画面の大きさを変えると、枠を新しい整数のマス寸法で 10×9 マスに描き直す', async () => {
  // 前提: ブラウザの時間帯は設定(vitest.integration.config.ts)どおり UTC。機器の時間帯に左右させない
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone, 'ブラウザの時間帯は UTC').toBe('UTC')

  await page.viewport(1280, 720)
  render(<VillagePageContainer {...villageJa} />)
  // 横長の PC: 幅なら 128px、高さなら 80px のマスが取れるが、原寸の上限 64px で止まる
  await expect
    .poll(frameSize, { message: '1280×720 では 64px のマスで 640×576' })
    .toEqual({ width: 640, height: 576 })

  await page.viewport(600, 900)
  // 縦長: 幅で決まり 600 / 10 列 = 60px。描き直さないと 64px のマスの 640×576 のまま残る
  await expect
    .poll(frameSize, { message: '600×900 では 60px のマスで 600×540' })
    .toEqual({ width: 600, height: 540 })
})

// ---- 画面の大きさ・窓・時計・昼夜 ----
// E2E が見ていた舞台の寸法・窓の焦点と吹き出し・卓上時計・昼夜と天気・開いたまま時間帯が替わる時の断定を、
// E2E からこの統合テストへ移したもの(ADR 0018 の「統合へ移す」)。
// E2E と同じく利用者に見える物(role・名前・aria・要素の有無・計算されたスタイル・位置)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。段階を決めるテストだけ Date を止め
// (startVillageClock の date。E2E の page.clock.setFixedTime)、開いたまま時間帯が替わるテストは Date と setInterval を止めて進める
// (phase-check)。差し替えるのは天気とシートの絵の取得(ネットワーク)と時間だけで、歩く・押す・待つは上の describe と同じ手順。
// タッチ端末(E2E の isMobile・hasTouch)の配置とスティックは、CDP のタッチの模擬(emulateTouch)で描く。
// 模擬を切った後は pointer も hover も none のまま戻らない(resetEmulation の注)が、村は pointer: coarse かどうかだけで分けるので、
// 続くテストの振る舞いは変わらない。
// 統合では作れないので E2E に残すもの: ビルドが焼くシートの PNG とローダーの <style> が描く絵・再読み込み・ko の文言
describe('画面の大きさ・窓・時計・昼夜', () => {
  const { text } = villageJa
  const setId = villageJa.worldSet.id

  // 画面は既定で PC(E2E の既定と同じ 1280×720)
  beforeEach(async () => {
    await page.viewport(1280, 720)
  })

  // キーを受け取る村の枠。E2E と同じく data-village で指す(枠の読み上げ名はタッチ端末かどうかで替わる)
  const frame = () => page.elementLocator(villageFrame())

  // DOM から 1 つ引く。無ければ前提が崩れているのでその場で落とす
  const queryOne = (selector: string, from: ParentNode = document): HTMLElement => {
    const element = from.querySelector<HTMLElement>(selector)
    if (element === null) throw new Error(`${selector} が描かれていない`)
    return element
  }

  // 村の根。data-phase に今の段階が、インラインの --cols・--rows(Village)と --cell・--band(useStageScale)に寸法が載る
  const root = () => {
    const element = villageFrame().closest<HTMLElement>('[data-phase]')
    if (element === null) throw new Error('村の根(data-phase)が描かれていない')
    return element
  }
  const phase = () => root().getAttribute('data-phase')
  const worldId = () => worldLayer().getAttribute('data-world')

  // 村を描き、起動の覆いが外れたら枠へ焦点を置き(E2E の openVillage)、useStageScale が舞台の実測を --cell に書くまで待つ。
  // CSS の既定値だけでも近い寸法になるため、インラインの値で見る。実際のコンテンツでは作れない場合だけ、props を変えた版を overrides で渡す
  const renderVillage = async (overrides: Partial<typeof villageJa> = {}) => {
    render(<VillagePageContainer {...villageJa} {...overrides} />)
    await focusVillage()
    await advanceUntil(
      () => root().style.getPropertyValue('--cell') !== '',
      'useStageScale が --cell を書いた'
    )
  }

  // 村は自室の開始マス (4,4) から始まる。下端の 1 マスのマット (4,7) へ下へ 3 マス歩いて乗ると、町の自宅前 (14,12) へ出る
  const walkOutToTown = async () => {
    villageFrame().focus()
    expect(await leaveRoom(setId), '部屋の下端のマットまで歩けた').toBe(3)
    // 天気・灯りを数える前に「今いるのは屋外」を確定させる。屋内のままだと天気は常に 0 枚で素通りする
    await expect.poll(worldId, { message: '町(屋外)へ出た' }).toBe('town')
  }

  // 「段階が変わらない」を見る前に待つフレーム数。段階を変える処理(シートの decode を待ってから setState)は、
  // 走れば 2 フレーム以内に画面へ届いた(2026-10-15、取消しで時刻を決めてしまう欠陥を入れて実測)ので、余裕を見て 5 フレーム
  const SETTLE_FRAMES = 5

  describe('舞台の寸法(tests/layout.spec.ts)', () => {
    const scrollOverflow = () => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight

    // .root のインライン変数(--cols/--rows は Village が、--cell と --band は useStageScale が書く)。
    // --band は帯の高さではなく「舞台の下端から帯の上端までの距離」で、会話窓・地図がこれを bottom に使う
    const stageVars = () => {
      const { style } = root()
      return {
        cols: Number(style.getPropertyValue('--cols')),
        rows: Number(style.getPropertyValue('--rows')),
        cell: Number.parseInt(style.getPropertyValue('--cell'), 10),
        band: Number.parseInt(style.getPropertyValue('--band'), 10),
      }
    }

    // 描かれている要素の箱。面積が無ければ(display: none など)描かれていないので落とす
    const box = (selector: string) => {
      const rect = queryOne(selector).getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) throw new Error(`${selector} が描かれていない`)
      return rect
    }

    // 矩形どうしが重なっているか(接するだけは重なりに数えない)
    const boxesIntersect = (a: DOMRect, b: DOMRect) =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

    test('PC では一覧への出口が右下に固定される', async () => {
      await renderVillage()
      const exit = page
        .getByRole('link', { name: text.toList, exact: true })
        .element()
        .getBoundingClientRect()
      const stage = villageFrame().getBoundingClientRect()
      expect(exit.right, '出口の右端は画面の右端から 8px 以上内側').toBeLessThanOrEqual(
        window.innerWidth - 8
      )
      expect(exit.bottom, '出口の下端は画面の下端から 8px 以上内側').toBeLessThanOrEqual(
        window.innerHeight - 8
      )
      expect(exit.top, '出口は枠の下半分より下').toBeGreaterThan(stage.top + stage.height / 2)
      expect(exit.width, '出口は枠の半分より細い').toBeLessThan(stage.width / 2)
    })

    test('PC では枠が上限 64px の整数マスで舞台に収まり、スティックと A/B は出ない', async () => {
      await renderVillage()
      const stage = villageFrame().getBoundingClientRect()
      const { cols, rows, cell } = stageVars()
      // PC の上限は視野(10×9 マス)で 64px = 640×576(原寸 160×144 の 4 倍)
      expect(cell).toBe(computeCell(1280, 720, 0, cols, rows))
      expect(cell).toBe(cellMax(cols))
      // 上限そのものが変わったら気づけるよう、公式ではなく実数で留める
      expect(cell).toBe(64)
      expect(cell).toBeGreaterThanOrEqual(CELL_MIN)
      expect(stage.width).toBe(cell * cols)
      expect(stage.height).toBe(cell * rows)
      expect(stage.left).toBeGreaterThanOrEqual(0)
      expect(stage.right).toBeLessThanOrEqual(1280)
      expect(stage.top).toBeGreaterThanOrEqual(0)
      expect(stage.bottom).toBeLessThanOrEqual(720)
      await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect
        .element(page.elementLocator(queryOne('[data-village-controls]')), {
          message: '操作帯(スティックと A/B)は PC では出ない',
        })
        .not.toBeVisible()
      expect(scrollOverflow(), '文書はスクロールしない').toBeLessThanOrEqual(0)
    })

    // E2E の isMobile・hasTouch に当たるタッチ端末(pointer: coarse)にしてから描く。寸法は E2E と同じ
    describe('縦持ちのスマートフォン', () => {
      beforeEach(async () => {
        await emulateTouch()
        await page.viewport(390, 664)
      })

      test('枠は幅基準の整数マス、スティックと A/B は枠の下の帯に置かれる', async () => {
        await renderVillage()
        const viewport = { width: window.innerWidth, height: window.innerHeight }
        const stage = villageFrame().getBoundingClientRect()
        const band = box('[data-village-controls]')
        const exitSlot = box('[data-village-exit-slot]')
        const exit = box('[data-village-exit]')
        const { cols, rows, cell, band: bandVar } = stageVars()
        // 幅基準: floor(390 / 列)。CSS 既定値ではなく JS の実測値であること(差し引くのは帯と出口の箱の実測)
        expect(cell).toBe(
          computeCell(viewport.width, viewport.height, band.height + exitSlot.height, cols, rows)
        )
        // 上の 1 行は検査対象(computeCell)で検査対象を測っているだけなので、幅の基準式が半分になっても
        // 通ってしまう。390px 幅で実ブラウザが出した値を実数で留め、式そのものが変わったら落とす
        expect(cell).toBe(39)
        // 縦持ちは帯が通常フローにいるので、--band に帯の上端までの距離(= 下端に密着した帯の高さ)が入る。
        // ここが 0 のままだと会話窓・地図が帯を覆う回帰に気づけない
        expect(bandVar).toBeGreaterThan(0)
        expect(bandVar).toBe(Math.round(band.height))
        // 一覧への出口は枠のすぐ下に横いっぱい、帯より上
        expect(exit.y).toBeGreaterThanOrEqual(stage.y + stage.height)
        expect(exit.y - (stage.y + stage.height)).toBeLessThanOrEqual(24)
        expect(exit.y + exit.height).toBeLessThanOrEqual(band.y)
        expect(exit.width).toBeGreaterThanOrEqual(stage.width - 24)
        expect(exit.height).toBeGreaterThanOrEqual(44)
        expect(stage.width).toBe(cell * cols)
        expect(stage.height).toBe(cell * rows)
        expect(band.y).toBeGreaterThanOrEqual(stage.y + stage.height)
        expect(band.y + band.height).toBeLessThanOrEqual(viewport.height)
        // 帯は親指ゾーン(画面の最下端)まで届く。テスト環境に safe-area は無いので端に密着する
        expect(band.y + band.height).toBeGreaterThanOrEqual(viewport.height - 1)
        const joystick = box('[data-village-controls] [role="application"]')
        const a = box('[data-village-action="a"]')
        const b = box('[data-village-action="b"]')
        // スティックは帯の左半分。縦持ちタッチは 120px 以上まで大きくする
        expect(joystick.width).toBeGreaterThanOrEqual(120)
        expect(joystick.x).toBeGreaterThanOrEqual(band.x)
        expect(joystick.x + joystick.width).toBeLessThanOrEqual(band.x + band.width / 2)
        expect(joystick.y).toBeGreaterThanOrEqual(band.y)
        expect(joystick.y + joystick.height).toBeLessThanOrEqual(band.y + band.height)
        // A・B は帯の右半分、どちらも帯の内側。縦持ちタッチは 64px 以上まで大きくする
        expect(a.width).toBeGreaterThanOrEqual(64)
        expect(b.width).toBeGreaterThanOrEqual(64)
        expect(a.x).toBeGreaterThanOrEqual(band.x + band.width / 2)
        expect(a.x + a.width).toBeLessThanOrEqual(band.x + band.width)
        expect(a.y).toBeGreaterThanOrEqual(band.y)
        expect(a.y + a.height).toBeLessThanOrEqual(band.y + band.height)
        expect(b.x).toBeGreaterThanOrEqual(band.x + band.width / 2)
        expect(b.x + b.width).toBeLessThanOrEqual(band.x + band.width)
        expect(b.y).toBeGreaterThanOrEqual(band.y)
        expect(b.y + b.height).toBeLessThanOrEqual(band.y + band.height)
        // A は B の右上(GBA と同じ配置)
        expect(b.x + b.width).toBeLessThanOrEqual(a.x + a.width)
        expect(a.x).toBeGreaterThan(b.x)
        expect(a.y).toBeLessThan(b.y)
        expect(scrollOverflow(), '文書はスクロールしない').toBeLessThanOrEqual(0)
      })

      test('操作帯を含む舞台全体で touch-action: none が効き、文書はスクロールしない', async () => {
        await renderVillage()
        const controls = queryOne('[data-village-controls]')
        // 前提: 縦持ちのタッチ端末では操作帯が描かれている(描かれていない帯の計算値を見ても何も証明しない)
        expect(isVisible(controls), '縦持ちのタッチ端末では操作帯が描かれる').toBe(true)
        // touch-action は継承されないので、帯自身の計算値だけでは祖先の none を拾えない。
        // ブラウザがタッチのページのパンを止めるかは帯とその祖先を合わせた実効値で決まるので、帯から根まで遡って none を持つ要素があるかを見る
        const effectiveNone = (node: Element | null): boolean =>
          node !== null &&
          (getComputedStyle(node).touchAction === 'none' || effectiveNone(node.parentElement))
        expect(getComputedStyle(root()).touchAction, '舞台全体(.root)が touch-action: none').toBe(
          'none'
        )
        expect(effectiveNone(controls), '操作帯から祖先を遡った実効値も none').toBe(true)
        expect(scrollOverflow(), '文書はスクロールしない').toBeLessThanOrEqual(0)
      })
    })

    // 枠の左右に 150px 以上のガターが空く(片側 (画面の幅 - 枠の幅)/2 ≥ 150px)横持ち・タブレットは、
    // 帯を枠へ重ねず左右のガターへ分けて置く。スティック・A/B とも枠の外(ガター側)に収まり、高さは親指の位置(画面の縦中央)へ揃う
    const expectGutterLayout = (stage: DOMRect) => {
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      expect(root().hasAttribute('data-gutters'), 'useStageScale がガター配置の印を立てる').toBe(
        true
      )
      // ガター配置の帯は absolute で枠に重なるだけなので、差し引く距離は無い。
      // 縦持ち用の値がそのまま残ると会話窓・地図が画面の途中で切り上がる
      expect(stageVars().band).toBe(0)
      const joystick = box('[data-village-controls] [role="application"]')
      const a = box('[data-village-action="a"]')
      const b = box('[data-village-action="b"]')
      // スティックは枠の外(左のガター)に、A・B は枠の外(右のガター)に収まる
      expect(joystick.x + joystick.width).toBeLessThanOrEqual(stage.x)
      expect(a.x).toBeGreaterThanOrEqual(stage.x + stage.width)
      expect(b.x).toBeGreaterThanOrEqual(stage.x + stage.width)
      // 縦中央(親指の高さ)に寄る
      const center = viewport.height / 2
      expect(Math.abs(joystick.y + joystick.height / 2 - center)).toBeLessThanOrEqual(2)
      // 一覧への出口はガター配置でも A・B の上に重ならず、画面の下端に収まる
      const exit = box('[data-village-exit]')
      expect(boxesIntersect(exit, a)).toBe(false)
      expect(boxesIntersect(exit, b)).toBe(false)
      expect(exit.y + exit.height).toBeLessThanOrEqual(viewport.height)
      expect(scrollOverflow(), '文書はスクロールしない').toBeLessThanOrEqual(0)
    }

    describe('横持ちのスマートフォン', () => {
      beforeEach(async () => {
        await emulateTouch()
        await page.viewport(750, 342)
      })

      test('枠は高さ基準の整数マス、スティックと A/B は左右のガターへ分かれる', async () => {
        await renderVillage()
        const stage = villageFrame().getBoundingClientRect()
        const { cols, rows, cell } = stageVars()
        // 横持ちは帯が無いので min(floor(w/列), floor(h/行), 64)
        expect(cell).toBe(computeCell(window.innerWidth, window.innerHeight, 0, cols, rows))
        // computeCell で computeCell を測っても式の変更は捕まえられない。750×342 で実ブラウザが出した値(高さ基準 floor(342/9))を実数で留める
        expect(cell).toBe(38)
        expect(stage.width).toBe(cell * cols)
        expect(stage.height).toBe(cell * rows)
        // 750×342・マス 38 の枠の幅 380 なら片側 185px のガターが空き、ガター配置になる
        expectGutterLayout(stage)
      })
    })

    describe('iPad横持ち', () => {
      beforeEach(async () => {
        await emulateTouch()
        await page.viewport(1024, 768)
      })

      test('枠は上限 64px で止まり、スティックと A/B は左右のガターへ分かれる', async () => {
        await renderVillage()
        const stage = villageFrame().getBoundingClientRect()
        const { cols, rows, cell } = stageVars()
        // 1024×768 はどちらの基準でも上限 64px で頭打ちになる
        expect(cell).toBe(computeCell(window.innerWidth, window.innerHeight, 0, cols, rows))
        expect(cell).toBe(cellMax(cols))
        // 上限そのものが変わったら気づけるよう、公式ではなく実数で留める(PC と同じ 64px)
        expect(cell).toBe(64)
        expect(stage.width).toBe(cell * cols)
        expect(stage.height).toBe(cell * rows)
        // 枠の幅 640 に対し片側 192px のガターが空き、ガター配置になる
        expectGutterLayout(stage)
      })
    })
  })

  describe('窓の焦点と吹き出し', () => {
    // 窓は role='dialog' の div と手製の Tab の輪(src/hooks/use-dialog-focus.ts)で作るので、ブラウザは輪を保証しない。
    // 今の焦点から Tab で 1 つずつ末尾まで進め、末尾の次は先頭へ、先頭の前は末尾へ回るのを見る
    const cycleWithTab = async (dialog: Element, selector: string) => {
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(selector))
      // 1 つだけだと先頭と末尾が同じで、回ったのか留まったのかを見分けられない
      expect(items.length, '窓の中に焦点を移せる要素が 2 つ以上ある').toBeGreaterThanOrEqual(2)
      const advance = async (index: number): Promise<void> => {
        if (index >= items.length - 1) return
        await userEvent.tab()
        await expect
          .poll(() => focusIndex(dialog, selector), { message: `Tab で ${index + 1} 番目へ進む` })
          .toBe(index + 1)
        await advance(index + 1)
      }
      await advance(focusIndex(dialog, selector))
      await userEvent.tab()
      await expect
        .element(page.elementLocator(items[0]), { message: '末尾で Tab を押すと先頭へ回る' })
        .toHaveFocus()
      await userEvent.tab({ shift: true })
      await expect
        .element(page.elementLocator(items[items.length - 1]), {
          message: '先頭で Shift+Tab を押すと末尾へ回る',
        })
        .toHaveFocus()
    }

    // 窓を開く前の焦点が村の枠にあるか。閉じた後に枠へ戻ったことが「元からそこにあった」のではなく「戻された」と言えるよう、開く前にも押さえる
    const expectFrameFocused = (message: string) =>
      expect.element(frame(), { message }).toHaveFocus()

    test('拡大地図は Tab の輪を両端で回し、閉じると村の枠へ焦点を戻す', async () => {
      await renderVillage()
      // 地図は町でだけ開く。部屋の下端のマットから町の自宅前へ出る
      await walkOutToTown()
      await expectFrameFocused('開く前の焦点は村の枠')
      await userEvent.keyboard('m')
      const map = page.getByRole('dialog')
      await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
      // 開いた直後の焦点は番号 1 の地点で、並びの先頭(閉じるボタン)ではない。そこから末尾まで進めて回す
      await expect
        .poll(() => focusIndex(map.element(), MAP_FOCUSABLE_SELECTOR), {
          message: '開いた直後の焦点は窓の中の、先頭より後ろ',
        })
        .toBeGreaterThan(0)

      await cycleWithTab(map.element(), MAP_FOCUSABLE_SELECTOR)

      await userEvent.keyboard('{Escape}')
      await expect.element(map).not.toBeInTheDocument()
      await expectFrameFocused('閉じると村の枠へ焦点が戻る')
    })

    // ここから下の 5 件は tests/journey.spec.ts が見ている窓の中の操作(Z/X・本文送り・地図の方向キー)のうち、
    // 窓のフック(use-village-buttons・use-held-scroll・use-map-focus)の分岐を統合で通すもの。journey の行き先は
    // この段では決めていないので、journey はそのまま残す(ADR 0018)
    test('Z(画面の A)は歩いている時は話しかけ、会話中は次の地点へ進み、X(画面の B)は歩いている時は何もせず会話中は閉じる', async () => {
      await renderVillage()
      await expect
        .poll(() => document.querySelector('[data-village-bubble]'), {
          message: '出発の机の前で吹き出しが出る',
          timeout: 3_000,
        })
        .not.toBeNull()
      villageFrame().focus()
      const dialog = page.getByRole('dialog')
      // 歩いている時の X は閉じる窓が無いので何もしない
      await userEvent.keyboard('x')
      await runFrames(SETTLE_FRAMES)
      expect(
        document.querySelector('[role="dialog"]'),
        '歩いている時の X では窓が開かない'
      ).toBeNull()
      await expectFrameFocused('X の後も焦点は村の枠')
      // 歩いている時の Z は話しかける(E と同じ)
      await userEvent.keyboard('z')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }), {
          message: 'Z で机に話しかけ、会話窓の見出しに焦点がある',
        })
        .toHaveFocus()
      // 焦点がボタンでない(見出しの)時の Z は、窓の「次へ」と同じ行き先へ進む
      await userEvent.keyboard('z')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.meishi.title }), {
          message: '会話中の Z で次の地点(名刺工房)へ進む',
          timeout: 10_000,
        })
        .toBeVisible()
      // 会話中の X は窓を閉じる
      await userEvent.keyboard('x')
      await expect.element(dialog).not.toBeInTheDocument()
    })

    // 拡大地図の地点の印(字 + 番号の札)は、隣り合うマスの地点どうしで重なるので実測でずらして離す。
    // ずらす量は px なので、開いたまま画面の大きさが変わると測り直さないと重なる
    test('拡大地図を開いたまま画面の大きさが変わっても、地点の印どうしは重ならない', async () => {
      await renderVillage()
      await walkOutToTown()
      await userEvent.keyboard('m')
      const map = page.getByRole('dialog')
      await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
      // 印は字と札を合わせた範囲(ボタンの子の外接矩形。札はボタンの外へはみ出す)
      const badgeBoxes = () =>
        Array.from(map.element().querySelectorAll('[data-spot-id]')).map(spot => {
          const rects = Array.from(spot.children).map(child => child.getBoundingClientRect())
          return {
            id: spot.getAttribute('data-spot-id'),
            left: Math.min(...rects.map(rect => rect.left)),
            right: Math.max(...rects.map(rect => rect.right)),
            top: Math.min(...rects.map(rect => rect.top)),
            bottom: Math.max(...rects.map(rect => rect.bottom)),
          }
        })
      // 重なっている印の組(接するだけは数えない)
      const overlapping = () => {
        const boxes = badgeBoxes()
        return boxes.flatMap((a, index) =>
          boxes
            .slice(index + 1)
            .filter(
              b => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
            )
            .map(b => `${a.id}/${b.id}`)
        )
      }
      expect(badgeBoxes().length, '地図に地点の印が並ぶ').toBeGreaterThanOrEqual(2)
      expect(overlapping(), '開いた時、印どうしは重ならない').toEqual([])
      await page.viewport(390, 664)
      await runFrames(SETTLE_FRAMES)
      expect(overlapping(), '小さい画面へ変えた後も、印どうしは重ならない').toEqual([])
    })

    test('拡大地図は方向キーでその向きの地点へ焦点を移し、M で閉じる', async () => {
      await renderVillage()
      await walkOutToTown()
      await userEvent.keyboard('m')
      const map = page.getByRole('dialog')
      await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
      const focusedSpot = () =>
        document.activeElement instanceof HTMLElement
          ? document.activeElement.dataset.spotId
          : undefined
      // 地図を開いた直後は番号 1(自室)の印に焦点がある
      const entries = mapEntries(villageJa.worldSet, villageJa.worldSet.worlds.town, new Set())
      const first = entries[0]
      await expect.poll(focusedSpot, { message: '開いた直後の焦点は番号 1 の地点' }).toBe(first.id)
      // 焦点が地点に無い(並びの先頭の閉じるボタンの)時は、Tab と同じく番号 1 の地点から入る
      await userEvent.tab({ shift: true })
      await expect
        .element(map.getByRole('button', { name: text.closeMap }), {
          message: '番号 1 の地点の前は閉じるボタン',
        })
        .toHaveFocus()
      await userEvent.keyboard('{ArrowRight}')
      await expect
        .poll(focusedSpot, { message: '閉じるボタンから方向キーで番号 1 の地点へ' })
        .toBe(first.id)
      // 右か下のうち、実際に地点がある向きを町のデータから選ぶ(tests/journey.spec.ts と同じ選び方)
      const moves: { key: WalkKey; spot: MapEntry | null }[] = [
        { key: 'ArrowRight', spot: spotToward(entries, first.id, 'right') },
        { key: 'ArrowDown', spot: spotToward(entries, first.id, 'down') },
      ]
      const move = moves.find(candidate => candidate.spot !== null)
      if (move === undefined || move.spot === null) {
        throw new Error('最初の地点の右にも下にも地点が無い')
      }
      const moved = move.spot
      expect(moved.id).not.toBe(first.id)
      await userEvent.keyboard(`{${move.key}}`)
      await expect
        .poll(focusedSpot, { message: 'その向きで最も近い地点へ焦点が移る' })
        .toBe(moved.id)
      // 押した向きに地点が無ければ、焦点は動かない
      const DIRECTIONS = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      } as const
      const dead = (Object.keys(DIRECTIONS) as WalkKey[]).find(
        key => spotToward(entries, moved.id, DIRECTIONS[key]) === null
      )
      if (dead === undefined) throw new Error(`${moved.id} からはどの向きにも地点がある`)
      await userEvent.keyboard(`{${dead}}`)
      await runFor(FRAME_MS * SETTLE_FRAMES)
      expect(focusedSpot(), 'その向きに地点が無ければ焦点は動かない').toBe(moved.id)
      // 焦点が移っただけで地図は閉じない。M は開閉の切り替えで、地図の中でも閉じる
      await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
      await userEvent.keyboard('m')
      await expect.element(map).not.toBeInTheDocument()
      await expectFrameFocused('閉じると村の枠へ焦点が戻る')
    })
  })

  describe('昼夜と天気(tests/day-night.spec.ts)', () => {
    // 雨・雪の層。Weather が層ごとに data-weather を置き、値に降水の種類を載せる。層は枠の子
    const WEATHER_LAYERS = '[data-weather]'
    const RAIN_LAYERS = '[data-weather="rain"]'
    const SNOW_LAYERS = '[data-weather="snow"]'
    // 降っている間に並ぶ層の枚数。2 コマを不透明度で交互に見せ消しする作りなので、出ているなら必ず 2 枚
    const WEATHER_LAYER_COUNT = 2
    const countOf = (selector: string) => document.querySelectorAll(selector).length

    // 天気の層が敷くシート(data URI をカスタムプロパティで渡す)。画像として実際に読めるかまで見る
    // (読めない URI でも文字列は取れるので、比較だけでは「両方壊れている」を取り逃がす)
    const weatherSheet = async (layer: Element) => {
      const image = getComputedStyle(layer).backgroundImage
      // none・グラデーション・複数指定はここで落とす(url() 1 本だけを認める)
      const single = /^url\((['"]?)(.+)\1\)$/.exec(image)
      if (single === null) return { drawable: false, image }
      const probe = new RealImage()
      probe.src = single[2]
      const drawable = await probe.decode().then(
        () => probe.naturalWidth > 0 && probe.naturalHeight > 0,
        () => false
      )
      return { drawable, image }
    }

    const ariaHiddenOf = (selector: string) =>
      Array.from(document.querySelectorAll(selector)).map(layer =>
        layer.getAttribute('aria-hidden')
      )

    test('夜で雨でも8か所のコースは最後まで通る', { timeout: 90_000 }, async () => {
      const { home, meishi, lab, monument, robot, campfire, mailbox, journey } = text.stops
      const weather = stubWeather('rain')
      startVillageClock(PHASE_CLOCKS.night, 'date')
      await renderVillage()
      expect(phase()).toBe('night')
      await expect.poll(weather.calls, { message: '天気を問い合わせた' }).toBeGreaterThan(0)
      // 出発点の自室は屋内。ここではまだ降っていないのが正しい
      expect(countOf(WEATHER_LAYERS), '出発点の自室は屋内なので降らない').toBe(0)

      const dialog = page.getByRole('dialog')
      const expectStop = (title: string) =>
        expect
          .element(dialog.getByRole('heading', { name: title }), { timeout: 10_000 })
          .toBeVisible()
      await userEvent.keyboard('e')
      await expectStop(home.title)
      await userEvent.click(dialog.getByRole('button', { name: home.next }))
      await expectStop(meishi.title)
      // 自動の移動(飛んで扉を出る)で町(屋外)へ出た最初の地点。ここから完走まで雨が降り続けるはず
      await expect
        .poll(() => countOf(RAIN_LAYERS), { message: '町へ出た時点で雨が降っている' })
        .toBe(WEATHER_LAYER_COUNT)
      await userEvent.click(dialog.getByRole('button', { name: meishi.next }))
      await expectStop(lab.title)
      // 研究所 → 経歴碑 → AIロボ → 焚き火 → ポスト → 次の旅を次へで連ねる。
      // 最後の次の旅は、北の道の突き当たりへ着いたことで会話窓が自動で開く
      const chain = [lab, monument, robot, campfire, mailbox]
      const follow = async (index: number): Promise<void> => {
        if (index >= chain.length) return
        await userEvent.click(dialog.getByRole('button', { name: chain[index].next }))
        await expectStop((chain[index + 1] ?? journey).title)
        await follow(index + 1)
      }
      await follow(0)
      await userEvent.keyboard('{Escape}')
      await expect.element(dialog).not.toBeInTheDocument()
      await expect
        .element(page.getByRole('status'))
        .toHaveTextContent(text.allSeen.replace('{list}', text.toList))
      // 完走すると一覧への出口へ焦点が移り、出口が跳ねて(data-bounce)合図する
      const exit = page.getByRole('link', { name: text.toList, exact: true })
      await expect.element(exit).toHaveFocus()
      await expect.element(exit).toHaveAttribute('data-bounce', '')
      // 完走しても段階と雨はそのまま(コースの進行が空や天気を壊していない)
      expect(phase()).toBe('night')
      expect(countOf(RAIN_LAYERS), '完走後も雨が降り続けている').toBe(WEATHER_LAYER_COUNT)
    })

    // E2E の同じ検査の段階の属性の部分。焼いたシートそのものが段階ごとに別物かは、ビルドが焼く PNG と
    // ローダーの <style>(スプライトの背景)が要り、統合では描かれないので E2E に残す
    test('4 段階のどの瞬間に開いても、その段階で描く', async () => {
      for (const dayPhase of DAY_PHASES) {
        startVillageClock(PHASE_CLOCKS[dayPhase], 'date')
        await renderVillage()
        expect(phase(), `${PHASE_CLOCKS[dayPhase]} に開くと ${dayPhase}`).toBe(dayPhase)
        cleanup()
      }
    })

    test('大阪が雨なら雨の層が出て、読み上げからは外れる', async () => {
      const weather = stubWeather('rain')
      startVillageClock(PHASE_CLOCKS.day, 'date')
      await renderVillage()

      // このテストの応答を見て描いたことを先に押さえる
      await expect.poll(weather.calls, { message: '天気を問い合わせた' }).toBeGreaterThan(0)
      // 自室には天井があるので、雨だと分かっていても屋内では降らせない
      expect(countOf(WEATHER_LAYERS), '屋内では降らない').toBe(0)

      await walkOutToTown()
      // 属性の値まで見るので、雪の層が出ていても「雨が降った」とは数えない
      await expect
        .poll(() => countOf(RAIN_LAYERS), { message: '雨は 2 コマぶんの層が並ぶ' })
        .toBe(WEATHER_LAYER_COUNT)
      // 2 枚とも読み上げから外れていること。片方だけだと支援技術に粒の層が残る
      expect(ariaHiddenOf(RAIN_LAYERS), '2 枚とも読み上げから外れる').toEqual(['true', 'true'])
    })

    test('大阪が雪なら雪の層が出て、雨とは別のシートになる', async () => {
      const weather = stubWeather('snow')
      startVillageClock(PHASE_CLOCKS.day, 'date')
      await renderVillage()

      await expect.poll(weather.calls, { message: '天気を問い合わせた' }).toBeGreaterThan(0)
      // 雨と同じく、天井のある自室では降らせない
      expect(countOf(WEATHER_LAYERS), '屋内では降らない').toBe(0)

      await walkOutToTown()
      await expect
        .poll(() => countOf(SNOW_LAYERS), { message: '雪は 2 コマぶんの層が並ぶ' })
        .toBe(WEATHER_LAYER_COUNT)
      // 差し替えた応答は降水も 0 より大きい。降雪を先に見る判定が落ちればここが雨に化けるので、
      // 「雨が 0 枚」まで見て初めて雪として降ったと言える
      expect(countOf(RAIN_LAYERS), '雪の日に雨の層は出ない').toBe(0)
      expect(ariaHiddenOf(SNOW_LAYERS), '2 枚とも読み上げから外れる').toEqual(['true', 'true'])

      const [snowFirstLayer, snowSecondLayer] = Array.from(document.querySelectorAll(SNOW_LAYERS))
      const snowFirst = await weatherSheet(snowFirstLayer)
      const snowSecond = await weatherSheet(snowSecondLayer)
      expect(snowFirst.drawable, '雪の 1 コマ目が画像として読める').toBe(true)
      expect(snowSecond.drawable, '雪の 2 コマ目が画像として読める').toBe(true)
      // 2 枚が同じ絵だと、見せ消ししても粒が動かない(コマ送りになっていない)
      expect(snowSecond.image, '雪の 2 枚は別のコマである').not.toBe(snowFirst.image)

      // 同じ村を雨へ差し替えて開き直す(E2E から移す前は再読み込みしていた所)。属性の値が違うだけでなく、敷かれるシートそのものが
      // 雨と雪で別物だと確かめる。読み込み直すと自室から始まる(位置は捨てる)ので、降る場所までもう一度出てから数える
      stubWeather('rain')
      cleanup()
      clearVillageProgress(setId)
      await renderVillage()
      await walkOutToTown()
      await expect
        .poll(() => countOf(RAIN_LAYERS), { message: '差し替えた後は雨の層に入れ替わる' })
        .toBe(WEATHER_LAYER_COUNT)
      expect(countOf(SNOW_LAYERS), '雨に変えたら雪の層は残らない').toBe(0)
      const rainFirst = await weatherSheet(queryOne(RAIN_LAYERS))
      expect(rainFirst.drawable, '雨の 1 コマ目が画像として読める').toBe(true)
      expect(rainFirst.image, '雪のシートは雨のシートと別物').not.toBe(snowFirst.image)
    })

    test('天気の取得が失敗したら何も降らせず村は動く', async () => {
      const weather = stubWeather('error')
      startVillageClock(PHASE_CLOCKS.day, 'date')
      await renderVillage()

      // 問い合わせが済んでから数える。応答前に数えると「まだ出ていない」を通してしまう
      await expect.poll(weather.calls, { message: '天気を問い合わせた' }).toBeGreaterThan(0)
      // 取得に失敗しても村の描画と会話はそのまま動く
      await expect.element(frame()).toBeVisible()
      const dialog = page.getByRole('dialog')
      await userEvent.keyboard('e')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }))
        .toBeVisible()
      await userEvent.keyboard('{Escape}')
      await expect.element(dialog).not.toBeInTheDocument()

      // 降る場所(屋外)まで出てから数える。種類も問わない — 雨に絞ると、誤って雪として降った時に見逃す
      await walkOutToTown()
      await runFrames(SETTLE_FRAMES)
      expect(countOf(WEATHER_LAYERS), '失敗したら何も降らない').toBe(0)
    })
  })

  // E2E の同じ検査はさらに、描いた地形と主人公の背景がその段階の焼いたシートを指し、画像として読めるか(expectDrawable)を見る。
  // その背景はローダーの <style> が描き、シートの PNG はビルドが焼くので、統合では描かれない。そこは E2E に残す
  describe('開いたまま時間帯が替わる(tests/night-transition.spec.ts)', () => {
    // JST 2026-09-23 16:59(昼の帯の終わり)。2 時間 2 分進めると JST 19:01 で夜の帯に入る
    const START = '2026-09-23T07:59:00Z'
    const TWO_HOURS_LATER = 2 * 60 * 60 * 1000 + 2 * 60 * 1000
    // 段階を確かめ直す間隔(hooks/use-day-phase.ts の CHECK_INTERVAL_MS)
    const CHECK_INTERVAL_MS = 60_000

    // 再読み込みせずに開いたまま時間を進める。Date と setInterval を偽の時計に載せて昼から始める
    const openDay = async () => {
      startVillageClock(START, 'phase-check')
      await renderVillage()
      expect(phase(), '開いた時は昼').toBe('day')
    }

    test('2 時間開いたまま夜へ移ると、地形と主人公の夜のシートを取りに行って夜になる', async () => {
      const requested: string[] = []
      routeSheets(async url => {
        requested.push(url)
      })
      await openDay()
      vi.advanceTimersByTime(TWO_HOURS_LATER)
      await expect.poll(phase, { message: '2 時間後は再読み込みせずに夜' }).toBe('night')
      // 夜の段階は地形と主人公の両方のシートで描く
      expect(requested.some(url => url.includes('/sprite-night-'))).toBe(true)
      expect(requested.some(url => url.includes('/player-night-'))).toBe(true)
    })

    test('夜の画像が届かない間は直前の昼の村を残し、届くようになれば夜へ移る', async () => {
      let unavailable = true
      let failures = 0
      routeSheets(async url => {
        if (!unavailable || !url.includes('-night-')) return
        failures += 1
        throw new Error(`404: ${url}`)
      })
      await openDay()
      // 開いた時の先読みで夜の絵も一度取りに行って失敗している。夜へ入った時に取り直してまた失敗するのを、増えた数で見る
      await expect
        .poll(() => failures, { message: '開いた時の先読みが失敗した' })
        .toBeGreaterThan(0)
      const preloadFailures = failures
      vi.advanceTimersByTime(TWO_HOURS_LATER)
      await expect
        .poll(() => failures, { message: '夜へ入って夜の絵を取り直し、また失敗した' })
        .toBeGreaterThan(preloadFailures)
      await runFrames(SETTLE_FRAMES)
      expect(phase(), '夜の絵が届かない間は昼のまま').toBe('day')

      unavailable = false
      vi.advanceTimersByTime(CHECK_INTERVAL_MS)
      await expect.poll(phase, { message: '届くようになった次の確かめで夜へ移る' }).toBe('night')
    })

    // 実際の段階の表は全段階のシートを持つので作れない。夜を抜いた表を props で渡し、描く絵の無い段階へ移らないことを見る
    test('段階のシートの表に無い段階へは移らず、直前の段階を残す', async () => {
      routeSheets(async () => {})
      startVillageClock(START, 'phase-check')
      await renderVillage({
        phaseSheets: villageJa.phaseSheets.filter(sheet => sheet.phase !== 'night'),
      })
      expect(phase(), '開いた時は昼').toBe('day')
      vi.advanceTimersByTime(TWO_HOURS_LATER)
      await runFrames(SETTLE_FRAMES)
      expect(phase(), '描くシートの無い夜へは移らない').toBe('day')
      // 同じ表でも、シートのある段階へは移る(表を絞ったせいで段階が全く動かないのではない)
      vi.advanceTimersByTime(10 * 60 * 60 * 1000)
      await expect.poll(phase, { message: '翌朝(明け方)のシートはあるので移る' }).toBe('dawn')
    })

    test('夜の主人公の絵だけ遅れても、両方の絵が揃うまで昼を残す', async () => {
      // 夜の主人公の絵への応答を、テストが手放すまで返さずに留める
      let release = () => {}
      const pending = new Promise<void>(resolve => {
        release = resolve
      })
      let requests = 0
      routeSheets(async url => {
        if (!url.includes('/player-night-')) return
        requests += 1
        await pending
      })
      try {
        await openDay()
        vi.advanceTimersByTime(TWO_HOURS_LATER)
        await expect
          .poll(() => requests, { message: '夜の主人公の絵を取りに行った' })
          .toBeGreaterThan(0)
        await runFrames(SETTLE_FRAMES)
        expect(phase(), '主人公の夜の絵が届くまで昼のまま').toBe('day')
        release()
        await expect.poll(phase, { message: '両方揃えば夜へ移る' }).toBe('night')
      } finally {
        release()
      }
    })
  })
})

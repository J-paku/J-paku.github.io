// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// happy-dom は配置を計算せず ResizeObserver.observe() も実装が無いので、寸法に頼る振る舞いはここで見る。
// 差し替えるのはネットワーク(天気の通信・段階のシートの絵の取得)と時間だけ。レイアウト・ResizeObserver・入力は本物を使う。
// 時間の差し替え方は describe ごとに違う(掛け方は village-time.test-helper.ts の startVillageClock):
//   - 「歩く・待つ・釣り・傘・飛ぶ」は rAF・performance.now・タイマー・Date を偽の時計に載せ、テストが 1 フレーム(16ms)ずつ進める
//   - 「画面の大きさ・窓・時計・昼夜」は rAF・タイマー・performance.now を本物のまま使い、段階を決めるテストだけ Date を止める
//     (開いたまま時間帯が替わるテストは Date と setInterval を止め、テストが進める)
//   - その間にある画面の大きさのテストは時間を差し替えない
// 偽の時計・差し替えた通信と Image・CDP で替えたブラウザの環境・卓上時計のストア・保存した位置は、下の afterEach が毎回戻す
// (タッチの模擬を切った後の pointer・hover だけは戻り切らない。village-walk.test-helper.ts の resetEmulation の注)
import { cleanup, render } from '@testing-library/react'
import { inject } from 'vitest'
import { page } from 'vitest/browser'
import { clearVillageProgress } from '@/lib/preferences'
import VillagePageContainer from './container'
import { userEvent } from 'vitest/browser'
import type { Cell, World } from '@content/types/world'
import { isWalkable } from '@/lib/village/collision'
import { FLIGHT_MIN_DISTANCE, flightDurationMs } from '@/lib/village/flight-curve'
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
  FRAME_MS,
  HOLD_MS,
  SETTLE_MS,
  SLACK_MS,
  advanceUntil,
  emulateReducedMotion,
  emulateTouch,
  expectLoopIdle,
  focusVillage,
  isVisible,
  leaveRoom,
  loopState,
  mouse,
  playerOnScreen,
  press,
  readCell,
  resetEmulation,
  runFor,
  stepFrame,
  stubWeather,
  tap,
  villageFrame,
  villagePlayer,
  walk,
  worldLayer,
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
import { PHASE_CLOCKS, startVillageClock } from './village-time.test-helper'

const villageJa = inject('villageJa')

// 利用者に見える枠の大きさ(px)。操作帯のスティックも role=application なので、枠の読み上げ名
// (use-village.ts の hintLabel。ポインタが細かい端末では text.hint)で枠だけを指す
const frameSize = () => {
  const { width, height } = page
    .getByRole('application', { name: villageJa.text.hint })
    .element()
    .getBoundingClientRect()
  return { width, height }
}

// 天気(Open-Meteo)にだけ晴れを返し、ほかの問い合わせは断る。テストが外へ出ていく道を残さない。
// 雨・雪・取得失敗を見るテストは、テストの中で stubWeather を敷き直して上書きする
beforeEach(() => {
  stubWeather('clear')
})

// どの describe が何を差し替えても、次のテストへ持ち越さないようここで毎回戻す
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  // CDP で替えたブラウザの環境(動きを控える設定・タッチ)
  await resetEmulation()
  // 村が本物の sessionStorage へ書いた位置と訪問を消し、何も保存していない状態へ戻す(消し方の正本は preferences.ts)。
  // 歩いた・話した後に残すと、同じページで後に描く村がその位置・訪問から始まる
  clearVillageProgress(villageJa.worldSet.id)
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
  })

  describe('自動移動の直線飛行', () => {
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
    const TOWN_ENTRY = exitWarp.target.cell
    // 町の自宅の扉(壁の扉。通れないマス)と、ぶつかった時に戻る部屋の出口手前
    const doorWarp = town.warps.find(w => w.target.worldId === room.id)
    if (doorWarp === undefined) throw new Error('町に部屋へ戻る扉が無い')
    // 地点の立ち位置。経歴碑は自宅前から真上寄りで、直線は自宅の屋根と壁の上を通る。
    // 研究所は自宅前から右上で、横の差の方が大きい。名刺工房 → 研究所は次へで巡る順
    const MONUMENT = spotCell(town, 'monument')
    const LAB = spotCell(town, 'lab')
    const MEISHI = spotCell(town, 'meishi')
    const MAILBOX = spotCell(town, 'mailbox')
    // 町で最も上(y が最小)の地点。北の道の突き当たりにあり、カメラは町の上端で止まる
    const TOP_SPOT = town.spots.reduce((top, spot) => (spot.cell.y < top.cell.y ? spot : top))
    const placeOf = (id: string) => {
      const stop = text.stops[id]
      if (stop === undefined) throw new Error(`地点 ${id} の文言が無い`)
      return stop.place
    }

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

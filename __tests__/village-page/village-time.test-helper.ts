// 村の統合テスト(village.integration.test.tsx)が時間を差し替える手順。段階ごとの瞬間・偽の時計の掛け方と、
// 段階が替わる時に読むシートの絵の取得(ネットワーク)の差し替えをここに置く。
// 描く道具(@testing-library/react・react-dom)はここから import しない(npm run test:boundary)。
// 偽の時計を外す(vi.useRealTimers)のと差し替えた Image を戻す(vi.unstubAllGlobals)のは、village.integration.test.tsx の
// ファイル先頭の afterEach が毎回行う。どの describe で掛けた時計も、次のテストへ持ち越さない
import { vi } from 'vitest'
import type { DayPhase } from '@/utils/day-phase'

// ---- 時間 ----

// 村は訪問者の時間帯を見ず、常に大阪時刻(JST = UTC+9 固定)で段階を決めるので、UTC の瞬間だけを決めれば足りる。
// 括弧内はその瞬間を JST に直した時刻(tests/day-night.spec.ts の PHASE_CLOCKS と同じ瞬間。昼は tests/village.helpers.ts の NOON_JST)
export const PHASE_CLOCKS: Record<DayPhase, string> = {
  // JST 2026-09-21 06:00 — 明け方の帯(5時〜7時)。UTC では前日の夜で、ずれの向きを一番よく突く
  dawn: '2026-09-20T21:00:00Z',
  // JST 2026-09-20 12:00 — 昼の帯(7時〜17時)
  day: '2026-09-20T03:00:00Z',
  // JST 2026-09-20 18:00 — 夕方の帯(17時〜19時)
  dusk: '2026-09-20T09:00:00Z',
  // JST 2026-09-20 22:00 — 夜の帯(19時〜翌5時)
  night: '2026-09-20T13:00:00Z',
}

// 偽の時計に載せる物。
//   frames: 替えられる時間の全部(rAF・performance.now・タイマー・Date)。E2E の page.clock.install に当たり、
//           テストが stepFrame(village-walk.test-helper.ts)で 1 フレーム(16ms)ずつ進めた分だけ経つ
//   date: Date だけ。E2E の page.clock.setFixedTime に当たり、rAF・タイマー・performance.now は本物のまま進む
//   phase-check: Date と setInterval。use-day-phase.ts が段階を 1 分ごとに確かめ直す時計を、テストが
//           vi.advanceTimersByTime で進める。setTimeout と rAF は本物のまま
//   frames-real-timeouts: rAF・performance.now・Date だけ。setTimeout は本物のまま本物の時間で走る。
//           テストがフレームを本物の時間より速く進めると、同じ時刻に予約したタイマーより先にフレームが来る
//           (実機で、フレームが先に来てタイマーが遅れて走るのと同じ順)。frames ではタイマーが先に走るので作れない
export type ClockScope = 'frames' | 'date' | 'phase-check' | 'frames-real-timeouts'
const CLOCK_SCOPES: Record<ClockScope, Parameters<typeof vi.useFakeTimers>[0]> = {
  // 既定の偽物(nextTick と queueMicrotask を除く全部)
  frames: undefined,
  date: { toFake: ['Date'] },
  'phase-check': { toFake: ['Date', 'setInterval', 'clearInterval'] },
  'frames-real-timeouts': {
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
  },
}

// 偽の時計を scope の範囲で入れ、at の瞬間に止める。描く前に呼ぶ(村が最初に読む時刻・rAF から偽物にする)
export const startVillageClock = (at: string, scope: ClockScope): void => {
  vi.useFakeTimers(CLOCK_SCOPES[scope])
  vi.setSystemTime(new Date(at))
}

// ---- 段階のシートの絵(ネットワーク) ----

// 差し替える前の Image。シートの取得を差し替えている間も、テスト自身が絵を読めるかを確かめるのに使う
export const RealImage = window.Image

// 段階のシートの絵の取得(ネットワーク)を差し替える。村は段階が替わる時、地形と主人公のシートが両方 decode できるまで
// 前の段階を残す(hooks/use-day-phase.ts)。統合テストはビルドしないので /sprites/ の PNG が無く(scripts/build-sprites.mjs が
// ビルドで焼く)、本物の取得はどれも失敗する。E2E が page.route で配信を差し替えるのと同じく、URL ごとの応答をテストが決める。
// respond が resolve すれば届いた、reject すれば 404 などで失敗した、決着しなければまだ届いていない。
// 村がシートを読むのは new Image() の src と decode() だけなので、その 2 つを持つ物に替える
export const routeSheets = (respond: (url: string) => Promise<void>): void => {
  class SheetImage {
    src = ''
    decode(): Promise<void> {
      return respond(this.src)
    }
  }
  vi.stubGlobal('Image', SheetImage)
}

// 村の統合テスト(__tests__/village-page の下の *.integration.test.tsx)が共有する準備と後始末。
// 村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// happy-dom は配置を計算せず ResizeObserver.observe() も実装が無いので、寸法に頼る振る舞いは統合テストで見る。
// 差し替えるのはネットワーク(天気の通信・段階のシートの絵の取得)と時間だけ。レイアウト・ResizeObserver・入力は本物を使う。
// 時間の差し替え方はファイルごとに違う(掛け方は village-time.test-helper.ts の startVillageClock):
//   - 歩く・待つ・釣り・傘・飛ぶを見るファイル(idle-loop・fishing・umbrella・flight-*・村の入力と道中の配線の各ファイルなど)は
//     rAF・performance.now・タイマー・Date を偽の時計に載せ(frames)、テストが 1 フレーム(16ms)ずつ進める
//     (傘の 1 件だけは setTimeout を本物のまま残し(frames-real-timeouts)、フレームをタイマーより先に進める)
//   - 昼夜と卓上時計のファイル(day-night・night-lights・desk-clock)は rAF・タイマー・performance.now を本物のまま使い、
//     段階を決めるテストだけ Date を止める(date)。開いたまま時間帯が替わる night-transition は Date と setInterval を止め(phase-check)、テストが進める
//   - 舞台の寸法・窓の焦点・会話窓の中身・拡大地図などのファイルは時間を差し替えない
//   - 状態コンテナのフォルダ(boot/ など)のテストで時間を差し替えるものは、そのファイルの中で vi.useFakeTimers を掛ける
// 偽の時計・差し替えた通信と Image・CDP で替えたブラウザの環境・卓上時計のストア・保存した位置は、下の resetVillage が毎回戻す
// (タッチの模擬を切った後の pointer・hover だけは戻り切らない。village-walk.test-helper.ts の resetEmulation の注。
// 模擬を使うファイルは自分だけのページで走るので、戻り切らない物もほかのファイルへは持ち越さない)。
// 描く道具(@testing-library/react・react-dom)はここから import しない(npm run test:boundary)。
// 各ファイルは beforeEach で prepareVillage を、afterEach で描いた物を cleanup で外した後に resetVillage を呼ぶ
import { inject } from 'vitest'
import { page } from 'vitest/browser'
import { clearVillageProgress } from '@/lib/preferences'
import { useVillageTime } from '@/components/VillagePage/hooks/use-village-time'
import { onOwnPage, resetEmulation, stubWeather } from './village-walk.test-helper'

// container.fixture.ts が node で組んで provide した村の props(ja)
export const villageJa = inject('villageJa')

// 利用者に見える枠の大きさ(px)。操作帯のスティックも role=application なので、枠の読み上げ名
// (use-village.ts の hintLabel。ポインタが細かい端末では text.hint)で枠だけを指す
export const frameSize = () => {
  const { width, height } = page
    .getByRole('application', { name: villageJa.text.hint })
    .element()
    .getBoundingClientRect()
  return { width, height }
}

// 各ファイルの beforeEach が呼ぶ。
// 天気(Open-Meteo)にだけ晴れを返し、ほかの問い合わせは断る。テストが外へ出ていく道を残さない。
// 雨・雪・取得失敗を見るテストは、テストの中で stubWeather を敷き直して上書きする
export const prepareVillage = (): void => {
  // 前提: どのテストもタッチ端末(pointer: coarse)ではない所から始まる。タッチのテストは、この後にテストの中か describe の
  // beforeEach で模擬を入れる。模擬を切った後は pointer: fine・hover: hover へ戻らない(resetEmulation の注)ので、
  // タッチの模擬を使うファイル(自分だけのページで走る。onOwnPage)で、タッチのテストより後の PC のテストが頼れるのは
  // coarse でないことだけで、それをここで確かめる
  expect(
    window.matchMedia('(pointer: coarse)').matches,
    '前提: 前のテストのタッチの模擬を持ち越していない'
  ).toBe(false)
  // タッチの模擬を使わないファイルは、ほかのファイルとページを共にする。そのページでは誰も模擬を入れないので、
  // 開いた時のマウスの端末(hover: hover・pointer: fine)のままのはずで、崩れていればほかのファイルが持ち込んだ
  if (!onOwnPage()) {
    expect(
      window.matchMedia('(hover: hover) and (pointer: fine)').matches,
      '前提: ほかのファイルがタッチの模擬を持ち込んでいない(ページはマウスの端末のまま)'
    ).toBe(true)
  }
  stubWeather('clear')
}

// 各ファイルの afterEach が、描いた物を cleanup で外した後に呼ぶ
// (effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)。
// どの describe が何を差し替えても、次のテストへ持ち越さないようここで毎回戻す
export const resetVillage = async (): Promise<void> => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  // CDP で替えたブラウザの環境(動きを控える設定・タッチ)
  await resetEmulation()
  // 卓上時計で決めた時刻はストア(メモリ)に残り、同じページで後に描く村がその時刻から始まる。何も決めていない状態へ戻す
  useVillageTime.getState().resetTimeState()
  // 村が本物の sessionStorage へ書いた位置と訪問を消し、何も保存していない状態へ戻す(消し方の正本は preferences.ts)。
  // 歩いた・話した後に残すと、同じページで後に描く村がその位置・訪問から始まる
  clearVillageProgress(villageJa.worldSet.id)
}

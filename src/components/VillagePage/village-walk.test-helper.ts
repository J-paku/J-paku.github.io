// 村の統合テスト(container.browser.test.tsx)で歩く・押す・待つ・保存された現在地と見え方を読む共通の手順。
// E2E の tests/village.helpers.ts と同じ押し方(1 マス分押して離し、到着を保存位置の変化で知る)で歩く。
// 時間はテストの describe ごとに 2 通りで進む(偽の時計の掛け方は village-time.test-helper.ts の startVillageClock)。
//   - rAF まで偽の時計に載せた時(frames): 1 フレーム(16ms)ずつ偽の時計を進める。歩行ループ・釣り・傘・飛行の時間割は
//     テストが進めた分だけ進み、実時間の揺れを受けない。React の確定は偽にしない MessageChannel で回るので、
//     フレームを進めるたびに本物のタスクで手番を渡す
//   - rAF が本物の時(Date だけ止めた時・偽の時計を入れない時): 本物の次のフレームを待つ
// どちらでも、時間を進める手(stepFrame・runFor・advanceUntil)とそれを使う手(walk・press など)は同じ物を使い、
// 経った時間は performance.now() で測る(rAF まで偽物の時は performance.now も偽の時計の上で進む)。
// 押す・叩くは実際の入力(vitest/browser の userEvent と CDP の Input)で行い、DOM へ作り物のイベントを投げない
import { cdp, userEvent } from 'vitest/browser'
import type { Cell } from '@content/types/world'
import { readPosition } from '@/lib/preferences'

// 押す長さと、離してから到着を待つ上限(tests/village.helpers.ts の HOLD_MS・SETTLE_MS と同じ値)。
// 短押しは旋回だけ(TURN_MS 64ms)なので、旋回を越えて 1 マス分の移動を始めるまで押す。
// 始まった移動は離しても最後まで進む(CELL_MS 256ms)。旋回から始めても押してから 64 + 256ms 余りで着くので、
// 離してから SETTLE_MS を過ぎても着かない回は、ぶつかって向きだけ変わった(= 進めなかった)とみなす
export const HOLD_MS = 150
export const SETTLE_MS = 320
// 時間で替わるもの(眠り・段階・到着)を待つ上限(E2E の SLACK_MS と同じ値。偽の時計なら偽の時計の上の ms)
export const SLACK_MS = 3_000
// 偽の rAF の間隔。偽の時計はこの単位で進める
export const FRAME_MS = 16

export type WalkKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

// 本物のタスクを 1 回渡す。React の予定(scheduler)も偽の時計が替えない MessageChannel で積まれるので、
// 同じ仕組みで後ろに並べば、先に積まれた確定はここで走り終えている。
// setTimeout で渡すと、入れ子が深くなった所で 4ms ずつ待たされる(偽の時計の外の本物の setTimeout でも同じ)
const yieldTask = () =>
  new Promise<void>(resolve => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(null)
  })

// 偽の時計が rAF を替えているか。このファイルを読んだ時点の rAF(偽の時計を入れるのは beforeEach かテストの中なので本物)と、
// 今の rAF を比べる。Date だけを止めた時は rAF が本物のままなので、本物の時間で進める
const realRequestFrame = window.requestAnimationFrame
const framesFaked = () => window.requestAnimationFrame !== realRequestFrame

// フレームを進めた直後(その回の rAF を全部呼んだ後、React が確定する前)に呼ぶ手。
// 飛行の記録がこの瞬間を写す。rAF の中で書く DOM と同じフレームの中の値になる
let afterFrame: (() => void) | null = null
export const onEachFrame = (hook: (() => void) | null) => {
  afterFrame = hook
}

// 1 フレーム進める。rAF まで偽物なら、偽の時計を 1 フレーム分進めてそのフレームの rAF と期限の来たタイマーを呼び、
// React が確定と effect を終えるまで手番を渡す(確定の 1 タスクと、その後に別のタスクで走る effect の分に、遊びを 1 回足して 3 回)。
// rAF が本物なら、本物の次のフレームを待つ
export const stepFrame = async () => {
  if (framesFaked()) {
    vi.advanceTimersByTime(FRAME_MS)
    afterFrame?.()
    await yieldTask()
    await yieldTask()
    await yieldTask()
    return
  }
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve())
  })
  afterFrame?.()
}

// ms が経つまでフレームを進める(偽の時計なら端数を 1 フレームに切り上げる)
export const runFor = async (ms: number) => {
  const until = performance.now() + ms
  while (performance.now() < until) await stepFrame()
}

// condition が真になるまで 1 フレームずつ進める。maxMs を越えても偽なら message で落とす
export const advanceUntil = async (
  condition: () => boolean,
  message: string,
  maxMs: number = SLACK_MS
) => {
  const until = performance.now() + maxMs
  while (!condition() && performance.now() < until) await stepFrame()
  expect(condition(), message).toBe(true)
}

const required = <T extends Element>(element: T | null, name: string): T => {
  if (element === null) throw new Error(`${name}が描かれていない`)
  return element
}

// 村の枠。操作帯のスティックも role=application なので data-village で枠を指す
export const villageFrame = () =>
  required(document.querySelector<HTMLElement>('[data-village]'), '村の枠')
export const villagePlayer = () =>
  required(document.querySelector<HTMLElement>('[data-village-player]'), '主人公')
// ワールドの層。data-world に描画済みのワールドが載る
export const worldLayer = () =>
  required(document.querySelector<HTMLElement>('[data-world]'), 'ワールドの層')

// 歩行ループが回っているか(running)眠っているか(idle)。create-animation-loop が枠へ書く
export const loopState = () => villageFrame().dataset.villageLoop

// 利用者に見えているか(E2E の toBeVisible と同じ見方: 箱が空でなく、計算値の visibility が hidden でない)
export const isVisible = (element: Element | null) => {
  if (element === null) return false
  const box = element.getBoundingClientRect()
  return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden'
}

// 要素が本当に描かれているか。昼夜の出し分けは CSS なので要素は昼も DOM に残り、「ある・ない」では判定できない。
// どの手段で消していても取り逃さないよう、display・visibility・不透明度・面積を先祖まで遡って見る
// (昼夜の灯りの検査を E2E からこの統合テストへ移した時に、E2E の物差しをそのまま写した。isVisible は自分の visibility しか見ない)
export const isPainted = (element: Element): boolean => {
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false
  const hidden = (node: Element | null): boolean => {
    if (node === null) return false
    const style = getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden') return true
    if (Number(style.opacity) === 0) return true
    return hidden(node.parentElement)
  }
  return !hidden(element)
}

// 窓の中で焦点を移せる要素(DOM 順)のうち、今の焦点が何番目か。並びの外(見出しなど)なら -1
export const focusIndex = (root: Element, selector: string): number =>
  Array.from(root.querySelectorAll(selector)).findIndex(
    element => element === document.activeElement
  )

// 起動の覆いが外れるまで時計を進め、キー操作を受け取る村の枠へ焦点を置く
export const focusVillage = async () => {
  await advanceUntil(() => document.getElementById('boot') === null, '起動の覆いが外れる')
  villageFrame().focus()
}

// 保存された現在地(ワールドとマス)。保存は到着したマスとワープの先でだけ走るので、
// 通れない所へぶつかった時はここの値が変わらない
export const readCell = (setId: string): { worldId: string; cell: Cell } | null => {
  const saved = readPosition(setId)
  return saved === null ? null : { worldId: saved.worldId, cell: saved.cell }
}

const savedText = (setId: string) => JSON.stringify(readPosition(setId))

// 方向キーを 1 マス分だけ押して離す。到着も描画も待たない
export const press = async (key: WalkKey) => {
  await userEvent.keyboard(`{${key}>}`)
  await runFor(HOLD_MS)
  await userEvent.keyboard(`{/${key}}`)
}

// 押しっぱなしの向きを rAF で読む経路(会話窓の本文送り・窓の外から焦点を入れる方向)へ、押した瞬間の 1 回として読ませる。
// 押してすぐ離すと、同じフレームの間に離されて rAF が向きを 1 度も読まないことがあるので、2 フレーム置いてから離す
// (押し続けた時の繰り返しは 300ms 先からなので、2 フレームでは始まらない)。歩くための 1 マス分の押し方は press
export const tapHeld = async (key: WalkKey) => {
  await userEvent.keyboard(`{${key}>}`)
  await runFor(FRAME_MS * 2)
  await userEvent.keyboard(`{/${key}}`)
}

// 方向キーで cells マス歩く。1 マスごとに押して離し、到着(保存位置の変化)を待ってから次へ進む。
// 戻り値は実際に到着したマス数(壁や水へ向きを変えただけの 1 回は数えない)
export const walk = async (setId: string, key: WalkKey, cells: number): Promise<number> => {
  let arrived = 0
  for (let i = 0; i < cells; i += 1) {
    const before = savedText(setId)
    await press(key)
    const until = performance.now() + SETTLE_MS
    let moved = false
    while (!moved && performance.now() < until) {
      await stepFrame()
      moved = savedText(setId) !== before
    }
    if (moved) {
      arrived += 1
      // 到着と同じフレームで積まれた描画が終わるまで 2 フレーム待つ
      await runFor(FRAME_MS * 2)
    }
  }
  return arrived
}

// 村は自室の開始マス (4,4) から始まる。下端の 1 マスのマット (4,7) へ下へ 3 マス歩いて乗ると、
// 町の自宅前 (14,12) へ下向きで出る
export const leaveRoom = (setId: string) => walk(setId, 'ArrowDown', 3)

// 歩行ループが眠るまで時計を進める。歩き終えてカメラが追い付き、時間で替わるコマが無くなれば眠る
export const expectLoopIdle = () => advanceUntil(() => loopState() === 'idle', '歩行ループが眠る')

// 主人公が枠の中で何マス目に立って見えるか(左上が 0)。シートは縦 1.5 マスで頭が半マス上へはみ出すので、
// 足元(下辺)から数える。マス寸法は枠の幅(10 列)から出す。位置は丸めずに返し、枠の箱とマス寸法も添える
export const playerOnScreen = () => {
  const frame = villageFrame().getBoundingClientRect()
  const player = villagePlayer().getBoundingClientRect()
  const cell = frame.width / 10
  return {
    frame,
    cell,
    x: (player.x - frame.x) / cell,
    y: (player.y + player.height - frame.y) / cell - 1,
  }
}

// ワールドのマスの真ん中が画面のどこに描かれているか(px)。ワールドの層の原点と --cell から出すので、
// カメラが動いた後でも今描かれている位置を指す。押す位置を決める時に使う
export const cellCenter = (cell: Cell) => {
  const layer = worldLayer()
  const origin = layer.getBoundingClientRect()
  const size = parseFloat(getComputedStyle(layer).getPropertyValue('--cell'))
  return { x: origin.x + (cell.x + 0.5) * size, y: origin.y + (cell.y + 0.5) * size }
}

// ---- 天気(通信の差し替え) ----

// Open-Meteo の問い合わせ先の頭(src/lib/weather.ts が組み立てる URL の頭)
const OPEN_METEO = 'https://api.open-meteo.com/'

// error は失敗応答(500)で、村はそれを「降らない」に丸める
export type WeatherKind = 'clear' | 'rain' | 'snow' | 'error'

// 応答の形は src/lib/weather.ts が受け付けるもの(tests/village.helpers.ts の CURRENT と同じ値)。
// 雪は降水にも 0 より大きい値を載せ、降雪を先に見る判定が落ちた時に雨へ化けるようにする
const CURRENT: Record<
  Exclude<WeatherKind, 'error'>,
  { precipitation: number; snowfall: number }
> = {
  clear: { precipitation: 0, snowfall: 0 },
  rain: { precipitation: 2.4, snowfall: 0 },
  snow: { precipitation: 1.2, snowfall: 0.8 },
}

// 天気にだけ決めた応答を返し、ほかの問い合わせは断る。ファイル先頭の beforeEach が敷く晴れを上書きする
// (後から stubGlobal した方が効く)。戻り値の calls() は天気へ実際に問い合わせが届いた回数で、
// 応答の前に数えて「まだ出ていない」を通してしまうのを防ぐ。
// 戻すのは container.browser.test.tsx の afterEach の vi.unstubAllGlobals
export const stubWeather = (kind: WeatherKind) => {
  let calls = 0
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const { url } = new Request(input)
    if (!url.startsWith(OPEN_METEO)) {
      throw new TypeError(`統合テストから外への問い合わせは断る: ${url}`)
    }
    calls += 1
    if (kind === 'error') return Response.json({}, { status: 500 })
    return Response.json({ current: CURRENT[kind] })
  })
  return { calls: () => calls }
}

// ---- ブラウザの環境(CDP)と実際の入力 ----

// 動きを控える設定。村は描いた時に一度だけ読むので、描く前に呼ぶ
export const emulateReducedMotion = () =>
  cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })

// タッチ端末(pointer: coarse)。E2E の hasTouch に当たる。描く前に呼ぶ。
// 同時に触れる指の数は既定で 1 本。2 本の指を置く検査(touches)だけ増やす
export const emulateTouch = (maxTouchPoints = 1) =>
  cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints })

// どちらの設定も外す。テストの後始末で呼ぶ。
// タッチの模擬を外しても pointer: fine・hover: hover には戻らず、どちらも none のまま同じページの後のテストへ残る。
// 開いた時の fine・hover は Playwright が headless の Chromium に渡す --blink-settings(primaryPointerType など)の値で、
// 模擬を外すと端末そのものの値(none)へ戻るとみられる(推定)。CDP で戻す手は見つからなかった(2026-10-15 の実測:
// Emulation.setEmitTouchEventsForMouse の false・setEmulatedMedia の pointer: fine と hover: hover・
// setDeviceMetricsOverride の mobile: false・clearDeviceMetricsOverride のどれでも none のまま。
// setTouchEmulationEnabled の maxTouchPoints: 0 は 1〜16 の外として CDP が断る)。
// 村の CSS とフックは pointer: coarse かどうかで分けるので、none でもマウスの端末と同じに描く
// (hover: hover and pointer: fine で隠すスティックは、帯ごと隠れている)。coarse へ戻っていないことは
// container.browser.test.tsx の先頭の beforeEach が、どのテストの始めにも前提として確かめる
export const resetEmulation = async () => {
  await cdp().send('Emulation.setEmulatedMedia', { features: [] })
  await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false })
}

// テストの描く iframe の中の座標を、CDP の Input が受け取るページの座標へ直す
const pagePoint = (x: number, y: number) => {
  const box = window.frameElement?.getBoundingClientRect()
  return { x: x + (box?.left ?? 0), y: y + (box?.top ?? 0) }
}

// 左ボタンのマウス(E2E の page.mouse)。押している間の移動は buttons に左を載せる
export const mouse = {
  down: (x: number, y: number) =>
    cdp().send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...pagePoint(x, y),
      button: 'left',
      buttons: 1,
      clickCount: 1,
    }),
  move: (x: number, y: number, pressed: boolean) =>
    cdp().send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...pagePoint(x, y),
      button: pressed ? 'left' : 'none',
      buttons: pressed ? 1 : 0,
    }),
  up: (x: number, y: number) =>
    cdp().send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...pagePoint(x, y),
      button: 'left',
      buttons: 0,
      clickCount: 1,
    }),
}

// 左ボタンで 1 回押す(E2E の page.mouse.click)
export const click = async (x: number, y: number) => {
  await mouse.move(x, y, false)
  await mouse.down(x, y)
  await mouse.up(x, y)
}

// 指を 1 本置く・動かす・離す。emulateTouch の後で使う
export const finger = {
  down: (x: number, y: number) =>
    cdp().send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pagePoint(x, y)] }),
  move: (x: number, y: number) =>
    cdp().send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pagePoint(x, y)] }),
  up: () => cdp().send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
}

// 指を何本か置いたまま動かす。points には今触れている指を id 付きで全部並べる。CDP は前の並びとの差から、
// 増えた指を置き・動いた指を動かし・並びから消えた指を離す。一部の指だけを離す時は、残す指だけを並べた touchMove を送る。
// touchEnd は指を並べずに送り、触れている指を全部離す(CDP は touchEnd に指を並べることを認めない)。
// emulateTouch に 2 以上を渡した後で使う
export type TouchPoint = { id: number; x: number; y: number }
export const touches = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: TouchPoint[]) =>
  cdp().send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(({ id, x, y }) => ({ id, ...pagePoint(x, y) })),
  })

// 指で 1 回叩く(E2E の page.touchscreen.tap)。emulateTouch の後で使う
export const tap = async (x: number, y: number) => {
  await finger.down(x, y)
  await finger.up()
}

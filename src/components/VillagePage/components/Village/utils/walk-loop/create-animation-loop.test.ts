// @vitest-environment happy-dom
// rAFの予約と眠り・起床を受け持つ部品(createAnimationLoop)のテスト。
// requestAnimationFrameは頼まれたフレームを溜めるだけの偽物に替え、テストが時刻を渡して1フレームずつ回す。
// performance.nowも固定し、経過の数え方(上限・負・眠っていた間)と枠のdata-village-loopを確かめる
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnimationLoop, type AnimationLoop } from './create-animation-loop'

type PendingFrame = { id: number; callback: FrameRequestCallback }

// 頼まれてまだ回していないフレーム
let pending: PendingFrame[] = []
let nextId = 1
// performance.nowが返す時刻
let clock = 1000

const requestFrame = vi.fn((callback: FrameRequestCallback): number => {
  const id = nextId
  nextId += 1
  pending.push({ id, callback })
  return id
})
const cancelFrame = vi.fn((id: number) => {
  pending = pending.filter(frame => frame.id !== id)
})

// 溜まっているフレームを、rAFが渡す時刻timeで1回ずつ回す
const runFrame = (time: number) => {
  const frames = pending
  pending = []
  frames.forEach(frame => frame.callback(time))
}

const makeFrameRef = () => ({ current: document.createElement('div') })

beforeEach(() => {
  pending = []
  nextId = 1
  clock = 1000
  requestFrame.mockClear()
  cancelFrame.mockClear()
  vi.stubGlobal('requestAnimationFrame', requestFrame)
  vi.stubGlobal('cancelAnimationFrame', cancelFrame)
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createAnimationLoop', () => {
  it('startは最初のフレームを頼み、枠をrunningにする', () => {
    const frameRef = makeFrameRef()
    const tick = vi.fn((_elapsed: number) => true)
    createAnimationLoop(tick, frameRef).start()
    expect(requestFrame).toHaveBeenCalledTimes(1)
    expect(pending).toHaveLength(1)
    expect(tick).not.toHaveBeenCalled()
    expect(frameRef.current.dataset.villageLoop).toBe('running')
  })

  it('tickがtrueを返す間は次のフレームを頼み続け、runningのまま', () => {
    const frameRef = makeFrameRef()
    const tick = vi.fn((_elapsed: number) => true)
    createAnimationLoop(tick, frameRef).start()
    runFrame(1016)
    runFrame(1032)
    expect(tick).toHaveBeenCalledTimes(2)
    expect(requestFrame).toHaveBeenCalledTimes(3)
    expect(pending).toHaveLength(1)
    expect(frameRef.current.dataset.villageLoop).toBe('running')
  })

  it('tickがfalseを返したら次を頼まずに眠り、枠をidleにする', () => {
    const frameRef = makeFrameRef()
    createAnimationLoop(() => false, frameRef).start()
    runFrame(1016)
    expect(requestFrame).toHaveBeenCalledTimes(1)
    expect(pending).toHaveLength(0)
    expect(frameRef.current.dataset.villageLoop).toBe('idle')
  })

  it('経過は前のフレームからの差で、250msを上限にし、時刻が戻っても負にしない', () => {
    // 作った時刻は1000
    const tick = vi.fn((_elapsed: number) => true)
    createAnimationLoop(tick, makeFrameRef()).start()
    runFrame(1016)
    // タブ復帰などで400ms空いても250msまで
    runFrame(1416)
    // 前のフレームより早い時刻が来ても0
    runFrame(1400)
    // 上限ちょうどは切らない
    runFrame(1650)
    expect(tick.mock.calls.map(([elapsed]) => elapsed)).toEqual([16, 250, 0, 250])
  })

  it('眠っている間にwakeすると次のフレームを頼んでrunningに戻し、経過は起こした時刻から数える', () => {
    const frameRef = makeFrameRef()
    const tick = vi.fn((_elapsed: number) => false)
    const loop = createAnimationLoop(tick, frameRef)
    loop.start()
    runFrame(1016)
    expect(frameRef.current.dataset.villageLoop).toBe('idle')

    // 4秒眠った後に起こす。眠っていた間を数えると上限の250msになる
    clock = 5000
    loop.wake()
    expect(requestFrame).toHaveBeenCalledTimes(2)
    expect(frameRef.current.dataset.villageLoop).toBe('running')
    runFrame(5020)
    expect(tick).toHaveBeenLastCalledWith(20)
  })

  it('回っている間のwakeはフレームを二重に頼まない', () => {
    const loop = createAnimationLoop(() => true, makeFrameRef())
    loop.start()
    loop.wake()
    expect(requestFrame).toHaveBeenCalledTimes(1)
    runFrame(1016)
    loop.wake()
    expect(requestFrame).toHaveBeenCalledTimes(2)
    expect(pending).toHaveLength(1)
  })

  it('フレームの処理中に起こされたら、tickがfalseでも眠らずにもう1フレーム回す', () => {
    const frameRef = makeFrameRef()
    // 1フレーム目だけ処理中にwakeを呼ぶ(到着でワールドが替わった形)
    let wakeInside = true
    const loop: AnimationLoop = createAnimationLoop(() => {
      if (wakeInside) loop.wake()
      wakeInside = false
      return false
    }, frameRef)
    loop.start()
    runFrame(1016)
    // 処理中のwakeは自分では頼まず、終わった所で1回だけ頼む
    expect(requestFrame).toHaveBeenCalledTimes(2)
    expect(pending).toHaveLength(1)
    expect(frameRef.current.dataset.villageLoop).toBe('running')

    runFrame(1032)
    expect(pending).toHaveLength(0)
    expect(frameRef.current.dataset.villageLoop).toBe('idle')
  })

  it('tickが投げても、次のwakeで回り直せる', () => {
    let fail = true
    const tick = vi.fn((_elapsed: number) => {
      if (fail) throw new Error('描画の失敗')
      return true
    })
    const loop = createAnimationLoop(tick, makeFrameRef())
    loop.start()
    expect(() => runFrame(1016)).toThrow('描画の失敗')
    expect(pending).toHaveLength(0)

    fail = false
    loop.wake()
    expect(requestFrame).toHaveBeenCalledTimes(2)
    runFrame(1032)
    expect(tick).toHaveBeenCalledTimes(2)
  })

  it('stopは頼んであるフレームを取り消す', () => {
    const tick = vi.fn((_elapsed: number) => true)
    const loop = createAnimationLoop(tick, makeFrameRef())
    loop.start()
    loop.stop()
    expect(cancelFrame).toHaveBeenCalledTimes(1)
    expect(cancelFrame).toHaveBeenCalledWith(1)
    runFrame(1016)
    expect(tick).not.toHaveBeenCalled()
  })

  it('眠っている間のstopは何も取り消さない', () => {
    const loop = createAnimationLoop(() => false, makeFrameRef())
    loop.start()
    runFrame(1016)
    loop.stop()
    expect(cancelFrame).not.toHaveBeenCalled()
  })

  it('枠の印は変わった時だけ書く', () => {
    // 前のループ(開発時のeffectの二度実行など)が既にrunningを書いた枠
    const frameRef = makeFrameRef()
    frameRef.current.dataset.villageLoop = 'running'
    const observer = new MutationObserver(() => {})
    observer.observe(frameRef.current, { attributes: true })
    createAnimationLoop(() => false, frameRef).start()
    expect(observer.takeRecords()).toHaveLength(0)
    // 眠る時はidleへ変わるので1回書く
    runFrame(1016)
    expect(observer.takeRecords().map(record => record.attributeName)).toEqual([
      'data-village-loop',
    ])
    observer.disconnect()
  })

  it('枠がまだ無くても回り、眠り・起床で投げない', () => {
    const tick = vi.fn((_elapsed: number) => false)
    const loop = createAnimationLoop(tick, { current: null })
    loop.start()
    runFrame(1016)
    loop.wake()
    runFrame(1032)
    expect(tick).toHaveBeenCalledTimes(2)
  })
})

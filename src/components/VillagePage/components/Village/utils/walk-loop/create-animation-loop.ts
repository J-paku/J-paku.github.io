// rAF の予約と、眠り・起床の切り替えだけを受け持つ。1 フレームで何をするかは tick に任せ、
// ここは「次のフレームを頼むか眠るか」と「眠っている間を経過に数えない」ことだけを守る。
// 入力も経路も無く描き終えたら次のフレームを頼まずに眠り、wake で起こされる
import type { RefObject } from 'react'

// ループが回っているか眠っているかを枠の data-village-loop に出す。E2E が眠りを確かめる取っ手で、
// 止まらない・起きない不具合を DevTools で追う手掛かりにもなる。変わった時だけ書く
const markLoop = (frame: HTMLElement | null, state: 'running' | 'idle') => {
  if (frame === null || frame.dataset.villageLoop === state) return
  frame.dataset.villageLoop = state
}

export type AnimationLoop = {
  // 眠っていれば次のフレームを頼む
  wake: () => void
  // 最初のフレームを頼む
  start: () => void
  // 頼んであるフレームを取り消す
  stop: () => void
}

// tick は 1 フレーム分進めて描き、まだ時間で変わるもの・読むべき入力が残っていれば true を返す
export const createAnimationLoop = (
  tick: (elapsed: number) => boolean,
  frameRef: RefObject<HTMLElement | null>
): AnimationLoop => {
  // 頼んである次のフレーム。null は眠っている(またはフレームの処理中)
  let raf: number | null = null
  // フレームの処理中か。処理中に起こされた時は(到着でワールドが替わった等)眠るのを 1 回見送る
  let inFrame = false
  let wokenInFrame = false
  let last = performance.now()

  const loop = (now: number) => {
    raf = null
    // 長いフレーム(タブ復帰など)で一気に進まないよう上限を置く。
    // 起こした直後は起こした時刻から数えるので、同じフレームの中で起こされると負になりうる
    const elapsed = Math.min(Math.max(now - last, 0), 250)
    last = now
    inFrame = true
    wokenInFrame = false
    let busy = true
    try {
      busy = tick(elapsed)
    } finally {
      // 途中で投げても、次に起こされた時に回り直せるようにする
      inFrame = false
    }
    if (busy || wokenInFrame) {
      raf = window.requestAnimationFrame(loop)
      return
    }
    markLoop(frameRef.current, 'idle')
  }

  // 眠っていれば次のフレームを頼む。回っている間は何もしない
  const wake = () => {
    if (inFrame) {
      wokenInFrame = true
      return
    }
    if (raf !== null) return
    // 眠っていた間を 1 フレームの経過として数えない
    last = performance.now()
    raf = window.requestAnimationFrame(loop)
    markLoop(frameRef.current, 'running')
  }

  const start = () => {
    markLoop(frameRef.current, 'running')
    raf = window.requestAnimationFrame(loop)
  }

  const stop = () => {
    if (raf !== null) window.cancelAnimationFrame(raf)
  }

  return { wake, start, stop }
}

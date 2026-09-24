// 押しっぱなしの方向(ジョイスティック・会話中の方向キーが ref へ書く)を毎フレーム読み、
// 押している間だけ onHeld を呼ぶ。会話窓(StopModal)と卓上時計の窓(ClockModal)が同じ入力を読むので、
// rAF の回し方・眠り方・「押した瞬間」の判定はここ 1 か所に置く(片方だけ直すと操作感が食い違う)。
// React state を経由させない(押している間ずっと再レンダーになる)。
// 離している間は次のフレームを頼まずに眠り、キー・ポインタの入力で起きる
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import type { Direction } from '@content/types/world'

type UseHeldDirectionParams = {
  // 押しっぱなしの方向。村の入力(use-village-input)が書き、ここは読むだけ
  heldRef: RefObject<Direction | null>
  // 押している間の毎フレーム呼ぶ。pressed は「今フレームが押した瞬間(前フレームと違う向き)か」、
  // now は rAF の時刻(ms)で、押し続けた時の繰り返し間隔を測るのに使う
  onHeld: (direction: Direction, pressed: boolean, now: number) => void
}

export function useHeldDirection({ heldRef, onHeld }: UseHeldDirectionParams) {
  // 呼び出し側は描画ごとに新しい関数を渡してくる(段階や値を閉じ込めるため)。
  // それをループの依存にすると描画のたびに回し直しになり、前フレームの向きを忘れて
  // 押しっぱなしを「押した瞬間」と読み直してしまうので、最新の関数は ref 越しに読む
  const onHeldRef = useRef(onHeld)
  useEffect(() => {
    onHeldRef.current = onHeld
  })

  // 閉じたら(アンマウントで)止まる
  useEffect(() => {
    // 前フレームの方向。押した瞬間(前フレームと違う向き)だけを1回の操作として数える。
    // 初期値は null ではなく今この瞬間の向き。次へで自動歩行している間も下を押し続けていると、
    // 開いた直後の1フレーム目が null → down を新しい押下と読み、いきなり焦点を渡してしまう
    let previous: Direction | null = heldRef.current
    // 頼んである次のフレーム。null は眠っている
    let frame: number | null = null

    const step = (now: number) => {
      frame = null
      const direction = heldRef.current
      const pressed = direction !== null && direction !== previous
      previous = direction
      // 離しているフレームは離したことだけ覚えて眠る。押されたら下の wake が回し直す
      if (direction === null) return
      onHeldRef.current(direction, pressed, now)
      frame = requestAnimationFrame(step)
    }

    // 押した向きは村の入力(キー・スティック)が ref へ書くだけで、ここへ知らせは来ない。
    // どの向きもキー・ポインタの入力から始まるので、それを合図に 1 フレーム回して ref を読み直す。
    // 読むのは入力を配り終えた後の rAF なので、書く側のハンドラより先にここが呼ばれても取りこぼさない
    const wake = (event: Event) => {
      if (frame !== null) return
      // ボタンを押していないポインタ(マウスを動かしただけ)では向きは変わらない
      if (event instanceof PointerEvent && event.buttons === 0) return
      frame = requestAnimationFrame(step)
    }
    // 捕捉段で受ける。途中で伝播を止められても合図を取りこぼさない
    window.addEventListener('keydown', wake, true)
    window.addEventListener('pointerdown', wake, true)
    window.addEventListener('pointermove', wake, true)
    // 開く前から押されていた向きがあれば、開いた直後から回す(離していれば最初のフレームで眠る)
    frame = requestAnimationFrame(step)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      window.removeEventListener('keydown', wake, true)
      window.removeEventListener('pointerdown', wake, true)
      window.removeEventListener('pointermove', wake, true)
    }
  }, [heldRef])
}

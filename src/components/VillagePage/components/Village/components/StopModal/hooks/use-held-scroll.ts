// 押しっぱなしの方向を毎フレーム読み、本文(パネル)のスクロール位置へ直接書く。
// React state を経由させない(押している間ずっと再レンダーになる)。
// 本文を下端まで送り切った後の「下」は送る先が無いので、代わりに窓の中のボタン・リンクへ
// 焦点を1つずつ渡す。送り先の割り振りは1フレームに1つの判断なので、この1本のループで持つ。
// 離している間は次のフレームを頼まずに眠り、キー・ポインタの入力で起きる
import { useEffect } from 'react'
import type { RefObject } from 'react'

import type { Direction } from '@content/types/world'

import { focusablesIn } from '../focusables'

// 押しっぱなしの間、1フレームで動かす本文スクロール量(px)
const SCROLL_STEP = 6

// 戻る向き(上・左)を押しっぱなしにした間、焦点を1つ前へ移し直す間隔(ms)。人が枠の移りを見てから
// 手を離すまで(反応はおよそ 0.2〜0.25 秒)より長くし、ボタンを1つずつ遡るのを目で追って止められるようにする
const FOCUS_BACK_REPEAT_MS = 300

// 下端判定の遊び(px)。scrollTop は小数を持つので、等号では下端に着いても一致しない
const BOTTOM_SLACK = 1

type UseHeldScrollParams = {
  // 焦点を送る範囲。操作ボタンはパネルの外にあるので、根はパネルではなく窓全体
  dialogRef: RefObject<HTMLElement | null>
  panelRef: RefObject<HTMLElement | null>
  // 本文へ戻す先。見出し(tabIndex -1)に焦点がある間が「本文を読んでいる」状態
  titleRef: RefObject<HTMLElement | null>
  // 押しっぱなしの方向。右・下で進み、左・上で戻る
  scrollHeldRef: RefObject<Direction | null>
}

const isAtBottom = (panel: HTMLElement) =>
  panel.scrollTop + panel.clientHeight >= panel.scrollHeight - BOTTOM_SLACK

export function useHeldScroll({
  dialogRef,
  panelRef,
  titleRef,
  scrollHeldRef,
}: UseHeldScrollParams) {
  // ジョイスティック・矢印キーの押しっぱなしで本文を送る。閉じたら(アンマウントで)止まる
  useEffect(() => {
    // 前フレームの方向。押した瞬間(前フレームと違う向き)だけを1回の操作として数える。
    // 前へ(下・右)の焦点送りはこの1回だけに反応させ、押しっぱなしで最後まで流れて行かないようにする。
    // 初期値は null ではなく今この瞬間の向き。次へで自動歩行している間も下を押し続けていると、
    // 開いた直後の1フレーム目が null → down を新しい押下と読み、いきなり焦点を渡してしまう
    let previous: Direction | null = scrollHeldRef.current
    // 戻る向きで最後に焦点を移した rAF 時刻。押した瞬間の移動で置き、離す・向きを変えると空に戻す。
    // 空の間は押しっぱなしでも遡らない(開く前から押されていた向きでは動かさない)
    let backMovedAt: number | null = null
    // 頼んである次のフレーム。null は眠っている
    let frame: number | null = null

    // pressed は「今フレームが押した瞬間か」。下端到達時以外の前への焦点送りは押した瞬間だけ。
    // now は rAF の時刻(ms)で、戻る焦点送りを繰り返す間隔を測る
    const advance = (direction: 'up' | 'down', pressed: boolean, now: number) => {
      const panel = panelRef.current
      const dialog = dialogRef.current
      if (panel === null || dialog === null) return

      const focusables = focusablesIn(dialog)
      const active = document.activeElement
      const index = focusables.findIndex(element => element === active)

      // 焦点がボタン・リンクに移っている間は本文を送らない(下端で動かないうえ、
      // 焦点を移した拍子のスクロールと競合する)。上下はそのまま焦点の行き来に使う
      if (index >= 0) {
        if (direction === 'down') {
          if (pressed) focusables[Math.min(index + 1, focusables.length - 1)].focus()
          return
        }
        // 戻る向きは押した瞬間にすぐ1つ、押し続ければ FOCUS_BACK_REPEAT_MS ごとにもう1つ遡る
        const repeatDue = backMovedAt !== null && now - backMovedAt >= FOCUS_BACK_REPEAT_MS
        if (!pressed && !repeatDue) return
        backMovedAt = now
        // 先頭から上は本文へ戻す。押し続ければ次のフレームから本文が送られる。
        // preventScroll を付けないと見出しが見える位置まで本文が一気に巻き戻る
        if (index === 0) titleRef.current?.focus({ preventScroll: true })
        else focusables[index - 1].focus()
        return
      }

      // 既に下端なら新しい押下だけで渡す。開く前から押されていた方向では飛ばさない
      if (direction === 'down' && isAtBottom(panel)) {
        if (pressed) focusables[0]?.focus()
        return
      }

      panel.scrollTop += direction === 'down' ? SCROLL_STEP : -SCROLL_STEP
      // 押し直しを待たず、送り切ったフレームで最初の対象へ渡す
      if (direction === 'down' && isAtBottom(panel)) focusables[0]?.focus()
    }

    const step = (now: number) => {
      frame = null
      const direction = scrollHeldRef.current
      const pressed = direction !== null && direction !== previous
      // 離した・向きを変えたら繰り返しの起点を捨て、次は押した瞬間から数え直す
      if (direction !== previous) backMovedAt = null
      previous = direction
      // 離しているフレームは離したことだけ覚えて眠る。押されたら下の wake が回し直す
      if (direction === null) return
      advance(direction === 'down' || direction === 'right' ? 'down' : 'up', pressed, now)
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
    // 開く前から押されていた向きがあれば、開いた直後から送る(離していれば最初のフレームで眠る)
    frame = requestAnimationFrame(step)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      window.removeEventListener('keydown', wake, true)
      window.removeEventListener('pointerdown', wake, true)
      window.removeEventListener('pointermove', wake, true)
    }
  }, [dialogRef, panelRef, scrollHeldRef, titleRef])
}

// 押しっぱなしの方向を毎フレーム読み、本文(パネル)のスクロール位置へ直接書く。
// React state を経由させない(押している間ずっと再レンダーになる)。
// 本文を下端まで送り切った後の「下」は送る先が無いので、代わりに窓の中のボタン・リンクへ
// 焦点を1つずつ渡す。送り先の割り振りは1フレームに1つの判断なので、この1本のループで持つ。
// ループの回し方・眠り方・押した瞬間の判定は卓上時計の窓と共用の use-held-direction が持つ
import { useRef } from 'react'
import type { RefObject } from 'react'

import type { Direction } from '@content/types/world'

import { useHeldDirection } from '../../../hooks/use-held-direction'
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
  // 戻る向きで最後に焦点を移した rAF 時刻。押した瞬間の移動で置き、押し直す・向きを変えると空に戻す。
  // 空の間は押しっぱなしでも遡らない(開く前から押されていた向きでは動かさない)
  const backMovedAtRef = useRef<number | null>(null)

  // pressed は「今フレームが押した瞬間か」。下端到達時以外の前への焦点送りは押した瞬間だけ。
  // 前へ(下・右)の焦点送りはこの1回だけに反応させ、押しっぱなしで最後まで流れて行かないようにする。
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
      const backMovedAt = backMovedAtRef.current
      const repeatDue = backMovedAt !== null && now - backMovedAt >= FOCUS_BACK_REPEAT_MS
      if (!pressed && !repeatDue) return
      backMovedAtRef.current = now
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

  // ジョイスティック・矢印キーの押しっぱなしで本文を送る。閉じたら(アンマウントで)止まる
  useHeldDirection({
    heldRef: scrollHeldRef,
    onHeld: (direction, pressed, now) => {
      // 押し直した・向きを変えたら繰り返しの起点を捨て、押した瞬間から数え直す。
      // 共用ループへ移す前は「前フレームと向きが違えば(離した時も)空に戻す」だったが、起点を読むのは
      // 押している間だけで、離した後の最初の押下は必ず pressed になる。離した時の初期化は次の押下が
      // 代わりに行うので、pressed の時だけ空に戻しても読む値は変わらない
      if (pressed) backMovedAtRef.current = null
      advance(direction === 'down' || direction === 'right' ? 'down' : 'up', pressed, now)
    },
  })
}

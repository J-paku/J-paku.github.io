// 押しっぱなしの方向を毎フレーム読み、本文(パネル)のスクロール位置へ直接書く。
// React state を経由させない(押している間ずっと再レンダーになる)。
// 本文を下端まで送り切った後の「下」は送る先が無いので、代わりに窓の中のボタン・リンクへ
// 焦点を1つずつ渡す。送り先の割り振りは1フレームに1つの判断なので、この1本のループで持つ
import { useEffect } from 'react'
import type { RefObject } from 'react'

import type { Direction } from '@content/types/world'

import { focusablesIn } from '../focusables'

// 押しっぱなしの間、1フレームで動かす本文スクロール量(px)
const SCROLL_STEP = 6

// 下端判定の遊び(px)。scrollTop は小数を持つので、等号では下端に着いても一致しない
const BOTTOM_SLACK = 1

type UseHeldScrollParams = {
  // 焦点を送る範囲。操作ボタンはパネルの外にあるので、根はパネルではなく窓全体
  dialogRef: RefObject<HTMLElement | null>
  panelRef: RefObject<HTMLElement | null>
  // 本文へ戻す先。見出し(tabIndex -1)に焦点がある間が「本文を読んでいる」状態
  titleRef: RefObject<HTMLElement | null>
  // 押しっぱなしの方向。ロック中(このモーダルが開いている間)の上下は本文スクロールに使う
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
    // 焦点送りはこの1回だけに反応させ、押しっぱなしで最後まで流れて行かないようにする。
    // 初期値は null ではなく今この瞬間の向き。次へで自動歩行している間も下を押し続けていると、
    // 開いた直後の1フレーム目が null → down を新しい押下と読み、いきなり焦点を渡してしまう
    let previous: Direction | null = scrollHeldRef.current
    let frame: number

    // pressed は「今フレームが押した瞬間か」。本文送りは毎フレーム、焦点送りは押した瞬間だけ
    const advance = (direction: 'up' | 'down', pressed: boolean) => {
      const panel = panelRef.current
      const dialog = dialogRef.current
      if (panel === null || dialog === null) return

      const focusables = focusablesIn(dialog)
      const active = document.activeElement
      const index = focusables.findIndex(element => element === active)

      // 焦点がボタン・リンクに移っている間は本文を送らない(下端で動かないうえ、
      // 焦点を移した拍子のスクロールと競合する)。上下はそのまま焦点の行き来に使う
      if (index >= 0) {
        if (!pressed) return
        if (direction === 'down') {
          focusables[Math.min(index + 1, focusables.length - 1)].focus()
          return
        }
        // 先頭から上は本文へ戻す。見出しへ移せば、次の上からはまた本文が送られる。
        // preventScroll を付けないと見出しが見える位置まで本文が一気に巻き戻る
        if (index === 0) titleRef.current?.focus({ preventScroll: true })
        else focusables[index - 1].focus()
        return
      }

      // 本文が下端(または短くて送る必要が無い)なら、下は焦点をボタンへ渡す。1回の押下で1つだけ
      if (direction === 'down' && isAtBottom(panel)) {
        if (pressed) focusables[0]?.focus()
        return
      }

      panel.scrollTop += direction === 'down' ? SCROLL_STEP : -SCROLL_STEP
    }

    const step = () => {
      const direction = scrollHeldRef.current
      const pressed = direction !== null && direction !== previous
      previous = direction
      if (direction === 'up' || direction === 'down') advance(direction, pressed)
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [dialogRef, panelRef, scrollHeldRef, titleRef])
}

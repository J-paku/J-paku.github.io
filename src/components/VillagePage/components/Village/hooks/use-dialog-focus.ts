// 重ね表示の窓に共通の焦点まわり。開いた時に返却先を控えて閉じた時にそこへ戻し、Tab はこの窓の中で回す
import { useEffect } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

import { focusablesIn } from '../utils/focusables'

type UseDialogFocusParams = {
  // 開いている間だけ返却先を控える。窓は開いている間だけ描かれるので、呼び出し元は今のところ常に true
  open: boolean
  // Tab の輪を回す根。この中の selector に合う要素を DOM 順に並べる
  rootRef: RefObject<HTMLElement | null>
  selector: string
  // 閉じた時に戻す先。マウント時(開いた時)の値を控える
  returnTo: RefObject<HTMLElement | null>
  // 開いた時に最初に焦点を置く所。段階で置き場所が変わる窓は渡さず、呼び出し元が自分で置く
  initialFocusRef?: RefObject<HTMLElement | null>
  // 並びの外で輪の先頭と同じに扱う所(tabIndex -1 の見出しなど)。ここで Shift+Tab を押すと末尾へ回す
  leadRef?: RefObject<HTMLElement | null>
}

// 戻り値は onKeyDown の中から呼ぶ Tab の手。Tab だった時は true を返す(呼び出し元はそこで打ち切る)
export function useDialogFocus({
  open,
  rootRef,
  selector,
  returnTo,
  initialFocusRef,
  leadRef,
}: UseDialogFocusParams): (event: KeyboardEvent<HTMLElement>) => boolean {
  // 返却先はマウント時に控え、アンマウントの片付けでそこへ戻す
  useEffect(() => {
    if (!open) return
    const returnTarget = returnTo.current
    initialFocusRef?.current?.focus()

    return () => {
      returnTarget?.focus()
    }
  }, [open, returnTo, initialFocusRef])

  const trapTab = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return false

    const root = rootRef.current
    if (root === null) return true
    const focusable = focusablesIn(root, selector)
    if (focusable.length === 0) return true

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (
      event.shiftKey &&
      (active === first || (leadRef !== undefined && active === leadRef.current))
    ) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
    return true
  }

  return trapTab
}

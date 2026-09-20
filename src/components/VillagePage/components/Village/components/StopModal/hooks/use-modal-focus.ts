// 会話窓の焦点まわり。開いた時は見出しへ移し、閉じた時は開く前にいた所へ戻す。
// 開いている間は Esc で閉じ、Tab はこの窓の中で回す
import { useEffect } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

import { focusablesIn } from '../focusables'

type UseModalFocusParams = {
  titleRef: RefObject<HTMLHeadingElement | null>
  returnTo: RefObject<HTMLElement | null>
  onClose: () => void
}

export function useModalFocus({ titleRef, returnTo, onClose }: UseModalFocusParams) {
  // 返却先はマウント時に控え、アンマウントの片付けでそこへ戻す。
  // 完走の演出(一覧への案内)はこの戻しを上書きする側なので、呼び出し元が次フレームまで待っている
  useEffect(() => {
    const returnTarget = returnTo.current
    titleRef.current?.focus()

    return () => {
      returnTarget?.focus()
    }
  }, [returnTo, titleRef])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const focusable = focusablesIn(event.currentTarget)
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === titleRef.current)
    ) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return handleKeyDown
}

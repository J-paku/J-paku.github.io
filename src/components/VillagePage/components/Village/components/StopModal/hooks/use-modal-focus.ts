// 会話窓の焦点まわり。開いた時は見出しへ移し、閉じた時は開く前にいた所へ戻す。
// 開いている間は Esc で閉じ、Tab はこの窓の中で回す(戻しと Tab の輪は use-dialog-focus が持つ)
import type { KeyboardEvent, RefObject } from 'react'

import { useDialogFocus } from '../../../hooks/use-dialog-focus'
import { STOP_FOCUSABLE_SELECTOR } from '../../../utils/focusables'

type UseModalFocusParams = {
  dialogRef: RefObject<HTMLDivElement | null>
  titleRef: RefObject<HTMLHeadingElement | null>
  returnTo: RefObject<HTMLElement | null>
  onClose: () => void
}

export function useModalFocus({ dialogRef, titleRef, returnTo, onClose }: UseModalFocusParams) {
  // 返却先はマウント時に控え、アンマウントの片付けでそこへ戻す。
  // 完走の演出(一覧への案内)はこの戻しを上書きする側なので、呼び出し元が次フレームまで待っている
  const trapTab = useDialogFocus({
    open: true,
    rootRef: dialogRef,
    selector: STOP_FOCUSABLE_SELECTOR,
    returnTo,
    initialFocusRef: titleRef,
    // 見出しは並びの外(tabIndex -1)だが、ここで Shift+Tab を押しても末尾へ回す
    leadRef: titleRef,
  })

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    trapTab(event)
  }

  return handleKeyDown
}

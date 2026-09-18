// ネイティブ<dialog>の開閉まわり(showModalと初期フォーカス・背景スクロール固定・スクリムクリック)を担う
import { useEffect } from 'react'
import type { MouseEvent, RefObject } from 'react'

type UseModalDialogParams = {
  dialogRef: RefObject<HTMLDialogElement | null>
  closeButtonRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}

export function useModalDialog({ dialogRef, closeButtonRef, onClose }: UseModalDialogParams) {
  // マウント時にネイティブモーダルとして開き、閉じるボタンへフォーカスを移す。
  // StrictMode の二重実行対策として、既に open な場合は showModal を呼び直さない
  useEffect(() => {
    const dialogElement = dialogRef.current
    if (dialogElement === null) return
    if (!dialogElement.open) dialogElement.showModal()
    closeButtonRef.current?.focus()
  }, [dialogRef, closeButtonRef])

  // 開いている間は背景を固定する(top-layer に載っても背景スクロールは自動では止まらない)。
  // 復帰値は「開く直前の値」を保存し、閉じたら必ずそれへ戻す
  // (他の要因で overflow が変わっていても、このモーダルの分だけを正確に打ち消して漏れを防ぐ)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  // dialog 要素自身が click の target ならスクリム(余白)クリック、
  // panel 側の子孫が target なら内容クリックなので閉じない(stopPropagation 不要の判定)
  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose()
  }

  return handleDialogClick
}

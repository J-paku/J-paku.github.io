// ネイティブ<dialog>の開閉まわり(showModalと初期フォーカス・背景スクロール固定・スクリムクリック)を担う
import { useCallback, useEffect } from 'react'
import type { MouseEvent, RefObject } from 'react'

type UseModalDialogParams = {
  closeButtonRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}

export function useModalDialog({ closeButtonRef, onClose }: UseModalDialogParams) {
  // dialog の要素が付いた時にネイティブモーダルとして開き、閉じるボタンへフォーカスを移す。
  // ref のコールバックは要素が付いた時に要素を受け取って呼ばれ、片付けを返すので外れる時に null で呼ばれない(要素が無い場合は来ない)。
  // 閉じるボタンは dialog の子なので、その ref は dialog の ref より先に付いている。
  // 付く時機(commit の中)は、下の背景の固定と自動送り(use-scene-carousel)の effect より前で、この順は前と変わらない。
  // StrictMode の二重実行対策として、既に open な場合は showModal を呼び直さない
  const attachDialog = useCallback(
    (dialogElement: HTMLDialogElement) => {
      if (!dialogElement.open) dialogElement.showModal()
      closeButtonRef.current?.focus()
      // 外れる時に戻すものは無い(dialog は文書から外れると閉じる)
      return () => {}
    },
    [closeButtonRef]
  )

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
  // panel 側の子孫が target なら内容クリックなので閉じない(stopPropagation 不要の判定)。
  // この処理は dialog に付けるので、currentTarget は dialog 要素自身
  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  return { attachDialog, handleDialogClick }
}

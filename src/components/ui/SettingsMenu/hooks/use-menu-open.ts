// 設定メニューの開閉。Esc・項目選択ではトリガーへフォーカスを戻し、外側クリックでは閉じるだけにする
import { useRef, useState } from 'react'
import { useLightDismiss } from '@/hooks/use-light-dismiss'

export function useMenuOpen() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // 選択操作からの close。トリガーへフォーカスを戻す
  const closeAndFocusTrigger = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  // Esc はトリガーへフォーカスを戻して閉じる。外側クリックはフォーカスを奪わずに閉じるだけ
  useLightDismiss({
    open,
    rootRef,
    onEscape: closeAndFocusTrigger,
    onOutside: () => setOpen(false),
    target: 'document',
  })

  return { open, setOpen, rootRef, buttonRef, closeAndFocusTrigger }
}

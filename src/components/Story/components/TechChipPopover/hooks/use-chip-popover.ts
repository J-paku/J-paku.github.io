// 技術チップの開閉。マウスのホバーで開閉し、Esc とチップ外側の pointerdown で閉じる
import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useLightDismiss } from '@/hooks/use-light-dismiss'

export function useChipPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  // Esc とチップ外側の pointerdown で閉じる。開いている間だけ購読する
  useLightDismiss({
    open: isOpen,
    rootRef,
    onEscape: () => setIsOpen(false),
    onOutside: () => setIsOpen(false),
    target: 'window',
  })

  // マウスのホバーだけを開閉に使う。タッチ環境のタップ直後に発火する疑似ホバーは対象外にする
  const handlePointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') return
    setIsOpen(true)
  }
  const handlePointerLeave = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') return
    setIsOpen(false)
  }

  return { isOpen, setIsOpen, rootRef, handlePointerEnter, handlePointerLeave }
}

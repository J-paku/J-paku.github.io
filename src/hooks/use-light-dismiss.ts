// 開いている間だけ Esc と枠外の pointerdown で閉じる購読を張る(設定メニュー・リンクの覆い・技術チップで共用)
import { useEffect, useEffectEvent } from 'react'
import type { RefObject } from 'react'

type UseLightDismissOptions = {
  open: boolean
  // 外側判定の基準になる要素。この要素の内側で起きた pointerdown では閉じない
  rootRef: RefObject<HTMLElement | null>
  onEscape: () => void
  onOutside: () => void
  // 購読先。呼び出し側がもともと使っていた対象をそのまま指定する(イベント順を変えないため)
  target: 'document' | 'window'
}

export function useLightDismiss({
  open,
  rootRef,
  onEscape,
  onOutside,
  target,
}: UseLightDismissOptions) {
  // 最新のコールバックを購読し直さずに呼ぶ。購読の張り直しは open・rootRef・target の変化時だけ
  const handleEscape = useEffectEvent(onEscape)
  const handleOutside = useEffectEvent(onOutside)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleEscape()
    }
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (root !== null && event.target instanceof Node && !root.contains(event.target)) {
        handleOutside()
      }
    }
    if (target === 'document') {
      document.addEventListener('keydown', onKeyDown)
      document.addEventListener('pointerdown', onPointerDown)
      return () => {
        document.removeEventListener('keydown', onKeyDown)
        document.removeEventListener('pointerdown', onPointerDown)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, rootRef, target])
}

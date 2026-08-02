// Cmd+K(mac)/Ctrl+K(win)でパレットを開くグローバルショートカット。
// input・textarea・contenteditableへのフォーカス中は横取りしない。既に開いている間は何もしない
// (パレット自身の検索入力にフォーカスがある状態は「開いている間」に含まれるため、
// このガードだけで自動的に対象外になる)
import { useEffect } from 'react'

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable
}

export function useOpenShortcut(isOpen: boolean, onOpen: () => void): void {
  useEffect(() => {
    if (isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (!isShortcut) return
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      onOpen()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onOpen])
}

// 技術チップの開閉を見る道具。技術チップ(tech-chip-popover)のテストと、まとめのチップを開く作品ストーリー画面のテストが使う
import { expect } from 'vitest'
import type { Locator } from 'vitest/browser'

// 閉じている間も aria-controls が指す説明を DOM に残す契約を確認する
export const popoverOf = (trigger: Locator): HTMLElement => {
  const popover = document.getElementById(trigger.element().getAttribute('aria-controls') ?? '')
  if (popover === null) throw new Error('チップのaria-controlsが指す要素が無い')
  return popover
}

export const expectChip = async (trigger: Locator, open: boolean) => {
  await expect.element(trigger).toHaveAttribute('aria-expanded', String(open))
  await expect.poll(() => popoverOf(trigger).hidden).toBe(!open)
}

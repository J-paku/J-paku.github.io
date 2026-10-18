// 設定メニューの表示と開閉(SettingsMenuPanel)の統合テスト(Vitest Browser Mode)のうち、テーマの選択肢。部品を実際の Chromium で、
// 開閉のフック(useMenuOpen)と一緒に直接描く。適用中のテーマは props で手で渡し、切り替えの知らせは受け取った値を記録する。
// 選んだテーマがルート属性と保存へ届くことは設定メニューのテスト(../../../__tests__/theme-choice.integration.test.tsx)が見る
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import type { Theme } from '@/lib/preferences'
import SettingsMenuPanel from '@/components/ui/SettingsMenu/components/SettingsMenuPanel/container'
import {
  PATHNAME,
  isOpen,
  preventNavigation,
  triggerOf,
  ui,
} from '@/components/ui/SettingsMenu/__tests__/settings-menu.test-helper'

beforeEach(() => {
  // 外へ通信させない
  vi.stubGlobal('fetch', () => Promise.reject(new Error('テストでは通信しない')))
  document.addEventListener('click', preventNavigation)
})

afterEach(() => {
  // 先に外してから環境を戻す(effectの後始末が差し替えた環境のまま走るように)
  cleanup()
  vi.unstubAllGlobals()
  document.removeEventListener('click', preventNavigation)
})

describe('テーマ', () => {
  it.each([
    ['light', 'dark'],
    ['dark', 'light'],
  ] as const satisfies readonly (readonly [Theme, Theme])[])(
    '適用中の%sの選択肢だけが押された状態で開き、%sを押すとそのテーマを知らせ、閉じて歯車へフォーカスを戻す',
    async (from, to) => {
      const notified: Theme[] = []
      render(
        <SettingsMenuPanel
          locale='ja'
          pathname={PATHNAME}
          ui={ui}
          theme={from}
          onThemeChange={next => {
            notified.push(next)
          }}
        />
      )
      const trigger = triggerOf()

      await userEvent.click(trigger)
      const group = page.getByRole('group', { name: ui.theme.label, exact: true })
      for (const theme of ['light', 'dark'] as const) {
        const option = group.getByRole('button', { name: ui.theme[theme], exact: true }).element()
        expect(option.getAttribute('aria-pressed'), `${theme} の選択肢`).toBe(
          String(theme === from)
        )
      }

      await userEvent.click(page.getByRole('button', { name: ui.theme[to], exact: true }))

      expect(notified, '押した選択肢のテーマを1回だけ知らせる').toEqual([to])
      expect(isOpen(trigger)).toBe(false)
      expect(document.activeElement).toBe(trigger)
    }
  )
})

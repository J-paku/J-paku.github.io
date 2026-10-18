// 設定メニューの表示と開閉(SettingsMenuPanel)の統合テスト(Vitest Browser Mode)のうち、言語のリンク。部品を実際の Chromium で、
// 開閉のフック(useMenuOpen)と一緒に直接描き、言語リンクの印(aria-current・href・lang・hreflang)と、押した後の閉じ方・
// フォーカスの行き先を確かめる。適用中のテーマと切り替えは props で手で渡す
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import type { Locale } from '@content/types/content'
import SettingsMenuPanel from '@/components/ui/SettingsMenu/components/SettingsMenuPanel'
import {
  PATHNAME,
  isOpen,
  preventNavigation,
  triggerOf,
  ui,
  uiOf,
} from '@/components/ui/SettingsMenu/__tests__/settings-menu.test-helper'

// 言語のリンクはテーマに依らないので、適用中のテーマは light に固定し、切り替えの知らせは受け流す
const ignoreThemeChange = () => undefined

const renderPanel = (locale: Locale = 'ja') =>
  render(
    <SettingsMenuPanel
      locale={locale}
      pathname={PATHNAME}
      ui={uiOf[locale]}
      theme='light'
      onThemeChange={ignoreThemeChange}
    />
  )

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

describe('言語', () => {
  it.each([
    ['ja', 'ko'],
    ['ko', 'ja'],
  ] as const)(
    '表示中の言語(%s)のリンクだけが現在のページを示し、各言語版の同じページを指す',
    async (current, other) => {
      renderPanel(current)
      const menuUi = uiOf[current]

      await userEvent.click(
        page.getByRole('button', { name: menuUi.settingsMenu.label, exact: true })
      )
      const nav = page.getByRole('navigation', { name: menuUi.localeMenu.label, exact: true })
      const linkOf = (name: string) => nav.getByRole('link', { name, exact: true }).element()

      const currentLink = linkOf(menuUi.localeMenu[current])
      const otherLink = linkOf(menuUi.localeMenu[other])
      expect(currentLink.getAttribute('aria-current')).toBe('page')
      expect(otherLink.hasAttribute('aria-current')).toBe(false)

      const ja = linkOf(menuUi.localeMenu.ja)
      const ko = linkOf(menuUi.localeMenu.ko)
      expect(ja.getAttribute('href')).toBe('/list/')
      expect(ko.getAttribute('href')).toBe('/ko/list/')
      // 読み上げが言語を切り替えられるよう、リンク文字列の言語と行き先の言語を示す
      expect([ja.getAttribute('lang'), ja.getAttribute('hreflang')]).toEqual(['ja', 'ja'])
      expect([ko.getAttribute('lang'), ko.getAttribute('hreflang')]).toEqual(['ko', 'ko'])
    }
  )

  it('言語のリンクを押すとメニューを閉じ、フォーカスを歯車へ戻す', async () => {
    renderPanel()
    const trigger = triggerOf()

    await userEvent.click(trigger)
    await userEvent.click(page.getByRole('link', { name: ui.localeMenu.ko, exact: true }))

    expect(isOpen(trigger)).toBe(false)
    expect(page.getByRole('navigation').query()).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})

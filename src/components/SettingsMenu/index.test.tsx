import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '@/contexts/LocaleContext/LocaleProvider'
import { ThemeProvider } from '@/contexts/ThemeContext/ThemeProvider'
import { ui } from '@content/ja/ui'
import SettingsMenu from './index'

// LocaleProvider は useLocation を使うため、App.tsx と同じ並び(Router > Theme > Locale)で包む
function renderSettingsMenu() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider>
        <LocaleProvider>
          <SettingsMenu />
        </LocaleProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('SettingsMenu', () => {
  // ThemeProvider が localStorage に書き込むため、テスト間で状態が漏れないよう毎回消す
  afterEach(() => {
    window.localStorage.clear()
  })

  it('初期状態ではパネルが閉じている', () => {
    renderSettingsMenu()
    const trigger = screen.getByRole('button', { name: ui.settingsMenu.label })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(ui.localeMenu.ja)).not.toBeInTheDocument()
  })

  it('トリガーを押すと言語・テーマの項目が開き、現在値が aria で示される', () => {
    renderSettingsMenu()
    const trigger = screen.getByRole('button', { name: ui.settingsMenu.label })
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const jaLink = screen.getByRole('link', { name: ui.localeMenu.ja })
    expect(jaLink).toHaveAttribute('aria-current', 'page')
    const koLink = screen.getByRole('link', { name: ui.localeMenu.ko })
    expect(koLink).not.toHaveAttribute('aria-current')

    const lightButton = screen.getByRole('button', { name: ui.theme.light })
    expect(lightButton).toHaveAttribute('aria-pressed', 'true')
    const darkButton = screen.getByRole('button', { name: ui.theme.dark })
    expect(darkButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('テーマ項目を選ぶとパネルが閉じてトリガーへフォーカスが戻り、選択が永続化される', () => {
    renderSettingsMenu()
    const trigger = screen.getByRole('button', { name: ui.settingsMenu.label })
    fireEvent.click(trigger)

    const darkButton = screen.getByRole('button', { name: ui.theme.dark })
    fireEvent.click(darkButton)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
    expect(window.localStorage.getItem('theme-preference')).toBe('dark')
  })
})

// 設定メニュー(SettingsMenu)の統合テスト(Vitest Browser Mode)のうち、言語・パス・文言の受け渡し。コンテナを実際の Chromium で、
// テーマの選択(useThemeChoice)・表示と開閉の SettingsMenuPanel と一緒に描き、受け取った言語・パス・文言が言語リンクまで届くかを見る。
// 言語ごとのリンクの印(aria-current・lang・hreflang)と、押した後の閉じ方は SettingsMenuPanel のテスト(settings-menu-panel/)が見る
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import SettingsMenu from '@/components/ui/SettingsMenu/container'
import { preventNavigation, uiOf } from './settings-menu.test-helper'

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

it('受け取った言語(ko)・パス・文言を言語リンクへ渡し、ko のリンクが現在のページを示して同じページの各言語版を指す', async () => {
  // 既定の ja と一覧のパスでは渡し損ねても見分けられないので、ko と別のパスで描く
  const ko = uiOf.ko
  render(<SettingsMenu locale='ko' pathname='/works/sample' ui={ko} />)

  await userEvent.click(page.getByRole('button', { name: ko.settingsMenu.label, exact: true }))
  const nav = page.getByRole('navigation', { name: ko.localeMenu.label, exact: true })
  const linkOf = (name: string) => nav.getByRole('link', { name, exact: true }).element()

  const jaLink = linkOf(ko.localeMenu.ja)
  const koLink = linkOf(ko.localeMenu.ko)
  expect(koLink.getAttribute('aria-current')).toBe('page')
  expect(jaLink.hasAttribute('aria-current')).toBe(false)
  expect(jaLink.getAttribute('href')).toBe('/works/sample/')
  expect(koLink.getAttribute('href')).toBe('/ko/works/sample/')
})

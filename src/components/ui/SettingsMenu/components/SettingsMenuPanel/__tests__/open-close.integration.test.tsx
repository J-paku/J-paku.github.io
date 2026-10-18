// 設定メニューの表示と開閉(SettingsMenuPanel)の統合テスト(Vitest Browser Mode)のうち、開閉。部品を実際の Chromium で、
// 開閉のフック(useMenuOpen)と一緒に直接描き、開閉・Esc・内側と外側の押下の結果を、利用者に見える形
// (role・aria-expanded・フォーカスの行き先)で確かめる。適用中のテーマと切り替えは props で手で渡す
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import SettingsMenuPanel from '@/components/ui/SettingsMenu/components/SettingsMenuPanel/container'
import {
  PATHNAME,
  isOpen,
  preventNavigation,
  triggerOf,
  ui,
} from '@/components/ui/SettingsMenu/__tests__/settings-menu.test-helper'

// 開閉はテーマに依らないので、適用中のテーマは light に固定し、切り替えの知らせは受け流す
const ignoreThemeChange = () => undefined

const menu = () => (
  <SettingsMenuPanel
    locale='ja'
    pathname={PATHNAME}
    ui={ui}
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

describe('開閉', () => {
  it('最初は閉じていて、歯車を押すと言語とテーマの選択肢が開き、もう一度押すと閉じる', async () => {
    render(menu())

    const trigger = triggerOf()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(page.getByRole('navigation').query()).toBeNull()
    expect(page.getByRole('group').query()).toBeNull()

    await userEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(
      page.getByRole('navigation', { name: ui.localeMenu.label, exact: true }).element()
    ).toBeTruthy()
    expect(page.getByRole('group', { name: ui.theme.label, exact: true }).element()).toBeTruthy()

    await userEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(page.getByRole('navigation').query()).toBeNull()
    expect(page.getByRole('group').query()).toBeNull()
  })

  it('Escで閉じ、パネルの中にあったフォーカスを歯車へ戻す', async () => {
    render(menu())
    const trigger = triggerOf()

    await userEvent.click(trigger)
    // 歯車からパネルの中へフォーカスを移しておく
    await userEvent.tab()
    const nav = page.getByRole('navigation', { name: ui.localeMenu.label, exact: true }).element()
    expect(nav.contains(document.activeElement)).toBe(true)

    await userEvent.keyboard('{Escape}')
    expect(isOpen(trigger)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('パネルの内側を押しても閉じない', async () => {
    render(menu())
    const trigger = triggerOf()

    await userEvent.click(trigger)
    await userEvent.click(page.getByText(ui.theme.label, { exact: true }))
    expect(isOpen(trigger)).toBe(true)
    expect(page.getByRole('group', { name: ui.theme.label, exact: true }).element()).toBeTruthy()
  })

  it('外側を押すと閉じるが、フォーカスは歯車へ動かさない', async () => {
    render(
      <>
        <button type='button'>外側</button>
        {menu()}
      </>
    )
    const trigger = triggerOf()
    const outside = page.getByRole('button', { name: '外側', exact: true }).element()

    await userEvent.click(trigger)
    outside.focus()
    // 本物のクリックはpointerdownの後のmousedownで押した先へフォーカスを移し、閉じる処理が
    // 歯車へフォーカスを奪っていても上書きして隠してしまう。pointerdownだけを送って確かめる
    fireEvent.pointerDown(outside)

    expect(isOpen(trigger)).toBe(false)
    expect(page.getByRole('navigation').query()).toBeNull()
    expect(document.activeElement).toBe(outside)
  })
})

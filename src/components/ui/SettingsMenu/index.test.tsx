// @vitest-environment happy-dom
// 設定メニュー(SettingsMenu)の統合テスト。歯車のボタンで開閉するパネルをhappy-domへ描き、
// 開閉・Esc・外側の押下・言語リンク・テーマ選択の結果を、利用者に見える形
// (role・aria-expanded・aria-current・aria-pressed・フォーカスの行き先)で確かめる
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Locale } from '@content/types/content'
import { THEME_STORAGE_KEY, type Theme } from '@/lib/preferences'
import SettingsMenu from './index'

// server-onlyはNext.jsのビルド境界専用ガードで、vitestでは無条件に例外を投げる。
// テストでは中身を持たないmockに差し替え、読み込み専用の@/lib/content/readを素通しにする
vi.mock('server-only', () => ({}))

import { readContent } from '@/lib/content/read'

const { ui } = readContent('ja')

// 一覧ページが渡す、locale接頭辞の無いパス(DirectoryのNavigationと同じ値)
const PATHNAME = '/list'

// localStorageの代わりに差し替える、メモリ上だけの保存先。テーマの保存はpreferences経由でここへ届く
const createMemoryStorage = () => {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
  }
}

let storage = createMemoryStorage()

// happy-domはリンクの既定動作で実際にページを移ろうとする(next/linkはルーターが無いと既定動作を止めない)。
// 文書まで届いたクリックの既定動作を止め、ページを移らせない
const preventNavigation = (event: MouseEvent) => {
  event.preventDefault()
}

const renderMenu = (locale: Locale = 'ja') =>
  render(<SettingsMenu locale={locale} pathname={PATHNAME} ui={readContent(locale).ui} />)

const triggerOf = () => screen.getByRole('button', { name: ui.settingsMenu.label })

const isOpen = (trigger: HTMLElement) => trigger.getAttribute('aria-expanded') === 'true'

beforeEach(() => {
  storage = createMemoryStorage()
  vi.stubGlobal('localStorage', storage)
  // 外へ通信させない
  vi.stubGlobal('fetch', () => Promise.reject(new Error('テストでは通信しない')))
  // next.configのtrailingSlash: trueは、ビルド時にこの環境変数としてnext/linkへ渡る(next/dist/build/define-env.js)。
  // 無いとnext/linkがhrefの末尾スラッシュを落とし、配信物と違うhrefになる
  vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')
  document.addEventListener('click', preventNavigation)
})

afterEach(() => {
  // 先に外してから環境を戻す(effectの後始末が差し替えた環境のまま走るように)
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  document.removeEventListener('click', preventNavigation)
  // テーマの適用値はルート属性が正本。次のテストへ持ち越さない
  delete document.documentElement.dataset.theme
})

describe('開閉', () => {
  it('最初は閉じていて、歯車を押すと言語とテーマの選択肢が開き、もう一度押すと閉じる', async () => {
    const user = userEvent.setup()
    renderMenu()

    const trigger = triggerOf()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('group')).toBeNull()

    await user.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('navigation', { name: ui.localeMenu.label })).toBeTruthy()
    expect(screen.getByRole('group', { name: ui.theme.label })).toBeTruthy()

    await user.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('Escで閉じ、パネルの中にあったフォーカスを歯車へ戻す', async () => {
    const user = userEvent.setup()
    renderMenu()
    const trigger = triggerOf()

    await user.click(trigger)
    // 歯車からパネルの中へフォーカスを移しておく
    await user.tab()
    const nav = screen.getByRole('navigation', { name: ui.localeMenu.label })
    expect(nav.contains(document.activeElement)).toBe(true)

    await user.keyboard('{Escape}')
    expect(isOpen(trigger)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('パネルの内側を押しても閉じない', async () => {
    const user = userEvent.setup()
    renderMenu()
    const trigger = triggerOf()

    await user.click(trigger)
    await user.click(screen.getByText(ui.theme.label))
    expect(isOpen(trigger)).toBe(true)
    expect(screen.getByRole('group', { name: ui.theme.label })).toBeTruthy()
  })

  it('外側を押すと閉じるが、フォーカスは歯車へ動かさない', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type='button'>外側</button>
        <SettingsMenu locale='ja' pathname={PATHNAME} ui={ui} />
      </>
    )
    const trigger = triggerOf()
    const outside = screen.getByRole('button', { name: '外側' })

    await user.click(trigger)
    outside.focus()
    // user.clickはpointerdownの後のmousedownで押した先へフォーカスを移し、閉じる処理が
    // 歯車へフォーカスを奪っていても上書きして隠してしまう。pointerdownだけを送って確かめる
    fireEvent.pointerDown(outside)

    expect(isOpen(trigger)).toBe(false)
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(document.activeElement).toBe(outside)
  })
})

describe('言語', () => {
  it.each([
    ['ja', 'ko'],
    ['ko', 'ja'],
  ] as const)(
    '表示中の言語(%s)のリンクだけが現在のページを示し、各言語版の同じページを指す',
    async (current, other) => {
      const user = userEvent.setup()
      renderMenu(current)
      const menuUi = readContent(current).ui

      await user.click(screen.getByRole('button', { name: menuUi.settingsMenu.label }))
      const nav = within(screen.getByRole('navigation', { name: menuUi.localeMenu.label }))

      const currentLink = nav.getByRole('link', { name: menuUi.localeMenu[current] })
      const otherLink = nav.getByRole('link', { name: menuUi.localeMenu[other] })
      expect(currentLink.getAttribute('aria-current')).toBe('page')
      expect(otherLink.hasAttribute('aria-current')).toBe(false)

      const ja = nav.getByRole('link', { name: menuUi.localeMenu.ja })
      const ko = nav.getByRole('link', { name: menuUi.localeMenu.ko })
      expect(ja.getAttribute('href')).toBe('/list/')
      expect(ko.getAttribute('href')).toBe('/ko/list/')
      // 読み上げが言語を切り替えられるよう、リンク文字列の言語と行き先の言語を示す
      expect([ja.getAttribute('lang'), ja.getAttribute('hreflang')]).toEqual(['ja', 'ja'])
      expect([ko.getAttribute('lang'), ko.getAttribute('hreflang')]).toEqual(['ko', 'ko'])
    }
  )

  it('言語のリンクを押すとメニューを閉じ、フォーカスを歯車へ戻す', async () => {
    const user = userEvent.setup()
    renderMenu()
    const trigger = triggerOf()

    await user.click(trigger)
    await user.click(screen.getByRole('link', { name: ui.localeMenu.ko }))

    expect(isOpen(trigger)).toBe(false)
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})

describe('テーマ', () => {
  it.each([
    ['無い', undefined, 'light'],
    ['darkの', 'dark', 'dark'],
  ] as const)(
    'ルート属性が%sとき、適用中のテーマの選択肢だけが押された状態で開く',
    async (_label, applied, expected) => {
      if (applied !== undefined) document.documentElement.dataset.theme = applied
      const user = userEvent.setup()
      renderMenu()

      await user.click(triggerOf())
      const group = within(screen.getByRole('group', { name: ui.theme.label }))
      for (const theme of ['light', 'dark'] as const) {
        const option = group.getByRole('button', { name: ui.theme[theme] })
        expect(option.getAttribute('aria-pressed')).toBe(String(theme === expected))
      }
    }
  )

  it.each([
    ['light', 'dark'],
    ['dark', 'light'],
  ] as const satisfies readonly (readonly [Theme, Theme])[])(
    '%sから%sを選ぶと、ルート属性と保存を書き換え、閉じて歯車へフォーカスを戻し、開き直すと選んだ方が押されている',
    async (from, to) => {
      document.documentElement.dataset.theme = from
      const user = userEvent.setup()
      renderMenu()
      const trigger = triggerOf()

      await user.click(trigger)
      await user.click(screen.getByRole('button', { name: ui.theme[to] }))

      expect(document.documentElement.dataset.theme).toBe(to)
      expect(storage.getItem(THEME_STORAGE_KEY)).toBe(to)
      expect(isOpen(trigger)).toBe(false)
      expect(document.activeElement).toBe(trigger)

      await user.click(trigger)
      const chosen = screen.getByRole('button', { name: ui.theme[to] })
      const previous = screen.getByRole('button', { name: ui.theme[from] })
      expect(chosen.getAttribute('aria-pressed')).toBe('true')
      expect(previous.getAttribute('aria-pressed')).toBe('false')
    }
  )
})

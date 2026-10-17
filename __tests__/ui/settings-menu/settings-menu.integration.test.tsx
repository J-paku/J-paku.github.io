// 設定メニュー(SettingsMenu)の統合テスト(Vitest Browser Mode)。コンテナを実際の Chromium で、テーマの選択(useThemeChoice)・
// 開閉のフックと一緒に描き、開閉・Esc・外側の押下・言語リンク・テーマ選択の結果を、利用者に見える形
// (role・aria-expanded・aria-current・aria-pressed・フォーカスの行き先)で確かめる。テーマの保存は本物の localStorage へ書かせて読む
import { cleanup, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, inject, it, onTestFinished, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import type { Locale } from '@content/types/content'
import { THEME_STORAGE_KEY, type Theme } from '@/lib/preferences'
import SettingsMenu from '@/components/ui/SettingsMenu/container'

// 文言は container.fixture.ts が node で readContent から読んで渡す
const uiOf = inject('settingsMenuUi')
const ui = uiOf.ja

// 一覧ページが渡す、locale接頭辞の無いパス(DirectoryのNavigationと同じ値)
const PATHNAME = '/list'

// next/linkはルーターが無いとリンクの既定動作を止めないので、実ブラウザでは押すとテストの文書ごとページを移ってしまう。
// 文書まで届いたクリックの既定動作を止め、ページを移らせない
const preventNavigation = (event: MouseEvent) => {
  event.preventDefault()
}

const renderMenu = (locale: Locale = 'ja') =>
  render(<SettingsMenu locale={locale} pathname={PATHNAME} ui={uiOf[locale]} />)

// 名前は部分一致でなく、単体テスト(Testing Library)の既定と同じく全体の一致で引く
const triggerOf = () =>
  page.getByRole('button', { name: ui.settingsMenu.label, exact: true }).element()

const isOpen = (trigger: Element) => trigger.getAttribute('aria-expanded') === 'true'

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
  // テーマの適用値はルート属性が正本。次のテストへ持ち越さない
  delete document.documentElement.dataset.theme
  // テーマ選択が本物の localStorage へ書いた保存を消し、何も保存していない状態へ戻す
  localStorage.removeItem(THEME_STORAGE_KEY)
})

describe('テーマ', () => {
  it.each([
    ['無い', undefined, 'light'],
    ['darkの', 'dark', 'dark'],
  ] as const)(
    'ルート属性が%sとき、適用中のテーマの選択肢だけが押された状態で開く',
    async (_label, applied, expected) => {
      if (applied !== undefined) document.documentElement.dataset.theme = applied
      renderMenu()

      await userEvent.click(triggerOf())
      const group = page.getByRole('group', { name: ui.theme.label, exact: true })
      for (const theme of ['light', 'dark'] as const) {
        const option = group.getByRole('button', { name: ui.theme[theme], exact: true }).element()
        expect(option.getAttribute('aria-pressed')).toBe(String(theme === expected))
      }
    }
  )

  it('書き出す HTML(サーバの描画)へハイドレーションしても歯車を作り直さず、開くと適用中のテーマ(dark)が押されている', async () => {
    // 初回ペイントの前に html-shell がルート属性へ書いた適用値。サーバの描画は保存値を知れないので light で描く
    document.documentElement.dataset.theme = 'dark'
    const host = document.createElement('div')
    host.innerHTML = renderToString(<SettingsMenu locale='ja' pathname={PATHNAME} ui={ui} />)
    document.body.append(host)
    // ハイドレーションの前に落ちても、書き出した HTML を次のテストへ残さない(描いた後は cleanup も外す)
    onTestFinished(() => host.remove())
    const trigger = triggerOf()

    render(<SettingsMenu locale='ja' pathname={PATHNAME} ui={ui} />, {
      container: host,
      hydrate: true,
    })

    // サーバとクライアントの最初の描画が食い違うと、React は書き出した要素を捨てて作り直す
    expect(triggerOf(), 'ハイドレーションしても書き出した歯車をそのまま使う').toBe(trigger)
    await userEvent.click(trigger)
    const group = page.getByRole('group', { name: ui.theme.label, exact: true })
    for (const theme of ['light', 'dark'] as const) {
      const option = group.getByRole('button', { name: ui.theme[theme], exact: true }).element()
      expect(option.getAttribute('aria-pressed'), `${theme} の選択肢`).toBe(
        String(theme === 'dark')
      )
    }
  })

  it.each([
    ['light', 'dark'],
    ['dark', 'light'],
  ] as const satisfies readonly (readonly [Theme, Theme])[])(
    '%sから%sを選ぶと、ルート属性と保存を書き換え、閉じて歯車へフォーカスを戻し、開き直すと選んだ方が押されている',
    async (from, to) => {
      document.documentElement.dataset.theme = from
      renderMenu()
      const trigger = triggerOf()

      await userEvent.click(trigger)
      await userEvent.click(page.getByRole('button', { name: ui.theme[to], exact: true }))

      expect(document.documentElement.dataset.theme).toBe(to)
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(to)
      expect(isOpen(trigger)).toBe(false)
      expect(document.activeElement).toBe(trigger)

      await userEvent.click(trigger)
      const chosen = page.getByRole('button', { name: ui.theme[to], exact: true }).element()
      const previous = page.getByRole('button', { name: ui.theme[from], exact: true }).element()
      expect(chosen.getAttribute('aria-pressed')).toBe('true')
      expect(previous.getAttribute('aria-pressed')).toBe('false')
    }
  )
})

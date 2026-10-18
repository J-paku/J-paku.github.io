// 設定メニュー(SettingsMenu)と、その開閉を持つ SettingsMenuPanel の統合テストが共通で使う、文言・パス・歯車の引き方・リンクの移動止め。
// 描くのは各テストで、ここはコンポーネントを描く道具を import しない
import { inject } from 'vitest'
import { page } from 'vitest/browser'

// 文言は index.fixture.ts が node で readContent から読んで渡す
export const uiOf = inject('settingsMenuUi')
export const ui = uiOf.ja

// 一覧ページが渡す、locale接頭辞の無いパス(DirectoryのNavigationと同じ値)
export const PATHNAME = '/list'

// next/linkはルーターが無いとリンクの既定動作を止めないので、実ブラウザでは押すとテストの文書ごとページを移ってしまう。
// 文書まで届いたクリックの既定動作を止め、ページを移らせない
export const preventNavigation = (event: MouseEvent) => {
  event.preventDefault()
}

// 名前は部分一致でなく、単体テスト(Testing Library)の既定と同じく全体の一致で引く
export const triggerOf = () =>
  page.getByRole('button', { name: ui.settingsMenu.label, exact: true }).element()

export const isOpen = (trigger: Element) => trigger.getAttribute('aria-expanded') === 'true'

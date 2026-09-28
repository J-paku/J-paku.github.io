// 設定メニューのテーマ選択。現在の適用値を読み、切り替え時はルート属性を書いて preferences 経由で保存する
import { useSyncExternalStore } from 'react'
import { writeTheme, type Theme } from '@/lib/preferences'

// 適用値の正本はルート属性。初回ペイント前の html-shell を除けば書き換えるのは下の setTheme だけなので、
// 購読は setTheme が鳴らすこの通知だけで足りる
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// 初期テーマは html-shell のインラインスクリプトがルート属性へ書いた値から読む
const readAppliedTheme = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

// サーバー描画時は保存値を知れないため 'light' で描き、ハイドレーション後に実際の適用値へ合わせる
const readServerTheme = (): Theme => 'light'

export function useThemeChoice() {
  const theme = useSyncExternalStore(subscribe, readAppliedTheme, readServerTheme)

  // ルート属性と保存を先に済ませてから知らせ、購読側に新しい属性値を読ませる
  const setTheme = (next: Theme) => {
    document.documentElement.dataset.theme = next
    writeTheme(next)
    for (const listener of listeners) listener()
  }

  return { theme, setTheme }
}

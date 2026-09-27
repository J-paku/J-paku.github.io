// 設定メニューのテーマ選択。現在の適用値を読み、切り替え時はルート属性を書いて preferences 経由で保存する
import { useEffect, useState } from 'react'
import { writeTheme, type Theme } from '@/lib/preferences'

export function useThemeChoice() {
  const [theme, setThemeState] = useState<Theme>('light')

  // 初期テーマは html-shell のインラインスクリプトがルート属性へ書いた値から読む
  // (サーバー描画時は保存値を知れないため、マウント後に実際の適用値へ合わせる)
  useEffect(() => {
    setThemeState(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  }, [])

  // 副作用(DOM 属性・保存)は updater の外で行う(StrictMode の二重実行を避ける)
  const setTheme = (next: Theme) => {
    document.documentElement.dataset.theme = next
    writeTheme(next)
    setThemeState(next)
  }

  return { theme, setTheme }
}

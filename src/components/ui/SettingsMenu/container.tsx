// 設定メニューの I/O コンテナ。外の世界(ルート属性と preferences 経由の保存)に触れるテーマの選択(useThemeChoice)を
// ここで呼び、適用中のテーマと切り替えを、開閉を持つ状態コンテナ(components/SettingsMenuPanel)へ props で渡す。
// 言語・パス・文言は受け取ったまま渡す
'use client'
import type { Locale, UiStrings } from '@content/types/content'
import { useThemeChoice } from './hooks/use-theme-choice'
import SettingsMenuPanel from './components/SettingsMenuPanel/container'

type SettingsMenuContainerProps = {
  locale: Locale
  pathname: string
  ui: UiStrings
}

function SettingsMenuContainer({ locale, pathname, ui }: SettingsMenuContainerProps) {
  const { theme, setTheme } = useThemeChoice()

  return (
    <SettingsMenuPanel
      locale={locale}
      pathname={pathname}
      ui={ui}
      theme={theme}
      onThemeChange={setTheme}
    />
  )
}

export default SettingsMenuContainer

// 設定メニューのコンテナ。外の世界(ルート属性と preferences 経由の保存)に触れるテーマの選択(useThemeChoice)を
// ここで呼び、適用中のテーマと切り替えを表示部品(components/SettingsMenuView)へ props で渡す。言語・パス・文言は受け取ったまま渡す
'use client'
import type { Locale, UiStrings } from '@content/types/content'
import { useThemeChoice } from './hooks/use-theme-choice'
import SettingsMenu from './components/SettingsMenuView'

type SettingsMenuContainerProps = {
  locale: Locale
  pathname: string
  ui: UiStrings
}

function SettingsMenuContainer({ locale, pathname, ui }: SettingsMenuContainerProps) {
  const { theme, setTheme } = useThemeChoice()

  return (
    <SettingsMenu
      locale={locale}
      pathname={pathname}
      ui={ui}
      theme={theme}
      onThemeChange={setTheme}
    />
  )
}

export default SettingsMenuContainer

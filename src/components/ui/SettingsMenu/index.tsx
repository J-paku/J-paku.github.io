// 画面右上に固定する設定メニュー。旧 LocaleSwitcher(言語)と旧 ThemeToggle(テーマ)を1つの
// ドロップダウンへ統合する。開閉状態は自前で持ち、他に同型のドロップダウンが無いため
// 独自にキーボード(Escape)・外側クリック・フォーカス復帰を実装する。
// フォーカス復帰は Escape と項目選択(自分で閉じる操作)にのみ適用し、外側クリックでは行わない
// — 外側クリックはユーザーが別の要素を狙った操作なので、そのフォーカス先を奪わない
'use client'
import { useId } from 'react'
import Link from 'next/link'
import type { Locale, UiStrings } from '@content/types/content'
import { toHref } from '@/utils/locale-path'
import type { Theme } from '@/lib/preferences'
import { useThemeChoice } from './hooks/use-theme-choice'
import { useMenuOpen } from './hooks/use-menu-open'
import GearIcon from './components/GearIcon'
import styles from './settings-menu.module.css'

type SettingsMenuProps = {
  locale: Locale
  pathname: string
  ui: UiStrings
}

const LOCALES: Locale[] = ['ja', 'ko']
const THEMES: Theme[] = ['light', 'dark']

function SettingsMenu({ locale, pathname, ui }: SettingsMenuProps) {
  const { theme, setTheme } = useThemeChoice()
  // ラベルの原点は視覚テキスト<p>ひとつ。aria-label と二重に持たせるとスクリーンリーダーが
  // 同じ文字列を2回読み上げるため、aria-labelledby で<p>を指し直す
  const localeLabelId = useId()
  const themeLabelId = useId()
  // 開閉の購読 effect を useThemeChoice の effect より後に保つため、この位置で呼ぶ
  const { open, setOpen, rootRef, buttonRef, closeAndFocusTrigger } = useMenuOpen()

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type='button'
        className={styles.trigger}
        aria-expanded={open}
        aria-label={ui.settingsMenu.label}
        onClick={() => setOpen(prev => !prev)}
      >
        <GearIcon className={styles.icon} />
      </button>

      {open ? (
        <div className={styles.panel}>
          <nav aria-labelledby={localeLabelId} className={styles.section}>
            <p id={localeLabelId} className={styles.sectionLabel}>
              {ui.localeMenu.label}
            </p>
            {LOCALES.map(item => (
              <Link
                key={item}
                href={toHref(pathname, item)}
                hrefLang={item}
                lang={item}
                className={styles.optionLink}
                aria-current={item === locale ? 'page' : undefined}
                onClick={closeAndFocusTrigger}
              >
                {ui.localeMenu[item]}
              </Link>
            ))}
          </nav>

          <div role='group' aria-labelledby={themeLabelId} className={styles.section}>
            <p id={themeLabelId} className={styles.sectionLabel}>
              {ui.theme.label}
            </p>
            {THEMES.map(item => (
              <button
                key={item}
                type='button'
                className={styles.optionButton}
                aria-pressed={item === theme}
                onClick={() => {
                  setTheme(item)
                  closeAndFocusTrigger()
                }}
              >
                {ui.theme[item]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default SettingsMenu

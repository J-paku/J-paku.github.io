// 画面右上に固定する設定メニュー。旧 LocaleSwitcher(言語)と旧 ThemeToggle(テーマ)を1つの
// ドロップダウンへ統合する。開閉状態は自前で持ち、他に同型のドロップダウンが無いため
// 独自にキーボード(Escape)・外側クリック・フォーカス復帰を実装する。
// フォーカス復帰は Escape と項目選択(自分で閉じる操作)にのみ適用し、外側クリックでは行わない
// — 外側クリックはユーザーが別の要素を狙った操作なので、そのフォーカス先を奪わない
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useLocale } from '@/contexts/LocaleContext/locale-context'
import { useTheme } from '@/contexts/ThemeContext/theme-context'
import { useContent } from '@/hooks/use-content'
import type { Locale } from '@/types/content'
import type { ThemePreference } from '@/lib/preferences'
import styles from './settings-menu.module.css'

const LOCALES: Locale[] = ['ja', 'ko']
const THEMES: ThemePreference[] = ['light', 'dark']

// 装飾専用の歯車アイコン。状態は持たないため aria-hidden
function GearIcon() {
  return (
    <svg aria-hidden='true' focusable='false' viewBox='0 0 24 24' className={styles.icon}>
      <path
        fill='currentColor'
        d='M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.48-.41h-3.84a.5.5 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.74 8.87a.5.5 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94L2.84 14.5a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58ZM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2Z'
      />
    </svg>
  )
}

function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { locale, switchTo } = useLocale()
  const { theme, setTheme } = useTheme()
  const { ui } = useContent()
  // ラベルの原点は視覚テキスト<p>ひとつ。aria-label と二重に持たせるとスクリーンリーダーが
  // 同じ文字列を2回読み上げるため、aria-labelledby で<p>を指し直す
  const localeLabelId = useId()
  const themeLabelId = useId()

  // 選択操作からの close。トリガーへフォーカスを戻す
  const closeAndFocusTrigger = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      closeAndFocusTrigger()
    }

    // 外側クリックはフォーカスを奪わずに閉じるだけ
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type='button'
        className={styles.trigger}
        aria-haspopup='true'
        aria-expanded={open}
        aria-label={ui.settingsMenu.label}
        onClick={() => setOpen((prev) => !prev)}
      >
        <GearIcon />
      </button>

      {open ? (
        <div className={styles.panel}>
          <nav aria-labelledby={localeLabelId} className={styles.section}>
            <p id={localeLabelId} className={styles.sectionLabel}>{ui.localeMenu.label}</p>
            {LOCALES.map((item) => (
              <Link
                key={item}
                to={switchTo(item)}
                className={styles.optionLink}
                aria-current={item === locale ? 'true' : undefined}
                onClick={closeAndFocusTrigger}
              >
                {ui.localeMenu[item]}
              </Link>
            ))}
          </nav>

          <div role='group' aria-labelledby={themeLabelId} className={styles.section}>
            <p id={themeLabelId} className={styles.sectionLabel}>{ui.theme.label}</p>
            {THEMES.map((item) => (
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

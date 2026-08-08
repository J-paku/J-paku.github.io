// テーマの切替ボタン。light ⇄ dark の2状態のみ(OS追従の system は廃止)
import { useTheme } from '@/hooks/use-theme'
import { useContent } from '@/hooks/use-content'
import type { ThemePreference } from '@/lib/preferences'
import styles from './theme-toggle.module.css'

const nextTheme = (current: ThemePreference): ThemePreference =>
  current === 'dark' ? 'light' : 'dark'

type ThemeIconProps = {
  theme: ThemePreference
}

// アイコンは装飾専用。状態そのものは aria-label 側のテキストで伝える
function ThemeIcon({ theme }: ThemeIconProps) {
  if (theme === 'light') {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={styles.icon}>
        <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={styles.icon}>
      <path
        d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { ui } = useContent()

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={`${ui.theme.label}: ${ui.theme[theme]}`}
      onClick={() => setTheme(nextTheme(theme))}
    >
      <ThemeIcon theme={theme} />
      {/* 原本の枠線ボタンは文字を持つ形。文言は content の ui.theme.* をそのまま使い、ここでは作らない。
          読み上げ名は aria-label 側が持つため、この文字列は aria-label に含まれる語と一致させる */}
      <span className={styles.label}>{ui.theme[theme]}</span>
    </button>
  )
}

export default ThemeToggle

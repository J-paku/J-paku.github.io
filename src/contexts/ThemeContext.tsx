// テーマ設定(light / dark の2状態)を保持し、data-theme 属性への反映と永続化を配布する Context。
// localStorage への直接アクセスは行わず、外部境界である lib/preferences.ts のみを呼ぶ
import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { readTheme, writeTheme, type ThemePreference } from '@/lib/preferences'

export type ThemeContextValue = {
  theme: ThemePreference
  setTheme: (next: ThemePreference) => void
}

// Context+Provider を同居させる構成上の意図的な設計であり、消費フックは hooks/use-theme.ts に分離済み
// oxlint-disable-next-line react/only-export-components
export const ThemeContext = createContext<ThemeContextValue | null>(null)

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemePreference>(() => readTheme())

  useEffect(() => {
    // data-theme は常に立てる。tokens.css には prefers-color-scheme の分岐が無いため、
    // 属性を外すとOS設定に関係なくライトで固定されてしまう
    document.documentElement.dataset.theme = theme
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => {
        setThemeState(next)
        writeTheme(next)
      },
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

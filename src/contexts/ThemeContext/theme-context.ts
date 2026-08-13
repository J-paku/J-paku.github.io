// ThemeContext 本体と消費フック。Provider は ./ThemeProvider.tsx に分離している
import { createContext, useContext } from 'react'
import type { ThemePreference } from '@/lib/preferences'

export type ThemeContextValue = {
  theme: ThemePreference
  setTheme: (next: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

// ThemeContext を消費するフック。Provider の外側で呼ばれた場合は明確に例外を投げる
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error('useTheme must be called within ThemeProvider')
  }
  return context
}

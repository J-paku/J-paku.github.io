// ThemeContext を消費するフック。Provider の外側で呼ばれた場合は明確に例外を投げる
import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from '@/contexts/ThemeContext'

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error('useTheme must be called within ThemeProvider')
  }
  return context
}

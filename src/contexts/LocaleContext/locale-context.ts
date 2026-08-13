// LocaleContext 本体と消費フック。Provider は ./LocaleProvider.tsx に分離している
import { createContext, useContext } from 'react'
import type { Locale } from '@/types/content'

export type LocaleContextValue = {
  locale: Locale
  // 引数の locale に切り替えた場合の遷移先パスを返すだけ。遷移自体は呼び出し側の <Link> が行う
  switchTo: (next: Locale) => string
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)

// LocaleContext を消費するフック。Provider の外側で呼ばれた場合は明確に例外を投げる
export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext)
  if (context === null) {
    throw new Error('useLocale must be called within LocaleProvider')
  }
  return context
}

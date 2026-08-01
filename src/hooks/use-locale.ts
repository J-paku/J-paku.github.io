// LocaleContext を消費するフック。Provider の外側で呼ばれた場合は明確に例外を投げる
import { useContext } from 'react'
import { LocaleContext, type LocaleContextValue } from '@/contexts/LocaleContext'

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext)
  if (context === null) {
    throw new Error('useLocale must be called within LocaleProvider')
  }
  return context
}

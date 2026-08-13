// URL の pathname から locale を算出し、locale 切替用パスを配布する Context。
// UI文字列は hooks/use-content.ts が集約ローダー経由で供給するため、ここでは持たない(同一概念の供給元が二重化するのを避ける)
// locale 判定は utils/locale-path.ts 一箇所に集約し、ここでは startsWith 等の再判定を行わない
import { useEffect, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { parseLocale, withLocale } from '@/utils/locale-path'
import { LocaleContext, type LocaleContextValue } from './locale-context'

type LocaleProviderProps = {
  children: ReactNode
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const { pathname } = useLocation()
  const locale = parseLocale(pathname)

  // スクリーンリーダーの発音・ブラウザ翻訳が参照するため html lang を locale に追従させる
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      switchTo: (next) => withLocale(pathname, next),
    }),
    [locale, pathname],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

// URL の pathname から locale を算出し、locale 切替用パスを配布する Context。
// UI文字列は hooks/use-content.ts が集約ローダー経由で供給するため、ここでは持たない(同一概念の供給元が二重化するのを避ける)
// locale 判定は utils/locale-path.ts 一箇所に集約し、ここでは startsWith 等の再判定を行わない
import { createContext, useEffect, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import type { Locale } from '@/types/content'
import { parseLocale, withLocale } from '@/utils/locale-path'

export type LocaleContextValue = {
  locale: Locale
  // 引数の locale に切り替えた場合の遷移先パスを返すだけ。遷移自体は呼び出し側の <Link> が行う
  switchTo: (next: Locale) => string
}

// Context+Provider を同居させる構成上の意図的な設計であり、消費フックは hooks/use-locale.ts に分離済み
// oxlint-disable-next-line react/only-export-components
export const LocaleContext = createContext<LocaleContextValue | null>(null)

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

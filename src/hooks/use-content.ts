// 現在の locale に対応する Content を返すフック。
// locale の判定は useLocale() に委譲し、ここではpathnameの再判定を行わない
import { useMemo } from 'react'
import type { Content } from '@/types/content'
import { useLocale } from '@/contexts/LocaleContext/locale-context'
import { loadContent } from '@/utils/content-loader'
import { mergeContent } from '@/utils/merge-content'

export function useContent(): Content {
  const { locale } = useLocale()

  // ja は正本そのものなのでフォールバック不要。koのみ merge-content.ts の安全網を通す
  return useMemo<Content>(() => {
    const ja = loadContent('ja')
    return locale === 'ja' ? ja : mergeContent(ja, loadContent('ko'))
  }, [locale])
}

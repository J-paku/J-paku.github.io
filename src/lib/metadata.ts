// canonical と言語別リンク、共有カードのメタデータを共通規則で組み立てる
import type { Metadata } from 'next'
import type { Locale } from '@content/types/content'
import { stripLocale, toHref } from '@/utils/locale-path'

const SITE = 'https://j-paku.github.io'

type BuildMetadataArgs = { locale: Locale; pathname: string; title: string; description: string }

// canonical と ja/ko の相互リンクを全ページで同じ規則で出す。og:image は既存の静的カード
export const buildMetadata = ({
  locale,
  pathname,
  title,
  description,
}: BuildMetadataArgs): Metadata => {
  const bare = stripLocale(pathname)
  return {
    title,
    description,
    metadataBase: new URL(SITE),
    alternates: {
      canonical: toHref(bare, locale),
      languages: { ja: toHref(bare, 'ja'), ko: toHref(bare, 'ko') },
    },
    openGraph: {
      title,
      description,
      siteName: 'J-Paku',
      locale: locale === 'ja' ? 'ja_JP' : 'ko_KR',
      images: [{ url: '/og-card.png', width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: { card: 'summary_large_image' },
  }
}

// canonical・言語別リンク・共有カードのメタデータが、ページの言語に応じて同じ規則で組み立つことを検証する
import { describe, expect, it } from 'vitest'
import { buildMetadata } from './metadata'

describe('buildMetadata', () => {
  it('ja のページは接頭辞の無い canonical と ja_JP の共有カードを出す', () => {
    const { metadataBase, ...metadata } = buildMetadata({
      locale: 'ja',
      pathname: '/list',
      title: '作品一覧',
      description: '作品の紹介',
    })

    // 相対 URL(アイコン・共有カードの画像)はこの起点で絶対 URL になる
    expect(String(metadataBase)).toBe('https://j-paku.github.io/')
    expect(metadata).toEqual({
      title: '作品一覧',
      description: '作品の紹介',
      icons: {
        icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
        apple: [{ url: '/apple-touch-icon.png' }],
      },
      alternates: {
        canonical: '/list/',
        languages: { ja: '/list/', ko: '/ko/list/' },
      },
      openGraph: {
        title: '作品一覧',
        description: '作品の紹介',
        siteName: 'J-Paku',
        locale: 'ja_JP',
        images: [{ url: '/og-card.png', width: 1200, height: 630 }],
        type: 'website',
      },
      twitter: { card: 'summary_large_image' },
    })
  })

  it('ko のページは /ko 付きの canonical と ko_KR の共有カードを出し、言語別リンクは ja と同じ', () => {
    // /ko 付きのパスを渡しても、接頭辞を外してから言語ごとに付け直す
    const metadata = buildMetadata({
      locale: 'ko',
      pathname: '/ko/list',
      title: 'Works',
      description: 'Works list',
    })

    expect(metadata.alternates).toEqual({
      canonical: '/ko/list/',
      languages: { ja: '/list/', ko: '/ko/list/' },
    })
    expect(metadata.openGraph).toMatchObject({ locale: 'ko_KR' })
  })
})

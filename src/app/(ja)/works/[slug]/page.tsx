// ストーリーを持つ公開作品だけを日本語の静的詳細ページとして生成する
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findStoryWork, listStorySlugs } from '@/lib/content/read'
import { buildMetadata } from '@/lib/metadata'
import Story from '@/components/Story'

const LOCALE = 'ja' as const

type PageProps = {
  params: Promise<{ slug: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return listStorySlugs(LOCALE).map(slug => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const work = findStoryWork(LOCALE, slug)
  if (work === null || work.story === undefined) return {}
  return buildMetadata({
    locale: LOCALE,
    pathname: `/works/${slug}`,
    title: work.story.intro.title,
    description: work.story.intro.lead,
  })
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  const work = findStoryWork(LOCALE, slug)
  if (work === null) notFound()
  return <Story locale={LOCALE} work={work} />
}

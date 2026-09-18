// 韓国語の一覧ページ。メタデータも表示文字列も content から組み立てる
import type { Metadata } from 'next'
import { readContent } from '@/lib/content/read'
import { buildMetadata } from '@/lib/metadata'
import Directory from '@/components/Directory'

export const metadata: Metadata = buildMetadata({
  locale: 'ko',
  pathname: '/list',
  title: `${readContent('ko').ui.work.index} — ${readContent('ko').profile.name}`,
  description: readContent('ko').profile.headline,
})

export default function Page() {
  return <Directory locale='ko' />
}

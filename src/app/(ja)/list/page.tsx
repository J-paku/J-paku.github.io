// 日本語の一覧ページ。メタデータも表示文字列も content から組み立てる
import type { Metadata } from 'next'
import { readContent } from '@/lib/content/read'
import { buildMetadata } from '@/lib/metadata'
import Directory from '@/components/Directory'

export const metadata: Metadata = buildMetadata({
  locale: 'ja',
  pathname: '/list',
  title: `${readContent('ja').ui.work.index} — ${readContent('ja').profile.name}`,
  description: readContent('ja').profile.headline,
})

export default function Page() {
  return <Directory locale='ja' />
}

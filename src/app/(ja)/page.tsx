// 日本語の村ページ。メタデータも表示文字列も content から組み立てる
import type { Metadata } from 'next'
import { readContent, readVillageText } from '@/lib/content/read'
import { buildMetadata } from '@/lib/metadata'
import VillagePage from '@/components/VillagePage'

export const metadata: Metadata = buildMetadata({
  locale: 'ja',
  pathname: '/',
  title: readContent('ja').profile.name,
  description: readVillageText('ja').intro,
})

export default function Page() {
  return <VillagePage locale='ja' />
}

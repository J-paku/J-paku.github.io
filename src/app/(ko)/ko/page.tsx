// 韓国語の村ページ。メタデータも表示文字列も content から組み立てる
import type { Metadata } from 'next'
import { readContent, readVillageText } from '@/lib/content/read'
import { buildMetadata } from '@/lib/metadata'
import VillagePage from '@/components/VillagePage'

export const metadata: Metadata = buildMetadata({
  locale: 'ko',
  pathname: '/',
  title: readContent('ko').profile.name,
  description: readVillageText('ko').intro,
})

export default function Page() {
  return <VillagePage locale='ko' />
}

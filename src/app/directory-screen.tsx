// 一覧ページの入口(サーバ)。content の読み出し(サーバ専用)だけを行い、
// 直列化できるデータを画面(src/components/Directory/index.tsx)へ渡す。画面の組み立てはコンテナが持つ
import type { Locale } from '@content/types/content'
import { readContent, readVillageText } from '@/lib/content/read'
import DirectoryContainer from '@/components/Directory'
import { directoryProps } from '@/components/Directory/utils/directory-props'

type DirectoryProps = { locale: Locale }

function Directory({ locale }: DirectoryProps) {
  const props = directoryProps(locale, readContent(locale), readVillageText(locale))

  return <DirectoryContainer {...props} />
}

export default Directory

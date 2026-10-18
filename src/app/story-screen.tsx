// 作品ストーリーのサーバローダー。読み出しと存在確認を行い、画面の組み立てはコンテナへ渡す
import { notFound } from 'next/navigation'
import type { Locale, Work } from '@content/types/content'
import { readContent, readVillageText } from '@/lib/content/read'
import StoryContainer from '@/components/Story'
import { storyProps } from '@/components/Story/utils/story-props'

type StoryProps = {
  locale: Locale
  work: Work
}

function Story({ locale, work }: StoryProps) {
  const props = storyProps(locale, readContent(locale), readVillageText(locale), work)
  // 呼び出し側がストーリー付きの作品だけを渡す。型では任意なので notFound() で絞る(空の 200 を返さない)
  if (props === null) notFound()
  return <StoryContainer {...props} />
}

export default Story

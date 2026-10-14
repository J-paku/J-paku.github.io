// 作品ストーリーのコンテナの props を、サーバローダーと同じ純粋関数(utils/story-props.ts)で node 側で組み、
// ブラウザへ直列化可能な props だけを渡す
import type { ComponentProps } from 'react'
import type { TestProject } from 'vitest/node'
import { readContent, readVillageText } from '@/lib/content/read'
import type StoryContainer from './container'
import { storyProps } from './utils/story-props'

type StoryData = ComponentProps<typeof StoryContainer>

declare module 'vitest' {
  export interface ProvidedContext {
    storyJa: StoryData
  }
}

export function setup(project: TestProject): void {
  const content = readContent('ja')
  const work = content.works.find(work => work.slug === 'meishi-cross-platform')
  if (work === undefined) throw new Error('統合テスト用の作品が無い')
  const props = storyProps('ja', content, readVillageText('ja'), work)
  if (props === null) throw new Error('統合テスト用の作品ストーリーが無い')

  project.provide('storyJa', props)
}

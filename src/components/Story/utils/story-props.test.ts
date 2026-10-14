// ローダーと fixture が同じ作品ストーリー・文言を渡すための組み立てと、ストーリーを持たない作品の扱いを確かめる。
import { describe, expect, it, vi } from 'vitest'
import type { Work } from '@content/types/content'
import { readContent, readVillageText } from '@/lib/content/read'
import { storyProps } from './story-props'

vi.mock('server-only', () => ({}))

// ストーリーを持つ作品。ストーリーは型では任意なので、持つものを content から選ぶ
const storyWorkOf = (works: Work[]): Work => {
  const found = works.find(work => work.story !== undefined)
  if (found === undefined) throw new Error('ストーリーを持つ作品が content に無い')
  return found
}

describe('storyProps', () => {
  it.each(['ja', 'ko'] as const)(
    '%s の作品のストーリー・文言・村への導線の文言をデータだけで渡す',
    locale => {
      const content = readContent(locale)
      const text = readVillageText(locale)
      const work = storyWorkOf(content.works)
      const props = storyProps(locale, content, text, work)

      expect(props).toEqual({
        locale,
        slug: work.slug,
        story: work.story,
        ui: content.ui,
        switchLabel: text.toVillage,
      })
      expect(JSON.parse(JSON.stringify(props))).toEqual(props)
    }
  )

  it('ストーリーを持たない作品では、組まずに null を返す', () => {
    const content = readContent('ja')
    // 実データの作品からストーリーだけを外した写し。ほかの値はストーリーを持つ作品と同じにして、違いをストーリーの有無だけにする
    const work: Work = { ...storyWorkOf(content.works), story: undefined }

    expect(storyProps('ja', content, readVillageText('ja'), work)).toBeNull()
  })
})

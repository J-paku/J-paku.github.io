// 作品ストーリーのサーバの入口(story-screen)のテスト。描かずに、呼んで返る React 要素の型と props を見る。
// 画面のコンテナ(@/components/Story)はここから実行時に import できない(scripts/check-layers.mjs の規則 3)ので、
// 要素の型は関数の名前で見る
import { describe, expect, it, vi } from 'vitest'
import type { Locale, Work } from '@content/types/content'
import { findStoryWork, listStorySlugs, readContent, readVillageText } from '@/lib/content/read'
import { storyProps } from '@/components/Story/utils/story-props'
import { NOT_FOUND } from './not-found-error.test-helper'
import Story from './story-screen'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

// 詳細ページを引ける作品(ストーリーを持つ公開作品)
const storyWorksOf = (locale: Locale): Work[] =>
  listStorySlugs(locale).map(slug => findStoryWork(locale, slug)!)

describe('Story(作品ストーリーの入口)', () => {
  it.each(['ja', 'ko'] as const)(
    '%s のストーリーを持つ作品ごとに、その言語の content で組んだ props をコンテナへ渡す',
    locale => {
      const works = storyWorksOf(locale)
      expect(works.length).toBeGreaterThan(0)

      for (const work of works) {
        const element = Story({ locale, work })

        expect(element.type.name).toBe('StoryContainer')
        expect(element.props).toEqual(
          storyProps(locale, readContent(locale), readVillageText(locale), work)
        )
        // 渡すのはその作品のストーリーと、その言語の文言そのもの
        expect(element.props.story).toBe(work.story)
        expect(element.props.ui).toBe(readContent(locale).ui)
        expect(element.props.switchLabel).toBe(readVillageText(locale).toVillage)
      }
    }
  )

  it('ストーリーを持たない作品は、空の 200 を返さず notFound() で 404 にする', () => {
    // 実データの作品からストーリーだけを外した写し。違いをストーリーの有無だけにする
    const work: Work = { ...storyWorksOf('ja')[0], story: undefined }

    expect(() => Story({ locale: 'ja', work })).toThrow(NOT_FOUND)
  })
})

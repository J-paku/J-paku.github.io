// 日本語の作品詳細ページ((ja)/works/[slug]/page.tsx)のテスト。静的に作る slug・メタデータと、
// ページが返す React 要素(描かない)を見る。詳細ページを作るのはストーリーを持つ公開作品だけ(wip は作らない)
import { describe, expect, it, vi } from 'vitest'
import type { Work } from '@content/types/content'
import { findStoryWork, readContent } from '@/lib/content/read'
import Story from '@/app/story-screen'
import { NOT_FOUND } from '@/app/not-found-error.test-helper'
import Page, { dynamicParams, generateMetadata, generateStaticParams } from './page'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

// ページに渡る経路の引数(Next は Promise で渡す)
const routeOf = (slug: string) => ({ params: Promise.resolve({ slug }) })

// content の作品を、詳細ページを作るもの(ストーリーを持つ公開作品)と作らないものに分ける
const hasPage = (work: Work): boolean => work.status === 'published' && work.story !== undefined
const worksBySide = () => {
  const works = readContent('ja').works
  return {
    withPage: works.filter(work => hasPage(work)),
    withoutPage: works.filter(work => !hasPage(work)),
  }
}

describe('作品詳細ページ(ja)', () => {
  it('ビルドで作った slug のほかは受け付けない(dynamicParams は false)', () => {
    expect(dynamicParams).toBe(false)
  })

  it('ストーリーを持つ公開作品の slug だけを、content の並びのまま静的に作る', () => {
    const { withPage, withoutPage } = worksBySide()
    // 作るものと作らないものが両方ある実データで見る
    expect(withPage.length).toBeGreaterThan(0)
    expect(withoutPage.length).toBeGreaterThan(0)

    expect(generateStaticParams()).toEqual(withPage.map(work => ({ slug: work.slug })))
  })

  it('作品ごとに、ストーリーの題と導入文で、その作品の URL を canonical にしたメタデータを組む', async () => {
    for (const work of worksBySide().withPage) {
      const metadata = await generateMetadata(routeOf(work.slug))

      expect(metadata.title).toBe(work.story!.intro.title)
      expect(metadata.description).toBe(work.story!.intro.lead)
      expect(metadata.alternates).toEqual({
        canonical: `/works/${work.slug}/`,
        languages: { ja: `/works/${work.slug}/`, ko: `/ko/works/${work.slug}/` },
      })
    }
  })

  it('作品ごとに、その作品を ja のストーリーの入口へ渡す', async () => {
    for (const work of worksBySide().withPage) {
      const element = await Page(routeOf(work.slug))

      expect(element.type).toBe(Story)
      expect(element.props).toEqual({ locale: 'ja', work })
      // 渡すのは content の作品そのもの
      expect(element.props.work).toBe(findStoryWork('ja', work.slug))
    }
  })

  it('ストーリーを持たない作品と無い slug は、メタデータを持たず、ページは notFound() で 404 にする', async () => {
    const slugs = [...worksBySide().withoutPage.map(work => work.slug), 'no-such-work']

    for (const slug of slugs) {
      await expect(generateMetadata(routeOf(slug))).resolves.toEqual({})
      await expect(Page(routeOf(slug))).rejects.toThrow(NOT_FOUND)
    }
  })
})

// 作品カードのリンクの覆いの種別(resolveOverlayKind)のテスト
import { describe, expect, it, vi } from 'vitest'
import type { Work, WorkLinks, WorkStory } from '@content/types/content'
import { resolveOverlayKind } from './overlay-kind'

// server-onlyはvitest(node環境)では無条件に例外を投げるので、中身を持たないmockに差し替える
vi.mock('server-only', () => ({}))

import { readContent } from '@/lib/content/read'

// 判定が読むのはlinksとstoryだけ。残りは型を満たすための最小の値
const STORY: WorkStory = {
  intro: { title: '導入', lead: '導入文' },
  scenes: [],
  outro: { title: 'まとめ', body: 'まとめ本文', stackSummary: [] },
}

const workOf = (links: WorkLinks, story?: WorkStory): Work => ({
  slug: 'sample',
  status: 'published',
  title: '作品',
  tagline: '一言',
  context: '文脈',
  contextKind: 'personal',
  stack: [],
  links,
  story,
})

describe('resolveOverlayKind', () => {
  it.each([
    ['liveだけ', { live: 'https://example.com/' }],
    ['repoだけ', { repo: 'https://github.com/example/repo' }],
    ['liveとrepoの両方', { live: 'https://example.com/', repo: 'https://github.com/example/repo' }],
  ] as const)('%sを持つ作品はリンクの覆いを出す', (_label, links) => {
    expect(resolveOverlayKind(workOf(links))).toEqual({
      hasLinks: true,
      hasStoryOverlay: false,
      hasOverlay: true,
    })
  })

  it('linksが無くstoryだけを持つ作品はストーリーの覆いを出す', () => {
    expect(resolveOverlayKind(workOf({}, STORY))).toEqual({
      hasLinks: false,
      hasStoryOverlay: true,
      hasOverlay: true,
    })
  })

  // 両方を持つ作品にストーリーのボタンまで重ねると、覆いの中身が二重になる
  it('linksとstoryの両方を持つ作品はlinksを優先し、ストーリーの覆いは出さない', () => {
    expect(resolveOverlayKind(workOf({ repo: 'https://github.com/example/repo' }, STORY))).toEqual({
      hasLinks: true,
      hasStoryOverlay: false,
      hasOverlay: true,
    })
  })

  it('linksもstoryも無い作品は覆いを出さない', () => {
    expect(resolveOverlayKind(workOf({}))).toEqual({
      hasLinks: false,
      hasStoryOverlay: false,
      hasOverlay: false,
    })
  })

  // 実データに両方の形があることも確かめる。どちらかが消えると上の分岐は実画面で通らなくなる
  it('実データではlinksを持つ作品と、linksが無くstoryだけを持つ作品がそれぞれの覆いに分かれる', () => {
    const { works } = readContent('ja')
    const linked = works.find(w => w.links.live !== undefined || w.links.repo !== undefined)
    const storyOnly = works.find(
      w => w.links.live === undefined && w.links.repo === undefined && w.story !== undefined
    )
    if (linked === undefined) throw new Error('linksを持つ作品がcontentに無い')
    if (storyOnly === undefined) throw new Error('linksが無くstoryだけを持つ作品がcontentに無い')

    expect(resolveOverlayKind(linked)).toMatchObject({ hasLinks: true, hasStoryOverlay: false })
    expect(resolveOverlayKind(storyOnly)).toMatchObject({ hasLinks: false, hasStoryOverlay: true })
  })
})

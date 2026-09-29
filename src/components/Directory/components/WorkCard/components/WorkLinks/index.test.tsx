// @vitest-environment happy-dom
// 作品カードの下部パネルのリンク(WorkLinks)の統合テスト。実データの作品が持つ公開ページ・GitHub・
// ストーリーの組み合わせで、どのリンクを出すかを利用者に見える形(role・名前・行き先・要素の有無)で確かめる
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Locale, Work } from '@content/types/content'
import WorkLinks from './index'

// server-onlyはvitestでは無条件に例外を投げるため、中身を持たないmockに差し替える
vi.mock('server-only', () => ({}))

import { readContent } from '@/lib/content/read'

const { works, ui } = readContent('ja')

const pickWork = (candidates: Work[], label: string, predicate: (work: Work) => boolean): Work => {
  const found = candidates.find(predicate)
  if (found === undefined) throw new Error(`${label}作品がcontentに無い`)
  return found
}

// 公開ページとGitHubの両方を持ち、ストーリーは持たない作品
const linkWork = pickWork(
  works,
  '公開ページとGitHubを持ちストーリーを持たない',
  work => work.links.live !== undefined && work.links.repo !== undefined && work.story === undefined
)
// リンクもストーリーも持たない作品(準備中の作品の形)。いまの実データには無いので、実データから外して作る
const bareWork: Work = { ...linkWork, links: {}, story: undefined }

// 親(WorkCard)と同じ渡し方。storySlugはストーリーを持つ作品だけに渡す
const renderLinks = (work: Work, locale: Locale = 'ja') =>
  render(
    <WorkLinks
      live={work.links.live}
      repo={work.links.repo}
      storySlug={work.story !== undefined ? work.slug : undefined}
      locale={locale}
      ui={readContent(locale).ui.work}
    />
  )

beforeEach(() => {
  // 外へ通信させない(happy-domは相対URLをlocalhost:3000へ取りに行く)
  vi.stubGlobal('fetch', () => Promise.reject(new Error('テストでは通信しない')))
  // ビルドはnext.configのtrailingSlash: trueをこの環境変数でnext/linkへ渡す。無いとnext/linkが
  // 行き先の末尾スラッシュを削り、配信物とは違うhrefになる
  vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('リンクの出し分け', () => {
  it('リンクもストーリーも持たない作品では何も描かない', () => {
    const { container } = renderLinks(bareWork)

    expect(container.childElementCount).toBe(0)
  })

  const linkCases: [string, Work][] = [
    ['公開ページとGitHub', linkWork],
    ['公開ページだけ', { ...linkWork, links: { live: linkWork.links.live } }],
    ['GitHubだけ', { ...linkWork, links: { repo: linkWork.links.repo } }],
  ]

  it.each(linkCases)(
    '外部リンクが%sでストーリーを持たない作品は、持っているリンクだけを出す',
    (_label, work) => {
      renderLinks(work)

      // 持たないリンクは要素ごと無い(行き先がundefinedのまま一致する)
      const live = screen.queryByRole('link', { name: ui.work.live })
      const repo = screen.queryByRole('link', { name: ui.work.repo })
      expect(live?.getAttribute('href')).toBe(work.links.live)
      expect(repo?.getAttribute('href')).toBe(work.links.repo)
      expect(screen.queryByRole('link', { name: ui.work.story })).toBeNull()
    }
  )

  it.each([
    ['ja', ''],
    ['ko', '/ko'],
  ] as const)(
    'ストーリーを持つ作品は、その言語のストーリーページへのリンクを出す(%s)',
    (locale, prefix) => {
      const content = readContent(locale)
      const work = pickWork(
        content.works,
        'ストーリーを持つ',
        candidate => candidate.story !== undefined
      )
      renderLinks(work, locale)

      const story = screen.getByRole('link', { name: content.ui.work.story })
      expect(story.getAttribute('href')).toBe(`${prefix}/works/${work.slug}/`)
    }
  )

  it('外部リンクとストーリーの両方を持つ作品にも、ストーリーへの常設の入口を並べて出す', () => {
    const storyWork = pickWork(works, 'ストーリーを持つ', work => work.story !== undefined)
    renderLinks({ ...linkWork, story: storyWork.story })

    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual([
      ui.work.live,
      ui.work.repo,
      ui.work.story,
    ])
  })
})

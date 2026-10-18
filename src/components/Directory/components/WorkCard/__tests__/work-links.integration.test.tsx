// 作品カード(状態コンテナ)の、下部パネルのリンク(WorkLinks)の統合テスト(Vitest Browser Mode)。
// カードを実際の Chromium で、フック・子と一緒に描き(ADR 0016)、事実のパネルに並ぶ外部リンクとストーリーへの常設の入口の出し分けを、
// 利用者に見える形(role・名前・行き先・要素の有無)で確かめる。
// props は一覧の container.fixture.ts が node で組んで provide した作品・文言を inject で受け取る。
// 実データに無い形(リンクを持たない作品など)は、作品の写しを変えてテストが直接渡す
import { cleanup, render, within } from '@testing-library/react'
import type { Work } from '@content/types/content'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import workLinksStyles from '@/components/Directory/components/WorkCard/components/WorkLinks/work-links.module.css'
import WorkCard from '@/components/Directory/components/WorkCard/container'
import {
  cardProps,
  directoryJa,
  directoryKo,
  factPanelOf,
  linkWork,
  pickWork,
  prepareEachTest,
  restoreEachTest,
  ui,
  works,
} from '@/components/Directory/__tests__/directory.test-helper'

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('下部パネルのリンク(WorkLinks)', () => {
  it('リンクもストーリーも持たない作品では何も描かない', () => {
    // リンクもストーリーも持たない作品(準備中の作品の形)。いまの実データには無いので、実データから外して作る
    const bareWork: Work = { ...linkWork, links: {}, story: undefined }
    render(<WorkCard {...cardProps(bareWork)} />)

    const panel = factPanelOf(bareWork)
    expect(panel.querySelector(`.${workLinksStyles.links}`)).toBeNull()
    expect(within(panel).queryAllByRole('link')).toHaveLength(0)
  })

  const linkCases: [string, Work][] = [
    ['公開ページとGitHub', linkWork],
    ['公開ページだけ', { ...linkWork, links: { live: linkWork.links.live } }],
    ['GitHubだけ', { ...linkWork, links: { repo: linkWork.links.repo } }],
  ]

  it.each(linkCases)(
    '外部リンクが%sでストーリーを持たない作品は、持っているリンクだけを出す',
    (_label, work) => {
      render(<WorkCard {...cardProps(work)} />)

      // 持たないリンクは要素ごと無い(行き先がundefinedのまま一致する)
      const panel = within(factPanelOf(work))
      const live = panel.queryByRole('link', { name: ui.work.live })
      const repo = panel.queryByRole('link', { name: ui.work.repo })
      expect(live?.getAttribute('href')).toBe(work.links.live)
      expect(repo?.getAttribute('href')).toBe(work.links.repo)
      expect(panel.queryByRole('link', { name: ui.work.story })).toBeNull()
    }
  )

  it('公開ページとGitHubへの外部リンクは、行き先へ参照元を渡さない(rel=noreferrer)', () => {
    render(<WorkCard {...cardProps(linkWork)} />)

    const panel = within(factPanelOf(linkWork))
    for (const name of [ui.work.live, ui.work.repo]) {
      expect(panel.getByRole('link', { name }).getAttribute('rel')).toBe('noreferrer')
    }
  })

  it.each([
    ['ja', directoryJa, ''],
    ['ko', directoryKo, '/ko'],
  ] as const)(
    'ストーリーを持つ作品は、その言語のストーリーページへのリンクを出す(%s)',
    (_locale, data, prefix) => {
      const work = pickWork(
        data.works,
        'ストーリーを持つ',
        candidate => candidate.story !== undefined
      )
      render(<WorkCard {...cardProps(work, data)} />)

      const story = within(factPanelOf(work)).getByRole('link', { name: data.ui.work.story })
      expect(story.getAttribute('href')).toBe(`${prefix}/works/${work.slug}/`)
    }
  )

  it('外部リンクとストーリーの両方を持つ作品にも、ストーリーへの常設の入口を並べて出す', () => {
    const storyWork = pickWork(works, 'ストーリーを持つ', work => work.story !== undefined)
    const work: Work = { ...linkWork, story: storyWork.story }
    render(<WorkCard {...cardProps(work)} />)

    expect(
      within(factPanelOf(work))
        .getAllByRole('link')
        .map(link => link.textContent)
    ).toEqual([ui.work.live, ui.work.repo, ui.work.story])
  })
})

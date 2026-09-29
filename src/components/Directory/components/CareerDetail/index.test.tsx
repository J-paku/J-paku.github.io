// @vitest-environment happy-dom
// 担当業務の詳細パネル(CareerDetail)の統合テスト。実データの経歴をhappy-domへ描き、
// 経歴が持つ項目(手順・判断の核・技術スタック・派遣先・機能一覧・余談)の有無で分かれる表示を、
// 利用者に見える形(role・見出し・文字・要素の有無)で確かめる
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Career, CareerDetail as CareerDetailContent } from '@content/types/content'
import CareerDetail from './index'

// server-onlyはNext.jsのビルド境界専用ガードで、vitestでは無条件に例外を投げる。
// テストでは中身を持たないmockに差し替え、読み込み専用の@/lib/content/readを素通しにする
vi.mock('server-only', () => ({}))

import { readContent } from '@/lib/content/read'

const { profile, ui } = readContent('ja')

// detailを持つ経歴だけを、detailを非undefinedの型で受け取る
type DetailedCareer = Career & { detail: CareerDetailContent }

const hasDetail = (career: Career): career is DetailedCareer => career.detail !== undefined

const detailedCareers = profile.careers.filter(hasDetail)

const pickCareer = (
  label: string,
  predicate: (detail: CareerDetailContent) => boolean
): DetailedCareer => {
  const found = detailedCareers.find(career => predicate(career.detail))
  if (found === undefined) throw new Error(`${label}経歴がcontentに無い`)
  return found
}

// 派遣先を持たない側の任意項目を全部持つ経歴
const fullCareer = pickCareer(
  '手順・判断の核・技術スタック・機能一覧・余談を全部持つ',
  detail =>
    detail.origin !== undefined &&
    detail.core !== undefined &&
    detail.stacks !== undefined &&
    detail.features !== undefined &&
    detail.asides !== undefined
)
// 派遣先を2件以上持つ経歴(節番号が並び順から振られることを見る)
const assignmentCareer = pickCareer(
  '派遣先を2件以上持つ',
  detail => (detail.assignments?.length ?? 0) >= 2
)

// 実データの経歴から任意項目を1つだけ外した写しを作る
const withoutField = (career: DetailedCareer, key: keyof CareerDetailContent): DetailedCareer => ({
  ...career,
  detail: { ...career.detail, [key]: undefined },
})

const renderCareer = (career: Career) =>
  render(<CareerDetail career={career} ui={ui} locale='ja' />)

// 日本語はPhraseTextが文節ごとに<wbr>を挟む。happy-domは<wbr>のdisplayを空で返し、
// 名前を組むdom-accessibility-apiが<wbr>ごとに空白を足す(実測)。
// 読み上げ名の実際はE2Eの領分とし、ここでは足された空白に左右されないよう空白を除いて比べる
const squash = (text: string) => text.replace(/\s+/g, '')
const nameIs = (expected: string) => (name: string) => squash(name) === squash(expected)

// 経歴1件のパネル。見出し(会社名)で名前の付いたregionとして出る
const panelOf = (career: Career) => screen.getByRole('region', { name: nameIs(career.company) })

// 見出し(h3)を持つ節。節の中だけを探すために使う
const sectionOf = (heading: string): HTMLElement => {
  const section = screen
    .getByRole('heading', { level: 3, name: nameIs(heading) })
    .closest('section')
  if (section === null) throw new Error(`「${heading}」の節が無い`)
  return section
}

afterEach(() => {
  cleanup()
})

describe('パネルの有無と骨組み', () => {
  it('detailを持たない経歴を渡されたら何も描かない', () => {
    const { container } = renderCareer({ ...fullCareer, detail: undefined })

    expect(container.childElementCount).toBe(0)
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('会社名の見出しで名前の付いた領域として出て、経歴のidで飛べて、作品一覧へ戻るリンクを持つ', () => {
    renderCareer(fullCareer)

    const panel = panelOf(fullCareer)
    // 左列の導線(#career-<id>)の飛び先。飛んだ後にフォーカスを受けられる
    expect(document.getElementById(`career-${fullCareer.id}`)).toBe(panel)
    expect(panel.getAttribute('tabindex')).toBe('-1')

    expect(
      within(panel).getByRole('heading', { level: 2, name: nameIs(fullCareer.company) })
    ).toBeTruthy()
    expect(within(panel).getByText(`${fullCareer.period} · ${fullCareer.role}`)).toBeTruthy()
    expect(
      within(panel).getByRole('heading', {
        level: 3,
        name: nameIs(fullCareer.detail.overview.title),
      })
    ).toBeTruthy()
    for (const fact of fullCareer.detail.facts) {
      expect(within(panel).getByText(fact.value)).toBeTruthy()
    }

    const back = within(panel).getByRole('link', { name: nameIs(ui.career.backToWorks) })
    expect(back.getAttribute('href')).toBe('#works')
  })

  it('同じページに全経歴を並べても、どのパネルも自分の会社名で名前が付く', () => {
    render(
      <>
        {detailedCareers.map(career => (
          <CareerDetail key={career.id} career={career} ui={ui} locale='ja' />
        ))}
      </>
    )

    expect(screen.getAllByRole('region')).toHaveLength(detailedCareers.length)
    for (const career of detailedCareers) {
      expect(panelOf(career).id).toBe(`career-${career.id}`)
    }
  })
})

describe('任意項目の有無', () => {
  it.each([
    ['現場の手順(origin)', 'origin', fullCareer.detail.origin?.heading],
    ['技術スタック(stacks)', 'stacks', fullCareer.detail.stacks?.heading],
    ['機能一覧(features)', 'features', fullCareer.detail.features?.heading],
    ['余談(asides)', 'asides', fullCareer.detail.asides?.heading],
  ] as const)('%sを持てば節の見出しを出し、外すと節ごと消える', (_label, key, heading) => {
    if (heading === undefined) throw new Error(`${key}の見出しが無い`)

    const { unmount } = renderCareer(fullCareer)
    expect(screen.getByRole('heading', { level: 3, name: nameIs(heading) })).toBeTruthy()
    unmount()

    renderCareer(withoutField(fullCareer, key))
    expect(screen.queryByRole('heading', { name: nameIs(heading) })).toBeNull()
    // 外したのはその節だけで、パネル自体は描かれている
    expect(panelOf(fullCareer)).toBeTruthy()
  })

  it('判断の核(core)を持てば主張と理由を出し、外すと両方消える', () => {
    const core = fullCareer.detail.core
    if (core === undefined) throw new Error('coreが無い')

    const { unmount } = renderCareer(fullCareer)
    expect(screen.getByText(core.claim)).toBeTruthy()
    expect(screen.getByText(core.body)).toBeTruthy()
    unmount()

    renderCareer(withoutField(fullCareer, 'core'))
    expect(screen.queryByText(core.claim)).toBeNull()
    expect(screen.queryByText(core.body)).toBeNull()
    expect(panelOf(fullCareer)).toBeTruthy()
  })

  it('技術スタックは層ごとに小見出しを立て、層の行を並べる', () => {
    const stacks = fullCareer.detail.stacks
    if (stacks === undefined) throw new Error('stacksが無い')
    renderCareer(fullCareer)

    const section = within(sectionOf(stacks.heading))
    const layerTitles = section
      .getAllByRole('heading', { level: 4 })
      .map(title => title.textContent)
    expect(layerTitles).toEqual(stacks.groups.map(group => group.title))
    for (const row of stacks.groups.flatMap(group => group.rows)) {
      expect(section.getAllByText(row.value).length).toBeGreaterThan(0)
    }
  })

  it('派遣先(assignments)を持てば、派遣先ごとに並び順の節番号と題字を出す', () => {
    const assignments = assignmentCareer.detail.assignments ?? []
    renderCareer(assignmentCareer)

    const eyebrows = screen.getAllByText(/^ASSIGNMENT \d+$/).map(eyebrow => eyebrow.textContent)
    expect(eyebrows).toEqual(
      assignments.map((_, index) => `ASSIGNMENT ${String(index + 1).padStart(2, '0')}`)
    )
    for (const assignment of assignments) {
      expect(
        screen.getByRole('heading', { level: 3, name: nameIs(assignment.client) })
      ).toBeTruthy()
    }
  })

  it('派遣先を外すと、節番号も派遣先の題字も出さない', () => {
    const assignments = assignmentCareer.detail.assignments ?? []
    renderCareer(withoutField(assignmentCareer, 'assignments'))

    expect(screen.queryByText(/^ASSIGNMENT \d+$/)).toBeNull()
    for (const assignment of assignments) {
      expect(screen.queryByRole('heading', { name: nameIs(assignment.client) })).toBeNull()
    }
    expect(panelOf(assignmentCareer)).toBeTruthy()
  })
})

describe('節の中の出し分け', () => {
  it('手順のうち強調するコマだけをstrongで示す', () => {
    const origin = fullCareer.detail.origin
    if (origin === undefined) throw new Error('originが無い')
    // 強調するコマとしないコマの両方がある前提で見る
    expect(origin.flow.some(step => step.emphasis === true)).toBe(true)
    expect(origin.flow.some(step => step.emphasis !== true)).toBe(true)
    renderCareer(fullCareer)

    const flow = within(within(sectionOf(origin.heading)).getByRole('list'))
    for (const step of origin.flow) {
      const label = flow.getByText(step.label)
      expect(label.closest('strong') !== null).toBe(step.emphasis === true)
    }
  })

  it('機能ごとの工程バッジは、担当した工程に「担当」、しなかった工程に「担当外」を読み上げ用に添える', () => {
    const features = fullCareer.detail.features
    if (features === undefined) throw new Error('featuresが無い')
    // 担当外の工程を含む機能を選ぶ
    const partial = features.items.find(item => item.roles.length < 3)
    if (partial === undefined) throw new Error('担当外の工程を持つ機能がcontentに無い')
    renderCareer(fullCareer)

    // 同じ名前の機能が並んでも取り違えないよう、日付も一致する行を選ぶ
    const item = within(sectionOf(features.heading))
      .getAllByText(partial.name)
      .map(name => name.closest('li'))
      .find(row => row !== null && within(row).queryByText(partial.date) !== null)
    if (item === null || item === undefined) throw new Error('機能の行が無い')

    const labels = {
      design: ui.career.roleDesign,
      build: ui.career.roleBuild,
      release: ui.career.roleRelease,
    } as const
    for (const role of ['design', 'build', 'release'] as const) {
      const badge = within(item).getByText(labels[role])
      const expected = partial.roles.includes(role) ? ui.career.roleOwned : ui.career.roleNotOwned
      expect(badge.textContent).toBe(`${labels[role]}${expected}`)
    }
  })
})

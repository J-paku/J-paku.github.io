// 一覧の画面(コンテナ)の統合テスト(Vitest Browser Mode)。一覧を実際の Chromium で、フック・子と一緒に描き(ADR 0016)、
// 作品カード・キャプチャ枠の中身・リンクの覆い・下部パネルのリンク・担当業務の詳細の出し分けを、利用者に見える形
// (role・名前・aria-*・inert・行き先・要素の有無)で確かめる。CSS も Vite が実際に当てるので、押せるかどうかは本物の重なりで決まる。
// props は入口(index.tsx)と同じ組み方で container.fixture.ts が node で組み、inject で受け取る。
// 実データに無い形(リンクを持たない作品・節を欠いた経歴など)は、作品・経歴を差し替えた props の写しをテストが直接渡す。
// 差し替えるのはネットワーク(場面 SVG の取得)と時間(リールの自動送り)と、タッチ端末かどうかの問い合わせ1つだけ(理由は viewAsTouch の注釈)。
// 動きを控える設定は差し替えず、Chromium の模擬(CDP)で本物の media query を切り替える
import { cleanup, render, screen, within } from '@testing-library/react'
import { inject } from 'vitest'
import { page } from 'vitest/browser'
import type {
  Career,
  CareerDetail as CareerDetailContent,
  CareerFact,
} from '@content/types/content'
import type { DirectoryData } from './container.fixture'
import DirectoryContainer from '@/components/Directory/container'

const directoryJa = inject('directoryJa')
const { ui, profile } = directoryJa

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

const renderDirectory = (data: DirectoryData = directoryJa) =>
  render(<DirectoryContainer {...data} />)

// 経歴を1件差し替えた画面の props。同じ id の経歴と入れ替える
const withCareer = (career: Career): DirectoryData => ({
  ...directoryJa,
  profile: {
    ...profile,
    careers: profile.careers.map(candidate => (candidate.id === career.id ? career : candidate)),
  },
})

// 日本語はPhraseTextが文節ごとに<wbr>を挟む。flexの箱の中では<wbr>も箱になり、名前を組む
// dom-accessibility-apiが箱の境に空白を足す(実測: 作品一覧への戻り道が「作品一覧へ 戻る」になった)。
// 読み上げ名の実際はE2Eの領分とし、ここでは足された空白に左右されないよう空白を除いて比べる
const squash = (text: string) => text.replace(/\s+/g, '')
const nameIs = (expected: string) => (name: string) => squash(name) === squash(expected)

// 経歴1件のパネル。見出し(会社名)で名前の付いたregionとして出る
const panelOf = (career: Career) => screen.getByRole('region', { name: nameIs(career.company) })

// パネルの中の、見出し(h3)を持つ節。節の中だけを探すために使う
const sectionIn = (panel: HTMLElement, heading: string): HTMLElement => {
  const section = within(panel)
    .getByRole('heading', { level: 3, name: nameIs(heading) })
    .closest('section')
  if (section === null) throw new Error(`「${heading}」の節が無い`)
  return section
}

// 事実表の行を、見出し列(dt)と本文列(dd)の組として文書順に読む。本文列は見出し列のすぐ後に並ぶ
const factPairsIn = (root: HTMLElement) =>
  within(root)
    .getAllByRole('term')
    .map(term => {
      const value = term.nextElementSibling
      return [term.textContent, value?.tagName === 'DD' ? value.textContent : null]
    })

const pairsOf = (rows: CareerFact[]) => rows.map(row => [row.label, row.value])

const NO_NETWORK = 'テストでは通信しない'

// 場面 SVG の取得を、テストが手放すまで返さずに留める。手放すと失敗で返す。
// 失敗した取得は取得の覚え(src/lib/fetch-svg-source.ts)から消えるので、次のテストは空の覚えから始まる
const heldFetches: Array<(reason: Error) => void> = []
const releaseSceneFetches = () => {
  for (const reject of heldFetches.splice(0)) reject(new Error(NO_NETWORK))
}

const originalUrl = window.location.href

beforeEach(async () => {
  // 既定は PC の画面・マウス・動きを許す設定。各テストが必要な条件だけ替える
  await page.viewport(1280, 720)
  // 外へ通信させない。リールは場面 SVG を取りに行き、取れない場面は準備中の文言に替わる
  vi.stubGlobal('fetch', () => Promise.reject(new Error(NO_NETWORK)))
})

afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  releaseSceneFetches()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', originalUrl)
})

describe('担当業務の詳細(CareerDetail)', () => {
  describe('パネルの有無と骨組み', () => {
    it('detailを持たない経歴には、パネルを描かない', () => {
      renderDirectory(withCareer({ ...fullCareer, detail: undefined }))

      expect(screen.queryByRole('region', { name: nameIs(fullCareer.company) })).toBeNull()
      expect(document.getElementById(`career-${fullCareer.id}`)).toBeNull()
      // 外したのはその経歴だけで、ほかの経歴のパネルは描かれている
      for (const career of detailedCareers.filter(other => other.id !== fullCareer.id)) {
        expect(panelOf(career)).toBeTruthy()
      }
    })

    it('会社名の見出しで名前の付いた領域として出て、経歴のidで飛べて、作品一覧へ戻るリンクを持つ', () => {
      renderDirectory()

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

    it.each([
      ['技術スタックを持つ', fullCareer],
      ['派遣先を持つ', assignmentCareer],
    ])(
      '%s経歴の事実表は、見出し列と本文列の組で、事実・技術スタック・派遣先の順に全行を並べる',
      (_label, career) => {
        renderDirectory()

        const { facts, stacks, assignments } = career.detail
        expect(factPairsIn(panelOf(career))).toEqual(
          pairsOf([
            ...facts,
            ...(stacks?.groups.flatMap(group => group.rows) ?? []),
            ...(assignments?.flatMap(assignment => assignment.facts) ?? []),
          ])
        )
      }
    )

    it('同じページに全経歴を並べても、どのパネルも自分の会社名で名前が付く', () => {
      renderDirectory()

      // 名前の付いた領域は、経歴のパネルのほかに作品一覧の節がある
      const works = screen.getByRole('region', { name: nameIs(ui.work.index) })
      const panels = screen.getAllByRole('region').filter(region => region !== works)
      expect(panels).toHaveLength(detailedCareers.length)
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

      const { unmount } = renderDirectory()
      expect(
        within(panelOf(fullCareer)).getByRole('heading', { level: 3, name: nameIs(heading) })
      ).toBeTruthy()
      unmount()

      renderDirectory(withCareer(withoutField(fullCareer, key)))
      // 外したのはその節だけで、パネル自体は描かれている
      expect(
        within(panelOf(fullCareer)).queryByRole('heading', { name: nameIs(heading) })
      ).toBeNull()
    })

    it('判断の核(core)を持てば主張と理由を出し、外すと両方消える', () => {
      const core = fullCareer.detail.core
      if (core === undefined) throw new Error('coreが無い')

      const { unmount } = renderDirectory()
      expect(within(panelOf(fullCareer)).getByText(core.claim)).toBeTruthy()
      expect(within(panelOf(fullCareer)).getByText(core.body)).toBeTruthy()
      unmount()

      renderDirectory(withCareer(withoutField(fullCareer, 'core')))
      const panel = within(panelOf(fullCareer))
      expect(panel.queryByText(core.claim)).toBeNull()
      expect(panel.queryByText(core.body)).toBeNull()
    })

    it('技術スタックは層ごとに小見出しを立て、層の行を並べる', () => {
      const stacks = fullCareer.detail.stacks
      if (stacks === undefined) throw new Error('stacksが無い')
      renderDirectory()

      const section = within(sectionIn(panelOf(fullCareer), stacks.heading))
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
      renderDirectory()

      const panel = panelOf(assignmentCareer)
      const eyebrows = within(panel)
        .getAllByText(/^ASSIGNMENT \d+$/)
        .map(eyebrow => eyebrow.textContent)
      expect(eyebrows).toEqual(
        assignments.map((_, index) => `ASSIGNMENT ${String(index + 1).padStart(2, '0')}`)
      )
      for (const assignment of assignments) {
        expect(
          within(panel).getByRole('heading', { level: 3, name: nameIs(assignment.client) })
        ).toBeTruthy()
        // 派遣先の事実表は、その派遣先の節の中に置く
        expect(factPairsIn(sectionIn(panel, assignment.client))).toEqual(pairsOf(assignment.facts))
      }
    })

    it('派遣先を外すと、節番号も派遣先の題字も出さない', () => {
      const assignments = assignmentCareer.detail.assignments ?? []
      renderDirectory(withCareer(withoutField(assignmentCareer, 'assignments')))

      const panel = within(panelOf(assignmentCareer))
      expect(panel.queryByText(/^ASSIGNMENT \d+$/)).toBeNull()
      for (const assignment of assignments) {
        expect(panel.queryByRole('heading', { name: nameIs(assignment.client) })).toBeNull()
      }
    })
  })

  describe('節の中の出し分け', () => {
    it('手順のうち強調するコマだけをstrongで示す', () => {
      const origin = fullCareer.detail.origin
      if (origin === undefined) throw new Error('originが無い')
      // 強調するコマとしないコマの両方がある前提で見る
      expect(origin.flow.some(step => step.emphasis === true)).toBe(true)
      expect(origin.flow.some(step => step.emphasis !== true)).toBe(true)
      renderDirectory()

      const flow = within(within(sectionIn(panelOf(fullCareer), origin.heading)).getByRole('list'))
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
      renderDirectory()

      // 同じ名前の機能が並んでも取り違えないよう、日付も一致する行を選ぶ
      const item = within(sectionIn(panelOf(fullCareer), features.heading))
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
})

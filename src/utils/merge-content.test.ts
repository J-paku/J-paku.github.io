import { describe, expect, it } from 'vitest'
import type { CaseSection, CaseSectionKey, Content, Measurement, Work } from '@/types/content'
import { CASE_SECTION_ORDER } from '@/types/content'
import { isEmpty, mergeContent, mergeWorks } from './merge-content'
import {
  assertSectionsIntegrity,
  assertSlugMatchesFilename,
  loadContent,
  sortWorks,
} from './content-loader'

// CASE_SECTION_ORDER の7keyを過不足なく持つ最小sectionsを作る
const makeSections = (headingSuffix: string, order: CaseSectionKey[] = CASE_SECTION_ORDER): CaseSection[] =>
  order.map((key) => ({ key, heading: `${key}-${headingSuffix}`, body: [`${key}-${headingSuffix}-body`] }))

const makeWork = (overrides: Partial<Work> = {}): Work => ({
  slug: 'sample-work',
  status: 'published',
  title: 'サンプル作品',
  tagline: 'サンプルの説明',
  context: '実務の再構成 — サンプル',
  contextKind: 'work',
  period: '2026.01 - 2026.02',
  role: '設計・実装',
  scale: '規模メモ',
  stack: ['TypeScript'],
  links: {},
  sections: makeSections('base'),
  ...overrides,
})

const makeContent = (overrides: Partial<Content> = {}): Content => ({
  ui: {
    skipToMain: 'skip',
    nav: { label: 'nav', works: 'works', now: 'now', skills: 'skills', about: 'about' },
    localeMenu: { label: 'locale', ja: 'ja', ko: 'ko' },
    theme: { label: 'theme', system: 'system', light: 'light', dark: 'dark' },
    work: {
      wipBadge: 'wip',
      period: 'period',
      role: 'role',
      scale: 'scale',
      stack: 'stack',
      live: 'live',
      repo: 'repo',
      backToList: 'back',
      shotPlaceholder: 'shotPlaceholder',
    },
    quality: {
      title: 'quality',
      measuredAt: 'measuredAt',
      violations: 'violations',
      viewRun: 'viewRun',
      hero: {
        items: [{ label: 'AXE', labelScript: 'latin' }],
        source: 'source',
        gate: 'gate',
      },
      footer: { label: 'MEASURED', environment: 'environment', limitation: 'limitation' },
    },
    notFound: { title: 'notFound', body: 'body', backHome: 'backHome' },
    commandPalette: {
      openButtonLabel: 'openButtonLabel',
      title: 'commandPaletteTitle',
      searchLabel: 'searchLabel',
      placeholder: 'placeholder',
      resultCount: 'resultCount',
      groupWorks: 'groupWorks',
      groupLocale: 'groupLocale',
      groupTheme: 'groupTheme',
      groupExternal: 'groupExternal',
    },
  },
  profile: {
    name: 'name',
    role: 'role',
    scope: ['scope'],
    headline: 'headline',
    location: 'location',
    goal: 'goal',
    links: { github: 'https://example.com/github' },
    careers: [{ company: 'c', period: 'p', stack: ['st'], role: 'r', summary: 's', highlights: ['h'] }],
    strengths: [{ title: 't', body: 'b' }],
  },
  skills: [{ category: 'cat', items: [{ name: 'name', evidence: [] }] }],
  now: [{ date: '2026.01', body: 'body' }],
  works: [makeWork()],
  ...overrides,
})

describe('mergeContent — 文字列・配列の空値フォールバック', () => {
  it('1: ko文字列が空ならja値を採用する', () => {
    const ja = makeContent({ profile: { ...makeContent().profile, name: 'ja-name' } })
    const ko = makeContent({ profile: { ...makeContent().profile, name: '' } })
    expect(mergeContent(ja, ko).profile.name).toBe('ja-name')
  })

  it('2: ko文字列に値があればko値を採用する', () => {
    const ja = makeContent({ profile: { ...makeContent().profile, name: 'ja-name' } })
    const ko = makeContent({ profile: { ...makeContent().profile, name: 'ko-name' } })
    expect(mergeContent(ja, ko).profile.name).toBe('ko-name')
  })

  it('3: ko配列が空ならja配列を採用する', () => {
    const jaStrengths = [{ title: 'ja-t', body: 'ja-b' }]
    const ja = makeContent({ profile: { ...makeContent().profile, strengths: jaStrengths } })
    const ko = makeContent({ profile: { ...makeContent().profile, strengths: [] } })
    expect(mergeContent(ja, ko).profile.strengths).toEqual(jaStrengths)
  })

  it('4: ko配列に要素があればko配列をそのまま採用する(部分マージしない)', () => {
    const jaStrengths = [
      { title: 'ja-t1', body: 'ja-b1' },
      { title: 'ja-t2', body: 'ja-b2' },
    ]
    const koStrengths = [{ title: 'ko-t1', body: 'ko-b1' }]
    const ja = makeContent({ profile: { ...makeContent().profile, strengths: jaStrengths } })
    const ko = makeContent({ profile: { ...makeContent().profile, strengths: koStrengths } })
    expect(mergeContent(ja, ko).profile.strengths).toEqual(koStrengths)
  })

  it('8: 値が0/falseなら代替されない(isEmptyの判定そのものを検証)', () => {
    expect(isEmpty(0)).toBe(false)
    expect(isEmpty(false)).toBe(false)
    expect(isEmpty('')).toBe(true)
    expect(isEmpty([])).toBe(true)
  })
})

describe('mergeWorks — slug基準の要素単位マージ', () => {
  it('5: koのあるslugのtaglineが空なら同じslugのja値を採用する', () => {
    const jaWorks = [makeWork({ slug: 'a', tagline: 'ja-tagline' })]
    const koWorks = [makeWork({ slug: 'a', tagline: '' })]
    expect(mergeWorks(jaWorks, koWorks)[0].tagline).toBe('ja-tagline')
  })

  it('6: koに無いslugはja要素をそのまま採用する', () => {
    const jaWorkB = makeWork({ slug: 'b', tagline: 'ja-only' })
    const jaWorks = [makeWork({ slug: 'a', tagline: 'ja-a' }), jaWorkB]
    const koWorks = [makeWork({ slug: 'a', tagline: 'ko-a' })]
    const merged = mergeWorks(jaWorks, koWorks)
    expect(merged.find((w) => w.slug === 'b')).toEqual(jaWorkB)
  })

  it('7: koのsections順序がjaと異なってもkeyで正しく対応づけて合成する', () => {
    const jaWorks = [makeWork({ slug: 'a', sections: makeSections('ja') })]
    // ko側は逆順で列挙。indexで揃えると全節がずれるはず
    const koWorks = [makeWork({ slug: 'a', sections: makeSections('ko', [...CASE_SECTION_ORDER].reverse()) })]
    const merged = mergeWorks(jaWorks, koWorks)[0].sections

    expect(merged.map((s) => s.key)).toEqual(CASE_SECTION_ORDER)
    for (const section of merged) {
      expect(section.heading).toBe(`${section.key}-ko`)
      expect(section.body).toEqual([`${section.key}-ko-body`])
    }
  })

  it('13: measurementsはko側が無ければjaを採用し、両方無ければundefinedのまま残る', () => {
    const jaMeasurements: Measurement[] = [
      { items: [{ label: '主要画面', labelScript: 'local', value: '3' }], condition: 'ja-condition' },
    ]
    const withJaOnly = mergeWorks(
      [makeWork({ slug: 'a', measurements: jaMeasurements })],
      [makeWork({ slug: 'a' })],
    )
    expect(withJaOnly[0].measurements).toEqual(jaMeasurements)

    // wip作品は両ロケールとも計測票を持たない。空配列へ丸めずundefinedで返す必要がある
    const withNeither = mergeWorks([makeWork({ slug: 'a' })], [makeWork({ slug: 'a' })])
    expect(withNeither[0].measurements).toBeUndefined()
  })
})

describe('sortWorks — 並び替え規則', () => {
  it('9: published2件+wip2件を混在させても規則どおりに並ぶ', () => {
    const publishedOld = makeWork({ slug: 'old-published', status: 'published', period: '2024.01 - 2024.03' })
    const publishedNew = makeWork({ slug: 'new-published', status: 'published', period: '2026.05 - 2026.06' })
    const wipZ = makeWork({ slug: 'z-wip', status: 'wip', period: undefined, sections: [] })
    const wipA = makeWork({ slug: 'a-wip', status: 'wip', period: undefined, sections: [] })

    const sorted = sortWorks([wipZ, publishedOld, wipA, publishedNew])

    expect(sorted.map((w) => w.slug)).toEqual(['new-published', 'old-published', 'a-wip', 'z-wip'])
  })
})

describe('content-loaderの実行時整合性検査', () => {
  it('10: published作品のsectionsが6個(1節欠落)だと検出する', () => {
    const missingRetrospect = makeWork({
      status: 'published',
      sections: makeSections('base', CASE_SECTION_ORDER.filter((key) => key !== 'retrospect')),
    })
    expect(() => assertSectionsIntegrity(missingRetrospect)).toThrow()
  })

  it('11: wip作品にsectionsが入っていると検出する', () => {
    const wipWithSections = makeWork({ status: 'wip', sections: makeSections('base').slice(0, 1) })
    expect(() => assertSectionsIntegrity(wipWithSections)).toThrow()
  })

  it('12: slugとファイル名が食い違うと検出する', () => {
    expect(() => assertSlugMatchesFilename('gatchanko', '/content/ja/works/seatmap-demo.ts')).toThrow()
  })

  it('正常なpublished/wipはthrowしない', () => {
    expect(() => assertSectionsIntegrity(makeWork({ status: 'published' }))).not.toThrow()
    expect(() => assertSectionsIntegrity(makeWork({ status: 'wip', sections: [] }))).not.toThrow()
    expect(() => assertSlugMatchesFilename('seatmap-demo', '/content/ja/works/seatmap-demo.ts')).not.toThrow()
  })
})

describe('loadContent — 実コンテンツの回帰確認', () => {
  it('作品4件がja/ko両方でロードされ、公開作品が先・期間降順で並ぶ', () => {
    const ja = loadContent('ja')
    const ko = loadContent('ko')
    expect(ja.works).toHaveLength(4)
    expect(ko.works).toHaveLength(4)
    expect(ja.works.map((w) => w.slug)).toEqual(ko.works.map((w) => w.slug))
    expect(ja.works.map((w) => w.status)).toEqual(['published', 'published', 'wip', 'wip'])
  })

  it('koはfallbackなしで自言語のまま出る(現状は全訳済みのため)', () => {
    const ko = loadContent('ko')
    const merged = mergeContent(loadContent('ja'), ko)
    expect(merged.profile.name).toBe(ko.profile.name)
  })

  // 08段階の受け入れ基準1。片側だけ埋めるとfallbackが日本語をko画面へ静かに流すため、
  // 合成後(mergeContent)ではなく生のloadContent同士で対照しなければ意味がない
  it('08段階の新設7フィールドが ja・ko 両方に値を持つ', () => {
    for (const locale of ['ja', 'ko'] as const) {
      const { profile, ui, works } = loadContent(locale)

      expect(profile.role, `${locale}.profile.role`).not.toBe('')
      expect(profile.scope.length, `${locale}.profile.scope`).toBeGreaterThan(0)
      expect(profile.links.github, `${locale}.profile.links.github`).toMatch(/^https:\/\//)
      expect(ui.work.shotPlaceholder, `${locale}.ui.work.shotPlaceholder`).not.toBe('')

      for (const career of profile.careers) {
        expect(career.stack.length, `${locale}.careers[${career.period}].stack`).toBeGreaterThan(0)
      }
      for (const work of works) {
        expect(work.context, `${locale}.works.${work.slug}.context`).not.toBe('')
        expect(['work', 'personal'], `${locale}.works.${work.slug}.contextKind`).toContain(work.contextKind)
      }
    }
  })

  // 上のテストは「両方に値がある」までしか見ない。ja文をkoへコピペした場合は値が入っているので通る。
  // ロケール依存の散文だけを取り出して相違を確認する(scope・stack・github は両言語で同値が正しいので除く)
  it('ロケール依存の散文が ja と ko で異なる(コピペ検出)', () => {
    const ja = loadContent('ja')
    const ko = loadContent('ko')

    expect(ko.profile.role).not.toBe(ja.profile.role)
    expect(ko.profile.headline).not.toBe(ja.profile.headline)
    expect(ko.ui.work.shotPlaceholder).not.toBe(ja.ui.work.shotPlaceholder)

    for (const koWork of ko.works) {
      const jaWork = ja.works.find((work) => work.slug === koWork.slug)
      expect(jaWork, `works.${koWork.slug} が ja 側に無い`).toBeDefined()
      expect(koWork.context, `works.${koWork.slug}.context`).not.toBe(jaWork?.context)
    }
  })
})

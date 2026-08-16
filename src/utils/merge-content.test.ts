import { describe, expect, it } from 'vitest'
import type { Content, Work, WorkDetail, WorkStory } from '@/types/content'
import { isEmpty, mergeContent, mergeWorks } from './merge-content'
import { assertSlugMatchesFilename, loadContent, sortWorks } from './content-loader'

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
  ...overrides,
})

const makeContent = (overrides: Partial<Content> = {}): Content => ({
  ui: {
    skipToMain: 'skip',
    localeMenu: { label: 'locale', ja: 'ja', ko: 'ko' },
    settingsMenu: { label: 'settings' },
    theme: { label: 'theme', light: 'light', dark: 'dark' },
    work: {
      index: 'index',
      openLinks: 'openLinks',
      story: 'story',
      openStory: 'openStory',
      wipBadge: 'wip',
      period: 'period',
      role: 'role',
      scale: 'scale',
      stack: 'stack',
      live: 'live',
      repo: 'repo',
      shotPlaceholder: 'shotPlaceholder',
      showDetail: 'showDetail',
      hideDetail: 'hideDetail',
    },
    workStory: { back: 'back', viewScene: 'viewScene', close: 'close', prevScene: 'prevScene', nextScene: 'nextScene' },
    notFound: { title: 'notFound', body: 'body', backHome: 'backHome' },
    colophon: { copyright: 'copyright', credit: 'credit' },
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

  it('17: ui.workStory.backが空ならja値を採用する', () => {
    const ja = makeContent({ ui: { ...makeContent().ui, workStory: { back: 'ja-back', viewScene: 'viewScene', close: 'close', prevScene: 'prevScene', nextScene: 'nextScene' } } })
    const ko = makeContent({ ui: { ...makeContent().ui, workStory: { back: '', viewScene: 'viewScene', close: 'close', prevScene: 'prevScene', nextScene: 'nextScene' } } })
    expect(mergeContent(ja, ko).ui.workStory.back).toBe('ja-back')
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

  it('13: works.detailはkoが無ければja値を丸ごと採用する', () => {
    const jaDetail: WorkDetail = {
      sections: [
        { id: 'background', title: 'ja-background-title', paragraphs: ['ja-background-p1', 'ja-background-p2'] },
      ],
    }
    const jaWorks = [makeWork({ slug: 'a', detail: jaDetail })]
    const koWorks = [makeWork({ slug: 'a', detail: undefined })]
    expect(mergeWorks(jaWorks, koWorks)[0].detail).toEqual(jaDetail)
  })

  it('14: works.detailはkoがあればko値を丸ごと採用する(部分マージしない)', () => {
    const jaDetail: WorkDetail = {
      sections: [
        { id: 'background', title: 'ja-background-title', paragraphs: ['ja-background-p1', 'ja-background-p2'] },
      ],
    }
    const koDetail: WorkDetail = {
      sections: [
        { id: 'background', title: 'ko-background-title', paragraphs: ['ko-background-p1', 'ko-background-p2'] },
      ],
    }
    const jaWorks = [makeWork({ slug: 'a', detail: jaDetail })]
    const koWorks = [makeWork({ slug: 'a', detail: koDetail })]
    expect(mergeWorks(jaWorks, koWorks)[0].detail).toEqual(koDetail)
  })

  it('15: works.storyはkoが無ければja値を丸ごと採用する', () => {
    const jaStory: WorkStory = {
      intro: { title: 'ja-intro-title', lead: 'ja-intro-lead' },
      scenes: [
        {
          id: 'scene-1',
          title: 'ja-scene-title',
          body: 'ja-scene-body',
          chips: [{ name: 'ja-chip', note: 'ja-chip-note' }],
          image: '/works/sample/scene1.svg',
        },
      ],
      outro: {
        title: 'ja-outro-title',
        body: 'ja-outro-body',
        stackSummary: [{ name: 'ja-stack', note: 'ja-stack-note' }],
      },
    }
    const jaWorks = [makeWork({ slug: 'a', story: jaStory })]
    const koWorks = [makeWork({ slug: 'a', story: undefined })]
    expect(mergeWorks(jaWorks, koWorks)[0].story).toEqual(jaStory)
  })

  it('16: works.storyはkoがあればko値を丸ごと採用する(部分マージしない)', () => {
    const jaStory: WorkStory = {
      intro: { title: 'ja-intro-title', lead: 'ja-intro-lead' },
      scenes: [
        {
          id: 'scene-1',
          title: 'ja-scene-title',
          body: 'ja-scene-body',
          chips: [{ name: 'ja-chip', note: 'ja-chip-note' }],
          image: '/works/sample/scene1.svg',
        },
      ],
      outro: {
        title: 'ja-outro-title',
        body: 'ja-outro-body',
        stackSummary: [{ name: 'ja-stack', note: 'ja-stack-note' }],
      },
    }
    const koStory: WorkStory = {
      intro: { title: 'ko-intro-title', lead: 'ko-intro-lead' },
      scenes: [
        {
          id: 'scene-1',
          title: 'ko-scene-title',
          body: 'ko-scene-body',
          chips: [{ name: 'ko-chip', note: 'ko-chip-note' }],
          image: '/works/sample/scene1.svg',
        },
      ],
      outro: {
        title: 'ko-outro-title',
        body: 'ko-outro-body',
        stackSummary: [{ name: 'ko-stack', note: 'ko-stack-note' }],
      },
    }
    const jaWorks = [makeWork({ slug: 'a', story: jaStory })]
    const koWorks = [makeWork({ slug: 'a', story: koStory })]
    expect(mergeWorks(jaWorks, koWorks)[0].story).toEqual(koStory)
  })
})

describe('sortWorks — 並び替え規則', () => {
  it('9: published2件+wip2件を混在させても規則どおりに並ぶ', () => {
    const publishedOld = makeWork({ slug: 'old-published', status: 'published', period: '2024.01 - 2024.03' })
    const publishedNew = makeWork({ slug: 'new-published', status: 'published', period: '2026.05 - 2026.06' })
    const wipZ = makeWork({ slug: 'z-wip', status: 'wip', period: undefined })
    const wipA = makeWork({ slug: 'a-wip', status: 'wip', period: undefined })

    const sorted = sortWorks([wipZ, publishedOld, wipA, publishedNew])

    expect(sorted.map((w) => w.slug)).toEqual(['new-published', 'old-published', 'a-wip', 'z-wip'])
  })
})

describe('content-loaderの実行時整合性検査', () => {
  it('12: slugとファイル名が食い違うと検出する', () => {
    expect(() => assertSlugMatchesFilename('gatchanko', '/content/ja/works/seatmap-demo.ts')).toThrow()
  })

  it('正常なslugはthrowしない', () => {
    expect(() => assertSlugMatchesFilename('seatmap-demo', '/content/ja/works/seatmap-demo.ts')).not.toThrow()
  })
})

describe('loadContent — 実コンテンツの回帰確認', () => {
  it('作品3件がja/ko両方でロードされ、公開作品が先・期間降順で並ぶ', () => {
    const ja = loadContent('ja')
    const ko = loadContent('ko')
    expect(ja.works).toHaveLength(3)
    expect(ko.works).toHaveLength(3)
    expect(ja.works.map((w) => w.slug)).toEqual(ko.works.map((w) => w.slug))
    // gatchanko(wip)を削除したため、公開3件のみになった
    expect(ja.works.map((w) => w.status)).toEqual(['published', 'published', 'published'])
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

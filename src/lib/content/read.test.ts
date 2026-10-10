// content と村ワールドの読み込み口(read.ts)のテスト。整合性検査は import した時点で走って投げるので、
// read.ts はファイルの先頭で import せず、各テストの中で読み込む。先頭で読むと、検査が落ちたときに
// このファイルごと読み込めなくなり、どのテストも走らないまま終わる
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Locale, Work } from '@content/types/content'
import type { VillageText, WorldSet } from '@content/types/world'

// server-only は Next.js のビルド境界専用ガードで、vitest(node 環境)では無条件に例外を投げる。
// テストでは中身を持たない mock に差し替え、読み込み専用の read.ts を素通しにする
vi.mock('server-only', () => ({}))

// 差し替えたモジュールを毎回当て直せるよう、覚えを捨ててから読み込み直す
const loadFresh = async () => {
  vi.resetModules()
  return import('./read')
}

const MOCKED = [
  'node:fs',
  './validate',
  './validate-world',
  '@content/ja/village',
  '@content/ja/works/seatmap-demo',
  '@content/ko/works/seatmap-demo',
]

afterEach(() => {
  for (const path of MOCKED) vi.doUnmock(path)
  vi.resetModules()
})

// 中身を持たない story。ja/ko で同じものを持たせれば scene id の検査も通る
const EMPTY_STORY: Work['story'] = {
  intro: { title: '', lead: '' },
  scenes: [],
  outro: { title: '', body: '', stackSummary: [] },
}

const slugsOf = (works: Work[]): string[] => works.map(w => w.slug)

// content/ja/works の一覧に、実在しないファイル名を 1 つ足して返すよう差し替える
const addWorkFile = (extra: string) => {
  vi.doMock('node:fs', async importOriginal => {
    const fs = await importOriginal<typeof import('node:fs')>()
    return { ...fs, readdirSync: (dir: string) => [...fs.readdirSync(dir), extra] }
  })
}

describe('読み込み口', () => {
  it('実データは読み込み時の整合性検査を通る', async () => {
    await expect(loadFresh()).resolves.toHaveProperty('readContent')
  })
  it('readVillageText は言語ごとの村の文言を返す', async () => {
    const read = await loadFresh()
    const ja = await import('@content/ja/village')
    const ko = await import('@content/ko/village')
    expect(read.readVillageText('ja')).toBe(ja.village)
    expect(read.readVillageText('ko')).toBe(ko.village)
  })
  it('readWorldSet は村ワールドの定義をそのまま返す', async () => {
    const read = await loadFresh()
    const { worldSet } = await import('@content/world')
    expect(read.readWorldSet()).toBe(worldSet)
  })
})

describe('listStorySlugs', () => {
  it.each(['ja', 'ko'] as const)('%s は詳細ページを引ける作品の slug を順に返す', async locale => {
    // 一覧に出す slug と、findStoryWork で詳細ページを引ける作品は一致していなければならない
    const read = await loadFresh()
    const works = read.readContent(locale).works
    const expected = slugsOf(works.filter(w => read.findStoryWork(locale, w.slug) !== null))
    // 対象の作品と対象外の作品が両方ある実データで見る
    expect(expected.length).toBeGreaterThan(0)
    expect(expected.length).toBeLessThan(works.length)
    expect(read.listStorySlugs(locale)).toEqual(expected)
  })
  it('制作中の作品は story を持っていても詳細ページの対象にしない', async () => {
    // 不変ルール5。story を持たない公開作品を、ja/ko そろえて制作中 + story ありに差し替える
    vi.doMock('@content/ja/works/seatmap-demo', async importOriginal => {
      const actual = await importOriginal<typeof import('@content/ja/works/seatmap-demo')>()
      return { seatmapDemo: { ...actual.seatmapDemo, status: 'wip', story: EMPTY_STORY } }
    })
    vi.doMock('@content/ko/works/seatmap-demo', async importOriginal => {
      const actual = await importOriginal<typeof import('@content/ko/works/seatmap-demo')>()
      return { seatmapDemo: { ...actual.seatmapDemo, status: 'wip', story: EMPTY_STORY } }
    })
    const read = await loadFresh()
    const wip = read.readContent('ja').works.find(w => w.slug === 'seatmap-demo')
    expect(wip?.status).toBe('wip')
    expect(wip?.story).toBe(EMPTY_STORY)
    expect(read.listStorySlugs('ja')).not.toContain('seatmap-demo')
    expect(read.findStoryWork('ja', 'seatmap-demo')).toBeNull()
  })
})

describe('findStoryWork', () => {
  it.each(['ja', 'ko'] as const)('%s で story を持つ公開作品だけを返す', async locale => {
    const read = await loadFresh()
    const works = read.readContent(locale).works
    const withStory = works.find(w => w.story !== undefined)
    const withoutStory = works.find(w => w.story === undefined)
    if (withStory === undefined || withoutStory === undefined) throw new Error('content')
    expect(read.findStoryWork(locale, withStory.slug)).toBe(withStory)
    expect(read.findStoryWork(locale, withoutStory.slug)).toBeNull()
    expect(read.findStoryWork(locale, 'no-such-work')).toBeNull()
  })
})

describe('読み込み時の整合性検査', () => {
  it('content/ja/works の .ts 以外のファイルは作品として数えない', async () => {
    // .ts 以外を作品として数えると、登録表に無いファイルとして読み込みが落ちる
    const expected = slugsOf((await loadFresh()).readContent('ja').works)
    addWorkFile('README.md')
    const read = await loadFresh()
    expect(slugsOf(read.readContent('ja').works)).toEqual(expected)
  })
  it('ファイル名からは末尾の .ts だけを外して登録表と突き合わせる', async () => {
    addWorkFile('draft.tsx.ts')
    await expect(loadFresh()).rejects.toHaveProperty(
      'message',
      'content の整合性検査に失敗:\n- content/works/draft.tsx.ts が登録表に無い'
    )
  })
  it('content の検査が問題を返したら、全件を行に並べて投げる', async () => {
    vi.doMock('./validate', async importOriginal => ({
      ...(await importOriginal<typeof import('./validate')>()),
      validateContent: () => ['問題1', '問題2'],
    }))
    await expect(loadFresh()).rejects.toHaveProperty(
      'message',
      'content の整合性検査に失敗:\n- 問題1\n- 問題2'
    )
  })
  it('world の検査が問題を返したら、全件を行に並べて投げる', async () => {
    vi.doMock('./validate-world', async importOriginal => ({
      ...(await importOriginal<typeof import('./validate-world')>()),
      validateWorldSet: () => ['問題1', '問題2'],
    }))
    await expect(loadFresh()).rejects.toHaveProperty(
      'message',
      'world の整合性検査に失敗:\n- 問題1\n- 問題2'
    )
  })
  it('地点の文言の検査が返した問題も、言語ごとに world の問題として投げる', async () => {
    vi.doMock('./validate-world', async importOriginal => ({
      ...(await importOriginal<typeof import('./validate-world')>()),
      validateVillageText: (_set: WorldSet, _text: VillageText, locale: Locale) => [
        `${locale} の文言の問題`,
      ],
    }))
    await expect(loadFresh()).rejects.toHaveProperty(
      'message',
      'world の整合性検査に失敗:\n- ja の文言の問題\n- ko の文言の問題'
    )
  })
  it('地点の story リンクが story の無い作品を指せば、その言語だけを報告して投げる', async () => {
    // ja の文言だけ、story リンクの行き先を story を持たない作品へ差し替える
    const read = await loadFresh()
    const stops = Object.entries(read.readVillageText('ja').stops)
    const id = stops.find(([, stop]) => stop.link?.target.kind === 'story')?.[0] ?? ''
    const slug = read.readContent('ja').works.find(w => w.story === undefined)?.slug ?? ''
    expect(id).not.toBe('')
    expect(slug).not.toBe('')
    vi.doMock('@content/ja/village', async importOriginal => {
      const { village } = await importOriginal<typeof import('@content/ja/village')>()
      const stop = { ...village.stops[id], link: { label: '', target: { kind: 'story', slug } } }
      return { village: { ...village, stops: { ...village.stops, [id]: stop } } }
    })
    await expect(loadFresh()).rejects.toHaveProperty(
      'message',
      `world の整合性検査に失敗:\n- ja: 地点 "${id}" の slug "${slug}" に story が無い`
    )
  })
})

// content/の整合性検査(validateContent・sortWorks)のテスト
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { vi } from 'vitest'
import type { Content, Work } from '@content/types/content'
import { validateContent, sortWorks } from './validate'

// server-only は Next.js のビルド境界専用ガードで、vitest(node 環境)では無条件に例外を投げる。
// テストでは中身を持たない mock に差し替え、読み込み専用の @/lib/content/read を素通しにする
vi.mock('server-only', () => ({}))

import { readContent } from './read'

// 検証に必要な最小の Work。detail・story は任意
const work = (slug: string, over: Partial<Work> = {}): Work => ({
  slug,
  status: 'published',
  title: slug,
  tagline: 't',
  context: 'c',
  contextKind: 'personal',
  period: '2026-01',
  stack: [],
  links: {},
  ...over,
})

// ui・profile などは検証対象外なので型だけ合わせて空に近い値を入れる
const content = (works: Work[]): Content => ({
  works,
  ui: {} as Content['ui'],
  profile: {} as Content['profile'],
  skills: [],
  now: [],
})

describe('validateContent', () => {
  it('ja/ko の slug 集合が一致すれば問題なし', () => {
    const ja = content([work('a'), work('b')])
    const ko = content([work('a'), work('b')])
    expect(validateContent(ja, ko, ['a', 'b'])).toEqual([])
  })
  it('ko に無い slug を報告する', () => {
    const ja = content([work('a'), work('b')])
    const ko = content([work('a')])
    expect(validateContent(ja, ko, ['a', 'b'])).toContain('ko に slug "b" が無い')
  })
  it('ko にだけある slug を報告する', () => {
    // ja 側の登録表とファイルは a だけ。ko だけが b を持つ「ja に無い」向きを押さえる
    const ja = content([work('a')])
    const ko = content([work('a'), work('b')])
    expect(validateContent(ja, ko, ['a'])).toContain('ja に slug "b" が無い')
  })
  it('status が ja/ko で食い違えば報告する', () => {
    // ja は公開済み、ko は制作中。両方 published の見本では status の比較が働かない
    const ja = content([work('a')])
    const ko = content([work('a', { status: 'wip', period: undefined })])
    expect(validateContent(ja, ko, ['a'])).toContain('slug "a" の status が ja/ko で一致しない')
  })
  it('status と story の有無が言語間で食い違えば報告する', () => {
    const story = {
      intro: { title: '', lead: '' },
      scenes: [],
      outro: { title: '', body: '', stackSummary: [] },
    }
    const ja = content([work('a', { story })])
    const ko = content([work('a')])
    expect(validateContent(ja, ko, ['a'])).toContain(
      'slug "a" の story の有無が ja/ko で一致しない'
    )
  })
  it('登録表に無いファイルを報告する', () => {
    const ja = content([work('a')])
    const ko = content([work('a')])
    expect(validateContent(ja, ko, ['a', 'orphan'])).toContain(
      'content/works/orphan.ts が登録表に無い'
    )
  })
  it('scene id が言語間で一致しなければ報告する', () => {
    const scene = (id: string) => ({ id, title: '', body: '', chips: [], image: '' })
    const mk = (ids: string[]) => ({
      intro: { title: '', lead: '' },
      scenes: ids.map(scene),
      outro: { title: '', body: '', stackSummary: [] },
    })
    const ja = content([work('a', { story: mk(['s1', 's2']) })])
    const ko = content([work('a', { story: mk(['s1', 'sX']) })])
    expect(validateContent(ja, ko, ['a'])).toContain('slug "a" の scene id が ja/ko で一致しない')
  })
  it('実際の content は問題なし', () => {
    // 見本だけを通すと、規約を破った実データが検査を素通りしても誰も気付けない。
    // 作品ファイルの一覧は read.ts と同じく content/ja/works を読んで作る
    const workFiles = readdirSync(path.join(process.cwd(), 'content', 'ja', 'works'))
      .filter(name => name.endsWith('.ts'))
      .map(name => name.replace(/\.ts$/, ''))
    expect(workFiles.length).toBeGreaterThan(0)
    expect(validateContent(readContent('ja'), readContent('ko'), workFiles)).toEqual([])
  })
})

describe('sortWorks', () => {
  it('published を period 降順で先に、wip を slug 昇順で後に並べる', () => {
    const list = [
      work('w2', { status: 'wip', period: undefined }),
      work('p-old', { period: '2025-01' }),
      work('w1', { status: 'wip', period: undefined }),
      work('p-new', { period: '2026-02' }),
    ]
    expect(sortWorks(list).map(w => w.slug)).toEqual(['p-new', 'p-old', 'w1', 'w2'])
  })
})

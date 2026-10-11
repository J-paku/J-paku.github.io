// ja と ko の村の文言(content/{ja,ko}/village.ts)を突き合わせるテスト。
// 型(VillageText)が両言語に求めるのは必須の欄だけで、任意の欄(StopText の arrive・talk・link・entries)は
// 片方の言語にだけ書いても、値が言語の間でずれても型は通る。言語に依らない E2E は ja だけで回す
// (docs/decisions/0015-trim-e2e-overlap-and-ko.md)ので、任意の欄の抜けとずれはここで落とす。
// 欄の名前を並べずに木を丸ごと歩くので、どこかに任意の欄が増えても同じ規則で見る
import { describe, expect, it } from 'vitest'
import type { StopText } from '@content/types/world'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'

// 文言の木。欄の有無・配列の長さ・文字列を道筋ごとに比べる
type TextNode = string | number | boolean | undefined | TextNode[] | { [key: string]: TextNode }

// 言語に依らず ja と ko で同じでなければならない値の道筋。
// リンク先(作品の slug・外部 URL)は両言語で同じ所を指し、経歴の並びのロゴは同じ会社の同じ画像
const SAME_IN_BOTH = [/^stops\.[^.]+\.link\.target\.[^.]+$/, /^stops\.[^.]+\.entries\.\d+\.logo$/]

const join = (path: string, key: string) => (path === '' ? key : `${path}.${key}`)

// ja と ko の木を同じ道筋で歩き、食い違いを 1 つずつ文で返す
const comparePair = (ja: TextNode, ko: TextNode, path = ''): string[] => {
  if (ja === undefined || ko === undefined) {
    if (ja === ko) return []
    return [`${path}: ${ja === undefined ? 'ko' : 'ja'} にだけある`]
  }
  if (Array.isArray(ja) && Array.isArray(ko)) {
    if (ja.length !== ko.length) return [`${path}: 数が違う(ja ${ja.length}・ko ${ko.length})`]
    return ja.flatMap((item, index) => comparePair(item, ko[index], join(path, String(index))))
  }
  if (
    typeof ja === 'object' &&
    typeof ko === 'object' &&
    !Array.isArray(ja) &&
    !Array.isArray(ko)
  ) {
    const keys = [...new Set([...Object.keys(ja), ...Object.keys(ko)])]
    return keys.flatMap(key => comparePair(ja[key], ko[key], join(path, key)))
  }
  if (typeof ja === 'string' && typeof ko === 'string') {
    if (SAME_IN_BOTH.some(pattern => pattern.test(path))) {
      return ja === ko ? [] : [`${path}: 言語に依らない値が違う(ja ${ja}・ko ${ko})`]
    }
    const empty = [ja.trim() === '' ? 'ja' : null, ko.trim() === '' ? 'ko' : null].filter(
      locale => locale !== null
    )
    return empty.length === 0 ? [] : [`${path}: ${empty.join('・')} の文言が空`]
  }
  return ja === ko ? [] : [`${path}: 形が違う`]
}

// 比べ方そのものを確かめるための小さな地点。必須の欄は埋め、任意の欄はテストごとに足す
const stop = (extra: Partial<StopText> = {}): StopText => ({
  place: '場所',
  title: '見出し',
  claim: '主張',
  proof: '根拠',
  hook: '誘い',
  next: '次へ',
  detail: '補足',
  ...extra,
})
const storyLink = (slug: string) => ({ label: '読む', target: { kind: 'story' as const, slug } })
const entry = (logo: string) => ({
  logo,
  company: '会社',
  period: '2022.04 - 2024.12',
  body: '本文',
})

describe('comparePair(比べ方)', () => {
  it('任意の欄が片方の言語にだけあると落とす', () => {
    expect(
      comparePair({ stops: { s: stop({ link: storyLink('a') }) } }, { stops: { s: stop() } })
    ).toEqual(['stops.s.link: ja にだけある'])
    expect(
      comparePair({ stops: { s: stop() } }, { stops: { s: stop({ arrive: '着いた' }) } })
    ).toEqual(['stops.s.arrive: ko にだけある'])
  })
  it('リンク先と経歴のロゴは言語の間で同じでなければ落とす', () => {
    expect(
      comparePair(
        { stops: { s: stop({ link: storyLink('a') }) } },
        { stops: { s: stop({ link: storyLink('b') }) } }
      )
    ).toEqual(['stops.s.link.target.slug: 言語に依らない値が違う(ja a・ko b)'])
    expect(
      comparePair(
        { stops: { s: stop({ entries: [entry('/logos/a.png')] }) } },
        { stops: { s: stop({ entries: [entry('/logos/b.png')] }) } }
      )
    ).toEqual(['stops.s.entries.0.logo: 言語に依らない値が違う(ja /logos/a.png・ko /logos/b.png)'])
  })
  it('経歴の数が違うと落とす', () => {
    expect(
      comparePair(
        { stops: { s: stop({ entries: [entry('/logos/a.png'), entry('/logos/b.png')] }) } },
        { stops: { s: stop({ entries: [entry('/logos/a.png')] }) } }
      )
    ).toEqual(['stops.s.entries: 数が違う(ja 2・ko 1)'])
  })
  it('言語ごとに違ってよい文言は、どちらかが空なら落とす', () => {
    expect(
      comparePair(
        { stops: { s: stop({ link: storyLink('a') }) } },
        { stops: { s: stop({ link: { ...storyLink('a'), label: ' ' } }) } }
      )
    ).toEqual(['stops.s.link.label: ko の文言が空'])
    expect(
      comparePair({ stops: { s: stop({ title: '' }) } }, { stops: { s: stop({ title: '' }) } })
    ).toEqual(['stops.s.title: ja・ko の文言が空'])
  })
  it('文言が違っても形と言語に依らない値が同じなら通す', () => {
    expect(
      comparePair(
        { stops: { s: stop({ link: storyLink('a'), entries: [entry('/logos/a.png')] }) } },
        {
          stops: {
            s: stop({
              title: '제목',
              link: { ...storyLink('a'), label: '읽기' },
              entries: [{ ...entry('/logos/a.png'), company: '회사' }],
            }),
          },
        }
      )
    ).toEqual([])
  })
})

describe('実際の村の文言(ja と ko)', () => {
  it('比べる任意の欄(link・entries・arrive・talk)が両言語の実際の文言にある', () => {
    // どれも 1 つも無いと、下の突き合わせは任意の欄を 1 度も比べずに通ってしまう
    for (const key of ['link', 'entries', 'arrive', 'talk'] as const) {
      for (const [locale, text] of [
        ['ja', villageJa],
        ['ko', villageKo],
      ] as const) {
        expect(
          Object.values(text.stops).some(s => s[key] !== undefined),
          `${locale} に ${key} を持つ地点がある`
        ).toBe(true)
      }
    }
  })
  it('任意の欄も両言語にそろい、リンク先と経歴のロゴが同じで、文言が空でない', () => {
    expect(comparePair(villageJa, villageKo)).toEqual([])
  })
})

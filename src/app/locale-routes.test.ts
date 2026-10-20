// 言語ルートが共有する中身(locale-routes)のテスト。layout・not-found は呼んで返る React 要素の型と props を、
// メタデータは組んだ値を見る。どれも受け取った locale の content と URL で組むか(locale は URL だけで決まる)を確かめる
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { readContent, readVillageText } from '@/lib/content/read'
import HtmlShell from './html-shell'
import {
  createListMetadata,
  createNotFound,
  createRootLayout,
  createVillageMetadata,
} from './locale-routes'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

describe('createRootLayout', () => {
  it.each(['ja', 'ko'] as const)(
    '%s を <html> の枠(HtmlShell)へ渡し、子をそのまま入れる',
    locale => {
      const child = createElement('main', { id: 'main' })
      const RootLayout = createRootLayout(locale)
      const element = RootLayout({ children: child })

      expect(element.type).toBe(HtmlShell)
      expect(element.props).toEqual({ locale, children: child })
      expect(element.props.children).toBe(child)
    }
  )
})

describe('createNotFound', () => {
  it.each([
    ['ja', '/list/'],
    ['ko', '/ko/list/'],
  ] as const)(
    '%s の文言で見出し・本文と、同じ言語の一覧(%s)へ戻る導線を出す',
    (locale, listHref) => {
      const { ui } = readContent(locale)
      const NotFound = createNotFound(locale)
      const element = NotFound()
      const [title, body, back] = element.props.children

      // スキップリンクの飛び先(#main)になる本文の枠
      expect(element.type).toBe('main')
      expect(element.props.id).toBe('main')
      expect(title.type).toBe('h1')
      expect(title.props.children).toBe(ui.notFound.title)
      expect(body.type).toBe('p')
      expect(body.props.children).toBe(ui.notFound.body)
      expect(back.type).toBe('a')
      expect(back.props).toEqual({ href: listHref, children: ui.notFound.backHome })
    }
  )
})

describe('createVillageMetadata', () => {
  it.each([
    ['ja', '/'],
    ['ko', '/ko/'],
  ] as const)('%s の名前と村の紹介文を、村の URL(%s)を canonical にして組む', (locale, href) => {
    const metadata = createVillageMetadata(locale)

    expect(metadata.title).toBe(readContent(locale).profile.name)
    expect(metadata.description).toBe(readVillageText(locale).intro)
    expect(metadata.alternates).toEqual({
      canonical: href,
      languages: { ja: '/', ko: '/ko/' },
    })
  })
})

describe('createListMetadata', () => {
  it.each([
    ['ja', '/list/'],
    ['ko', '/ko/list/'],
  ] as const)(
    '%s の索引の文言と名前・肩書きを、一覧の URL(%s)を canonical にして組む',
    (locale, href) => {
      const { profile, ui } = readContent(locale)
      const metadata = createListMetadata(locale)

      expect(metadata.title).toBe(`${ui.work.index} — ${profile.name}`)
      expect(metadata.description).toBe(profile.headline)
      expect(metadata.alternates).toEqual({
        canonical: href,
        languages: { ja: '/list/', ko: '/ko/list/' },
      })
    }
  )
})

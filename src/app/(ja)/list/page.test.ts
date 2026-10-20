// 日本語の一覧ページ((ja)/list/page.tsx)のテスト。描かずに、呼んで返る React 要素と、書き出すメタデータを見る
import { describe, expect, it, vi } from 'vitest'
import { readContent } from '@/lib/content/read'
import Directory from '@/app/directory-screen'
import Page, { metadata } from './page'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

describe('一覧ページ(ja)', () => {
  it('一覧の入口へ、この経路の locale(ja)だけを渡す', () => {
    const element = Page()

    expect(element.type).toBe(Directory)
    expect(element.props).toEqual({ locale: 'ja' })
  })

  it('ja の索引の文言と名前・肩書きを、/list/ を canonical にしたメタデータにする', () => {
    const { profile, ui } = readContent('ja')

    expect(metadata.title).toBe(`${ui.work.index} — ${profile.name}`)
    expect(metadata.description).toBe(profile.headline)
    expect(metadata.alternates?.canonical).toBe('/list/')
  })
})

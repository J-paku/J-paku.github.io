// 日本語の村ページ((ja)/page.tsx)のテスト。描かずに、呼んで返る React 要素と、書き出すメタデータを見る
import { describe, expect, it, vi } from 'vitest'
import { readContent, readVillageText } from '@/lib/content/read'
import VillagePage from '@/app/village-screen'
import Page, { metadata } from './page'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

describe('村ページ(ja)', () => {
  it('村の入口へ、この経路の locale(ja)だけを渡す', () => {
    const element = Page()

    expect(element.type).toBe(VillagePage)
    expect(element.props).toEqual({ locale: 'ja' })
  })

  it('ja の名前と村の紹介文を、/ を canonical にしたメタデータにする', () => {
    expect(metadata.title).toBe(readContent('ja').profile.name)
    expect(metadata.description).toBe(readVillageText('ja').intro)
    expect(metadata.alternates?.canonical).toBe('/')
  })
})

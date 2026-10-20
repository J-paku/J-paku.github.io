// 韓国語の村ページ((ko)/ko/page.tsx)のテスト。描かずに、呼んで返る React 要素と、書き出すメタデータを見る
import { describe, expect, it, vi } from 'vitest'
import { readContent, readVillageText } from '@/lib/content/read'
import VillagePage from '@/app/village-screen'
import Page, { metadata } from './page'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

describe('村ページ(ko)', () => {
  it('村の入口へ、この経路の locale(ko)だけを渡す', () => {
    const element = Page()

    expect(element.type).toBe(VillagePage)
    expect(element.props).toEqual({ locale: 'ko' })
  })

  it('ko の名前と村の紹介文を、/ko/ を canonical にしたメタデータにする', () => {
    expect(metadata.title).toBe(readContent('ko').profile.name)
    expect(metadata.description).toBe(readVillageText('ko').intro)
    expect(metadata.alternates?.canonical).toBe('/ko/')
  })
})

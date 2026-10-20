// 日本語ルートの not-found((ja)/not-found.tsx)のテスト。描かずに、呼んで返る React 要素を見る
import { describe, expect, it, vi } from 'vitest'
import { readContent } from '@/lib/content/read'
import NotFound from './not-found'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

describe('ルートの not-found(ja)', () => {
  it('ja の文言で、同じ言語の一覧(/list/)へ戻る導線を出す', () => {
    const { ui } = readContent('ja')
    const [title, body, back] = NotFound().props.children

    expect(title.props.children).toBe(ui.notFound.title)
    expect(body.props.children).toBe(ui.notFound.body)
    expect(back.props).toEqual({ href: '/list/', children: ui.notFound.backHome })
  })
})

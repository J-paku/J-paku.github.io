// 韓国語ルートの layout((ko)/ko/layout.tsx)のテスト。描かずに、呼んで返る React 要素を見る
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import HtmlShell from '@/app/html-shell'
import RootLayout from './layout'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

describe('ルートの layout(ko)', () => {
  it('<html> の枠(HtmlShell)へ、この経路の locale(ko)と子をそのまま渡す', () => {
    const child = createElement('main', { id: 'main' })
    const element = RootLayout({ children: child })

    expect(element.type).toBe(HtmlShell)
    expect(element.props).toEqual({ locale: 'ko', children: child })
  })
})

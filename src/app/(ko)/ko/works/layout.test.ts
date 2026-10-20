// 韓国語の作品詳細の共通枠((ko)/ko/works/layout.tsx)のテスト。描かずに、呼んで返る React 要素を見る
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import WorksLayout from './layout'

describe('作品詳細の共通枠(ko)', () => {
  it('子をそのまま data-works-layout の枠で包む(読み幅と導線は子のストーリーが持つ)', () => {
    const child = createElement('main', { id: 'main' })
    const element = WorksLayout({ children: child })

    expect(element.type).toBe('div')
    expect(element.props).toEqual({ 'data-works-layout': true, children: child })
    expect(element.props.children).toBe(child)
  })
})

// SceneSection(場面の文の現れ方を持つ状態のコンテナ)を直接描き、場面の技術チップを場面の中の一覧に並べることと、
// チップの無い場面では一覧を描かないことを見る。実際のコンテンツにチップの無い場面は無いので、
// チップを空にした props を直接渡す(ADR 0017 D6)
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import SceneSection from '@/components/Story/components/SceneSection/container'
import '@/styles/tokens.css'

const { slug, story, locale } = inject('storyJa')
const scene = story.scenes[0]
// チップを並べる側のテストが空振りしないよう、元の場面がチップを持つことを先に確かめる
if (scene.chips.length === 0) throw new Error(`${slug} の先頭の場面に技術チップが無い`)

beforeEach(async () => {
  await page.viewport(1280, 900)
})

afterEach(() => {
  cleanup()
})

describe('技術チップの一覧', () => {
  it('場面の技術チップを、場面の中の一覧にチップの名前のボタンとして並べる', async () => {
    render(<SceneSection scene={scene} locale={locale} />)
    const region = page.getByRole('region', { name: scene.title, exact: true })
    const list = region.getByRole('list')

    await expect.element(list).toBeInTheDocument()
    expect(list.getByRole('listitem').elements()).toHaveLength(scene.chips.length)
    for (const chip of scene.chips) {
      await expect
        .element(list.getByRole('button', { name: chip.name, exact: true }))
        .toBeInTheDocument()
    }
  })

  it('技術チップの無い場面は一覧を描かず、見出しと本文だけを描く', async () => {
    render(<SceneSection scene={{ ...scene, chips: [] }} locale={locale} />)
    const region = page.getByRole('region', { name: scene.title, exact: true })

    await expect
      .element(region.getByRole('heading', { name: scene.title, level: 2 }))
      .toBeInTheDocument()
    await expect.element(region).toHaveTextContent(scene.body)
    expect(region.getByRole('list').elements(), 'チップの一覧を描かない').toHaveLength(0)
    expect(region.getByRole('button').elements(), 'チップのボタンを描かない').toHaveLength(0)
  })
})

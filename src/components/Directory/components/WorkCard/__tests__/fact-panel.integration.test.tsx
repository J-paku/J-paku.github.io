// 作品カード(状態コンテナ)の、事実のパネルの仕様表(WorkSpec)と技術タグ(WorkStack)の出し分けの統合テスト(Vitest Browser Mode)。
// カードを実際の Chromium で、フック・子と一緒に描き(ADR 0016)、作品が持つ事実だけを表と一覧に並べ、
// 並べる物が1つも無いときは表・一覧の枠ごと描かないことを、利用者に見える形(role・名前・要素の有無)で確かめる。
// いまの実データに準備中(期間・役割・規模を持たない)の作品と技術スタックが空の作品は無いので、
// 公開済みの作品の写しの項目だけを替えてテストが直接渡す(ADR 0017 の D6)
import { cleanup, render, within } from '@testing-library/react'
import type { Work } from '@content/types/content'
import WorkCard from '@/components/Directory/components/WorkCard/container'
import {
  cardProps,
  factPanelOf,
  prepareEachTest,
  restoreEachTest,
  stillWork,
  ui,
} from '@/components/Directory/__tests__/directory.test-helper'

// 仕様表の行を、見出し列(dt)と本文列(dd)の組として文書順に読む。本文列は見出し列のすぐ後に並ぶ
const specPairsOf = (work: Work) =>
  within(factPanelOf(work))
    .queryAllByRole('term')
    .map(term => {
      const value = term.nextElementSibling
      return [term.textContent, value?.tagName === 'DD' ? value.textContent : null]
    })

// 技術タグの一覧。カードの文言 ui.work.stack を名前に持つ並び
const stackListOf = (work: Work) =>
  within(factPanelOf(work)).queryByRole('list', { name: ui.work.stack })

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('事実のパネルの仕様表と技術タグ', () => {
  it('期間・役割・規模のうち持つ項目だけを、見出し列と本文列の組で仕様表に並べる', () => {
    const { period } = stillWork
    if (period === undefined) throw new Error('写しの元にする作品が期間を持たない')
    const work: Work = { ...stillWork, period, role: undefined, scale: undefined }
    render(<WorkCard {...cardProps(work)} />)

    expect(specPairsOf(work)).toEqual([[ui.work.period, period]])
  })

  it('期間・役割・規模を1つも持たない準備中(wip)の作品は、仕様表を枠ごと描かない', () => {
    const work: Work = {
      ...stillWork,
      status: 'wip',
      period: undefined,
      role: undefined,
      scale: undefined,
    }
    render(<WorkCard {...cardProps(work)} />)

    const panel = factPanelOf(work)
    expect(panel.querySelector('dl')).toBeNull()
    expect(specPairsOf(work)).toEqual([])
    // 外したのは仕様表だけで、同じパネルの技術タグは残る
    expect(stackListOf(work)).not.toBeNull()
  })

  it('技術スタックを持つ作品は、技術タグをスタックの順に名前付きの一覧で並べる', () => {
    // 前提: 写しの元にした作品は技術スタックを持つ。空なら下の検査は空にした差を見ていない
    expect(stillWork.stack.length).toBeGreaterThan(0)
    render(<WorkCard {...cardProps(stillWork)} />)

    const list = stackListOf(stillWork)
    if (list === null) throw new Error('技術タグの一覧が描かれていない')
    expect(
      within(list)
        .getAllByRole('listitem')
        .map(item => item.textContent)
    ).toEqual(stillWork.stack)
  })

  it('技術スタックが空の作品は、技術タグの一覧を枠ごと描かない', () => {
    const work: Work = { ...stillWork, stack: [] }
    render(<WorkCard {...cardProps(work)} />)

    expect(stackListOf(work)).toBeNull()
    // 外したのは技術タグだけで、同じパネルの仕様表は残る
    expect(specPairsOf(work).length).toBeGreaterThan(0)
  })
})

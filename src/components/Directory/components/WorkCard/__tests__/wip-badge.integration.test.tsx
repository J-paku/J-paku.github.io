// 作品カード(状態コンテナ)の、準備中の印の統合テスト(Vitest Browser Mode)。
// カードを実際の Chromium で、フック・子と一緒に描き(ADR 0016)、準備中(wip)の作品だけが題字に準備中の印を添えることを、
// 見出しの中の文字で確かめる。
// いまの実データに準備中の作品は無いので、公開済みの作品の写しの status だけを替えてテストが直接渡す(ADR 0017 の D6)
import { cleanup, render, within } from '@testing-library/react'
import type { Work } from '@content/types/content'
import WorkCard from '@/components/Directory/components/WorkCard/container'
import {
  cardOf,
  cardProps,
  prepareEachTest,
  restoreEachTest,
  stillWork,
  ui,
} from '@/components/Directory/__tests__/directory.test-helper'

// カードの題字(h3)
const titleOf = (work: Work) => within(cardOf(work)).getByRole('heading', { level: 3 })

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('準備中の印', () => {
  it('準備中(wip)の作品は、題字に準備中の印を添える', () => {
    const work: Work = { ...stillWork, status: 'wip' }
    render(<WorkCard {...cardProps(work)} />)

    expect(within(titleOf(work)).getByText(ui.work.wipBadge)).toBeDefined()
  })

  it('公開済みの作品は、準備中の印を添えない', () => {
    // 前提: 写しの元にした作品は公開済み。そうでなければ上の検査は status を替えた差を見ていない
    expect(stillWork.status).toBe('published')
    render(<WorkCard {...cardProps(stillWork)} />)

    expect(within(cardOf(stillWork)).queryByText(ui.work.wipBadge)).toBeNull()
    expect(titleOf(stillWork).textContent).not.toContain(ui.work.wipBadge)
  })
})

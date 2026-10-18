// 一覧の画面(コンテナ)が作品カードを並べる流れの統合テスト(Vitest Browser Mode)。一覧を実際の Chromium で、子と一緒に描き(ADR 0016)、
// 作品の配列の並びどおりにカードを置いて番号を振ることと、カードへ画面の言語と文言を渡すことを確かめる。
// カードの中の動き(詳細の開閉・動き・リンクの覆い・下部パネルのリンク)はカードの統合テスト(../components/WorkCard/__tests__/)が見る。
// props は入口(src/app/directory-screen.tsx)と同じ組み方で index.fixture.ts が node で組み、inject で受け取る。
// 実データに無い形(10件並べた一覧)は、作品を差し替えた props の写しをテストが直接渡す
import { cleanup, render, within } from '@testing-library/react'
import DirectoryContainer from '@/components/Directory'
import type { DirectoryData } from './index.fixture'
import {
  cardOf,
  directoryJa,
  directoryKo,
  factPanelOf,
  pickWork,
  prepareEachTest,
  restoreEachTest,
  stillWork,
} from './directory.test-helper'

const renderDirectory = (data: DirectoryData = directoryJa) =>
  render(<DirectoryContainer {...data} />)

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('作品カードの並び', () => {
  describe('通し番号', () => {
    // 10件並べた一覧。番号は並び順だけで決まるので、静止画の作品を slug だけ替えて並べる
    const tenWorks = Array.from({ length: 10 }, (_, index) => ({
      ...stillWork,
      slug: `${stillWork.slug}-${index}`,
    }))

    it.each([
      [0, 'NO.01'],
      [9, 'NO.10'],
    ])('一覧の配列で%i番目(0始まり)のカードは、1始まりの2桁で %s と振る', (index, serial) => {
      renderDirectory({ ...directoryJa, works: tenWorks })

      expect(within(cardOf(tenWorks[index])).getByText(serial)).toBeDefined()
    })
  })

  it('ko の一覧は、カードへ ko の言語と文言を渡す(下部パネルのストーリーへのリンクが ko の名前で /ko の接頭を保つ)', () => {
    const work = pickWork(
      directoryKo.works,
      'ストーリーを持つ',
      candidate => candidate.story !== undefined
    )
    renderDirectory(directoryKo)

    const story = within(factPanelOf(work)).getByRole('link', { name: directoryKo.ui.work.story })
    expect(story.getAttribute('href')).toBe(`/ko/works/${work.slug}/`)
  })
})

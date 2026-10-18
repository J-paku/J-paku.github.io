// 一覧の画面(コンテナ)の、書き出す HTML へのハイドレーションの統合テスト(Vitest Browser Mode)。一覧を実際の Chromium で、子と一緒に描き(ADR 0016)、
// サーバの描画で書き出した一覧全体の HTML へハイドレーションしても、React が書き出した要素を捨てて作り直さないことを、要素の同一性で確かめる。
// 食い違いはカードの外(プロフィール・経歴の詳細・ナビゲーション)にあっても一覧全体の作り直しになるので、カードだけを描く
// カードのテスト(../components/WorkCard/__tests__/reveal.integration.test.tsx)では見えない。そのため一覧全体を描いて見る。
// props は入口(src/app/directory-screen.tsx)と同じ組み方で index.fixture.ts が node で組み、inject で受け取る
import { cleanup, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { onTestFinished } from 'vitest'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import shotStyles from '@/components/Directory/components/WorkCard/components/Shot/shot.module.css'
import DirectoryContainer from '@/components/Directory'
import {
  directoryJa,
  prepareEachTest,
  restoreEachTest,
  shotOf,
  videoWork,
} from './directory.test-helper'

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('書き出す HTML へのハイドレーション', () => {
  it('一覧全体を書き出した HTML へハイドレーションしても枠を作り直さず、ハイドレーションした枠は画面に収まると色を戻す', async () => {
    // 書き出し(next build)と同じくサーバの描画で HTML の文字列にし、その HTML へハイドレーションする
    const host = document.createElement('div')
    host.innerHTML = renderToString(<DirectoryContainer {...directoryJa} />)
    document.body.append(host)
    // ハイドレーションの前に落ちても、書き出した HTML を次のテストへ残さない(描いた後は cleanup も外す)
    onTestFinished(() => host.remove())
    const shot = shotOf(videoWork)
    expect(shot.classList.contains(shotStyles.shotInView), '書き出す HTML の写真は灰色').toBe(false)

    render(<DirectoryContainer {...directoryJa} />, { container: host, hydrate: true })

    // サーバとクライアントの最初の描画が食い違うと、React は書き出した要素を捨てて作り直す
    expect(shotOf(videoWork), 'ハイドレーションしても書き出した枠をそのまま使う').toBe(shot)
    // 同じ要素のままでも、ハイドレーションが付かずに書き出した HTML が残っただけなら上は通る。
    // フックが付いたこと(枠を観察して色を戻す)まで見て、ハイドレーションが済んだことを確かめる
    shot.scrollIntoView({ block: 'center' })
    await expect
      .poll(() => shot.classList.contains(shotStyles.shotInView), {
        message: 'ハイドレーションした枠も観察し、丸ごと収まると色を戻す',
      })
      .toBe(true)
  })
})

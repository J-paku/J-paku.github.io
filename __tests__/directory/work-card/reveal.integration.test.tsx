// 作品カード(状態コンテナ)の、交差を観察できるかどうか(use-reveal・use-fully-visible)の統合テスト(Vitest Browser Mode)。
// カードを実際の Chromium で、フック・子と一緒に描き(ADR 0016)、画面に入るまでカードを隠して写真を灰色のままにし、
// 入ると表示して色を戻すことと、書き出す HTML へのハイドレーションで枠を作り直さないことを、クラスと要素の同一性で確かめる。
// props は一覧の container.fixture.ts が node で組んで provide した作品・文言を inject で受け取る
import { cleanup, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { onTestFinished } from 'vitest'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import cardStyles from '@/components/Directory/components/WorkCard/work-card.module.css'
import shotStyles from '@/components/Directory/components/WorkCard/components/Shot/shot.module.css'
import WorkCard from '@/components/Directory/components/WorkCard/container'
import {
  belowFold,
  cardOf,
  cardProps,
  intersectionSettled,
  prepareEachTest,
  restoreEachTest,
  settleNotice,
  shotOf,
  videoIn,
  videoWork,
} from '../directory.test-helper'

const videoCard = <WorkCard {...cardProps(videoWork)} />

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('交差を観察できるかどうか(use-reveal・use-fully-visible)', () => {
  it('観察できる環境では、画面に入ったと通知されるまで隠したまま・灰色のまま', async () => {
    // カードを最初の画面の外に置く
    render(videoCard, { container: belowFold() })

    const card = cardOf(videoWork)
    expect(card.getBoundingClientRect().top, 'カードは最初の画面の外').toBeGreaterThan(
      window.innerHeight
    )
    await intersectionSettled(card)
    await settleNotice()

    expect(card.classList.contains(cardStyles.cardRevealed)).toBe(false)
    expect(videoIn(card).hasAttribute('src')).toBe(false)
    expect(shotOf(videoWork).classList.contains(shotStyles.shotInView)).toBe(false)

    // 画面に入れると通知が来て表示し、丸ごと収まれば色を戻す(上の「まま」が観察の故障でないことも見る)
    shotOf(videoWork).scrollIntoView({ block: 'center' })
    await expect
      .poll(() => card.classList.contains(cardStyles.cardRevealed), {
        message: '画面に入ったカードは表示する',
      })
      .toBe(true)
    await expect
      .poll(() => shotOf(videoWork).classList.contains(shotStyles.shotInView), {
        message: '丸ごと収まった枠は色を戻す',
      })
      .toBe(true)
  })

  it('書き出す HTML(サーバの描画)では観察できる前提で写真を灰色に描き、ハイドレーションしても枠を作り直さず、画面に収まると色を戻す', async () => {
    // 書き出し(next build)と同じくサーバの描画で HTML の文字列にし、その HTML へハイドレーションする
    const host = document.createElement('div')
    host.innerHTML = renderToString(videoCard)
    document.body.append(host)
    // ハイドレーションの前に落ちても、書き出した HTML を次のテストへ残さない(描いた後は cleanup も外す)
    onTestFinished(() => host.remove())
    const shot = shotOf(videoWork)
    expect(shot.classList.contains(shotStyles.shotInView), '書き出す HTML の写真は灰色').toBe(false)

    render(videoCard, { container: host, hydrate: true })

    // サーバとクライアントの最初の描画が食い違うと、React は書き出した要素を捨てて作り直す
    expect(shotOf(videoWork), 'ハイドレーションしても書き出した枠をそのまま使う').toBe(shot)
    shot.scrollIntoView({ block: 'center' })
    await expect
      .poll(() => shot.classList.contains(shotStyles.shotInView), {
        message: 'ハイドレーションした枠も観察し、丸ごと収まると色を戻す',
      })
      .toBe(true)
  })
})

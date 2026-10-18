// 作品ストーリー画面を読み進める流れ(E2E の story から移した)。ページの先頭では CTA が先頭の場面から開くか、
// 場面を画面の中央まで送ると場面の文が現れ(SceneSection の use-reveal)、
// CTA がその場面からモーダルを開くか(StoryBody の use-active-scene)と、別の作品の場面の並びへ描き直すと今読んでいる場面を
// 先頭へ戻すかを見る。どれも導入の見出しの下から場面が始まるページ全体の高さに頼るので、作品ストーリー画面のコンテナごと描く
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import StoryContainer from '@/components/Story/container'
import {
  counterFor,
  counterText,
  emulateFullMotion,
  expectStoryTriggers,
  locateStory,
  resetEmulatedMedia,
  REVEAL_TIMEOUT_MS,
  stubSvgFetch,
} from './story.test-helper'
import '@/styles/tokens.css'

const storyJa = inject('storyJa')
const { story, ui } = storyJa
const scenes = story.scenes
const sceneCount = scenes.length
// 先頭・末尾の他に、途中の場面が2つ要る(途中の場面から CTA で開く、を端と見分けるため)
if (sceneCount < 4) throw new Error(`${storyJa.slug} の場面が4つ未満(${sceneCount}つ)`)
const { expectCounter } = counterFor(sceneCount)

beforeEach(async () => {
  // E2E(Playwright の Desktop Chrome)と同じ画面の大きさで、ページの先頭から読み始める
  await page.viewport(1280, 720)
  window.scrollTo(0, 0)
  // E2E は1件ごとに新しいページで始まる。前のテストが背景の固定を戻し損ねても持ち越さず、戻し損ねたテストで落とす
  document.body.style.removeProperty('overflow')
  await emulateFullMotion()
  stubSvgFetch()
})

afterEach(async () => {
  // 先に外してから環境を戻す
  cleanup()
  await resetEmulatedMedia()
  vi.unstubAllGlobals()
})

describe('読み進め', () => {
  it('ページの先頭では、CTA は先頭の場面からモーダルを開く', async () => {
    render(<StoryContainer {...storyJa} />)
    await expectStoryTriggers(ui)
    const { cta, dialog } = locateStory(ui)
    // 先頭ではどの場面も中央の判定帯(上下45%を除いた中央10%。use-active-scene の rootMargin)に掛からず、
    // 観察の通知では今の場面が決まらない。今の場面の最初の値が、そのまま CTA が開く場面になる
    const firstSection = page.getByRole('region', { name: scenes[0].title, exact: true }).element()
    expect(
      firstSection.getBoundingClientRect().top,
      '先頭の場面は中央の判定帯より下から始まる'
    ).toBeGreaterThan(window.innerHeight * 0.55)

    await cta.click()
    await expect.element(dialog).toHaveAccessibleName(scenes[0].title)
    await expectCounter(0)
  })

  it('CTA は今読んでいる場面からモーダルを開き、場面の文は画面に入ると現れる', async () => {
    render(<StoryContainer {...storyJa} />)
    await expectStoryTriggers(ui)
    const { cta, dialog } = locateStory(ui)
    // 先頭でも末尾でもない場面を選ぶ。先頭だと「いつも先頭から開く」誤りと見分けられない
    const target = sceneCount - 2
    const section = page.getByRole('region', { name: scenes[target].title, exact: true }).element()
    // 場面の文を包む箱。現れる前は透明で、use-reveal が表示の印を付けると不透明になる
    const wrapper = section.querySelector(':scope > div')
    if (wrapper === null) throw new Error('場面の文を包む箱が無い')
    const opacity = () => getComputedStyle(wrapper).opacity

    expect(
      section.getBoundingClientRect().top,
      '選んだ場面は最初は画面の下の外にある'
    ).toBeGreaterThan(window.innerHeight)
    expect(opacity(), '画面の外の場面の文はまだ現れていない').toBe('0')

    // 画面の中央まで送ると現れ、今読んでいる場面になる
    section.scrollIntoView({ block: 'center', behavior: 'instant' })
    await expect
      .poll(opacity, { message: '画面に入った場面の文が現れる', timeout: REVEAL_TIMEOUT_MS })
      .toBe('1')

    await cta.click()
    await expect.element(dialog).toHaveAccessibleName(scenes[target].title)
    await expectCounter(target)
  })

  // E2E から移したものではない。フックの分岐(場面の数の変化)を、利用者に見える形で確かめる
  it('別の作品の場面の並びへ描き直すと、今読んでいる場面を先頭へ戻し、CTA は新しい並びの先頭から開く', async () => {
    const { rerender } = render(<StoryContainer {...storyJa} />)
    const { cta, dialog } = locateStory(ui)
    // 末尾の場面まで読み進め、CTA がその場面から開くことを確かめてから閉じる。
    // 今読んでいる場面の印と場面の文の現れ方は同じ描画の回で観察の通知を受けるので、文が現れるのを待ってから押す
    const last = sceneCount - 1
    const lastSection = page
      .getByRole('region', { name: scenes[last].title, exact: true })
      .element()
    const lastWrapper = lastSection.querySelector(':scope > div')
    if (lastWrapper === null) throw new Error('場面の文を包む箱が無い')
    lastSection.scrollIntoView({ block: 'center', behavior: 'instant' })
    await expect
      .poll(() => getComputedStyle(lastWrapper).opacity, { timeout: REVEAL_TIMEOUT_MS })
      .toBe('1')
    await cta.click()
    await expect.element(dialog).toHaveAccessibleName(scenes[last].title)
    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).not.toBeInTheDocument()

    // 別の作品へ移った時と同じく、ページの先頭へ戻ってから場面の数の違う並びで描き直す。
    // 先頭では中央の判定帯にどの場面も掛からない(1280×720 で先頭の場面は帯より下から始まる)ので、観察の通知では今の場面が変わらない
    window.scrollTo(0, 0)
    const otherScenes = scenes.slice(0, 2).map(scene => ({ ...scene, id: `${scene.id}-other` }))
    rerender(<StoryContainer {...storyJa} story={{ ...story, scenes: otherScenes }} />)

    // 前の作品の末尾の添字を引きずると、新しい並びに無い場面を開こうとする
    await cta.click()
    await expect.element(dialog).toHaveAccessibleName(otherScenes[0].title)
    await expect.poll(counterText).toBe(`1 / ${otherScenes.length}`)
  })
})

// SceneSection を直接描き、場面の文は画面の外では透明で、画面に入ると現れることを見る(use-reveal)。
// 場面を画面の下の外から始めるため、場面の前に画面より高い余白を置く
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import SceneSection from '@/components/Story/components/SceneSection/container'
import { emulateFullMotion, resetEmulatedMedia, REVEAL_TIMEOUT_MS } from '../story.test-helper'
import '@/styles/tokens.css'

const { story, locale } = inject('storyJa')
const scene = story.scenes[0]

beforeEach(async () => {
  await page.viewport(1280, 720)
  window.scrollTo(0, 0)
  // 場面の文の現れ方は、動きを控えない設定でだけ動く(控える設定では最初から現れる)
  await emulateFullMotion()
})

afterEach(async () => {
  // 先に外してから環境を戻す
  cleanup()
  await resetEmulatedMedia()
})

describe('場面の文の現れ方', () => {
  it('場面の文は画面の外では透明で、画面に入ると現れる', async () => {
    render(
      <>
        <div style={{ height: '200vh' }} />
        <SceneSection scene={scene} locale={locale} />
      </>
    )
    // 場面は見出しの名前で読める region。その中の、場面の文を包む箱が現れ方を持つ
    const section = page.getByRole('region', { name: scene.title, exact: true }).element()
    const wrapper = section.querySelector(':scope > div')
    if (wrapper === null) throw new Error('場面の文を包む箱が無い')
    const opacity = () => getComputedStyle(wrapper).opacity

    expect(section.getBoundingClientRect().top, '場面は最初は画面の下の外にある').toBeGreaterThan(
      window.innerHeight
    )
    expect(opacity(), '画面の外の場面の文はまだ現れていない').toBe('0')

    section.scrollIntoView({ block: 'center', behavior: 'instant' })
    await expect
      .poll(opacity, { message: '画面に入った場面の文が現れる', timeout: REVEAL_TIMEOUT_MS })
      .toBe('1')
  })
})

// 吹き出し(TalkBubble)を直接描き、形(台詞・考え事)ごとの中身と押す手、指す点の上下どちらへ出すかを見る。
// 村と同じく、村の枠(data-village)の中に置いて描く。枠の寸法と 1 マスの大きさはテストが決める。
// 村の画面の中で、どこでどちらの形の吹き出しが出るかは、画面全体を描くテスト(talk-keys・fishing など)が見る
import { cleanup, render } from '@testing-library/react'
import type { CSSProperties, ReactNode } from 'react'
import { inject } from 'vitest'
import { page } from 'vitest/browser'
import TalkBubble from '@/components/VillagePage/components/Village/components/TalkBubble/container'
import { bubbleElement, speechProps, thoughtProps } from './talk-bubble.test-helper'

const { lang } = inject('villageJa')

// 1 マスの大きさ(px)。枠は 10×8 マス
const CELL = 20

type FrameStyle = CSSProperties & { '--cell': string }

const frameStyle: FrameStyle = {
  position: 'relative',
  width: CELL * 10,
  height: CELL * 8,
  '--cell': `${CELL}px`,
}
const renderInFrame = (bubble: ReactNode) =>
  render(
    <div data-village style={frameStyle}>
      {bubble}
    </div>
  )

const frameTop = () => {
  const frame = document.querySelector('[data-village]')
  if (frame === null) throw new Error('村の枠が描かれていない')
  return frame.getBoundingClientRect().top
}

beforeEach(async () => {
  await page.viewport(1280, 720)
})

afterEach(() => {
  cleanup()
})

describe('吹き出しの形と押す手', () => {
  test('台詞の吹き出しは文言と押す手を出し、押す手を押すと知らせを呼ぶ', async () => {
    const onAction = vi.fn()
    const props = speechProps({ x: 5, y: 4 }, onAction)
    renderInFrame(<TalkBubble {...props} />)
    const bubble = bubbleElement()
    expect(bubble.dataset.villageBubbleKind, '形を省くと台詞').toBe('speech')
    expect(bubble.getAttribute('lang'), '文言の言語').toBe(lang)
    expect(bubble.textContent, '台詞の文言').toContain(props.text)

    await page.getByRole('button', { name: props.actionLabel }).click()
    expect(onAction, '押す手を押すと知らせを 1 回呼ぶ').toHaveBeenCalledTimes(1)
  })

  test('台詞の吹き出しでも、押す手の文言が無ければボタンを出さない', () => {
    renderInFrame(<TalkBubble {...speechProps({ x: 5, y: 4 }, vi.fn())} actionLabel={undefined} />)
    expect(bubbleElement().dataset.villageBubbleKind).toBe('speech')
    expect(page.getByRole('button').query(), '押す手は無い').toBeNull()
  })

  test('考え事の吹き出しは、押す手の文言を渡されてもボタンを出さない', () => {
    const props = thoughtProps({ x: 5, y: 4 })
    // 押す手の文言は台詞と同じもの
    const { actionLabel } = speechProps(props.at, vi.fn())
    renderInFrame(<TalkBubble {...props} actionLabel={actionLabel} onAction={vi.fn()} />)
    const bubble = bubbleElement()
    expect(bubble.dataset.villageBubbleKind, '考え事の形').toBe('thought')
    expect(bubble.textContent, '考え事の文言').toBe(props.text)
    expect(page.getByRole('button').query(), '押す手は無い').toBeNull()
  })
})

describe('指す点の上下', () => {
  test('置き場を指さない吹き出しは、指す点の上に出す', () => {
    renderInFrame(<TalkBubble {...thoughtProps({ x: 5, y: 4 })} />)
    const bubble = bubbleElement()
    expect(bubble.dataset.villageBubblePlace, '置き場を省くと上').toBe('above')
    expect(bubble.getBoundingClientRect().bottom, '下端は指す点より上').toBeLessThanOrEqual(
      frameTop() + CELL * 4
    )
  })

  test('指す点の上に置き場が無い時は、吹き出しを指す点の下に出す', () => {
    renderInFrame(<TalkBubble {...thoughtProps({ x: 5, y: 1, place: 'below' })} />)
    const bubble = bubbleElement()
    expect(bubble.dataset.villageBubblePlace, '下に置く印').toBe('below')
    expect(bubble.getBoundingClientRect().top, '上端は指す点より下').toBeGreaterThanOrEqual(
      frameTop() + CELL * 1
    )
  })
})

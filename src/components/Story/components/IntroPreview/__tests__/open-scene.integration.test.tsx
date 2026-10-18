// IntroPreview(イントロの小さなプレビュー。押したボタン自身の要素を覚える状態コンテナ)を直接描き、
// 場面を見せるボタンを1つだけ描くことと、押すと先頭の場面の番号とそのボタン自身を開く知らせ(onOpenScene)へ渡すことを見る。
// 知らせを受けて場面モーダルを開き、閉じた後にこのボタンへフォーカスを戻すのは呼び出し側(StoryBody。../../StoryBody/__tests__/ が見る)
import type { ComponentProps } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import IntroPreview from '@/components/Story/components/IntroPreview'
import { stubSvgFetch } from '@/components/Story/__tests__/story.test-helper'
import '@/styles/tokens.css'

const { story, ui } = inject('storyJa')

beforeEach(async () => {
  await page.viewport(1280, 900)
  stubSvgFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('押すと場面を開く', () => {
  it('場面を見せるボタンを1つ描き、押すと先頭の場面の番号と押したボタン自身を開く知らせへ渡す', async () => {
    const onOpenScene = vi.fn<ComponentProps<typeof IntroPreview>['onOpenScene']>()
    render(
      <IntroPreview
        scenes={story.scenes}
        placeholder={ui.work.shotPlaceholder}
        viewSceneLabel={ui.workStory.viewScene}
        onOpenScene={onOpenScene}
      />
    )
    // 中身は飾りの絵だけなので、名前は渡した文言(aria-label)から付く
    const trigger = page.getByRole('button', { name: ui.workStory.viewScene, exact: true })
    await expect.element(trigger).toBeVisible()
    expect(page.getByRole('button').elements(), '押せるものはプレビューの1つだけ').toHaveLength(1)
    expect(onOpenScene, '押すまでは知らせない').not.toHaveBeenCalled()

    await trigger.click()
    await expect
      .poll(() => onOpenScene.mock.calls.length, { message: '1回押すと1回知らせる' })
      .toBe(1)
    const [index, element] = onOpenScene.mock.calls[0]
    expect(index, '先頭の場面から開く').toBe(0)
    // 呼び出し側は閉じた後のフォーカスの戻り先にこの要素を使う。同じ形の別の要素ではなく、押したボタンそのもの
    expect(element, '押したボタン自身を渡す').toBe(trigger.element())
  })
})

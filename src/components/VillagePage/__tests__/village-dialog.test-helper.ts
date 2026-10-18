// 村の統合テストのうち、村の枠の中に出す窓(会話窓・拡大地図・卓上時計の窓)の焦点を見るファイルが共有する手順。
// 窓を開く・閉じる操作と村の描き方は各ファイルに置き、ここは焦点の輪と戻り先の断定と、窓を直接描くテストが渡す戻り先だけを持つ。
// 描く道具(@testing-library/react・react-dom)はここから import しない(npm run test:boundary)
import { onTestFinished } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { focusIndex, villageFrame } from './village-walk.test-helper'

// 窓は role='dialog' の div と手製の Tab の輪(src/hooks/use-dialog-focus.ts)で作るので、ブラウザは輪を保証しない。
// 今の焦点から Tab で 1 つずつ末尾まで進め、末尾の次は先頭へ、先頭の前は末尾へ回るのを見る
export const cycleWithTab = async (dialog: Element, selector: string) => {
  const items = Array.from(dialog.querySelectorAll<HTMLElement>(selector))
  // 1 つだけだと先頭と末尾が同じで、回ったのか留まったのかを見分けられない
  expect(items.length, '窓の中に焦点を移せる要素が 2 つ以上ある').toBeGreaterThanOrEqual(2)
  const advance = async (index: number): Promise<void> => {
    if (index >= items.length - 1) return
    await userEvent.tab()
    await expect
      .poll(() => focusIndex(dialog, selector), { message: `Tab で ${index + 1} 番目へ進む` })
      .toBe(index + 1)
    await advance(index + 1)
  }
  await advance(focusIndex(dialog, selector))
  await userEvent.tab()
  await expect
    .element(page.elementLocator(items[0]), { message: '末尾で Tab を押すと先頭へ回る' })
    .toHaveFocus()
  await userEvent.tab({ shift: true })
  await expect
    .element(page.elementLocator(items[items.length - 1]), {
      message: '先頭で Shift+Tab を押すと末尾へ回る',
    })
    .toHaveFocus()
}

// 窓を開く前の焦点が村の枠にあるか。閉じた後に枠へ戻ったことが「元からそこにあった」のではなく「戻された」と言えるよう、開く前にも押さえる。
// キーを受け取る村の枠は E2E と同じく data-village で指す(枠の読み上げ名はタッチ端末かどうかで替わる)
export const expectFrameFocused = (message: string) =>
  expect.element(page.elementLocator(villageFrame()), { message }).toHaveFocus()

// 窓を直接描くテストで、開く前に焦点を置いておく窓の外のボタン(村では枠)。閉じた時の戻り先(returnTo)として窓へ渡す。
// 窓を外した後に焦点がここへ戻れば、窓が開いた時に控えた戻り先へ戻したと言える。テストが終わると取り除く
export const placeOpener = (): HTMLButtonElement => {
  const opener = document.createElement('button')
  opener.type = 'button'
  opener.textContent = 'opener'
  document.body.append(opener)
  onTestFinished(() => opener.remove())
  opener.focus()
  return opener
}

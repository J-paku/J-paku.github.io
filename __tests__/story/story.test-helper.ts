// 作品ストーリーの統合テストが共有する、場面モーダルとそれを開くボタンの探し方・待ち方と、通信・動きの設定。
// 作品ストーリー画面(このフォルダ)・StoryBody(story-body/)・SceneModal(scene-modal/)・SceneSection(scene-section/)のテストが使う。
// 端・送り先・自動送りの待ち・フォーカスの逃がし先・周期の判定は SceneModal/utils と src/utils/cycle-scenes.ts の
// 単体テストが固めているので、統合テストではフックがその答えどおりに state・focus()・タイマーを動かしているかを見る
import type { ComponentProps } from 'react'
import { expect, vi } from 'vitest'
import { cdp, page, userEvent, type Locator } from 'vitest/browser'
import type { UiStrings, WorkStoryScene } from '@content/types/content'
import type SceneModal from '@/components/Story/components/SceneModal/container'

// 一時停止の間に進める時間。どの場面の周期(数秒)よりも十分に長く取る
export const LONG_MS = 60_000
// 場面の文の現れ方は opacity の 1 秒の遷移(scene-section.module.css)なので、遷移を待てる長さで待つ
export const REVEAL_TIMEOUT_MS = 5_000

const SCENE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'></svg>`

// SVG の通信だけを差し替える。フック・DOM API・子コンポーネントは本物を使う
export const stubSvgFetch = () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(SCENE_SVG, { headers: { 'Content-Type': 'image/svg+xml' } }))
  )
}

// 自動送りと場面の文の現れ方は、動きを控えない設定でだけ動く。実行環境の既定に任せず固定する
export const emulateFullMotion = () =>
  cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  })

export const resetEmulatedMedia = () => cdp().send('Emulation.setEmulatedMedia', { features: [] })

// 場面モーダルとその中のボタン
export const locateModal = (ui: UiStrings) => {
  const dialog = page.getByRole('dialog')
  return {
    dialog,
    close: dialog.getByRole('button', { name: ui.workStory.close, exact: true }),
    prev: dialog.getByRole('button', { name: ui.workStory.prevScene, exact: true }),
    next: dialog.getByRole('button', { name: ui.workStory.nextScene, exact: true }),
    // 画面そのものが一時停止/再開のボタンで、状態は名前の入れ替えだけで表す
    pause: dialog.getByRole('button', { name: ui.workStory.pauseScene, exact: true }),
    resume: dialog.getByRole('button', { name: ui.workStory.resumeScene, exact: true }),
  }
}

// 場面モーダルを開く2つのボタン(StoryBody が描く)と、場面モーダル
export const locateStory = (ui: UiStrings) => ({
  // イントロの小さなプレビュー。名前は aria-label から付き、DOM では CTA より先に並ぶ
  preview: page.getByRole('button', { name: ui.workStory.viewScene, exact: true }).first(),
  // 本文の後ろの CTA は文言を文節ごとに <wbr> で区切って描くので、名前ではなく中の文字で選ぶ。
  // プレビューは文字を持たないので当たらない
  cta: page.getByRole('button').filter({ hasText: ui.workStory.viewScene }),
  ...locateModal(ui),
})

// モーダルの「今の場面 / 場面の数」。読み上げのため aria-live を持つ。モーダルが無ければ null
export const counterOf = () => document.querySelector('dialog [aria-live=polite]')
export const counterText = () => counterOf()?.textContent ?? null

// 場面の数が count の並びで、場面の番号(0始まり)をモーダルの「今の場面 / 場面の数」の表示に直す道具と、その表示を待つ道具
export const counterFor = (count: number) => {
  const shown = (index: number) => `${index + 1} / ${count}`
  const expectCounter = (index: number, message?: string) =>
    expect.poll(counterText, { message }).toBe(shown(index))
  return { shown, expectCounter }
}

// root の中で、シャドウルートに <svg> が展開された場面の数。SceneSvg は取った原文をシャドウルートへ流し込み、
// 取れなかった場面は ScenePlayer がプレースホルダの文字に差し替える
export const scenesWithSvg = (root: Element | null) =>
  root === null
    ? 0
    : Array.from(root.querySelectorAll('*')).filter(element =>
        Boolean(element.shadowRoot?.querySelector('svg'))
      ).length

// 押す前に要素へフォーカスを置いてからキーを押す(Playwright の locator.press と同じ押し方)
export const press = async (target: Locator, key: string) => {
  target.element().focus()
  await userEvent.keyboard(key)
}

// 偽の時計は setTimeout・clearTimeout だけを差し替え、React が描き直しと effect の予約に使う MessageChannel は止めない。
// 同じ経路で1通流して戻りを待つと、それより前に予約された描き直しと effect が済んでいる。
// 「送られていない」を見る前と、次の時間の進め(effect が次のタイマーを掛け終える前に進めると、
// 進めた時間がそのタイマーに数えられない)の前に呼ぶ
export const flushRender = () =>
  new Promise<void>(resolve => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve()
    channel.port2.postMessage(null)
  })

// 描いた画面で、CTA とプレビューを取り違えていないこと・プレビューに場面の絵が出たことを確かめる。
// CTA(画面の下に固定・aria-label 無し)をプレビュー(常に先頭の場面で開く)と取り違えると CTA の検査が空回りする
export const expectStoryTriggers = async (ui: UiStrings) => {
  const { preview, cta } = locateStory(ui)
  expect(cta.elements()).toHaveLength(1)
  await expect.element(cta).toHaveStyle({ position: 'fixed' })
  await expect.element(cta).not.toHaveAttribute('aria-label')
  await expect.element(preview).toHaveAttribute('aria-label', ui.workStory.viewScene)
  await expect
    .poll(() => scenesWithSvg(preview.element()), {
      message: 'イントロのプレビューに場面の絵が出る',
    })
    .toBeGreaterThan(0)
}

// 場面モーダルを直接描く時の props。先頭の場面から開き、文言は作品ストーリーの props(フィクスチャ)の ui から取る
export const sceneModalProps = (
  scenes: WorkStoryScene[],
  ui: UiStrings,
  onClose: () => void
): ComponentProps<typeof SceneModal> => ({
  scenes,
  initialIndex: 0,
  placeholder: ui.work.shotPlaceholder,
  closeLabel: ui.workStory.close,
  prevLabel: ui.workStory.prevScene,
  nextLabel: ui.workStory.nextScene,
  pauseLabel: ui.workStory.pauseScene,
  resumeLabel: ui.workStory.resumeScene,
  onClose,
})

// 実データの画面を Chromium へ描き、場面の操作と技術チップの開閉をまとめて確かめる
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { cdp, page, userEvent, type Locator } from 'vitest/browser'
import StoryContainer from '@/components/Story/container'
import '@/styles/tokens.css'

const storyJa = inject('storyJa')
const { story, ui } = storyJa
const firstScene = story.scenes[0]
const chip = firstScene.chips[0]

const renderChip = () => {
  render(<StoryContainer {...storyJa} />)
  return page
    .getByRole('region', { name: firstScene.title, exact: true })
    .getByRole('button', { name: chip.name, exact: true })
}

// 閉じている間も aria-controls が指す説明を DOM に残す契約を確認する
const popoverOf = (trigger: Locator): HTMLElement => {
  const popover = document.getElementById(trigger.element().getAttribute('aria-controls') ?? '')
  if (popover === null) throw new Error('チップのaria-controlsが指す要素が無い')
  return popover
}

const expectChip = async (trigger: Locator, open: boolean) => {
  await expect.element(trigger).toHaveAttribute('aria-expanded', String(open))
  await expect.poll(() => popoverOf(trigger).hidden).toBe(!open)
}

const renderOpenChip = async () => {
  const trigger = renderChip()
  await trigger.click()
  await expectChip(trigger, true)
  return trigger
}

beforeEach(async () => {
  await page.viewport(1280, 900)
  // SVG の通信だけを差し替える。フック・DOM API・子コンポーネントは本物を使う
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>', {
          headers: { 'Content-Type': 'image/svg+xml' },
        })
    )
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('マウス', () => {
  it('最初は閉じていて、乗せると説明が開き、離すと閉じる', async () => {
    const trigger = renderChip()
    await expectChip(trigger, false)

    await trigger.hover()
    await expectChip(trigger, true)

    await trigger.unhover()
    await expectChip(trigger, false)
  })

  it('乗せて開いた直後に押しても閉じない(押すのは開く専用)', async () => {
    const trigger = renderChip()

    await trigger.hover()
    await trigger.click()
    await expectChip(trigger, true)
  })
})

describe('タッチ', () => {
  // Browser Mode の userEvent にタッチの API が無いため、この入力種別だけ実 DOM へ送る。
  // pointerover/out から React の pointerenter/leave が発火する。マウスの移動を混ぜない。
  // 「タッチでは動かない」だけだと、pointerover が開閉の処理へ届かなくなっても通るので、
  // 同じ形のイベントを pointerType: 'mouse' で送ると開閉することも同じテストで見る
  it('指が触れただけの疑似ホバーでは開かない(マウスの同じイベントなら開く)', async () => {
    const trigger = renderChip()
    const element = trigger.element()

    fireEvent.pointerOver(element, { pointerType: 'touch' })
    await expectChip(trigger, false)

    fireEvent.pointerOver(element, { pointerType: 'mouse' })
    await expectChip(trigger, true)
  })

  it('タップすると開き、指が離れた後の疑似ホバーの抜けでは閉じない(マウスの同じイベントなら閉じる)', async () => {
    const trigger = renderChip()
    const element = trigger.element()

    fireEvent.pointerOver(element, { pointerType: 'touch' })
    fireEvent.pointerDown(element, { pointerType: 'touch' })
    fireEvent.pointerUp(element, { pointerType: 'touch' })
    fireEvent.click(element)
    await expectChip(trigger, true)

    fireEvent.pointerOut(element, { pointerType: 'touch' })
    await expectChip(trigger, true)

    fireEvent.pointerOut(element, { pointerType: 'mouse' })
    await expectChip(trigger, false)
  })
})

describe('閉じ方', () => {
  it('Escで閉じる', async () => {
    const trigger = await renderOpenChip()

    await userEvent.keyboard('{Escape}')
    await expectChip(trigger, false)
  })

  it('チップの中を押しても閉じず、外側を押すと閉じる', async () => {
    const trigger = await renderOpenChip()

    // pointerdown だけを送り、mouseleave や click の開く処理と切り離して外側判定を見る
    fireEvent.pointerDown(trigger.element())
    await expectChip(trigger, true)

    fireEvent.pointerDown(
      page.getByRole('heading', { name: story.intro.title, level: 1 }).element()
    )
    await expectChip(trigger, false)
  })
})

describe('作品ストーリー画面', () => {
  it('導入・場面・まとめと、一覧・村への導線を描く', async () => {
    render(<StoryContainer {...storyJa} />)

    await expect.element(page.getByRole('main')).toBeInTheDocument()
    await expect
      .element(page.getByRole('heading', { name: story.intro.title, level: 1 }))
      .toBeVisible()
    await expect
      .element(page.getByRole('heading', { name: story.outro.title, level: 2 }))
      .toBeInTheDocument()
    for (const scene of story.scenes) {
      await expect
        .element(page.getByRole('region', { name: scene.title, exact: true }))
        .toBeInTheDocument()
    }
    // 配信物と同じく末尾にスラッシュが付く(next.config の trailingSlash。vitest.integration.config.ts の define)
    await expect
      .element(page.getByRole('link', { name: ui.workStory.back }))
      .toHaveAttribute('href', '/list/')
    await expect
      .element(page.getByRole('link', { name: storyJa.switchLabel }))
      .toHaveAttribute('href', '/')
  })

  it('まとめの技術チップを開き、外側をクリックすると閉じる', async () => {
    render(<StoryContainer {...storyJa} />)
    const outroChip = story.outro.stackSummary[0]
    // 同名の場面チップより後に描く、まとめのチップを選ぶ
    const trigger = page.getByRole('button', { name: outroChip.name, exact: true }).last()
    await expectChip(trigger, false)

    await trigger.click()
    await expectChip(trigger, true)
    expect(popoverOf(trigger).textContent).toBe(outroChip.note)

    await page.getByRole('heading', { name: story.outro.title, level: 2 }).click()
    await expectChip(trigger, false)
  })
})

// ---- 読み進めと場面モーダル・場面の絵の取り直し(E2E の story・scene-refetch から移した) ----
// CTA が今読んでいる場面から開くか(use-active-scene)、場面の文が画面に入ると現れるか(use-reveal)、
// 前へ・次へと端でのフォーカス、自動送りと一時停止(WCAG 2.2.2)、自動送りで端へ着く時のフォーカス、
// 閉じ方3通りとフォーカスの戻り先(StoryBody)、開いている間の背景の固定(use-modal-dialog)、
// 閉じて開き直すと失敗した場面の絵を取り直すか(ScenePlayer の use-scene-sources と取得の覚え)を見る。
// 端・送り先・自動送りの待ち・フォーカスの逃がし先・周期の判定は SceneModal/utils と src/utils/cycle-scenes.ts の
// 単体テストが固めているので、ここではフックがその答えどおりに state・focus()・タイマーを動かしているかを見る

const scenes = story.scenes
const sceneCount = scenes.length
// 先頭・末尾の他に、途中の場面が2つ要る(途中から途中へ送る・途中の場面から CTA で開く、を端と見分けるため)
if (sceneCount < 4) throw new Error(`${storyJa.slug} の場面が4つ未満(${sceneCount}つ)`)

const locateStory = () => {
  const main = page.getByRole('main')
  const dialog = page.getByRole('dialog')
  return {
    // イントロの小さなプレビュー。名前は aria-label から付き、DOM では CTA より先に並ぶ
    preview: main.getByRole('button', { name: ui.workStory.viewScene, exact: true }).first(),
    // 本文の後ろの CTA は文言を文節ごとに <wbr> で区切って描くので、名前ではなく中の文字で選ぶ。
    // プレビューは文字を持たないので当たらない
    cta: main.getByRole('button').filter({ hasText: ui.workStory.viewScene }),
    dialog,
    close: dialog.getByRole('button', { name: ui.workStory.close, exact: true }),
    prev: dialog.getByRole('button', { name: ui.workStory.prevScene, exact: true }),
    next: dialog.getByRole('button', { name: ui.workStory.nextScene, exact: true }),
    // 画面そのものが一時停止/再開のボタンで、状態は名前の入れ替えだけで表す
    pause: dialog.getByRole('button', { name: ui.workStory.pauseScene, exact: true }),
    resume: dialog.getByRole('button', { name: ui.workStory.resumeScene, exact: true }),
  }
}

// root の中で、シャドウルートに <svg> が展開された場面の数。SceneSvg は取った原文をシャドウルートへ流し込み、
// 取れなかった場面は ScenePlayer がプレースホルダの文字に差し替える
const scenesWithSvg = (root: Element | null) =>
  root === null
    ? 0
    : Array.from(root.querySelectorAll('*')).filter(element =>
        Boolean(element.shadowRoot?.querySelector('svg'))
      ).length

describe('読み進めと場面モーダル', () => {
  beforeEach(async () => {
    // E2E(Playwright の Desktop Chrome)と同じ画面の大きさで、ページの先頭から読み始める
    await page.viewport(1280, 720)
    window.scrollTo(0, 0)
    // E2E は1件ごとに新しいページで始まる。前のテストが背景の固定を戻し損ねても持ち越さず、戻し損ねたテストで落とす
    document.body.style.removeProperty('overflow')
    // 自動送りと場面の文の現れ方は、動きを控えない設定でだけ動く。実行環境の既定に任せず固定する
    await cdp().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    })
  })

  afterEach(async () => {
    // 先に外してから時計と環境を戻す(effect の後始末が差し替えた時計のまま走るように)
    cleanup()
    vi.useRealTimers()
    await cdp().send('Emulation.setEmulatedMedia', { features: [] })
  })

  // ここから下の2件は E2E から移したものではない。フックの分岐(場面の数の変化・開発時の二重実行)を、利用者に見える形で確かめる

  it('開発時の二重実行(StrictMode)でも、モーダルは開いたまま閉じるへフォーカスが乗り、閉じると背景の固定を解く', async () => {
    render(<StoryContainer {...storyJa} />, { reactStrictMode: true })
    const { cta, dialog, close } = locateStory()

    await cta.click()
    await expect.element(dialog).toBeVisible()
    await expect.element(close).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    await close.click()
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cta).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })
})

describe('場面の絵の取り直し', () => {
  // 場面 1 の絵は、最初のこの回数だけ 503 で落とす。それより後は絵を返す。
  // 1 回目はページを開いた時のイントロのプレビュー、2 回目は最初に開いたモーダルが取りに行く分
  const FAILED_REQUESTS = 2
  const SCENE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'></svg>`

  it('場面の絵の取得に失敗しても、モーダルを開き直すと取り直して絵が出る', async () => {
    // 取得の覚え(src/lib/fetch-svg-source.ts)は URL ごとにモジュールの中へ残り、同じファイルの前のテストが
    // 同じ場面の絵を取って覚えている。E2E はページを読み込むたびに空の覚えから始まるので、ここでは場面の URL に
    // 問い合わせの文字列を足して、まだ誰も取っていない URL にする(パスは実物のまま)
    const freshStory = {
      ...storyJa,
      story: {
        ...story,
        scenes: scenes.map(scene => ({ ...scene, image: `${scene.image}?scene-refetch` })),
      },
    }
    const firstImage = scenes[0].image
    let requests = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const { pathname } = new URL(new Request(input).url)
        if (pathname === firstImage) {
          requests += 1
          if (requests <= FAILED_REQUESTS) {
            return new Response('unavailable', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          }
        }
        return new Response(SCENE_SVG, { headers: { 'Content-Type': 'image/svg+xml' } })
      })
    )
    render(<StoryContainer {...freshStory} />)
    // イントロの小さなプレビュー。開いた時点で全場面を取りに行き、場面 1 は 1 回目の失敗でプレースホルダになる
    const { preview, dialog, close } = locateStory()
    const shownInDialog = () => scenesWithSvg(document.querySelector('dialog'))
    await expect.element(preview).toHaveTextContent(ui.work.shotPlaceholder)
    expect(requests).toBe(1)

    // 最初に開いたモーダルは場面 1 を取り直す。2 回目も失敗させるので、ここもプレースホルダになる
    await preview.click()
    await expect.element(dialog).toHaveTextContent(ui.work.shotPlaceholder)
    expect(requests, 'モーダルは前の失敗を引き継がず取り直す').toBe(2)
    await close.click()
    await expect.element(dialog).not.toBeInTheDocument()

    // 開き直すと取り直しが通り、全場面の絵がシャドウルートに出る
    await preview.click()
    await expect.element(dialog).toBeVisible()
    await expect
      .poll(shownInDialog, { message: '全場面の絵がシャドウルートに出る' })
      .toBe(sceneCount)
    await expect.element(dialog).not.toHaveTextContent(ui.work.shotPlaceholder)
    expect(requests, '失敗した後の取り直しは 1 回だけ').toBe(3)
    await close.click()
    await expect.element(dialog).not.toBeInTheDocument()

    // 成功した絵は覚えているので、もう一度開いても取りに行かずに出る
    await preview.click()
    await expect.element(dialog).toBeVisible()
    await expect.poll(shownInDialog).toBe(sceneCount)
    expect(requests, '成功した絵は取り直さない').toBe(3)
  })
})

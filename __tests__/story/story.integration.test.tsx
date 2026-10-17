// 実データの画面を Chromium へ描き、場面の操作と技術チップの開閉をまとめて確かめる
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { cdp, page, userEvent, type Locator } from 'vitest/browser'
import { sceneCycleMs } from '@/utils/cycle-scenes'
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

  it('場面カードから開き、次・前へ送り、Escで閉じると元のボタンへ戻る', async () => {
    render(<StoryContainer {...storyJa} />)
    // 同じ名前の固定 CTA より先にある、導入の場面カードを押す
    const trigger = page.getByRole('button', { name: ui.workStory.viewScene, exact: true }).first()
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect.element(dialog).toHaveAccessibleName(firstScene.title)
    await expect.element(dialog.getByRole('button', { name: ui.workStory.close })).toHaveFocus()
    // ユーザーの停止操作で自動送りを止め、手動の次・前だけを確かめる
    await dialog.getByRole('button', { name: ui.workStory.pauseScene }).click()
    const prev = dialog.getByRole('button', { name: ui.workStory.prevScene })
    const next = dialog.getByRole('button', { name: ui.workStory.nextScene })
    await expect.element(prev).toBeDisabled()

    await next.click()
    await expect.element(dialog).toHaveAccessibleName(story.scenes[1].title)
    await expect
      .element(dialog.getByText(`2 / ${story.scenes.length}`, { exact: true }))
      .toBeVisible()
    await expect.element(prev).toBeEnabled()

    await prev.click()
    await expect.element(dialog).toHaveAccessibleName(firstScene.title)
    await expect
      .element(dialog.getByText(`1 / ${story.scenes.length}`, { exact: true }))
      .toBeVisible()
    await expect.element(prev).toBeDisabled()

    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(trigger).toHaveFocus()
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

// 一時停止の間に進める時間。どの場面の周期(数秒)よりも十分に長く取る
const LONG_MS = 60_000
// 場面の文の現れ方は opacity の 1 秒の遷移(scene-section.module.css)なので、遷移を待てる長さで待つ
const REVEAL_TIMEOUT_MS = 5_000

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

// モーダルの「今の場面 / 場面の数」。読み上げのため aria-live を持つ。モーダルが無ければ null
const counterOf = () => document.querySelector('dialog [aria-live=polite]')
const counterText = () => counterOf()?.textContent ?? null

// 場面の番号(0始まり)を、モーダルの「今の場面 / 場面の数」の表示に直す
const shown = (index: number) => `${index + 1} / ${sceneCount}`

const expectCounter = (index: number, message?: string) =>
  expect.poll(counterText, { message }).toBe(shown(index))

// root の中で、シャドウルートに <svg> が展開された場面の数。SceneSvg は取った原文をシャドウルートへ流し込み、
// 取れなかった場面は ScenePlayer がプレースホルダの文字に差し替える
const scenesWithSvg = (root: Element | null) =>
  root === null
    ? 0
    : Array.from(root.querySelectorAll('*')).filter(element =>
        Boolean(element.shadowRoot?.querySelector('svg'))
      ).length

// 押す前に要素へフォーカスを置いてからキーを押す(Playwright の locator.press と同じ押し方)
const press = async (target: Locator, key: string) => {
  target.element().focus()
  await userEvent.keyboard(key)
}

// 偽の時計で ms だけ進める。発火した自動送りの描き直しと、それが掛け直す次のタイマーまでを act の中で済ませる
const runFor = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

// 偽の時計は setTimeout・clearTimeout だけを差し替え、React が描き直しと effect の予約に使う MessageChannel は止めない。
// 同じ経路で1通流して戻りを待つと、それより前に予約された描き直しと effect が済んでいる。
// 「送られていない」を見る前と、次の runFor の前(effect が次のタイマーを掛け終える前に進めると、
// 進めた時間がそのタイマーに数えられない)に呼ぶ
const flushRender = () =>
  new Promise<void>(resolve => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve()
    channel.port2.postMessage(null)
  })

// 画面を描き、CTA とプレビューを取り違えていないこと・プレビューに場面の絵が出たことを確かめる。
// CTA(画面の下に固定・aria-label 無し)をプレビュー(常に先頭の場面で開く)と取り違えると CTA の検査が空回りする
const openStory = async () => {
  render(<StoryContainer {...storyJa} />)
  const { preview, cta } = locateStory()
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

  it('CTA は今読んでいる場面からモーダルを開き、場面の文は画面に入ると現れる', async () => {
    await openStory()
    const { cta, dialog } = locateStory()
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

  it('前へ・次へで1つずつ送り、端ではそのボタンが無効になってフォーカスが隣のボタンへ移る', async () => {
    // 自動送りが割り込まないよう、時計を止めてから開く(進めない限りタイマーは発火しない)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await openStory()
    const { cta, dialog, close, prev, next } = locateStory()

    await cta.click()
    await expect.element(dialog).toHaveAccessibleName(scenes[0].title)
    await expectCounter(0)
    await expect.element(close, { message: '開いたら閉じるへフォーカスが乗る' }).toHaveFocus()
    await expect.element(prev).toBeDisabled()
    await expect.element(next).toBeEnabled()

    // 末尾の1つ手前までは、押した次へにフォーカスが残る
    for (let index = 1; index < sceneCount - 1; index += 1) {
      await press(next, '{Enter}')
      await expectCounter(index)
      await expect.element(dialog).toHaveAccessibleName(scenes[index].title)
      await expect.element(next).toHaveFocus()
      await expect.element(prev).toBeEnabled()
    }
    // 末尾へ着くと次へが無効になり、フォーカスは body へ落ちずに前へへ移る
    await press(next, '{Enter}')
    await expectCounter(sceneCount - 1)
    await expect.element(dialog).toHaveAccessibleName(scenes[sceneCount - 1].title)
    await expect.element(next).toBeDisabled()
    await expect.element(prev, { message: '末尾へ着くと次へから前へ移る' }).toHaveFocus()

    // 戻りも同じ。先頭の1つ手前までは、押した前へにフォーカスが残る
    for (let index = sceneCount - 2; index > 0; index -= 1) {
      await press(prev, '{Enter}')
      await expectCounter(index)
      await expect.element(dialog).toHaveAccessibleName(scenes[index].title)
      await expect.element(prev).toHaveFocus()
      await expect.element(next).toBeEnabled()
    }
    // 先頭へ着くと前へが無効になり、フォーカスは次へへ移る
    await press(prev, '{Enter}')
    await expectCounter(0)
    await expect.element(dialog).toHaveAccessibleName(scenes[0].title)
    await expect.element(prev).toBeDisabled()
    await expect.element(next, { message: '先頭へ着くと前へから次へ移る' }).toHaveFocus()
  })

  it('自動送りは場面の周期ちょうどで次へ進み、一時停止の間はどれだけ時間が経っても送らない', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await openStory()
    const { cta, pause, resume, next } = locateStory()

    await cta.click()
    await expectCounter(0)
    await flushRender()
    // 周期の 1ms 手前ではまだ送らず、周期ちょうどで送る
    runFor(sceneCycleMs(scenes[0].id) - 1)
    await flushRender()
    expect(counterText(), '周期の 1ms 手前ではまだ送らない').toBe(shown(0))
    runFor(1)
    await expectCounter(1, '周期ちょうどで次へ送る')
    await flushRender()

    // 画面そのものを押すと一時停止し、ボタンの名前が再開へ入れ替わる
    await pause.click()
    await expect.element(resume).toBeVisible()
    await flushRender()
    runFor(LONG_MS)
    await flushRender()
    expect(counterText(), '一時停止の間は送らない').toBe(shown(1))

    // 手で送っても一時停止は解けない
    await next.click()
    await expectCounter(2)
    await expect.element(resume).toBeVisible()
    await flushRender()
    runFor(LONG_MS)
    await flushRender()
    expect(counterText(), '手で送った後も一時停止のまま').toBe(shown(2))

    // 再開すると、今の場面の周期で次へ送る
    await resume.click()
    await expect.element(pause).toBeVisible()
    await flushRender()
    runFor(sceneCycleMs(scenes[2].id))
    await expectCounter(3, '再開すると今の場面の周期で送る')
  })

  it('自動送りで端へ着く時は、無効になるボタンに乗っていたフォーカスだけを逃がし、他のフォーカスは奪わない', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await openStory()
    const { cta, close, pause, prev, next } = locateStory()
    // index の場面の周期だけ進め、expected の場面へ送られて次のタイマーが掛かるまで待つ
    const advance = async (index: number, expected: number) => {
      runFor(sceneCycleMs(scenes[index].id))
      await expectCounter(expected)
      await flushRender()
    }

    await cta.click()
    await expectCounter(0)
    await flushRender()

    // 1周目: 画面そのもの(一時停止のボタン)にフォーカスを置いたまま送る。末尾へ着いても先頭へ巡っても動かさない
    pause.element().focus()
    for (let index = 1; index < sceneCount; index += 1) {
      await advance(index - 1, index)
      await expect.element(pause).toHaveFocus()
    }
    await expect.element(next).toBeDisabled()
    await advance(sceneCount - 1, 0)
    await expect
      .element(pause, { message: '先頭へ巡っても、前へ以外に乗ったフォーカスは奪わない' })
      .toHaveFocus()

    // 2周目: 次へにフォーカスを置く。途中では動かさず、末尾へ着くと無効になる次へから前へ逃がす
    next.element().focus()
    for (let index = 1; index < sceneCount - 1; index += 1) {
      await advance(index - 1, index)
      await expect.element(next).toHaveFocus()
    }
    await advance(sceneCount - 2, sceneCount - 1)
    await expect.element(next).toBeDisabled()
    await expect.element(prev, { message: '末尾へ着くと次へから前へ逃がす' }).toHaveFocus()

    // 前へに乗ったまま末尾から先頭へ巡ると、無効になる前へから閉じるへ逃がす
    await advance(sceneCount - 1, 0)
    await expect.element(prev).toBeDisabled()
    await expect.element(close, { message: '先頭へ巡ると前へから閉じるへ逃がす' }).toHaveFocus()
  })

  it('Esc・閉じる・余白のどれで閉じても開いたボタンへフォーカスが戻り、背景は開いている間だけ止まる', async () => {
    await openStory()
    const { preview, cta, dialog, close } = locateStory()
    const bodyOverflow = () => document.body.style.overflow
    expect(bodyOverflow()).toBe('')

    // 戻り先は開いたボタン(CTA・プレビュー)ごとに覚える(StoryBody)ので両方から開き分ける。Esc はブラウザ自身も
    // 開く前のフォーカスへ戻しうるので、StoryBody の戻しそのものは閉じる(プレビューへ)と余白(CTA へ)で確かめる
    // Esc: CTA から開いて閉じる
    await cta.click()
    await expect.element(dialog).toBeVisible()
    await expect.poll(bodyOverflow, { message: '開いている間は背景を止める' }).toBe('hidden')
    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cta, { message: 'Esc で閉じると CTA へ戻る' }).toHaveFocus()
    await expect.poll(bodyOverflow, { message: '閉じたら背景の固定を解く' }).toBe('')

    // 閉じるボタン: プレビューから開いた時はプレビューへ戻る(戻り先は開いたボタンごとに覚える)
    await preview.click()
    await expect.element(dialog).toBeVisible()
    await close.click()
    await expect.element(dialog).not.toBeInTheDocument()
    await expect
      .element(preview, { message: '閉じるで閉じると開いたプレビューへ戻る' })
      .toHaveFocus()

    // 余白: 中身を押しても閉じず、余白(dialog 自身)を押すと閉じる
    await cta.click()
    const counter = counterOf()
    if (counter === null) throw new Error('モーダルの場面の番号が無い')
    await userEvent.click(counter)
    await expect.element(dialog, { message: '中身を押しても閉じない' }).toBeVisible()
    await dialog.click({ position: { x: 4, y: 4 } })
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cta, { message: '余白で閉じると CTA へ戻る' }).toHaveFocus()
  })

  // ここから下の2件は E2E から移したものではない。フックの分岐(場面の数の変化・開発時の二重実行)を、利用者に見える形で確かめる

  it('別の作品の場面の並びへ描き直すと、今読んでいる場面を先頭へ戻し、CTA は新しい並びの先頭から開く', async () => {
    const { rerender } = render(<StoryContainer {...storyJa} />)
    const { cta, dialog } = locateStory()
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

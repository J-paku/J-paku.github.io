// 作品ストーリー(/works/<slug>/)の E2E。場面モーダルとストーリー本文の配線を、実際のクリック・キー操作で見る。
// 端・送り先・自動送りの待ち・フォーカスの逃がし先・周期の判定は SceneModal/utils と src/utils/cycle-scenes.ts の
// 単体テストが固めているので、ここではフックがその答えどおりに state・focus()・タイマーを動かしているかを見る:
// CTA が今読んでいる場面から開くか(use-active-scene)、場面の文が画面に入ると現れるか(use-reveal)、
// 前へ・次へと端でのフォーカス、自動送りと一時停止(WCAG 2.2.2)、自動送りで端へ着く時のフォーカス、
// 閉じ方3通りとフォーカスの戻り先(StoryBody)、開いている間の背景の固定(use-modal-dialog)。
// 場面の絵の取り直しは tests/scene-refetch.spec.ts が見る。どれも言語に依らないので ja(/ 配下)だけで見る
import { expect, type Page } from '@playwright/test'
import { ui } from '@content/ja/ui'
import { meishiCrossPlatform } from '@content/ja/works/meishi-cross-platform'
import { sceneCycleMs } from '@/utils/cycle-scenes'
// 天気を既定で晴れに固定した test を使う(他の spec と同じ土台に乗せる)。正本は village.helpers.ts
import { test } from './village.helpers'

const work = meishiCrossPlatform
const scenes = work.story?.scenes ?? []
const count = scenes.length
// 先頭・末尾の他に、途中の場面が2つ要る(途中から途中へ送る・途中の場面から CTA で開く、を端と見分けるため)
if (count < 4) throw new Error(`${work.slug} の場面が4つ未満(${count}つ)`)

// 偽の時計を止める時、今の時刻からこれだけ先へ進めてから止める(fishing.spec と同じ形)
const PAUSE_LEAD_MS = 1_000
// 一時停止の間に進める時間。どの場面の周期(数秒)よりも十分に長く取る
const LONG_MS = 60_000

// 計測(GoatCounter)へは1通も出さない。計測先を入れて build した out/ を見ても数えられないよう両方の宛先を塞ぐ
const isGoatCounter = (url: URL) =>
  url.hostname === 'gc.zgo.at' || url.hostname.endsWith('.goatcounter.com')

// 自動送りと場面の文の現れ方は、動きを控えない設定でだけ動く。実行環境の既定に任せず固定する
test.use({ reducedMotion: 'no-preference' })

test.beforeEach(async ({ page }) => {
  await page.route(isGoatCounter, route => route.abort())
})

const locate = (page: Page) => {
  const main = page.getByRole('main')
  const dialog = page.getByRole('dialog')
  return {
    // イントロの小さなプレビュー。名前は aria-label から付き、DOM では CTA より先に並ぶ
    preview: main.getByRole('button', { name: ui.workStory.viewScene, exact: true }).first(),
    // 本文の後ろの CTA は名前で探さない。文言を文節ごとに <wbr> で区切って描くため Playwright の付ける名前が
    // 文言と一致せず、名前で探すとプレビューだけが当たる(2026-10-11 に probe で実測。.last() もプレビューだった)。
    // 中の文字(区切りを挟まずにつないだもの)で選ぶ。プレビューは文字を持たないので当たらない
    cta: main.getByRole('button').filter({ hasText: ui.workStory.viewScene }),
    dialog,
    close: dialog.getByRole('button', { name: ui.workStory.close, exact: true }),
    prev: dialog.getByRole('button', { name: ui.workStory.prevScene, exact: true }),
    next: dialog.getByRole('button', { name: ui.workStory.nextScene, exact: true }),
    // 画面そのものが一時停止/再開のボタンで、状態は名前の入れ替えだけで表す
    pause: dialog.getByRole('button', { name: ui.workStory.pauseScene, exact: true }),
    resume: dialog.getByRole('button', { name: ui.workStory.resumeScene, exact: true }),
    // 「今の場面 / 場面の数」。読み上げのため aria-live を持つ
    counter: dialog.locator('[aria-live="polite"]'),
  }
}

// 場面の番号(0始まり)を、モーダルの「今の場面 / 場面の数」の表示に直す
const shown = (index: number) => `${index + 1} / ${count}`

// プレビューのシャドウルートに場面の絵が出たら、クライアントの島が動いている(押せば開く)。
// 島が動く前に押すと何も起きないので、開く前に必ず待つ
const openStory = async (page: Page) => {
  await page.goto(`/works/${work.slug}/`)
  const { preview, cta } = locate(page)
  // CTA(画面の下に固定・aria-label 無し)をプレビュー(常に先頭の場面で開く)と取り違えると CTA の検査が空回りする
  await expect(cta).toHaveCount(1)
  await expect(cta).toHaveCSS('position', 'fixed')
  await expect(cta).not.toHaveAttribute('aria-label')
  await expect(preview).toHaveAttribute('aria-label', ui.workStory.viewScene)
  await expect
    .poll(
      () =>
        preview.evaluate(root =>
          Array.from(root.querySelectorAll('*')).some(element =>
            Boolean(element.shadowRoot?.querySelector('svg'))
          )
        ),
      { message: 'イントロのプレビューに場面の絵が出る' }
    )
    .toBe(true)
}

// 偽の時計をここで止める。以降は runFor で進めた分しか時間が経たず、自動送りは勝手に走らない
const pauseClock = async (page: Page) => {
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + PAUSE_LEAD_MS)
}

// 偽の時計は setTimeout と rAF を止めるが、React が描き直しと effect の予約に使う MessageChannel は止めない。
// 同じ経路で1通流して戻りを待つと、それより前に予約された描き直しと effect が済んでいる。
// 「送られていない」を見る前(待たずに見ると、送られた描き直しが反映される前の古い表示で通る)と、
// 次の runFor の前(effect が次のタイマーを掛け終える前に進めると、進めた時間がそのタイマーに数えられない)に呼ぶ
const flushRender = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>(resolve => {
        const channel = new MessageChannel()
        channel.port1.onmessage = () => resolve()
        channel.port2.postMessage(null)
      })
  )

test('CTA は今読んでいる場面からモーダルを開き、場面の文は画面に入ると現れる', async ({ page }) => {
  await openStory(page)
  const { cta, dialog, counter } = locate(page)
  // 先頭でも末尾でもない場面を選ぶ。先頭だと「いつも先頭から開く」誤りと見分けられない
  const target = count - 2
  const section = page.getByRole('region', { name: scenes[target].title, exact: true })
  // 場面の文を包む箱。現れる前は透明で、use-reveal が表示の印を付けると不透明になる
  const wrapper = section.locator(':scope > div')
  const opacity = () => wrapper.evaluate(element => getComputedStyle(element).opacity)

  const box = await section.boundingBox()
  const viewport = page.viewportSize()
  if (box === null || viewport === null) throw new Error('場面の位置か画面の大きさが取れない')
  expect(box.y, '選んだ場面は最初は画面の下の外にある').toBeGreaterThan(viewport.height)
  expect(await opacity(), '画面の外の場面の文はまだ現れていない').toBe('0')

  // 画面の中央まで送ると現れ、今読んでいる場面になる
  await section.evaluate(element =>
    element.scrollIntoView({ block: 'center', behavior: 'instant' })
  )
  await expect.poll(opacity, { message: '画面に入った場面の文が現れる' }).toBe('1')

  await cta.click()
  await expect(dialog).toHaveAccessibleName(scenes[target].title)
  await expect(counter).toHaveText(shown(target))
})

test('前へ・次へで1つずつ送り、端ではそのボタンが無効になってフォーカスが隣のボタンへ移る', async ({
  page,
}) => {
  await page.clock.install()
  await openStory(page)
  // 自動送りが割り込まないよう、時計を止めてから開く
  await pauseClock(page)
  const { cta, dialog, close, prev, next, counter } = locate(page)

  await cta.click()
  await expect(dialog).toHaveAccessibleName(scenes[0].title)
  await expect(counter).toHaveText(shown(0))
  await expect(close, '開いたら閉じるへフォーカスが乗る').toBeFocused()
  await expect(prev).toBeDisabled()
  await expect(next).toBeEnabled()

  // 末尾の1つ手前までは、押した次へにフォーカスが残る
  for (let index = 1; index < count - 1; index += 1) {
    await next.press('Enter')
    await expect(counter).toHaveText(shown(index))
    await expect(dialog).toHaveAccessibleName(scenes[index].title)
    await expect(next).toBeFocused()
    await expect(prev).toBeEnabled()
  }
  // 末尾へ着くと次へが無効になり、フォーカスは body へ落ちずに前へへ移る
  await next.press('Enter')
  await expect(counter).toHaveText(shown(count - 1))
  await expect(dialog).toHaveAccessibleName(scenes[count - 1].title)
  await expect(next).toBeDisabled()
  await expect(prev, '末尾へ着くと次へから前へ移る').toBeFocused()

  // 戻りも同じ。先頭の1つ手前までは、押した前へにフォーカスが残る
  for (let index = count - 2; index > 0; index -= 1) {
    await prev.press('Enter')
    await expect(counter).toHaveText(shown(index))
    await expect(dialog).toHaveAccessibleName(scenes[index].title)
    await expect(prev).toBeFocused()
    await expect(next).toBeEnabled()
  }
  // 先頭へ着くと前へが無効になり、フォーカスは次へへ移る
  await prev.press('Enter')
  await expect(counter).toHaveText(shown(0))
  await expect(dialog).toHaveAccessibleName(scenes[0].title)
  await expect(prev).toBeDisabled()
  await expect(next, '先頭へ着くと前へから次へ移る').toBeFocused()
})

test('自動送りは場面の周期ちょうどで次へ進み、一時停止の間はどれだけ時間が経っても送らない', async ({
  page,
}) => {
  await page.clock.install()
  await openStory(page)
  await pauseClock(page)
  const { cta, pause, resume, next, counter } = locate(page)

  await cta.click()
  await expect(counter).toHaveText(shown(0))
  await flushRender(page)
  // 周期の 1ms 手前ではまだ送らず、周期ちょうどで送る
  await page.clock.runFor(sceneCycleMs(scenes[0].id) - 1)
  await flushRender(page)
  await expect(counter, '周期の 1ms 手前ではまだ送らない').toHaveText(shown(0))
  await page.clock.runFor(1)
  await expect(counter, '周期ちょうどで次へ送る').toHaveText(shown(1))
  await flushRender(page)

  // 画面そのものを押すと一時停止し、ボタンの名前が再開へ入れ替わる
  await pause.click()
  await expect(resume).toBeVisible()
  await page.clock.runFor(LONG_MS)
  await flushRender(page)
  await expect(counter, '一時停止の間は送らない').toHaveText(shown(1))

  // 手で送っても一時停止は解けない
  await next.click()
  await expect(counter).toHaveText(shown(2))
  await expect(resume).toBeVisible()
  await page.clock.runFor(LONG_MS)
  await flushRender(page)
  await expect(counter, '手で送った後も一時停止のまま').toHaveText(shown(2))

  // 再開すると、今の場面の周期で次へ送る
  await resume.click()
  await expect(pause).toBeVisible()
  await flushRender(page)
  await page.clock.runFor(sceneCycleMs(scenes[2].id))
  await expect(counter, '再開すると今の場面の周期で送る').toHaveText(shown(3))
})

test('自動送りで端へ着く時は、無効になるボタンに乗っていたフォーカスだけを逃がし、他のフォーカスは奪わない', async ({
  page,
}) => {
  await page.clock.install()
  await openStory(page)
  await pauseClock(page)
  const { cta, close, pause, prev, next, counter } = locate(page)
  // index の場面の周期だけ進め、expected の場面へ送られて次のタイマーが掛かるまで待つ
  const advance = async (index: number, expected: number) => {
    await page.clock.runFor(sceneCycleMs(scenes[index].id))
    await expect(counter).toHaveText(shown(expected))
    await flushRender(page)
  }

  await cta.click()
  await expect(counter).toHaveText(shown(0))
  await flushRender(page)

  // 1周目: 画面そのもの(一時停止のボタン)にフォーカスを置いたまま送る。末尾へ着いても先頭へ巡っても動かさない
  await pause.focus()
  for (let index = 1; index < count; index += 1) {
    await advance(index - 1, index)
    await expect(pause).toBeFocused()
  }
  await expect(next).toBeDisabled()
  await advance(count - 1, 0)
  await expect(pause, '先頭へ巡っても、前へ以外に乗ったフォーカスは奪わない').toBeFocused()

  // 2周目: 次へにフォーカスを置く。途中では動かさず、末尾へ着くと無効になる次へから前へ逃がす
  await next.focus()
  for (let index = 1; index < count - 1; index += 1) {
    await advance(index - 1, index)
    await expect(next).toBeFocused()
  }
  await advance(count - 2, count - 1)
  await expect(next).toBeDisabled()
  await expect(prev, '末尾へ着くと次へから前へ逃がす').toBeFocused()

  // 前へに乗ったまま末尾から先頭へ巡ると、無効になる前へから閉じるへ逃がす
  await advance(count - 1, 0)
  await expect(prev).toBeDisabled()
  await expect(close, '先頭へ巡ると前へから閉じるへ逃がす').toBeFocused()
})

test('Esc・閉じる・余白のどれで閉じても開いたボタンへフォーカスが戻り、背景は開いている間だけ止まる', async ({
  page,
}) => {
  await openStory(page)
  const { preview, cta, dialog, close, counter } = locate(page)
  const bodyOverflow = () => page.evaluate(() => document.body.style.overflow)
  expect(await bodyOverflow()).toBe('')

  // 戻り先は開いたボタン(CTA・プレビュー)ごとに覚える(StoryBody)ので両方から開き分ける。Esc はブラウザ自身も
  // 開く前のフォーカスへ戻しうるので、StoryBody の戻しそのものは閉じる(プレビューへ)と余白(CTA へ)で確かめる
  // Esc: CTA から開いて閉じる
  await cta.click()
  await expect(dialog).toBeVisible()
  await expect.poll(bodyOverflow, { message: '開いている間は背景を止める' }).toBe('hidden')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(cta, 'Esc で閉じると CTA へ戻る').toBeFocused()
  await expect.poll(bodyOverflow, { message: '閉じたら背景の固定を解く' }).toBe('')

  // 閉じるボタン: プレビューから開いた時はプレビューへ戻る(戻り先は開いたボタンごとに覚える)
  await preview.click()
  await expect(dialog).toBeVisible()
  await close.click()
  await expect(dialog).toHaveCount(0)
  await expect(preview, '閉じるで閉じると開いたプレビューへ戻る').toBeFocused()

  // 余白: 中身を押しても閉じず、余白(dialog 自身)を押すと閉じる
  await cta.click()
  await counter.click()
  await expect(dialog, '中身を押しても閉じない').toBeVisible()
  await dialog.click({ position: { x: 4, y: 4 } })
  await expect(dialog).toHaveCount(0)
  await expect(cta, '余白で閉じると CTA へ戻る').toBeFocused()
})

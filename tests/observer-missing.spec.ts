// 交差の観察(IntersectionObserver)が無いブラウザの E2E。一覧(/list/)の作品カードが、スクロールしなくても
// 画面の外の分まで最初から現れ(use-reveal)、写真が色付きで出る(use-fully-visible)かを見る。
// 作品ストーリー(/works/<slug>/)では、場面を下へ送っても今の場面を追わず先頭のまま(use-active-scene)、
// 画面の下に固定した CTA が先頭の場面から開くかを見る。
// 観察できない時の倒し方の判定そのもの(shouldRevealAtOnce・resolveFullyVisible)は src/utils/observe-fallback.test.ts が
// 単体で固めている。ここで見るのは、フックがその判定へ「観察できない」を実際に渡し、画面がその答えどおりに出ること。
// 統合テスト(Vitest Browser Mode)では見られない。読み込み済みのモジュールを読み直せないので後から消すしかなく、
// 読み込み時に「ある」と覚えた next/link が new IntersectionObserver を呼んで画面ごと落ちる(2026-10-14 の実測)。
// ここではページのどのスクリプトより先に消すので、next/link も読み込みの時点で「無い」と覚えて観察を使わない。
// 消した画面だけを見ると「観察が働いて現れた」のと見分けられないので、消さない普通のページでは画面の外のカードが
// まだ現れず写真も灰色のまま、という対照を同じ spec で見る。作品ストーリーの対照(観察できれば、同じ場面を画面の中央まで
// 送ると CTA がその場面から開く)は tests/story.spec.ts の「CTA は今読んでいる場面からモーダルを開き…」が見ている。
// どれも言語に依らないので ja だけで見る
import { expect, type Locator, type Page } from '@playwright/test'
import { ui } from '@content/ja/ui'
import { meishiCrossPlatform } from '@content/ja/works/meishi-cross-platform'
import { seatmapDemo } from '@content/ja/works/seatmap-demo'
// 天気を既定で晴れに固定した test を使う(他の spec と同じ土台に乗せる)。正本は village.helpers.ts
import { test } from './village.helpers'

// 実操作デモの動画を持つ作品と、その動画の場所
const videoWork = seatmapDemo
const videoSrc = videoWork.video
if (videoSrc === undefined) throw new Error(`${videoWork.slug} が動画を持たない`)

// 場面を持つ作品ストーリー(story.spec と同じ作品)。先頭と末尾の間に、送り先にする途中の場面が要る
const storyWork = meishiCrossPlatform
const scenes = storyWork.story?.scenes ?? []
if (scenes.length < 3) throw new Error(`${storyWork.slug} の場面が3つ未満(${scenes.length}つ)`)

// 今の場面とみなす画面の中央の帯(上下45%を除いた中央10%。use-active-scene の rootMargin と同じ)
const CENTER_BAND = { top: 0.45, bottom: 0.55 }

// カードは <article id="<slug>"> で並ぶ(WorkCard が slug をそのまま id にする。directory.spec と同じ)
const CARDS = '#works article'
// カードの写真(静止画)。動きを控えない設定では、動画もリールも持たない作品のカードにだけ出る
const PHOTOS = `${CARDS} img`

// 計測(GoatCounter)へは1通も出さない。計測先を入れて build した out/ を見ても数えられないよう両方の宛先を塞ぐ
const isGoatCounter = (url: URL) =>
  url.hostname === 'gc.zgo.at' || url.hostname.endsWith('.goatcounter.com')

// 動きを控える設定では観察を待たずに最初から出すので、観察の有無で違いが出ない。実行環境の既定に任せず固定する
test.use({ reducedMotion: 'no-preference' })

test.beforeEach(async ({ page }) => {
  await page.route(isGoatCounter, route => route.abort())
})

// ページのどのスクリプトよりも先に IntersectionObserver を消す。読み込み時に有無を覚える next/link にも効く
const removeIntersectionObserver = (page: Page) =>
  page.addInitScript(() => {
    Reflect.deleteProperty(window, 'IntersectionObserver')
  })

// 消しが本当に効いているか。効いていなければ観察が普通に働き、以降の検査は観察できるときの姿しか示さない。
// 判定は src/utils/observe-fallback.ts の canObserveIntersection と同じ形
const canObserve = (page: Page) => page.evaluate(() => typeof IntersectionObserver !== 'undefined')

// 捕まえられずに外へ出た例外の文言(storage-blocked.spec と同じ形)。goto より先に呼ぶ
const collectPageErrors = (page: Page) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  return errors
}

// 最初の画面の下端(px)。どのテストもスクロールしないので、ここより下にある要素は画面に入らない
const foldOf = (page: Page) => {
  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('画面の大きさが取れない')
  return viewport.height
}

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('要素の位置が取れない')
  return box
}

// カードの不透明度。現れる前は 0 で、use-reveal が表示の印を付けると 1 秒かけて 1 になる(work-card.module.css)
const opacityOf = (card: Locator) => card.evaluate(element => getComputedStyle(element).opacity)

// 写真の単色の度合い(0 = 実物の色、1 = 単色)。丸ごと収まっている印(use-fully-visible)が付くと 0 へ戻る(shot.module.css)。
// 計算値の filter は grayscale(1) contrast(1.1) の形で読める。百分率のまま返る版でも同じ尺度に直す
const grayscaleOf = (photo: Locator) =>
  photo.evaluate(element => {
    const match = /grayscale\(([\d.]+)(%?)\)/.exec(getComputedStyle(element).filter)
    if (match === null) return null
    return match[2] === '%' ? Number(match[1]) / 100 : Number(match[1])
  })

// 前提: 最後のカードと最後の写真は最初の画面に収まっていない。収まっていると、観察が働いても
// 最初から現れ・色付きになるので、観察の有無で違いが出ない
const expectBelowFold = async (page: Page) => {
  const fold = foldOf(page)
  const lastCard = await boxOf(page.locator(CARDS).last())
  expect(lastCard.y, '最後のカードは最初の画面の下の外にある').toBeGreaterThan(fold)
  const lastPhoto = await boxOf(page.locator(PHOTOS).last())
  expect(lastPhoto.y + lastPhoto.height, '最後の写真は最初の画面に収まっていない').toBeGreaterThan(
    fold
  )
}

test('IntersectionObserver があれば、画面の外のカードはスクロールするまで現れず、写真も灰色のまま', async ({
  page,
}) => {
  await page.goto('/list/')
  expect(await canObserve(page), 'IntersectionObserver がある').toBe(true)
  await expectBelowFold(page)
  const cards = page.locator(CARDS)
  expect((await boxOf(cards.first())).y, '最初のカードは最初の画面の中にある').toBeLessThan(
    foldOf(page)
  )

  // 最初の画面のカードが現れるのを待つ。ハイドレーションが済み、観察の最初の通知が届いた印。
  // カードごとの観察者は同じ描画の effect で作られ、最初の通知は同じ回にまとめて届くので、ここまで来れば
  // 画面の外のカードにも「交差していない」の通知が届いている。現れ切るまでの 1 秒の遷移が、その上の余裕になる
  await expect(cards.first(), '最初の画面のカードは現れる').toHaveCSS('opacity', '1')

  expect(await opacityOf(cards.last()), '画面の外のカードはまだ現れていない').toBe('0')
  expect(await grayscaleOf(page.locator(PHOTOS).last()), '収まっていない写真は灰色のまま').toBe(1)
})

test('IntersectionObserver が無くても、スクロールせずに画面の外のカードまで現れ、写真も色付きで出る', async ({
  page,
}) => {
  const errors = collectPageErrors(page)
  await removeIntersectionObserver(page)
  await page.goto('/list/')
  expect(await canObserve(page), 'IntersectionObserver は消えている').toBe(false)
  await expectBelowFold(page)

  // use-reveal: 観察できないので交差を待たずに表示の印を付ける。現れ切るまでの 1 秒の遷移を待つ。
  // 枚数は読み込んだ HTML で先に数える。画面が落ちてカードが消えたとき、空の繰り返しで通らないように
  const cards = page.locator(CARDS)
  const count = await cards.count()
  expect(count, 'カードが2枚以上ある(画面の中と外の両方)').toBeGreaterThan(1)
  for (let index = 0; index < count; index += 1) {
    await expect(cards.nth(index), `${index + 1} 枚目のカードも現れる`).toHaveCSS('opacity', '1')
  }
  // 表示の印は動画の src を付けてよい合図も兼ねる(WorkCard の shouldLoadVideo)。動画のカードは最初の画面にあるので、
  // 観察の有無を見分けるのは上のカードの方で、ここは観察できなくても動画を読み込むことだけを見る
  await expect(
    page.locator(`#${videoWork.slug} video`),
    '観察できなくても動画を読み込む'
  ).toHaveAttribute('src', videoSrc)

  // use-fully-visible: 判定できないので丸ごと収まっている側へ倒し、写真の色を戻す。0.8 秒の遷移を待つ
  await expect
    .poll(() => grayscaleOf(page.locator(PHOTOS).last()), {
      message: '画面に収まっていない写真も色付きで出る',
    })
    .toBe(0)

  expect(errors, '捕まえられない例外が出ていない').toEqual([])
})

// 描画の予約が2フレーム回るまで待つ。送った後に状態の更新が画面へ届く間を置いてから「変わらないまま」を見る
const settleFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )

test('IntersectionObserver が無いと、場面を下へ送っても今の場面は先頭のままで、CTA は先頭の場面から開く', async ({
  page,
}) => {
  const errors = collectPageErrors(page)
  await removeIntersectionObserver(page)
  await page.goto(`/works/${storyWork.slug}/`)
  expect(await canObserve(page), 'IntersectionObserver は消えている').toBe(false)

  // 探し方は story.spec の locate と同じ。CTA は文言を文節ごとに区切って描くので名前でなく中の文字で選ぶ
  const main = page.getByRole('main')
  const preview = main.getByRole('button', { name: ui.workStory.viewScene, exact: true }).first()
  const cta = main.getByRole('button').filter({ hasText: ui.workStory.viewScene })
  const dialog = page.getByRole('dialog')
  const counter = dialog.locator('[aria-live="polite"]')
  await expect(cta).toHaveCount(1)
  // プレビューのシャドウルートに場面の絵が出たら、クライアントの島が動いている(story.spec の openStory と同じ待ち)
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

  // 前提: 送る前は先頭の場面が今の場面。CTA で開いて確かめ、閉じて戻る
  await cta.click()
  await expect(dialog).toHaveAccessibleName(scenes[0].title)
  await expect(counter).toHaveText(`1 / ${scenes.length}`)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  // 前提: 最後に送る場面(末尾の1つ手前。story.spec の対照と同じ場面)は最初は画面の下の外にある
  const fold = foldOf(page)
  const last = scenes.length - 2
  const sectionOf = (index: number) =>
    page.getByRole('region', { name: scenes[index].title, exact: true })
  expect((await boxOf(sectionOf(last))).y, '最後に送る場面は最初は画面の下の外').toBeGreaterThan(
    fold
  )

  // 2番目の場面から末尾の1つ手前まで、1つずつ画面の中央へ送る。どれも中央の帯を通る(観察できれば今の場面になる位置)
  for (let index = 1; index <= last; index += 1) {
    const section = sectionOf(index)
    await section.evaluate(element =>
      element.scrollIntoView({ block: 'center', behavior: 'instant' })
    )
    const box = await boxOf(section)
    expect(box.y, `${index + 1} 番目の場面は中央の帯より上から始まる`).toBeLessThan(
      fold * CENTER_BAND.bottom
    )
    expect(box.y + box.height, `${index + 1} 番目の場面は中央の帯より下まで続く`).toBeGreaterThan(
      fold * CENTER_BAND.top
    )
  }
  await settleFrames(page)

  // 観察できないので今の場面を追わず、CTA は先頭の場面から開く
  await cta.click()
  await expect(dialog, '送った後も CTA は先頭の場面から開く').toHaveAccessibleName(scenes[0].title)
  await expect(counter).toHaveText(`1 / ${scenes.length}`)

  expect(errors, '捕まえられない例外が出ていない').toEqual([])
})

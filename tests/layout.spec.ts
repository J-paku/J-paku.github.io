// 村の舞台レイアウト E2E。PC は原寸 640×576 で中央、縦持ちは幅いっぱい + 画面最下端の帯にスティックと A/B、
// 横持ち・タブレットは枠の左右に150px以上のガターが空けば左右のガターへ、空かなければ枠の左右上に重ねる。
// useStageScale が --cell(と data-gutters)を実測で書いてから測る
import { expect, type Page } from '@playwright/test'
import {
  CELL_MIN,
  cellMax,
  computeCell,
} from '../src/components/VillagePage/components/Village/hooks/use-stage-scale'
// 村の E2E で共用する test。context に既定で晴れの応答を敷き、舞台を開いた時の天気の問い合わせを
// 実ネットワークへ出さない。正本は village.helpers.ts
import { test } from './village.helpers'

// ブート演出が消え、useStageScale が舞台の実測を --cell に書き込むまで待つ。
// CSS の既定値だけでも近い寸法になるため、インライン変数の有無で JS 側の実行を確かめる
const waitForStage = async (page: Page, path = '/') => {
  await page.goto(path)
  await page.waitForSelector('#boot', { state: 'detached', timeout: 5_000 })
  await page.waitForFunction(() => {
    const frame = document.querySelector('[data-village]')
    const root = frame?.closest<HTMLElement>('[style*="--cols"]')
    return root instanceof HTMLElement && root.style.getPropertyValue('--cell') !== ''
  })
}

// .root のインライン変数(--cols/--rows は Village が、--cell は useStageScale が書く)
const stageVars = (page: Page) =>
  page.evaluate(() => {
    const frame = document.querySelector('[data-village]')
    const root = frame?.closest<HTMLElement>('[style*="--cols"]')
    if (!(root instanceof HTMLElement)) throw new Error('.root が無い')
    return {
      cols: Number(root.style.getPropertyValue('--cols')),
      rows: Number(root.style.getPropertyValue('--rows')),
      cell: Number.parseInt(root.style.getPropertyValue('--cell'), 10),
    }
  })

// useStageScale が実測して .root へ立てる data-gutters(帯を左右のガターへ分けるか)
const hasGuttersAttr = (page: Page) =>
  page.evaluate(() => {
    const frame = document.querySelector('[data-village]')
    const root = frame?.closest<HTMLElement>('[style*="--cols"]')
    if (!(root instanceof HTMLElement)) throw new Error('.root が無い')
    return root.hasAttribute('data-gutters')
  })

const scrollOverflow = (page: Page) =>
  page.evaluate(() => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight)

const box = async (page: Page, selector: string) => {
  const rect = await page.locator(selector).boundingBox()
  if (rect === null) throw new Error(`${selector} が描かれていない`)
  return rect
}

// 矩形どうしが重なっているか(接するだけは重なりに数えない)
const boxesIntersect = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

// ko も同じ舞台レイアウトになることの最小確認(ロケール別のレイアウト崩れが無いか)
for (const path of ['/', '/ko/']) {
  test(`PC: 一覧への出口は右下に固定される (${path})`, async ({ page }) => {
    await waitForStage(page, path)
    const viewport = page.viewportSize()
    if (viewport === null) throw new Error('viewport 未設定')
    const exit = await box(page, '[data-village-exit]')
    const frame = await box(page, '[data-village]')
    expect(exit.x + exit.width).toBeLessThanOrEqual(viewport.width - 8)
    expect(exit.y + exit.height).toBeLessThanOrEqual(viewport.height - 8)
    expect(exit.y).toBeGreaterThan(frame.y + frame.height / 2)
    expect(exit.width).toBeLessThan(frame.width / 2)
  })
}

test('PC: 枠は上限 64px の整数マスで舞台に収まり、スティックと A/B は出ない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await waitForStage(page)
  const frame = await box(page, '[data-village]')
  const { cols, rows, cell } = await stageVars(page)
  // PC の上限は視野(10×9 マス)で 64px = 640×576(原寸 160×144 の 4 倍)
  expect(cell).toBe(computeCell(1280, 720, 0, cols, rows))
  expect(cell).toBe(cellMax(cols))
  // 上限そのものが変わったら気づけるよう、公式ではなく実数で留める
  expect(cell).toBe(64)
  expect(cell).toBeGreaterThanOrEqual(CELL_MIN)
  expect(frame.width).toBe(cell * cols)
  expect(frame.height).toBe(cell * rows)
  expect(frame.x).toBeGreaterThanOrEqual(0)
  expect(frame.x + frame.width).toBeLessThanOrEqual(1280)
  expect(frame.y).toBeGreaterThanOrEqual(0)
  expect(frame.y + frame.height).toBeLessThanOrEqual(720)
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.locator('[data-village-controls]')).toBeHidden()
  expect(await scrollOverflow(page)).toBeLessThanOrEqual(0)
})

// devices[] は defaultBrowserType を含み describe 内で使えないため、寸法と入力種別だけ指定する
test.describe('縦持ちのスマートフォン', () => {
  test.use({
    viewport: { width: 390, height: 664 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  })

  test('枠は幅基準の整数マス、スティックと A/B は枠の下の帯に置かれる', async ({ page }) => {
    await waitForStage(page)
    const viewport = page.viewportSize()
    if (viewport === null) throw new Error('viewport 未設定')
    const frame = await box(page, '[data-village]')
    const band = await box(page, '[data-village-controls]')
    const exitSlot = await box(page, '[data-village-exit-slot]')
    const exit = await box(page, '[data-village-exit]')
    const { cols, rows, cell } = await stageVars(page)
    // 幅基準: floor(390 / 列)。CSS 既定値ではなく JS の実測値であること(差し引くのは帯と出口の箱の実測)
    expect(cell).toBe(
      computeCell(viewport.width, viewport.height, band.height + exitSlot.height, cols, rows)
    )
    // 一覧への出口は枠のすぐ下に横いっぱい、帯より上
    expect(exit.y).toBeGreaterThanOrEqual(frame.y + frame.height)
    expect(exit.y - (frame.y + frame.height)).toBeLessThanOrEqual(24)
    expect(exit.y + exit.height).toBeLessThanOrEqual(band.y)
    expect(exit.width).toBeGreaterThanOrEqual(frame.width - 24)
    expect(exit.height).toBeGreaterThanOrEqual(44)
    expect(frame.width).toBe(cell * cols)
    expect(frame.height).toBe(cell * rows)
    expect(band.y).toBeGreaterThanOrEqual(frame.y + frame.height)
    expect(band.y + band.height).toBeLessThanOrEqual(viewport.height)
    // 帯は親指ゾーン(画面の最下端)まで届く。テスト環境に safe-area は無いので端に密着する
    expect(band.y + band.height).toBeGreaterThanOrEqual(viewport.height - 1)
    const joystick = await box(page, '[data-village-controls] [role="application"]')
    const a = await box(page, '[data-village-action="a"]')
    const b = await box(page, '[data-village-action="b"]')
    // スティックは帯の左半分。縦持ちタッチは120px以上まで大きくする
    expect(joystick.width).toBeGreaterThanOrEqual(120)
    expect(joystick.x).toBeGreaterThanOrEqual(band.x)
    expect(joystick.x + joystick.width).toBeLessThanOrEqual(band.x + band.width / 2)
    expect(joystick.y).toBeGreaterThanOrEqual(band.y)
    expect(joystick.y + joystick.height).toBeLessThanOrEqual(band.y + band.height)
    // A・B は帯の右半分、どちらも帯の内側。縦持ちタッチは64px以上まで大きくする
    expect(a.width).toBeGreaterThanOrEqual(64)
    expect(b.width).toBeGreaterThanOrEqual(64)
    expect(a.x).toBeGreaterThanOrEqual(band.x + band.width / 2)
    expect(a.x + a.width).toBeLessThanOrEqual(band.x + band.width)
    expect(a.y).toBeGreaterThanOrEqual(band.y)
    expect(a.y + a.height).toBeLessThanOrEqual(band.y + band.height)
    expect(b.x).toBeGreaterThanOrEqual(band.x + band.width / 2)
    expect(b.x + b.width).toBeLessThanOrEqual(band.x + band.width)
    expect(b.y).toBeGreaterThanOrEqual(band.y)
    expect(b.y + b.height).toBeLessThanOrEqual(band.y + band.height)
    // A は B の右上(GBA と同じ配置)
    expect(b.x + b.width).toBeLessThanOrEqual(a.x + a.width)
    expect(a.x).toBeGreaterThan(b.x)
    expect(a.y).toBeLessThan(b.y)
    expect(await scrollOverflow(page)).toBeLessThanOrEqual(0)
  })

  test('操作帯を含む舞台全体で touch-action: none が効き、下方向のドラッグで文書がスクロールしない', async ({
    page,
  }) => {
    await waitForStage(page)
    // touch-action は継承されないプロパティなので、帯自身の computed style だけでは祖先の
    // none を拾えない。ブラウザが実際にタッチのデフォルト動作(ページのパン)を止めるかは
    // 帯とその祖先を合わせた実効値で決まるので、帯から根まで遡って none を持つ要素があるかを見る
    // (実機の「黒帯を下へ引くとページごと動く」報告への対処)
    const result = await page.evaluate(() => {
      const controls = document.querySelector('[data-village-controls]')
      const root = controls?.closest<HTMLElement>('[style*="--cols"]')
      if (!(controls instanceof HTMLElement) || !(root instanceof HTMLElement)) {
        throw new Error('操作帯か .root が見つからない')
      }
      let node: Element | null = controls
      let controlsEffectiveNone = false
      while (node !== null) {
        if (getComputedStyle(node).touchAction === 'none') {
          controlsEffectiveNone = true
          break
        }
        node = node.parentElement
      }
      return {
        controlsEffectiveNone,
        rootTouchAction: getComputedStyle(root).touchAction,
      }
    })
    // .root(黒帯と余白を含む舞台全体)自身が touch-action: none であること
    expect(result.rootTouchAction).toBe('none')
    // 帯からその祖先を遡った実効値も none であること(帯の自前の宣言は無くてもよい)
    expect(result.controlsEffectiveNone).toBe(true)
    // 文書自体がスクロール可能になっていないこと(回帰検知)
    expect(await scrollOverflow(page)).toBeLessThanOrEqual(1)
  })
})

// 枠の左右に150px以上のガターが空く(片側 (viewport幅 - 枠幅)/2 ≥ 150px)横持ち・タブレットは、
// 帯を枠へ重ねず左右のガターへ分けて置く。スティック・A/B とも枠の外(ガター側)に収まり、
// 高さ方向は親指の位置(画面の縦中央)へ揃う
const expectGutterLayout = async (page: Page, frame: { x: number; width: number }) => {
  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('viewport 未設定')
  expect(await hasGuttersAttr(page)).toBe(true)
  const joystick = await box(page, '[data-village-controls] [role="application"]')
  const a = await box(page, '[data-village-action="a"]')
  const b = await box(page, '[data-village-action="b"]')
  // スティックは枠の外(左のガター)に収まる
  expect(joystick.x + joystick.width).toBeLessThanOrEqual(frame.x)
  // A・B は枠の外(右のガター)に収まる
  expect(a.x).toBeGreaterThanOrEqual(frame.x + frame.width)
  expect(b.x).toBeGreaterThanOrEqual(frame.x + frame.width)
  // 縦中央(親指の高さ)に寄る
  const center = viewport.height / 2
  expect(Math.abs(joystick.y + joystick.height / 2 - center)).toBeLessThanOrEqual(2)
  // 一覧への出口はガター配置でも A・B の上に重ならず、画面の下端に収まる
  const exit = await box(page, '[data-village-exit]')
  expect(boxesIntersect(exit, a)).toBe(false)
  expect(boxesIntersect(exit, b)).toBe(false)
  expect(exit.y + exit.height).toBeLessThanOrEqual(viewport.height)
  expect(await scrollOverflow(page)).toBeLessThanOrEqual(0)
}

test.describe('横持ちのスマートフォン', () => {
  test.use({
    viewport: { width: 750, height: 342 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  })

  test('枠は高さ基準の整数マス、スティックと A/B は左右のガターへ分かれる', async ({ page }) => {
    await waitForStage(page)
    const viewport = page.viewportSize()
    if (viewport === null) throw new Error('viewport 未設定')
    const frame = await box(page, '[data-village]')
    const { cols, rows, cell } = await stageVars(page)
    // 横持ちは帯が無いので min(floor(w/列), floor(h/行), 64)
    expect(cell).toBe(computeCell(viewport.width, viewport.height, 0, cols, rows))
    expect(frame.width).toBe(cell * cols)
    expect(frame.height).toBe(cell * rows)
    // 750×342・cell38の枠幅380なら片側185pxのガターが空き、ガター配置になる
    await expectGutterLayout(page, frame)
  })
})

test.describe('iPad横持ち', () => {
  test.use({
    viewport: { width: 1024, height: 768 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  })

  test('枠は上限64pxで止まり、スティックと A/B は左右のガターへ分かれる', async ({ page }) => {
    await waitForStage(page)
    const viewport = page.viewportSize()
    if (viewport === null) throw new Error('viewport 未設定')
    const frame = await box(page, '[data-village]')
    const { cols, rows, cell } = await stageVars(page)
    // 1024×768はどちらの基準でも上限64pxで頭打ちになる
    expect(cell).toBe(computeCell(viewport.width, viewport.height, 0, cols, rows))
    expect(cell).toBe(cellMax(cols))
    expect(frame.width).toBe(cell * cols)
    expect(frame.height).toBe(cell * rows)
    // 枠幅640に対し片側192pxのガターが空き、ガター配置になる
    await expectGutterLayout(page, frame)
  })
})

// 村の舞台レイアウト E2E。PC は原寸 640×576 で中央、縦持ちは幅いっぱい + 枠の下にスティックと A/B の帯、
// 横持ちは枠の左上にスティック・右上に A/B を重ねる。useStageScale が --cell を実測で書いてから測る
import { expect, test, type Page } from '@playwright/test'

// ブート演出が消え、useStageScale が舞台の実測を --cell に書き込むまで待つ。
// CSS の既定値だけでも近い寸法になるため、インライン変数の有無で JS 側の実行を確かめる
const waitForStage = async (page: Page) => {
  await page.goto('/')
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

// 期待マス寸法。useStageScale と同じ式(floor・下限 12・上限は視野 10 列で 64px)。
// 舞台はワールドではなく視野で決まるので cols は常に 10・rows は常に 9
const expectedCell = (w: number, h: number, band: number, cols: number, rows: number) =>
  Math.min(
    Math.floor((64 * 10) / cols),
    Math.max(12, Math.min(Math.floor(w / cols), Math.floor((h - band) / rows)))
  )

const scrollOverflow = (page: Page) =>
  page.evaluate(() => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight)

const box = async (page: Page, selector: string) => {
  const rect = await page.locator(selector).boundingBox()
  if (rect === null) throw new Error(`${selector} が描かれていない`)
  return rect
}

test('PC: 枠は上限 64px の整数マスで舞台に収まり、スティックと A/B は出ない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await waitForStage(page)
  const frame = await box(page, '[data-village]')
  const { cols, rows, cell } = await stageVars(page)
  // PC の上限は視野(10×9 マス)で 64px = 640×576(原寸 160×144 の 4 倍)
  expect(cell).toBe(expectedCell(1280, 720, 0, cols, rows))
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
    const { cols, rows, cell } = await stageVars(page)
    // 幅基準: floor(390 / 列)。CSS 既定値ではなく JS の実測値であること(帯の高さは操作帯全体の実測)
    expect(cell).toBe(expectedCell(viewport.width, viewport.height, band.height, cols, rows))
    expect(frame.width).toBe(cell * cols)
    expect(frame.height).toBe(cell * rows)
    expect(band.y).toBeGreaterThanOrEqual(frame.y + frame.height)
    expect(band.y + band.height).toBeLessThanOrEqual(viewport.height)
    const joystick = await box(page, '[data-village-controls] [role="application"]')
    const a = await box(page, '[data-village-action="a"]')
    const b = await box(page, '[data-village-action="b"]')
    // スティックは帯の左半分
    expect(joystick.x).toBeGreaterThanOrEqual(band.x)
    expect(joystick.x + joystick.width).toBeLessThanOrEqual(band.x + band.width / 2)
    expect(joystick.y).toBeGreaterThanOrEqual(band.y)
    expect(joystick.y + joystick.height).toBeLessThanOrEqual(band.y + band.height)
    // A・B は帯の右半分、どちらも帯の内側
    expect(a.x).toBeGreaterThanOrEqual(band.x + band.width / 2)
    expect(a.x + a.width).toBeLessThanOrEqual(band.x + band.width)
    expect(a.y).toBeGreaterThanOrEqual(band.y)
    expect(a.y + a.height).toBeLessThanOrEqual(band.y + band.height)
    expect(b.x).toBeGreaterThanOrEqual(band.x + band.width / 2)
    expect(b.x + b.width).toBeLessThanOrEqual(band.x + band.width)
    expect(b.y).toBeGreaterThanOrEqual(band.y)
    expect(b.y + b.height).toBeLessThanOrEqual(band.y + band.height)
    // B は A の左下(十字キーのような配置)
    expect(b.x + b.width).toBeLessThanOrEqual(a.x + a.width)
    expect(b.x).toBeLessThan(a.x)
    expect(b.y).toBeGreaterThan(a.y)
    expect(await scrollOverflow(page)).toBeLessThanOrEqual(0)
  })
})

test.describe('横持ちのスマートフォン', () => {
  test.use({
    viewport: { width: 750, height: 342 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  })

  test('枠は高さ基準の整数マス、スティックは枠の左上、A/B は枠の右上に重なる', async ({ page }) => {
    await waitForStage(page)
    const viewport = page.viewportSize()
    if (viewport === null) throw new Error('viewport 未設定')
    const frame = await box(page, '[data-village]')
    const joystick = await box(page, '[data-village-controls] [role="application"]')
    const a = await box(page, '[data-village-action="a"]')
    const b = await box(page, '[data-village-action="b"]')
    const { cols, rows, cell } = await stageVars(page)
    // 横持ちは帯が無いので min(floor(w/列), floor(h/行), 64)
    expect(cell).toBe(expectedCell(viewport.width, viewport.height, 0, cols, rows))
    expect(frame.width).toBe(cell * cols)
    expect(frame.height).toBe(cell * rows)
    // スティックは枠の内側かつ左上四分の一に収まる(右下のミニマップ・下辺の会話窓と重ならない)
    expect(joystick.x).toBeGreaterThanOrEqual(frame.x)
    expect(joystick.y).toBeGreaterThanOrEqual(frame.y)
    expect(joystick.x + joystick.width).toBeLessThanOrEqual(frame.x + frame.width / 2)
    expect(joystick.y + joystick.height).toBeLessThanOrEqual(frame.y + frame.height / 2)
    // A・B は枠の内側かつ右上四分の一に収まる
    expect(a.x).toBeGreaterThanOrEqual(frame.x + frame.width / 2)
    expect(a.x + a.width).toBeLessThanOrEqual(frame.x + frame.width)
    expect(a.y).toBeGreaterThanOrEqual(frame.y)
    expect(a.y + a.height).toBeLessThanOrEqual(frame.y + frame.height / 2)
    expect(b.x).toBeGreaterThanOrEqual(frame.x + frame.width / 2)
    expect(b.x + b.width).toBeLessThanOrEqual(frame.x + frame.width)
    expect(b.y).toBeGreaterThanOrEqual(frame.y)
    expect(b.y + b.height).toBeLessThanOrEqual(frame.y + frame.height / 2)
    expect(await scrollOverflow(page)).toBeLessThanOrEqual(0)
  })
})

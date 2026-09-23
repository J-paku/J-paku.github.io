// 再読込せず2時間を越えて夜へ入る。画像が欠ける・遅れる間も直前の村を描き続ける。
import { expect, test, type Page } from '@playwright/test'
import { focusVillage, stubWeather } from './village.helpers'

const ROOT = '[data-phase]'
const SPRITES = ['[data-village-terrain] > div', '[data-village-player]']
const START = new Date('2026-09-23T07:59:00Z')
const TWO_HOURS_LATER = 2 * 60 * 60 * 1000 + 2 * 60 * 1000

const openDay = async (page: Page) => {
  await stubWeather(page, 'clear')
  await page.clock.install({ time: START })
  // 次の時間帯を先読みしていても、その応答を待たず現在の村を操作する。
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await focusVillage(page)
  await expect(page.locator(ROOT)).toHaveAttribute('data-phase', 'day')
}

const expectDrawable = async (page: Page, phase: string) => {
  for (const selector of SPRITES) {
    const image = await page
      .locator(selector)
      .first()
      .evaluate(async element => {
        const background = getComputedStyle(element).backgroundImage
        const match = /^url\(["']?(.+?)["']?\)$/.exec(background)
        if (match === null) return { background, width: 0 }
        const probe = new Image()
        probe.src = match[1]
        await probe.decode()
        return { background, width: probe.naturalWidth }
      })
    expect(image.background).toContain(`-${phase}-`)
    expect(image.width).toBeGreaterThan(0)
  }
}

test('2時間開いたまま夜へ移っても地形と主人公が描ける', async ({ page }) => {
  await openDay(page)
  await page.clock.fastForward(TWO_HOURS_LATER)
  await expect(page.locator(ROOT)).toHaveAttribute('data-phase', 'night')
  await expectDrawable(page, 'night')
})

test('夜の画像が404でも村を消さず、通信が戻れば夜へ移る', async ({ page }) => {
  let unavailable = true
  let failures = 0
  await page.route('**/sprites/*-night-*.png', route => {
    if (!unavailable) return route.continue()
    failures += 1
    return route.fulfill({ status: 404, body: '' })
  })
  await openDay(page)
  await page.clock.fastForward(TWO_HOURS_LATER)
  await expect.poll(() => failures).toBeGreaterThan(0)
  await expect(page.locator(ROOT)).toHaveAttribute('data-phase', 'day')
  await expectDrawable(page, 'day')

  unavailable = false
  await page.clock.fastForward(60_000)
  await expect(page.locator(ROOT)).toHaveAttribute('data-phase', 'night')
  await expectDrawable(page, 'night')
})

test('夜の主人公だけ遅れても両方の画像が揃うまで昼を残す', async ({ page }) => {
  let release = () => {}
  const pending = new Promise<void>(resolve => {
    release = resolve
  })
  let requests = 0
  await page.route('**/sprites/player-night-*.png', async route => {
    requests += 1
    await pending
    await route.continue()
  })
  try {
    await openDay(page)
    await page.clock.fastForward(TWO_HOURS_LATER)
    await expect.poll(() => requests).toBeGreaterThan(0)
    await expect(page.locator(ROOT)).toHaveAttribute('data-phase', 'day')
    await expectDrawable(page, 'day')
    release()
    await expect(page.locator(ROOT)).toHaveAttribute('data-phase', 'night')
    await expectDrawable(page, 'night')
  } finally {
    release()
  }
})

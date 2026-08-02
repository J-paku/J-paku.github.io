// ⌘K/Ctrl+Kコマンドパレットの接続性要件(06-command-palette.md)15項目のうち、
// 実ブラウザでしか確認できない14項目をPlaywrightで自動化する。
// 項目15(パレット無しでも全機能が可能)は構造的に自動化できないため対象外(07-redesign.md §3-5)。
//
// ラベル文言は content/{locale}/ui.ts を正本として直接読み込む(emit-routes.mjsと同じ手法)。
// テスト側にラベルをハードコードすると、ロケール追加・文言変更のたびに二重管理になるため避ける
//
// 使い方: node scripts/check-command-palette-a11y.mjs <baseUrl>
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

const [, , baseUrl] = process.argv

if (!baseUrl) {
  console.error('使い方: node scripts/check-command-palette-a11y.mjs <baseUrl>')
  process.exit(1)
}

// / と /ko の両方で確認する(韓国語ラベルでも動作することを含めて検証する)
const LOCALES = [
  { locale: 'ja', routePath: '/' },
  { locale: 'ko', routePath: '/ko' },
]

// content/{locale}/ui.ts はimport typeのみを持つ値ファイルのため、型注釈だけをesbuildで落として
// data: URL経由で直接評価する(emit-routes.mjsのloadWorkと同じ手法)
async function loadUi(locale) {
  const uiPath = path.join(ROOT_DIR, 'content', locale, 'ui.ts')
  const source = readFileSync(uiPath, 'utf-8')
  const { code } = transformSync(source, { loader: 'ts', format: 'esm' })
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  const moduleExports = await import(dataUrl)
  return moduleExports.ui
}

async function newPage(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1280, height: 800 },
    reducedMotion: options.reducedMotion,
  })
  return context.newPage()
}

async function gotoAndWaitMount(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' })
  // Reactのマウント完了を実測して待つ(固定スリープではなく#rootの中身が入るまで待機)
  await page.waitForFunction(() => {
    const root = document.querySelector('#root')
    return root !== null && root.childElementCount > 0
  })
}

// 起動ボタンをクリックして開く。開いたことをdialog.openで実測してから返す
async function openViaClick(page, ui) {
  const trigger = page.getByRole('button', { name: ui.commandPalette.openButtonLabel })
  await trigger.click()
  await page.waitForFunction(() => document.querySelector('dialog')?.open === true, null, { timeout: 3000 })
  return trigger
}

// CSSの時間文字列(例: "0.01ms" "1e-05s")を秒単位の数値へ変換する
function parseCssTimeToSeconds(token) {
  if (token.endsWith('ms')) return parseFloat(token) / 1000
  return parseFloat(token)
}

// transition-duration は複数値(カンマ区切り)を取りうる。
// global.cssのprefers-reduced-motion対応が全要素へ`transition-duration: 0.01ms !important`を
// 強制するため(03-pitfalls.md #3と同種の手法)、厳密な0sではなく「知覚できない程度に小さいか」で判定する。
// しきい値100μs(0.0001s)は0.01ms(1e-5s)より一桁大きく、実アニメーション(通常100ms以上)より
// 三桁以上小さいため両者を確実に区別できる
function allDurationsImperceptible(value, thresholdSeconds = 0.0001) {
  if (!value) return true
  return value
    .split(',')
    .map((token) => token.trim())
    .every((token) => token === '' || parseCssTimeToSeconds(token) <= thresholdSeconds)
}

// 項目1: Ctrl+Kで開く(dialog.open === true)
async function checkOpenShortcut(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    await page.keyboard.press('Control+k')
    await page.waitForFunction(() => document.querySelector('dialog')?.open === true, null, { timeout: 3000 })
    const isOpen = await page.evaluate(() => document.querySelector('dialog')?.open === true)
    return { pass: isOpen === true, detail: `dialog.open=${isOpen}` }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目2: 開いたら入力欄にフォーカスが移る
async function checkFocusOnOpen(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    await openViaClick(page, target.ui)
    const focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null)
    const pass = focusedLabel === target.ui.commandPalette.searchLabel
    return { pass, detail: `activeElement.aria-label="${focusedLabel}"(期待:"${target.ui.commandPalette.searchLabel}")` }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目3: Tabが15回押しても毎回activeElementがダイアログ内に留まる
async function checkTabTrap(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    await openViaClick(page, target.ui)

    const escapedAt = []
    for (let i = 1; i <= 15; i++) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(() => {
        const dialog = document.querySelector('dialog')
        return dialog !== null && dialog.contains(document.activeElement)
      })
      if (!inside) escapedAt.push(i)
    }

    const pass = escapedAt.length === 0
    return { pass, detail: pass ? 'Tab15回、全てダイアログ内に留まった' : `Tab押下${escapedAt.join(',')}回目でダイアログ外へ脱出` }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目4: Escapeで閉じ、トリガーへフォーカスが復帰する
async function checkEscapeReturnsFocus(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    await openViaClick(page, target.ui)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('dialog')?.open === false, null, { timeout: 3000 })
    const focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null)
    const pass = focusedLabel === target.ui.commandPalette.openButtonLabel
    return { pass, detail: `Escape後のactiveElement.aria-label="${focusedLabel}"(期待:"${target.ui.commandPalette.openButtonLabel}")` }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目5: 外側クリックで閉じる
async function checkOutsideClickCloses(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    await openViaClick(page, target.ui)
    // dialogの矩形より確実に外側の座標(左上隅近く)をクリックする
    await page.mouse.click(2, 2)
    await page.waitForFunction(() => document.querySelector('dialog')?.open === false, null, { timeout: 3000 })
    const isOpen = await page.evaluate(() => document.querySelector('dialog')?.open === true)
    return { pass: isOpen === false, detail: `外側クリック後 dialog.open=${isOpen}` }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目6: ArrowUp/ArrowDownでaria-activedescendantが変わり、フォーカスは入力欄に残る
async function checkArrowKeysMoveActiveDescendant(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    await openViaClick(page, target.ui)

    const before = await page.evaluate(
      () => document.querySelector('input[aria-activedescendant]')?.getAttribute('aria-activedescendant') ?? null,
    )
    await page.keyboard.press('ArrowDown')
    const afterDown = await page.evaluate(
      () => document.querySelector('input[aria-activedescendant]')?.getAttribute('aria-activedescendant') ?? null,
    )
    const focusStillInput = await page.evaluate(
      (label) => document.activeElement?.getAttribute('aria-label') === label,
      target.ui.commandPalette.searchLabel,
    )

    const pass = before !== afterDown && afterDown !== null && focusStillInput
    return {
      pass,
      detail: `aria-activedescendant "${before}" → "${afterDown}"、フォーカスは入力欄に残っている=${focusStillInput}`,
    }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目7: 活性項目がスクロール領域内へ自動スクロールされる
async function checkActiveItemScrollsIntoView(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    await openViaClick(page, target.ui)

    const itemCount = await page.evaluate(() => document.querySelectorAll('[role="option"]').length)
    if (itemCount < 2) {
      return { pass: false, detail: `項目数が${itemCount}件しかなく検証不能` }
    }

    // 先頭から最後尾まで移動させる(overflow分は確実に自動スクロールが要求される)
    for (let i = 0; i < itemCount - 1; i++) {
      await page.keyboard.press('ArrowDown')
    }

    const result = await page.evaluate(() => {
      const listbox = document.querySelector('[role="listbox"]')
      const active = document.querySelector('[role="option"][aria-selected="true"]')
      if (listbox === null || active === null) return { overflowed: false, visible: false }

      const overflowed = listbox.scrollHeight > listbox.clientHeight
      const listRect = listbox.getBoundingClientRect()
      const itemRect = active.getBoundingClientRect()
      const visible = itemRect.top >= listRect.top - 1 && itemRect.bottom <= listRect.bottom + 1
      return { overflowed, visible }
    })

    return {
      pass: result.visible,
      detail: `listboxのoverflow有無=${result.overflowed}、最終項目が可視領域内=${result.visible}`,
    }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目8: Enterで実行され、location.pathnameが変わる
async function checkEnterExecutes(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    const before = new URL(page.url()).pathname
    await openViaClick(page, target.ui)
    await page.keyboard.press('Enter')
    await page.waitForFunction((prev) => window.location.pathname !== prev, before, { timeout: 3000 })
    const after = new URL(page.url()).pathname
    const pass = after !== before && after.includes('/works/')
    return { pass, detail: `pathname "${before}" → "${after}"` }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目9: 結果0件のときaria-live領域に件数が表示される
async function checkZeroResultsAriaLive(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    await openViaClick(page, target.ui)

    const input = page.getByRole('textbox', { name: target.ui.commandPalette.searchLabel })
    await input.fill('zzz-no-match-該当なし-zzz')

    const expected = target.ui.commandPalette.resultCount.replace('{count}', '0')
    const liveText = await page.evaluate(() => document.querySelector('[aria-live="polite"]')?.textContent ?? null)
    const optionCount = await page.evaluate(() => document.querySelectorAll('[role="option"]').length)

    const pass = liveText === expected && optionCount === 0
    return { pass, detail: `aria-live="${liveText}"(期待:"${expected}")、option数=${optionCount}` }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目10: 開いている間、背景スクロールが固定される
async function checkBodyScrollLockedWhileOpen(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    const before = await page.evaluate(() => document.body.style.overflow)
    await openViaClick(page, target.ui)
    // dialog.open===trueの直後はuseBodyScrollLockのuseEffectがまだコミットされていない
    // 場合があるため、実際にoverflowが変わるまで実測して待つ(固定スリープにしない)
    await page.waitForFunction(() => document.body.style.overflow === 'hidden', null, { timeout: 2000 }).catch(() => {})
    const during = await page.evaluate(() => document.body.style.overflow)
    return { pass: during === 'hidden', detail: `開く前overflow="${before}" 開いている間overflow="${during}"` }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目11: 閉じた後、背景スクロールが復元される
async function checkBodyScrollRestoredAfterClose(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    const before = await page.evaluate(() => document.body.style.overflow)
    await openViaClick(page, target.ui)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('dialog')?.open === false, null, { timeout: 3000 })
    // dialog.open===falseの直後はuseBodyScrollLockのクリーンアップがまだコミットされていない
    // 場合があるため、実際に元の値へ戻るまで実測して待つ(タイムアウトすれば本当の不具合として扱う)
    await page.waitForFunction((expected) => document.body.style.overflow === expected, before, { timeout: 2000 }).catch(() => {})
    const after = await page.evaluate(() => document.body.style.overflow)
    return { pass: after === before, detail: `開く前overflow="${before}" 閉じた後overflow="${after}"` }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目12: 他のinputにフォーカス中はCtrl+Kを横取りしない
async function checkNoHijackWhenEditableFocused(browser, target) {
  const page = await newPage(browser)
  try {
    await gotoAndWaitMount(page, target.url)
    await page.evaluate(() => {
      const el = document.createElement('input')
      el.id = '__external-test-input'
      document.body.appendChild(el)
      el.focus()
    })

    await page.keyboard.press('Control+k')
    // 横取りされていれば即座に開くため、開かないことを一定時間の非発火で確認する
    await page.waitForTimeout(300)

    const isOpen = await page.evaluate(() => document.querySelector('dialog')?.open === true)
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? null)
    const pass = isOpen === false && focusedId === '__external-test-input'
    return { pass, detail: `dialog.open=${isOpen}、フォーカス保持="${focusedId}"` }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目13: 360pxで起動ボタンが見え、押して開ける
async function checkTriggerVisibleAt360(browser, target) {
  const page = await newPage(browser, { viewport: { width: 360, height: 800 } })
  try {
    await gotoAndWaitMount(page, target.url)
    const trigger = page.getByRole('button', { name: target.ui.commandPalette.openButtonLabel })
    const box = await trigger.boundingBox()
    const withinViewport = box !== null && box.x >= 0 && box.x + box.width <= 360

    await trigger.click()
    await page.waitForFunction(() => document.querySelector('dialog')?.open === true, null, { timeout: 3000 })
    const isOpen = await page.evaluate(() => document.querySelector('dialog')?.open === true)

    const pass = withinViewport && isOpen === true
    return {
      pass,
      detail: `boundingBox=${JSON.stringify(box)}、360px内=${withinViewport}、クリックで開いた=${isOpen}`,
    }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

// 項目14: prefers-reduced-motionで開閉アニメーションが無い
async function checkNoAnimationReducedMotion(browser, target) {
  const page = await newPage(browser, { reducedMotion: 'reduce' })
  try {
    await gotoAndWaitMount(page, target.url)
    await openViaClick(page, target.ui)

    const openedStyle = await page.evaluate(() => {
      const dialog = document.querySelector('dialog')
      const style = window.getComputedStyle(dialog)
      return { transitionDuration: style.transitionDuration, animationName: style.animationName }
    })

    const pass = allDurationsImperceptible(openedStyle.transitionDuration) && openedStyle.animationName === 'none'
    return {
      pass,
      detail: `transitionDuration="${openedStyle.transitionDuration}", animationName="${openedStyle.animationName}"`,
    }
  } catch (error) {
    return { pass: false, detail: `例外: ${error.message}` }
  } finally {
    await page.close()
  }
}

const CHECKS = [
  { id: 1, label: 'Ctrl+Kで開く(dialog.open===true)', run: checkOpenShortcut },
  { id: 2, label: '開いたら入力欄にフォーカス', run: checkFocusOnOpen },
  { id: 3, label: 'Tabがパレット外へ出ない(15回)', run: checkTabTrap },
  { id: 4, label: 'Escapeで閉じ、トリガーへフォーカス復帰', run: checkEscapeReturnsFocus },
  { id: 5, label: '外側クリックで閉じる', run: checkOutsideClickCloses },
  { id: 6, label: 'ArrowUp/Downでaria-activedescendantが変わり、フォーカスは入力欄に残る', run: checkArrowKeysMoveActiveDescendant },
  { id: 7, label: '活性項目がスクロール領域内へ自動スクロール', run: checkActiveItemScrollsIntoView },
  { id: 8, label: 'Enterで実行され、location.pathnameが変わる', run: checkEnterExecutes },
  { id: 9, label: '結果0件でaria-live領域に件数が表示される', run: checkZeroResultsAriaLive },
  { id: 10, label: '開いている間、背景スクロールが固定される', run: checkBodyScrollLockedWhileOpen },
  { id: 11, label: '閉じた後、背景スクロールが復元される', run: checkBodyScrollRestoredAfterClose },
  { id: 12, label: '他のinputにフォーカス中はCtrl+Kを横取りしない', run: checkNoHijackWhenEditableFocused },
  { id: 13, label: '360pxで起動ボタンが見え、押して開ける', run: checkTriggerVisibleAt360 },
  { id: 14, label: 'prefers-reduced-motionで開閉アニメーションが無い', run: checkNoAnimationReducedMotion },
]

async function main() {
  const browser = await chromium.launch()
  let overallPass = true

  try {
    for (const { locale, routePath } of LOCALES) {
      const ui = await loadUi(locale)
      const target = { url: new URL(routePath, baseUrl).toString(), ui }

      console.log(`\n=== locale=${locale} path=${routePath} ===`)
      for (const check of CHECKS) {
        const result = await check.run(browser, target)
        overallPass = overallPass && result.pass
        const mark = result.pass ? '[OK]' : '[NG]'
        console.log(`${mark} item${check.id} ${check.label}: ${result.detail}`)
      }
    }
  } finally {
    await browser.close()
  }

  if (!overallPass) {
    console.error('\ncheck-command-palette-a11y: 1件以上のFAILがあった')
    process.exit(1)
  }

  console.log('\ncheck-command-palette-a11y: 全項目(14件 × ja/ko)PASS')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

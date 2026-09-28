// 保存(localStorage / sessionStorage)が使えないブラウザの E2E。テーマの切り替えと村の操作(話す・歩く・
// 扉をくぐる)が、捕まえられない例外を出さずに最後まで動くかを見る。
// 塞ぎ方は 2 通り。サイトデータをブロックした Chrome のようにプロパティを読んだ時点で投げる形と、
// 容量超過や保存を拒むプライベートモードのように getItem / setItem を呼んだ時点で投げる形。
// どちらもページのどのスクリプトより先に差し込むので、html-shell.tsx が初回ペイントの前に
// テーマを読むインラインスクリプトにも効く。
// 読み書きを包む try の単体は src/lib/preferences.test.ts が見ている。ここで見るのは、それを通った実際の
// 画面が例外を外へ出さず(pageerror が 0 件)、押した操作がそのまま画面に出ること。
// 保存が効かないので walk(保存位置の変化で到着を判定する)は使えない。歩みは主人公の描かれた位置で測る。
// テーマも村の歩き方も言語に依らないので ja だけで見る
import { expect, type Page } from '@playwright/test'
import { village } from '@content/ja/village'
import { ui } from '@content/ja/ui'
// 村を開く手順・1 マス分だけ押す press・主人公の描かれた位置・既定で晴れを敷く test は他の村の spec と共用。
// 正本は village.helpers.ts
import {
  focusVillage,
  openVillage,
  playerOnScreen,
  press,
  test,
  type WalkKey,
} from './village.helpers'

// access = window.localStorage / sessionStorage を読んだ時点で SecurityError を投げる。
// methods = 読めるが Storage のメソッドを呼ぶと QuotaExceededError を投げる
type BlockMode = 'access' | 'methods'
const BLOCK_MODES: BlockMode[] = ['access', 'methods']

// ページのどのスクリプトよりも先に保存を塞ぐ。再読み込みの後も同じ塞ぎが効く
const blockStorage = (page: Page, mode: BlockMode) =>
  page.addInitScript(blockMode => {
    if (blockMode === 'access') {
      for (const name of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, name, {
          configurable: true,
          get() {
            throw new DOMException(`${name} へのアクセスは拒否された`, 'SecurityError')
          },
        })
      }
      return
    }
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        writable: true,
        value() {
          throw new DOMException(`Storage.${method} は拒否された`, 'QuotaExceededError')
        },
      })
    }
  }, mode)

// 塞ぎが本当に効いているか。効いていなければ保存が普通に働き、以降の検査は
// 「保存が使えるときにも動く」ことしか示さない
const BLOCKED = { local: true, session: true }
const storageThrows = (page: Page) =>
  page.evaluate(() => {
    const throws = (read: () => void) => {
      try {
        read()
        return false
      } catch {
        return true
      }
    }
    return {
      local: throws(() => localStorage.getItem('theme')),
      session: throws(() => sessionStorage.getItem('theme')),
    }
  })

// 捕まえられずに外へ出た例外の文言。初回ペイント前のスクリプト・クリックの処理・歩行の rAF の
// どこで投げても拾う。goto より先に呼ぶ
const collectPageErrors = (page: Page) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  return errors
}

// 小数第 1 位で丸める。歩いている途中の位置(4.5 マス目など)と着いた位置を取り違えない細かさ
const round = (value: number) => Math.round(value * 10) / 10

// 主人公が枠の中で何マス目に立って見えるか(playerOnScreen)を小数第 1 位で丸め、x と y だけにする。
// 部屋は枠に収まりカメラが動かないので、1 マス歩けば描かれた位置もちょうど 1 マスずれる。
// 枠の箱とマス寸法を落とすのは、着いた位置を toEqual で x と y だけ比べるため
const roundedOnScreen = async (page: Page) => {
  const { x, y } = await playerOnScreen(page)
  return { x: round(x), y: round(y) }
}

// 1 マス歩き、描かれた主人公がその隣のマスへ着くまで待つ。保存位置は変わらない(読むことも投げる)ので、
// walk のように保存で到着を知ることはできない
const stepBy = async (page: Page, key: WalkKey, dx: number, dy: number) => {
  const before = await roundedOnScreen(page)
  await press(page, key)
  await expect
    .poll(() => roundedOnScreen(page), { message: `${key} で隣のマスへ着く` })
    .toEqual({ x: round(before.x + dx), y: round(before.y + dy) })
}

for (const mode of BLOCK_MODES) {
  test(`保存が使えなくてもテーマを切り替えられ、再読み込みすると既定の light で開く (${mode})`, async ({
    page,
  }) => {
    const errors = collectPageErrors(page)
    await blockStorage(page, mode)
    await openVillage(page, '')
    expect(await storageThrows(page), '保存は読む時点で投げる').toEqual(BLOCKED)
    const root = page.locator('html')
    const trigger = page.getByRole('button', { name: ui.settingsMenu.label })
    const darkOption = page.getByRole('group').getByRole('button', { name: ui.theme.dark })
    // 初回ペイント前のスクリプトは保存を読めなくても投げず、既定の light のまま進む
    await expect(root).toHaveAttribute('data-theme', 'light')
    await trigger.click()
    await darkOption.click()
    await expect(root).toHaveAttribute('data-theme', 'dark')
    // 選ぶとメニューは閉じる。保存で投げると属性だけ書き換わって選択の処理が途中で止まり、開いたまま残る
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    // 開き直すと、選んだ dark が押された状態で並ぶ
    await trigger.click()
    await expect(darkOption).toHaveAttribute('aria-pressed', 'true')
    // 保存できていないので、再読み込みすると既定の light へ戻る(ページは壊れずに開く)
    await page.reload()
    await focusVillage(page)
    await expect(root).toHaveAttribute('data-theme', 'light')
    // 再読み込みの後もまた切り替えられる
    await trigger.click()
    await darkOption.click()
    await expect(root).toHaveAttribute('data-theme', 'dark')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(errors, '捕まえられない例外が出ていない').toEqual([])
  })

  test(`保存が使えなくても話しかけて閉じ、歩いて部屋から町へ出られる (${mode})`, async ({
    page,
  }) => {
    const errors = collectPageErrors(page)
    await blockStorage(page, mode)
    await openVillage(page, '')
    expect(await storageThrows(page), '保存は読む時点で投げる').toEqual(BLOCKED)
    // 開始マス (4,4) は PC 机の前。話しかけると訪問を保存しようとする
    await page.keyboard.press('e')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: village.stops.home.title })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    // 着いたマスごとに位置を保存しようとする。右へ 1 マス出て戻る
    await stepBy(page, 'ArrowRight', 1, 0)
    await stepBy(page, 'ArrowLeft', -1, 0)
    // 下へ 2 マスで出口の手前 (4,6)、3 マス目で下端のマット (4,7) に乗り、扉をくぐって町の自宅前へ出る
    await stepBy(page, 'ArrowDown', 0, 1)
    await stepBy(page, 'ArrowDown', 0, 1)
    await press(page, 'ArrowDown')
    await expect(page.locator('[data-world]')).toHaveAttribute('data-world', 'town')
    // 町では既定の案内が操作説明に変わる。扉の先の位置を保存しようとした後の処理まで届いた印
    await expect(page.getByRole('status')).toContainText(village.hint, { timeout: 3_000 })
    expect(errors, '捕まえられない例外が出ていない').toEqual([])
  })
}

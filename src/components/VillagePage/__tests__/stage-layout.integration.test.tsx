// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage'
import {
  CELL_MIN,
  cellMax,
  computeCell,
} from '@/components/VillagePage/components/Village/utils/stage-scale'
import {
  advanceUntil,
  emulateTouch,
  focusVillage,
  isVisible,
  villageFrame,
} from './village-walk.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// ---- 舞台の寸法 ----
// E2E(tests/layout.spec.ts)が見ていた舞台の寸法の断定を、E2E からこの統合テストへ移したもの(ADR 0018 の「統合へ移す」)。
// E2E と同じく利用者に見える物(role・名前・要素の有無・計算されたスタイル・位置)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。差し替えるのは天気(ネットワーク)だけで、
// 待つ手順は village-walk.test-helper.ts。
// タッチ端末(E2E の isMobile・hasTouch)の配置とスティックは、CDP のタッチの模擬(emulateTouch)で描く。
// 模擬を切った後は pointer も hover も none のまま戻らない(resetEmulation の注)が、村は pointer: coarse かどうかだけで分けるので、
// 続くテストの振る舞いは変わらない
describe('舞台の寸法(tests/layout.spec.ts)', () => {
  const { text } = villageJa

  // 画面は既定で PC(E2E の既定と同じ 1280×720)
  beforeEach(async () => {
    await page.viewport(1280, 720)
  })

  // DOM から 1 つ引く。無ければ前提が崩れているのでその場で落とす
  const queryOne = (selector: string, from: ParentNode = document): HTMLElement => {
    const element = from.querySelector<HTMLElement>(selector)
    if (element === null) throw new Error(`${selector} が描かれていない`)
    return element
  }

  // 村の根。data-phase に今の段階が、インラインの --cols・--rows(Village)と --cell・--band(useStageScale)に寸法が載る
  const root = () => {
    const element = villageFrame().closest<HTMLElement>('[data-phase]')
    if (element === null) throw new Error('村の根(data-phase)が描かれていない')
    return element
  }

  // 村を描き、起動の覆いが外れたら枠へ焦点を置き(E2E の openVillage)、useStageScale が舞台の実測を --cell に書くまで待つ。
  // CSS の既定値だけでも近い寸法になるため、インラインの値で見る。実際のコンテンツでは作れない場合だけ、props を変えた版を overrides で渡す
  const renderVillage = async (overrides: Partial<typeof villageJa> = {}) => {
    render(<VillagePageContainer {...villageJa} {...overrides} />)
    await focusVillage()
    await advanceUntil(
      () => root().style.getPropertyValue('--cell') !== '',
      'useStageScale が --cell を書いた'
    )
  }

  const scrollOverflow = () => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight

  // .root のインライン変数(--cols/--rows は Village が、--cell と --band は useStageScale が書く)。
  // --band は帯の高さではなく「舞台の下端から帯の上端までの距離」で、会話窓・地図がこれを bottom に使う
  const stageVars = () => {
    const { style } = root()
    return {
      cols: Number(style.getPropertyValue('--cols')),
      rows: Number(style.getPropertyValue('--rows')),
      cell: Number.parseInt(style.getPropertyValue('--cell'), 10),
      band: Number.parseInt(style.getPropertyValue('--band'), 10),
    }
  }

  // 描かれている要素の箱。面積が無ければ(display: none など)描かれていないので落とす
  const box = (selector: string) => {
    const rect = queryOne(selector).getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) throw new Error(`${selector} が描かれていない`)
    return rect
  }

  // 矩形どうしが重なっているか(接するだけは重なりに数えない)
  const boxesIntersect = (a: DOMRect, b: DOMRect) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

  test('PC では一覧への出口が右下に固定される', async () => {
    await renderVillage()
    const exit = page
      .getByRole('link', { name: text.toList, exact: true })
      .element()
      .getBoundingClientRect()
    const stage = villageFrame().getBoundingClientRect()
    expect(exit.right, '出口の右端は画面の右端から 8px 以上内側').toBeLessThanOrEqual(
      window.innerWidth - 8
    )
    expect(exit.bottom, '出口の下端は画面の下端から 8px 以上内側').toBeLessThanOrEqual(
      window.innerHeight - 8
    )
    expect(exit.top, '出口は枠の下半分より下').toBeGreaterThan(stage.top + stage.height / 2)
    expect(exit.width, '出口は枠の半分より細い').toBeLessThan(stage.width / 2)
  })

  test('PC では枠が上限 64px の整数マスで舞台に収まり、スティックと A/B は出ない', async () => {
    await renderVillage()
    const stage = villageFrame().getBoundingClientRect()
    const { cols, rows, cell } = stageVars()
    // PC の上限は視野(10×9 マス)で 64px = 640×576(原寸 160×144 の 4 倍)
    expect(cell).toBe(computeCell(1280, 720, 0, cols, rows))
    expect(cell).toBe(cellMax(cols))
    // 上限そのものが変わったら気づけるよう、公式ではなく実数で留める
    expect(cell).toBe(64)
    expect(cell).toBeGreaterThanOrEqual(CELL_MIN)
    expect(stage.width).toBe(cell * cols)
    expect(stage.height).toBe(cell * rows)
    expect(stage.left).toBeGreaterThanOrEqual(0)
    expect(stage.right).toBeLessThanOrEqual(1280)
    expect(stage.top).toBeGreaterThanOrEqual(0)
    expect(stage.bottom).toBeLessThanOrEqual(720)
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect
      .element(page.elementLocator(queryOne('[data-village-controls]')), {
        message: '操作帯(スティックと A/B)は PC では出ない',
      })
      .not.toBeVisible()
    expect(scrollOverflow(), '文書はスクロールしない').toBeLessThanOrEqual(0)
  })

  // E2E の isMobile・hasTouch に当たるタッチ端末(pointer: coarse)にしてから描く。寸法は E2E と同じ
  describe('縦持ちのスマートフォン', () => {
    beforeEach(async () => {
      await emulateTouch()
      await page.viewport(390, 664)
    })

    test('枠は幅基準の整数マス、スティックと A/B は枠の下の帯に置かれる', async () => {
      await renderVillage()
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const stage = villageFrame().getBoundingClientRect()
      const band = box('[data-village-controls]')
      const exitSlot = box('[data-village-exit-slot]')
      const exit = box('[data-village-exit]')
      const { cols, rows, cell, band: bandVar } = stageVars()
      // 幅基準: floor(390 / 列)。CSS 既定値ではなく JS の実測値であること(差し引くのは帯と出口の箱の実測)
      expect(cell).toBe(
        computeCell(viewport.width, viewport.height, band.height + exitSlot.height, cols, rows)
      )
      // 上の 1 行は検査対象(computeCell)で検査対象を測っているだけなので、幅の基準式が半分になっても
      // 通ってしまう。390px 幅で実ブラウザが出した値を実数で留め、式そのものが変わったら落とす
      expect(cell).toBe(39)
      // 縦持ちは帯が通常フローにいるので、--band に帯の上端までの距離(= 下端に密着した帯の高さ)が入る。
      // ここが 0 のままだと会話窓・地図が帯を覆う回帰に気づけない
      expect(bandVar).toBeGreaterThan(0)
      expect(bandVar).toBe(Math.round(band.height))
      // 一覧への出口は枠のすぐ下に横いっぱい、帯より上
      expect(exit.y).toBeGreaterThanOrEqual(stage.y + stage.height)
      expect(exit.y - (stage.y + stage.height)).toBeLessThanOrEqual(24)
      expect(exit.y + exit.height).toBeLessThanOrEqual(band.y)
      expect(exit.width).toBeGreaterThanOrEqual(stage.width - 24)
      expect(exit.height).toBeGreaterThanOrEqual(44)
      expect(stage.width).toBe(cell * cols)
      expect(stage.height).toBe(cell * rows)
      expect(band.y).toBeGreaterThanOrEqual(stage.y + stage.height)
      expect(band.y + band.height).toBeLessThanOrEqual(viewport.height)
      // 帯は親指ゾーン(画面の最下端)まで届く。テスト環境に safe-area は無いので端に密着する
      expect(band.y + band.height).toBeGreaterThanOrEqual(viewport.height - 1)
      const joystick = box('[data-village-controls] [role="application"]')
      const a = box('[data-village-action="a"]')
      const b = box('[data-village-action="b"]')
      // スティックは帯の左半分。縦持ちタッチは 120px 以上まで大きくする
      expect(joystick.width).toBeGreaterThanOrEqual(120)
      expect(joystick.x).toBeGreaterThanOrEqual(band.x)
      expect(joystick.x + joystick.width).toBeLessThanOrEqual(band.x + band.width / 2)
      expect(joystick.y).toBeGreaterThanOrEqual(band.y)
      expect(joystick.y + joystick.height).toBeLessThanOrEqual(band.y + band.height)
      // A・B は帯の右半分、どちらも帯の内側。縦持ちタッチは 64px 以上まで大きくする
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
      expect(scrollOverflow(), '文書はスクロールしない').toBeLessThanOrEqual(0)
    })

    test('操作帯を含む舞台全体で touch-action: none が効き、文書はスクロールしない', async () => {
      await renderVillage()
      const controls = queryOne('[data-village-controls]')
      // 前提: 縦持ちのタッチ端末では操作帯が描かれている(描かれていない帯の計算値を見ても何も証明しない)
      expect(isVisible(controls), '縦持ちのタッチ端末では操作帯が描かれる').toBe(true)
      // touch-action は継承されないので、帯自身の計算値だけでは祖先の none を拾えない。
      // ブラウザがタッチのページのパンを止めるかは帯とその祖先を合わせた実効値で決まるので、帯から根まで遡って none を持つ要素があるかを見る
      const effectiveNone = (node: Element | null): boolean =>
        node !== null &&
        (getComputedStyle(node).touchAction === 'none' || effectiveNone(node.parentElement))
      expect(getComputedStyle(root()).touchAction, '舞台全体(.root)が touch-action: none').toBe(
        'none'
      )
      expect(effectiveNone(controls), '操作帯から祖先を遡った実効値も none').toBe(true)
      expect(scrollOverflow(), '文書はスクロールしない').toBeLessThanOrEqual(0)
    })
  })

  // 枠の左右に 150px 以上のガターが空く(片側 (画面の幅 - 枠の幅)/2 ≥ 150px)横持ち・タブレットは、
  // 帯を枠へ重ねず左右のガターへ分けて置く。スティック・A/B とも枠の外(ガター側)に収まり、高さは親指の位置(画面の縦中央)へ揃う
  const expectGutterLayout = (stage: DOMRect) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    expect(root().hasAttribute('data-gutters'), 'useStageScale がガター配置の印を立てる').toBe(true)
    // ガター配置の帯は absolute で枠に重なるだけなので、差し引く距離は無い。
    // 縦持ち用の値がそのまま残ると会話窓・地図が画面の途中で切り上がる
    expect(stageVars().band).toBe(0)
    const joystick = box('[data-village-controls] [role="application"]')
    const a = box('[data-village-action="a"]')
    const b = box('[data-village-action="b"]')
    // スティックは枠の外(左のガター)に、A・B は枠の外(右のガター)に収まる
    expect(joystick.x + joystick.width).toBeLessThanOrEqual(stage.x)
    expect(a.x).toBeGreaterThanOrEqual(stage.x + stage.width)
    expect(b.x).toBeGreaterThanOrEqual(stage.x + stage.width)
    // 縦中央(親指の高さ)に寄る
    const center = viewport.height / 2
    expect(Math.abs(joystick.y + joystick.height / 2 - center)).toBeLessThanOrEqual(2)
    // 一覧への出口はガター配置でも A・B の上に重ならず、画面の下端に収まる
    const exit = box('[data-village-exit]')
    expect(boxesIntersect(exit, a)).toBe(false)
    expect(boxesIntersect(exit, b)).toBe(false)
    expect(exit.y + exit.height).toBeLessThanOrEqual(viewport.height)
    expect(scrollOverflow(), '文書はスクロールしない').toBeLessThanOrEqual(0)
  }

  describe('横持ちのスマートフォン', () => {
    beforeEach(async () => {
      await emulateTouch()
      await page.viewport(750, 342)
    })

    test('枠は高さ基準の整数マス、スティックと A/B は左右のガターへ分かれる', async () => {
      await renderVillage()
      const stage = villageFrame().getBoundingClientRect()
      const { cols, rows, cell } = stageVars()
      // 横持ちは帯が無いので min(floor(w/列), floor(h/行), 64)
      expect(cell).toBe(computeCell(window.innerWidth, window.innerHeight, 0, cols, rows))
      // computeCell で computeCell を測っても式の変更は捕まえられない。750×342 で実ブラウザが出した値(高さ基準 floor(342/9))を実数で留める
      expect(cell).toBe(38)
      expect(stage.width).toBe(cell * cols)
      expect(stage.height).toBe(cell * rows)
      // 750×342・マス 38 の枠の幅 380 なら片側 185px のガターが空き、ガター配置になる
      expectGutterLayout(stage)
    })
  })

  describe('iPad横持ち', () => {
    beforeEach(async () => {
      await emulateTouch()
      await page.viewport(1024, 768)
    })

    test('枠は上限 64px で止まり、スティックと A/B は左右のガターへ分かれる', async () => {
      await renderVillage()
      const stage = villageFrame().getBoundingClientRect()
      const { cols, rows, cell } = stageVars()
      // 1024×768 はどちらの基準でも上限 64px で頭打ちになる
      expect(cell).toBe(computeCell(window.innerWidth, window.innerHeight, 0, cols, rows))
      expect(cell).toBe(cellMax(cols))
      // 上限そのものが変わったら気づけるよう、公式ではなく実数で留める(PC と同じ 64px)
      expect(cell).toBe(64)
      expect(stage.width).toBe(cell * cols)
      expect(stage.height).toBe(cell * rows)
      // 枠の幅 640 に対し片側 192px のガターが空き、ガター配置になる
      expectGutterLayout(stage)
    })
  })
})

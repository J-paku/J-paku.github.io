// 卓上時計の窓の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import {
  FRAME_MS,
  advanceUntil,
  focusVillage,
  isPainted,
  runFor,
  tapHeld,
  villageFrame,
  walk,
  worldLayer,
} from './village-walk.test-helper'
import { PHASE_CLOCKS, routeSheets, startVillageClock } from './village-time.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// E2E(tests/clock.spec.ts)が見ていた卓上時計の窓の断定を、E2E からこの統合テストへ移したもの(ADR 0018 の「統合へ移す」)。
// E2E と同じく利用者に見える物(role・名前・aria・要素の有無・計算されたスタイル)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。段階を決めるので Date だけを止める
// (startVillageClock の date。E2E の page.clock.setFixedTime)。差し替えるのは天気とシートの絵の取得(ネットワーク)と時間だけで、
// 歩く・押す・待つは village-walk.test-helper.ts の手順。
// タッチ端末(E2E の isMobile・hasTouch)のスティックは、CDP のタッチの模擬(emulateTouch)で描く。
// 模擬を切った後は pointer も hover も none のまま戻らない(resetEmulation の注)が、村は pointer: coarse かどうかだけで分けるので、
// 続くテストの振る舞いは変わらない。
// 統合では作れないので E2E に残すもの: 再読み込み
describe('卓上時計(tests/clock.spec.ts)', () => {
  const { text } = villageJa
  const setId = villageJa.worldSet.id

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
  const phase = () => root().getAttribute('data-phase')
  const worldId = () => worldLayer().getAttribute('data-world')

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

  // 主人公が提げるランタン。夜だけ描かれるので「時刻が本当に変わったか」の裏取りに使う
  const lanternPainted = () => isPainted(queryOne('[data-village-light="player"]'))

  // 「段階が変わらない」を見る前に待つフレーム数。段階を変える処理(シートの decode を待ってから setState)は、
  // 走れば 2 フレーム以内に画面へ届いた(2026-10-15、取消しで時刻を決めてしまう欠陥を入れて実測)ので、余裕を見て 5 フレーム
  const SETTLE_FRAMES = 5

  const clock = text.clock
  // 時計の設定窓。読み上げ名は窓の見出し(地点名)
  const clockWindow = () => page.getByRole('dialog', { name: clock.place })
  const button = (name: string) => clockWindow().getByRole('button', { name })
  const hourOf = () => queryOne('[data-clock-hour]', clockWindow().element()).textContent
  const minuteOf = () => queryOne('[data-clock-minute]', clockWindow().element()).textContent

  // 2 段目の窓で時と分の表示をまとめて確かめる。時は "18"、分は 2 桁の "00"
  const expectPicked = async (hour: string, minute: string) => {
    await expect.poll(hourOf, { message: `時が ${hour}` }).toBe(hour)
    await expect.poll(minuteOf, { message: `分が ${minute}` }).toBe(minute)
  }

  // 焦点が窓の中にあるか。矢印キーの検査は「窓に焦点がある」が前提なので、押す前に確かめておく
  const focusInside = () => clockWindow().element().contains(document.activeElement)

  const clickButton = (name: string) => userEvent.click(button(name))

  // 窓を開く。閉じた後に開き直す時も確実に届くよう、キーを受け取る枠へ焦点を戻してから押す
  const openClock = async () => {
    villageFrame().focus()
    await userEvent.keyboard('e')
  }

  // 時計の前まで歩いて昼から始める。どのテストも同じ出発点に揃え、「昼から変わったか」を段階で見る。
  // 段階が替わる時に読むシートの絵(ビルドが焼く PNG)は、どれも届く応答に差し替える
  const startAtClock = async () => {
    routeSheets(async () => {})
    startVillageClock(PHASE_CLOCKS.day, 'date')
    await renderVillage()
    expect(phase(), '出発は実時刻の昼').toBe('day')
    // 部屋の開始マス (4,4) から時計の前 (7,3) へ。右 3 マスは PC 机の下・テーブルの上を通る行なので素通りでき、
    // 最後の上 1 マスで卓上時計 (7,2) と向き合う
    expect(await walk(setId, 'ArrowRight', 3), '時計と同じ列まで歩けた').toBe(3)
    expect(await walk(setId, 'ArrowUp', 1), '時計の前まで歩けた').toBe(1)
    await expect
      .poll(() => document.querySelector('[data-village-bubble]')?.textContent, {
        message: '時計の前に立つと吹き出しが出る',
        timeout: 3_000,
      })
      .toContain(clock.arrive)
  }

  // 決めた 20:00 を窓から決める(昼から夜へ動かす)
  const decideTwenty = async () => {
    await openClock()
    await clickButton(clock.custom)
    await clickButton(clock.nextHour)
    await clickButton(clock.nextHour)
    await expectPicked('20', '00')
    await clickButton(clock.decide)
    await expect.element(clockWindow()).not.toBeInTheDocument()
  }

  // E2E の同じ検査はさらに再読み込みして実時刻の昼へ戻るかを見る。再読み込みは統合のテストの中では起こせない
  // (読み込み直すとテスト自体が消える)ので、そこは E2E に残す
  test('卓上時計で 20:00 を決めると夜になり、町へ出ても続く', async () => {
    await startAtClock()
    // 変える前に「昼は主人公のランタンが描かれていない」を押さえる。後の描かれている側だけを
    // 見ると、元から点きっぱなしの作りでも通ってしまい何も証明できない
    expect(lanternPainted(), '昼のうちはランタンが描かれない').toBe(false)

    await openClock()
    const clockDialog = clockWindow()
    await expect.element(clockDialog, { message: '設定窓は読み上げ上もダイアログ' }).toBeVisible()
    await expect.element(clockDialog).toHaveAttribute('aria-modal', 'true')
    await expect.element(clockDialog).toHaveAttribute('data-step', 'choose')
    await expect.element(clockDialog).toHaveTextContent(clock.prompt)

    await clickButton(clock.custom)
    await expect.element(clockDialog).toHaveAttribute('data-step', 'pick')
    await expect.element(clockDialog).toHaveTextContent(clock.customIntro)
    await expect.element(clockDialog).toHaveTextContent(clock.pick)
    // 何も押していない間の既定は 18:00。分は 2 桁で出す
    await expectPicked('18', '00')

    await clickButton(clock.nextHour)
    await clickButton(clock.nextHour)
    await expectPicked('20', '00')
    await clickButton(clock.decide)
    await expect.element(clockDialog).not.toBeInTheDocument()

    // 決めた時刻がそのまま段階になる(20 時は夜の帯)
    await expect.poll(phase, { message: '20 時は夜' }).toBe('night')
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(clock.setCustom.replace('{time}', '20:00'))
    // 属性だけでなく夜の描画まで届いている
    await expect.poll(lanternPainted, { message: '夜はランタンが描かれる' }).toBe(true)

    // 屋内で決めた時刻は、町へ出ても続く(ワールドを跨いでも覚えている)。
    // 時計の前 (7,3) から、PC 机が塞ぐ 3 行目を避けて 4 行目へ降り、左 3・下 3 でマット (4,7) に乗る
    villageFrame().focus()
    expect(await walk(setId, 'ArrowDown', 1), '4 行目へ降りた').toBe(1)
    expect(await walk(setId, 'ArrowLeft', 3), 'マットの列まで歩けた').toBe(3)
    expect(await walk(setId, 'ArrowDown', 3), 'マットまで歩けた').toBe(3)
    await expect.poll(worldId, { message: '町へ出た' }).toBe('town')
    expect(phase(), '町へ出ても夜のまま').toBe('night')
    expect(lanternPainted(), '町でもランタンが描かれている').toBe(true)
  })

  test('カスタム時間の後に現在時間を選ぶと実時刻へ戻る', async () => {
    await startAtClock()

    // まず 20:00 を決めて昼から夜へ動かす
    await decideTwenty()
    await expect.poll(phase, { message: '20 時は夜' }).toBe('night')

    // 開き直して 2 段目へ入ると、既定は 18:00 ではなく前に決めた 20:00
    await openClock()
    await clickButton(clock.custom)
    await expect.element(clockWindow()).toHaveAttribute('data-step', 'pick')
    await expectPicked('20', '00')
    await clickButton(clock.cancel)
    await expect.element(clockWindow()).not.toBeInTheDocument()
    expect(phase(), '取消しなので夜のまま').toBe('night')

    // 現在時間を選べば実時刻(JST 12:00 = 昼)へ戻る
    await openClock()
    await expect.element(clockWindow()).toHaveAttribute('data-step', 'choose')
    await clickButton(clock.realtime)
    await expect.element(clockWindow()).not.toBeInTheDocument()
    await expect.poll(phase, { message: '実時刻の昼へ戻る' }).toBe('day')
    await expect.element(page.getByRole('status')).toHaveTextContent(clock.setRealtime)
    expect(lanternPainted(), '昼へ戻ればランタンも消える').toBe(false)
  })

  test('取消すと時計を触る前の時間のままになる', async () => {
    await startAtClock()

    // 2 段目で時刻を動かしてから取消す。19 時は夜の帯なので、誤って決まっていれば段階が変わって落ちる
    await openClock()
    await clickButton(clock.custom)
    await clickButton(clock.nextHour)
    await expectPicked('19', '00')
    await clickButton(clock.cancel)
    await expect.element(clockWindow()).not.toBeInTheDocument()
    await expect.element(page.getByRole('status')).toHaveTextContent(clock.cancelled)
    // 決まっていれば段階を変える処理(シートを待ってから替える)が走り終わるまで待ってから見る
    await runFor(FRAME_MS * SETTLE_FRAMES)
    expect(phase(), '取消しでは段階が変わらない').toBe('day')

    // 1 段目の取消しも同じく何も変えずに閉じるだけ
    await openClock()
    await expect.element(clockWindow()).toHaveAttribute('data-step', 'choose')
    await clickButton(clock.cancel)
    await expect.element(clockWindow()).not.toBeInTheDocument()
    await runFor(FRAME_MS * SETTLE_FRAMES)
    expect(phase(), '1 段目の取消しでも段階が変わらない').toBe('day')
  })

  test('1 段目の窓は矢印キーでボタンを移れる', async () => {
    await startAtClock()

    await openClock()
    await expect.element(clockWindow()).toHaveAttribute('data-step', 'choose')
    await expect
      .element(button(clock.realtime), { message: '開いた直後の焦点は先頭の現在時間' })
      .toHaveFocus()

    // 下・右が次、上・左が前。1 回押すごとに 1 つだけ移る(2 つ飛べば枠側でも数えている)
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(button(clock.custom), { message: '下 1 回でカスタム時間' }).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(button(clock.cancel), { message: '下もう 1 回でやめる' }).toHaveFocus()
    // 末尾から先は先頭へ回り込む
    await userEvent.keyboard('{ArrowDown}')
    await expect
      .element(button(clock.realtime), { message: 'やめるの次は現在時間へ回り込む' })
      .toHaveFocus()
    // 先頭から前は末尾へ回り込む
    await userEvent.keyboard('{ArrowUp}')
    await expect
      .element(button(clock.cancel), { message: '現在時間の前はやめるへ回り込む' })
      .toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(button(clock.realtime), { message: '右も下と同じく次へ' }).toHaveFocus()
    // 焦点を移しただけで、どのボタンも押されていない
    await expect.element(clockWindow()).toHaveAttribute('data-step', 'choose')
  })

  test('2 段目の窓は矢印キーで時と分を動かせる', async () => {
    await startAtClock()

    await openClock()
    await clickButton(clock.custom)
    await expect.element(clockWindow()).toHaveAttribute('data-step', 'pick')
    // 2 段目へ入ると焦点は決定へ移る。A(Z)がそのまま決定になる前提
    await expect
      .element(button(clock.decide), { message: '2 段目へ入った時点の焦点は決定' })
      .toHaveFocus()
    await expectPicked('18', '00')
    // 矢印キーは窓に焦点がある時だけ届く。押す前にそこを確かめておく
    expect(focusInside(), '窓を開いた時点で焦点は窓の中にある').toBe(true)

    // 左右が時の ±1。1 回目は押したまま 2 フレーム置いてから離す。窓が受けたキーが枠まで伝わると、枠は同じ 1 回を
    // 押しっぱなしの向きとして書き、窓が rAF でもう 1 つ進める(2 倍進む)。rAF が読む間を与えてそれが無いことを見る
    await tapHeld('ArrowRight')
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(hourOf, { message: '右 2 回で 20 時' }).toBe('20')
    // 上下が分の ±10
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    await expect.poll(minuteOf, { message: '上 3 回で 30 分' }).toBe('30')

    // 0 時を跨いでも止まらずに一周する(20 - 21 = -1 → 23 時)
    await userEvent.keyboard('{ArrowLeft}'.repeat(21))
    await expect.poll(hourOf, { message: '左 21 回で 23 時へ回り込む' }).toBe('23')
    // 分も 0 分を跨いで一周する(30 - 40 = -10 → 50 分)。時が繰り下がるかは決めていないので見ない
    await userEvent.keyboard('{ArrowDown}'.repeat(4))
    await expect.poll(minuteOf, { message: '下 4 回で 50 分へ回り込む' }).toBe('50')
  })

  test('2 段目で A(Z) を押すと決定される', async () => {
    await startAtClock()

    await openClock()
    await clickButton(clock.custom)
    await expect.element(clockWindow()).toHaveAttribute('data-step', 'pick')
    await expect.element(button(clock.decide)).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await expectPicked('20', '00')
    // 焦点は決定に置かれたままなので、Z(画面の A)がそのまま決定を押す
    await userEvent.keyboard('z')
    await expect.element(clockWindow()).not.toBeInTheDocument()
    // 20 時は夜の帯。決定されていなければ昼のまま落ちる
    await expect.poll(phase, { message: 'Z で決定されて夜になる' }).toBe('night')
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(clock.setCustom.replace('{time}', '20:00'))
  })
})

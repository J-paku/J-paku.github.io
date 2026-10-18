// 卓上時計の窓(状態コンテナ)を直接描く統合テスト(Vitest Browser Mode)。窓を実際の Chromium で、フック・子と一緒に描き(ADR 0016)、
// 1 段目の 3 つのボタン・2 段目の針と「決定」「やめる」・キー操作が、受け取った手(時刻の設定・案内文へ流す一言・閉じる知らせ)を
// どう呼ぶかを、利用者に見える物(role・名前・焦点・針の数字)で確かめる。
// 窓を描く・外すのは呼び出し側の村なので、ここでは閉じる知らせを呼んだかを見て、外した後の焦点はテストが外して見る。
// 村の中で開いて昼夜が替わるまでは src/components/VillagePage/__tests__/desk-clock.integration.test.tsx が見る。
// props は村の index.fixture.ts が node で組んで provide した文言(villageJa)を inject で受け取り、手はテストが作る
import { cleanup, render } from '@testing-library/react'
import { inject, onTestFinished } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import ClockModal from '@/components/VillagePage/components/Village/components/ClockModal'

const { lang, text } = inject('villageJa')
const clock = text.clock

beforeEach(async () => {
  // 村の統合テストと同じ PC の画面の大きさ
  await page.viewport(1280, 720)
})

afterEach(() => {
  cleanup()
})

// 窓を描く。savedHour・savedMinute は前に決めた時刻(null はまだ決めていない)。
// 窓は村の枠の中に絶対配置で重なるので、枠の代わりに大きさを持つ箱へ描き、閉じた後の焦点の戻り先も同じ箱にする
const renderClock = (savedHour: number | null, savedMinute: number | null) => {
  const frame = document.createElement('div')
  frame.tabIndex = -1
  frame.style.position = 'relative'
  frame.style.width = '640px'
  frame.style.height = '600px'
  document.body.append(frame)
  onTestFinished(() => frame.remove())
  // 開く前の焦点は枠。戻ったことが「元からそこにあった」でないよう、開いた直後に窓の中へ移ったことも見る
  frame.focus()

  const hands = {
    setRealtime: vi.fn(),
    setCustomTime: vi.fn(),
    announce: vi.fn(),
    onClose: vi.fn(),
  }
  const view = render(
    <ClockModal
      text={clock}
      lang={lang}
      clock={{
        savedHour,
        savedMinute,
        setRealtime: hands.setRealtime,
        setCustomTime: hands.setCustomTime,
      }}
      announce={hands.announce}
      onClose={hands.onClose}
      returnTo={{ current: frame }}
      scrollHeldRef={{ current: null }}
    />,
    { container: frame }
  )
  return { frame, hands, unmount: view.unmount }
}

// 窓。読み上げ名は見出し(地点名)
const clockWindow = () => page.getByRole('dialog', { name: clock.place })
const button = (name: string) => clockWindow().getByRole('button', { name, exact: true })
const buttonNames = () =>
  Array.from(clockWindow().element().querySelectorAll('button'), item => item.textContent)
const hourOf = () => clockWindow().element().querySelector('[data-clock-hour]')?.textContent
const minuteOf = () => clockWindow().element().querySelector('[data-clock-minute]')?.textContent

// 2 段目の時と分の表示をまとめて確かめる
const expectPicked = async (hour: string, minute: string) => {
  await expect.poll(hourOf, { message: `時が ${hour}` }).toBe(hour)
  await expect.poll(minuteOf, { message: `分が ${minute}` }).toBe(minute)
}

describe('卓上時計の窓の 2 つの段', () => {
  test('1 段目は見出しを読み上げ名にした窓に 3 つのボタンを並べ、「やめる」は時刻も案内文も変えずに閉じる知らせだけを呼ぶ', async () => {
    const { frame, hands, unmount } = renderClock(null, null)
    const dialog = clockWindow()
    await expect.element(dialog).toHaveAttribute('aria-modal', 'true')
    await expect.element(dialog).toHaveAttribute('data-step', 'choose')
    await expect
      .element(dialog, { message: '窓は村の言語で読ませる' })
      .toHaveAttribute('lang', lang)
    expect(dialog.element().textContent, '1 段目は問いかけの一言を出す').toContain(clock.prompt)
    expect(buttonNames(), '1 段目のボタンは 現在時間・カスタム・やめる の順').toEqual([
      clock.realtime,
      clock.custom,
      clock.cancel,
    ])
    expect(hourOf(), '1 段目に針は無い').toBeUndefined()
    await expect
      .element(button(clock.realtime), { message: '開いた直後の焦点は先頭のボタン' })
      .toHaveFocus()

    await userEvent.click(button(clock.cancel))
    expect(hands.onClose, '1 段目の「やめる」は閉じる知らせを呼ぶ').toHaveBeenCalledTimes(1)
    expect(hands.announce, '1 段目の「やめる」は案内文を書き換えない').not.toHaveBeenCalled()
    expect(hands.setRealtime).not.toHaveBeenCalled()
    expect(hands.setCustomTime).not.toHaveBeenCalled()

    // 閉じる知らせを受けた村が窓を外すと、焦点は開く前にいた枠へ戻る
    unmount()
    expect(document.activeElement, '外すと開く前の枠へ焦点が戻る').toBe(frame)
  })

  test('1 段目の「現在時間」は実時刻へ戻す手を呼び、決めた一言を案内文へ流してから閉じる知らせを呼ぶ', async () => {
    const { hands } = renderClock(20, 0)
    await userEvent.click(button(clock.realtime))
    expect(hands.setRealtime, '実時刻へ戻す手を 1 回呼ぶ').toHaveBeenCalledTimes(1)
    expect(hands.setCustomTime, '決めた時刻は渡さない').not.toHaveBeenCalled()
    expect(hands.announce.mock.calls, '案内文へ流すのは実時刻にした一言だけ').toEqual([
      [clock.setRealtime],
    ])
    expect(hands.onClose).toHaveBeenCalledTimes(1)
    expect(hands.announce.mock.invocationCallOrder[0], '一言を流してから閉じる').toBeLessThan(
      hands.onClose.mock.invocationCallOrder[0]
    )
  })

  test('2 段目は前に決めた時刻から針を始め、時は 1 時間・分は 10 分ずつ矢印のボタンで動き、「決定」で針の時刻を渡して一言を流す', async () => {
    const { hands } = renderClock(7, 50)
    await userEvent.click(button(clock.custom))
    const dialog = clockWindow()
    await expect.element(dialog).toHaveAttribute('data-step', 'pick')
    const lead = dialog.element().textContent
    expect(lead, '2 段目は前置きの一言を出す').toContain(clock.customIntro)
    expect(lead, '2 段目は選ぶよう促す一言を出す').toContain(clock.pick)
    expect(lead, '2 段目に問いかけの一言は残らない').not.toContain(clock.prompt)
    await expect
      .element(dialog.getByRole('group', { name: clock.hourLabel }), { message: '時の組' })
      .toBeVisible()
    await expect
      .element(dialog.getByRole('group', { name: clock.minuteLabel }), { message: '分の組' })
      .toBeVisible()
    await expect
      .element(button(clock.decide), { message: '2 段目へ入ると焦点は「決定」' })
      .toHaveFocus()
    expect(buttonNames().slice(-2), '2 段目の下のボタンは 決定・やめる の順').toEqual([
      clock.decide,
      clock.cancel,
    ])
    // 前に決めた 7:50 を 2 桁で出す
    await expectPicked('07', '50')

    // 時の矢印は時だけを、分の矢印は分だけを動かす
    await userEvent.click(button(clock.nextHour))
    await expectPicked('08', '50')
    await userEvent.click(button(clock.prevHour))
    await userEvent.click(button(clock.prevHour))
    await expectPicked('06', '50')
    // 50 分の次は 0 分へ回る
    await userEvent.click(button(clock.nextMinute))
    await expectPicked('06', '00')
    await userEvent.click(button(clock.prevMinute))
    await userEvent.click(button(clock.prevMinute))
    await expectPicked('06', '40')
    expect(hands.setCustomTime, '決定を押すまで時刻は渡さない').not.toHaveBeenCalled()

    await userEvent.click(button(clock.decide))
    expect(hands.setCustomTime.mock.calls, '針の時刻を 1 回渡す').toEqual([[6, 40]])
    expect(hands.announce.mock.calls, '決めた時刻を入れた一言を流す').toEqual([
      [clock.setCustom.replaceAll('{time}', '06:40')],
    ])
    expect(hands.onClose).toHaveBeenCalledTimes(1)
    expect(hands.setRealtime).not.toHaveBeenCalled()
  })

  test('2 段目の「やめる」は取り消しの一言を流して閉じる知らせを呼び、動かした針の時刻は渡さない', async () => {
    const { hands } = renderClock(null, null)
    await userEvent.click(button(clock.custom))
    // まだ決めていない時の針は 18:00
    await expectPicked('18', '00')
    await userEvent.click(button(clock.nextHour))
    await expectPicked('19', '00')

    await userEvent.click(button(clock.cancel))
    expect(hands.announce.mock.calls, '取り消しの一言を流す').toEqual([[clock.cancelled]])
    expect(hands.onClose).toHaveBeenCalledTimes(1)
    expect(hands.setCustomTime, '動かした針の時刻は渡さない').not.toHaveBeenCalled()
    expect(hands.setRealtime).not.toHaveBeenCalled()
  })

  test('窓のキーは、矢印が 1 段目で焦点を・2 段目で針を動かし、Esc はどちらの段でも閉じる知らせを呼ぶ', async () => {
    const { hands } = renderClock(9, 20)
    await expect.element(button(clock.realtime)).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect
      .element(button(clock.custom), { message: '1 段目の下矢印は次のボタンへ焦点を移す' })
      .toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(hands.onClose, '1 段目の Esc は閉じる知らせを呼ぶ').toHaveBeenCalledTimes(1)

    await userEvent.click(button(clock.custom))
    await expect.element(clockWindow()).toHaveAttribute('data-step', 'pick')
    await userEvent.keyboard('{ArrowRight}')
    await expectPicked('10', '20')
    await userEvent.keyboard('{ArrowUp}')
    await expectPicked('10', '30')
    await userEvent.keyboard('{Escape}')
    expect(hands.onClose, '2 段目の Esc も閉じる知らせを呼ぶ').toHaveBeenCalledTimes(2)
    expect(hands.announce, 'Esc は案内文を書き換えない').not.toHaveBeenCalled()
    expect(hands.setCustomTime, 'Esc は針の時刻を渡さない').not.toHaveBeenCalled()
  })
})

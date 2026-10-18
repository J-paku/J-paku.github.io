// 開いたまま時間帯が替わる村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import { advanceUntil, focusVillage, runFrames, villageFrame } from './village-walk.test-helper'
import { routeSheets, startVillageClock } from './village-time.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// E2E(tests/night-transition.spec.ts)が見ていた、開いたまま時間帯が替わる時の断定を、E2E からこの統合テストへ移したもの
// (ADR 0018 の「統合へ移す」)。rAF・setTimeout は本物のまま、Date と setInterval を止めてテストが進める
// (startVillageClock の phase-check)。差し替えるのは天気とシートの絵の取得(ネットワーク)と時間だけ。
// E2E の同じ検査はさらに、描いた地形と主人公の背景がその段階の焼いたシートを指し、画像として読めるか(expectDrawable)を見る。
// その背景はローダーの <style> が描き、シートの PNG はビルドが焼くので、統合では描かれない。そこは E2E に残す
describe('開いたまま時間帯が替わる(tests/night-transition.spec.ts)', () => {
  // 画面は既定で PC(E2E の既定と同じ 1280×720)
  beforeEach(async () => {
    await page.viewport(1280, 720)
  })

  // 村の根。data-phase に今の段階が、インラインの --cols・--rows(Village)と --cell・--band(useStageScale)に寸法が載る
  const root = () => {
    const element = villageFrame().closest<HTMLElement>('[data-phase]')
    if (element === null) throw new Error('村の根(data-phase)が描かれていない')
    return element
  }
  const phase = () => root().getAttribute('data-phase')

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

  // 「段階が変わらない」を見る前に待つフレーム数。段階を変える処理(シートの decode を待ってから setState)は、
  // 走れば 2 フレーム以内に画面へ届いた(2026-10-15、取消しで時刻を決めてしまう欠陥を入れて実測)ので、余裕を見て 5 フレーム
  const SETTLE_FRAMES = 5

  // JST 2026-09-23 16:59(昼の帯の終わり)。2 時間 2 分進めると JST 19:01 で夜の帯に入る
  const START = '2026-09-23T07:59:00Z'
  const TWO_HOURS_LATER = 2 * 60 * 60 * 1000 + 2 * 60 * 1000
  // 段階を確かめ直す間隔(hooks/use-day-phase.ts の CHECK_INTERVAL_MS)
  const CHECK_INTERVAL_MS = 60_000

  // 再読み込みせずに開いたまま時間を進める。Date と setInterval を偽の時計に載せて昼から始める
  const openDay = async () => {
    startVillageClock(START, 'phase-check')
    await renderVillage()
    expect(phase(), '開いた時は昼').toBe('day')
  }

  test('2 時間開いたまま夜へ移ると、地形と主人公の夜のシートを取りに行って夜になる', async () => {
    const requested: string[] = []
    routeSheets(async url => {
      requested.push(url)
    })
    await openDay()
    vi.advanceTimersByTime(TWO_HOURS_LATER)
    await expect.poll(phase, { message: '2 時間後は再読み込みせずに夜' }).toBe('night')
    // 夜の段階は地形と主人公の両方のシートで描く
    expect(requested.some(url => url.includes('/sprite-night-'))).toBe(true)
    expect(requested.some(url => url.includes('/player-night-'))).toBe(true)
  })

  test('夜の画像が届かない間は直前の昼の村を残し、届くようになれば夜へ移る', async () => {
    let unavailable = true
    let failures = 0
    routeSheets(async url => {
      if (!unavailable || !url.includes('-night-')) return
      failures += 1
      throw new Error(`404: ${url}`)
    })
    await openDay()
    // 開いた時の先読みで夜の絵も一度取りに行って失敗している。夜へ入った時に取り直してまた失敗するのを、増えた数で見る
    await expect.poll(() => failures, { message: '開いた時の先読みが失敗した' }).toBeGreaterThan(0)
    const preloadFailures = failures
    vi.advanceTimersByTime(TWO_HOURS_LATER)
    await expect
      .poll(() => failures, { message: '夜へ入って夜の絵を取り直し、また失敗した' })
      .toBeGreaterThan(preloadFailures)
    await runFrames(SETTLE_FRAMES)
    expect(phase(), '夜の絵が届かない間は昼のまま').toBe('day')

    unavailable = false
    vi.advanceTimersByTime(CHECK_INTERVAL_MS)
    await expect.poll(phase, { message: '届くようになった次の確かめで夜へ移る' }).toBe('night')
  })

  // 実際の段階の表は全段階のシートを持つので作れない。夜を抜いた表を props で渡し、描く絵の無い段階へ移らないことを見る
  test('段階のシートの表に無い段階へは移らず、直前の段階を残す', async () => {
    routeSheets(async () => {})
    startVillageClock(START, 'phase-check')
    await renderVillage({
      phaseSheets: villageJa.phaseSheets.filter(sheet => sheet.phase !== 'night'),
    })
    expect(phase(), '開いた時は昼').toBe('day')
    vi.advanceTimersByTime(TWO_HOURS_LATER)
    await runFrames(SETTLE_FRAMES)
    expect(phase(), '描くシートの無い夜へは移らない').toBe('day')
    // 同じ表でも、シートのある段階へは移る(表を絞ったせいで段階が全く動かないのではない)
    vi.advanceTimersByTime(10 * 60 * 60 * 1000)
    await expect.poll(phase, { message: '翌朝(明け方)のシートはあるので移る' }).toBe('dawn')
  })

  test('夜の主人公の絵だけ遅れても、両方の絵が揃うまで昼を残す', async () => {
    // 夜の主人公の絵への応答を、テストが手放すまで返さずに留める
    let release = () => {}
    const pending = new Promise<void>(resolve => {
      release = resolve
    })
    let requests = 0
    routeSheets(async url => {
      if (!url.includes('/player-night-')) return
      requests += 1
      await pending
    })
    try {
      await openDay()
      vi.advanceTimersByTime(TWO_HOURS_LATER)
      await expect
        .poll(() => requests, { message: '夜の主人公の絵を取りに行った' })
        .toBeGreaterThan(0)
      await runFrames(SETTLE_FRAMES)
      expect(phase(), '主人公の夜の絵が届くまで昼のまま').toBe('day')
      release()
      await expect.poll(phase, { message: '両方揃えば夜へ移る' }).toBe('night')
    } finally {
      release()
    }
  })
})

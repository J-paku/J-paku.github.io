// 村の昼夜と天気の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import { clearVillageProgress } from '@/lib/preferences'
import VillagePageContainer from '@/components/VillagePage/container'
import { DAY_PHASES } from '@/utils/day-phase'
import {
  advanceUntil,
  focusVillage,
  leaveRoom,
  runFrames,
  stubWeather,
  villageFrame,
  worldLayer,
} from './village-walk.test-helper'
import { PHASE_CLOCKS, RealImage, startVillageClock } from './village-time.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// E2E(tests/day-night.spec.ts)が見ていた昼夜と天気の断定を、E2E からこの統合テストへ移したもの(ADR 0018 の「統合へ移す」)。
// 夜の灯りの断定は night-lights.integration.test.tsx。
// E2E と同じく利用者に見える物(role・名前・aria・要素の有無・計算されたスタイル)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。段階を決めるので Date だけを止める
// (startVillageClock の date。E2E の page.clock.setFixedTime)。差し替えるのは天気(ネットワーク)と時間だけで、
// 歩く・押す・待つは village-walk.test-helper.ts の手順。
// 統合では作れないので E2E に残すもの: ビルドが焼くシートの PNG とローダーの <style> が描く絵・ko の文言
describe('昼夜と天気(tests/day-night.spec.ts)', () => {
  const { text } = villageJa
  const setId = villageJa.worldSet.id

  // 画面は既定で PC(E2E の既定と同じ 1280×720)
  beforeEach(async () => {
    await page.viewport(1280, 720)
  })

  // キーを受け取る村の枠。E2E と同じく data-village で指す(枠の読み上げ名はタッチ端末かどうかで替わる)
  const frame = () => page.elementLocator(villageFrame())

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

  // 村は自室の開始マス (4,4) から始まる。下端の 1 マスのマット (4,7) へ下へ 3 マス歩いて乗ると、町の自宅前 (14,12) へ出る
  const walkOutToTown = async () => {
    villageFrame().focus()
    expect(await leaveRoom(setId), '部屋の下端のマットまで歩けた').toBe(3)
    // 天気・灯りを数える前に「今いるのは屋外」を確定させる。屋内のままだと天気は常に 0 枚で素通りする
    await expect.poll(worldId, { message: '町(屋外)へ出た' }).toBe('town')
  }

  // 「段階が変わらない」を見る前に待つフレーム数。段階を変える処理(シートの decode を待ってから setState)は、
  // 走れば 2 フレーム以内に画面へ届いた(2026-10-15、取消しで時刻を決めてしまう欠陥を入れて実測)ので、余裕を見て 5 フレーム
  const SETTLE_FRAMES = 5

  // 雨・雪の層。Weather が層ごとに data-weather を置き、値に降水の種類を載せる。層は枠の子
  const WEATHER_LAYERS = '[data-weather]'
  const RAIN_LAYERS = '[data-weather="rain"]'
  const SNOW_LAYERS = '[data-weather="snow"]'
  // 降っている間に並ぶ層の枚数。2 コマを不透明度で交互に見せ消しする作りなので、出ているなら必ず 2 枚
  const WEATHER_LAYER_COUNT = 2
  const countOf = (selector: string) => document.querySelectorAll(selector).length

  // 天気の層が敷くシート(data URI をカスタムプロパティで渡す)。画像として実際に読めるかまで見る
  // (読めない URI でも文字列は取れるので、比較だけでは「両方壊れている」を取り逃がす)
  const weatherSheet = async (layer: Element) => {
    const image = getComputedStyle(layer).backgroundImage
    // none・グラデーション・複数指定はここで落とす(url() 1 本だけを認める)
    const single = /^url\((['"]?)(.+)\1\)$/.exec(image)
    if (single === null) return { drawable: false, image }
    const probe = new RealImage()
    probe.src = single[2]
    const drawable = await probe.decode().then(
      () => probe.naturalWidth > 0 && probe.naturalHeight > 0,
      () => false
    )
    return { drawable, image }
  }

  const ariaHiddenOf = (selector: string) =>
    Array.from(document.querySelectorAll(selector)).map(layer => layer.getAttribute('aria-hidden'))

  test('夜で雨でも8か所のコースは最後まで通る', { timeout: 90_000 }, async () => {
    const { home, meishi, lab, monument, robot, campfire, mailbox, journey } = text.stops
    const weather = stubWeather('rain')
    startVillageClock(PHASE_CLOCKS.night, 'date')
    await renderVillage()
    expect(phase()).toBe('night')
    await expect.poll(weather.calls, { message: '天気を問い合わせた' }).toBeGreaterThan(0)
    // 出発点の自室は屋内。ここではまだ降っていないのが正しい
    expect(countOf(WEATHER_LAYERS), '出発点の自室は屋内なので降らない').toBe(0)

    const dialog = page.getByRole('dialog')
    const expectStop = (title: string) =>
      expect
        .element(dialog.getByRole('heading', { name: title }), { timeout: 10_000 })
        .toBeVisible()
    await userEvent.keyboard('e')
    await expectStop(home.title)
    await userEvent.click(dialog.getByRole('button', { name: home.next }))
    await expectStop(meishi.title)
    // 自動の移動(飛んで扉を出る)で町(屋外)へ出た最初の地点。ここから完走まで雨が降り続けるはず
    await expect
      .poll(() => countOf(RAIN_LAYERS), { message: '町へ出た時点で雨が降っている' })
      .toBe(WEATHER_LAYER_COUNT)
    await userEvent.click(dialog.getByRole('button', { name: meishi.next }))
    await expectStop(lab.title)
    // 研究所 → 経歴碑 → AIロボ → 焚き火 → ポスト → 次の旅を次へで連ねる。
    // 最後の次の旅は、北の道の突き当たりへ着いたことで会話窓が自動で開く
    const chain = [lab, monument, robot, campfire, mailbox]
    const follow = async (index: number): Promise<void> => {
      if (index >= chain.length) return
      await userEvent.click(dialog.getByRole('button', { name: chain[index].next }))
      await expectStop((chain[index + 1] ?? journey).title)
      await follow(index + 1)
    }
    await follow(0)
    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).not.toBeInTheDocument()
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent(text.allSeen.replace('{list}', text.toList))
    // 完走すると一覧への出口へ焦点が移り、出口が跳ねて(data-bounce)合図する
    const exit = page.getByRole('link', { name: text.toList, exact: true })
    await expect.element(exit).toHaveFocus()
    await expect.element(exit).toHaveAttribute('data-bounce', '')
    // 完走しても段階と雨はそのまま(コースの進行が空や天気を壊していない)
    expect(phase()).toBe('night')
    expect(countOf(RAIN_LAYERS), '完走後も雨が降り続けている').toBe(WEATHER_LAYER_COUNT)
  })

  // E2E の同じ検査の段階の属性の部分。焼いたシートそのものが段階ごとに別物かは、ビルドが焼く PNG と
  // ローダーの <style>(スプライトの背景)が要り、統合では描かれないので E2E に残す
  test('4 段階のどの瞬間に開いても、その段階で描く', async () => {
    for (const dayPhase of DAY_PHASES) {
      startVillageClock(PHASE_CLOCKS[dayPhase], 'date')
      await renderVillage()
      expect(phase(), `${PHASE_CLOCKS[dayPhase]} に開くと ${dayPhase}`).toBe(dayPhase)
      cleanup()
    }
  })

  test('大阪が雨なら雨の層が出て、読み上げからは外れる', async () => {
    const weather = stubWeather('rain')
    startVillageClock(PHASE_CLOCKS.day, 'date')
    await renderVillage()

    // このテストの応答を見て描いたことを先に押さえる
    await expect.poll(weather.calls, { message: '天気を問い合わせた' }).toBeGreaterThan(0)
    // 自室には天井があるので、雨だと分かっていても屋内では降らせない
    expect(countOf(WEATHER_LAYERS), '屋内では降らない').toBe(0)

    await walkOutToTown()
    // 属性の値まで見るので、雪の層が出ていても「雨が降った」とは数えない
    await expect
      .poll(() => countOf(RAIN_LAYERS), { message: '雨は 2 コマぶんの層が並ぶ' })
      .toBe(WEATHER_LAYER_COUNT)
    // 2 枚とも読み上げから外れていること。片方だけだと支援技術に粒の層が残る
    expect(ariaHiddenOf(RAIN_LAYERS), '2 枚とも読み上げから外れる').toEqual(['true', 'true'])
  })

  test('大阪が雪なら雪の層が出て、雨とは別のシートになる', async () => {
    const weather = stubWeather('snow')
    startVillageClock(PHASE_CLOCKS.day, 'date')
    await renderVillage()

    await expect.poll(weather.calls, { message: '天気を問い合わせた' }).toBeGreaterThan(0)
    // 雨と同じく、天井のある自室では降らせない
    expect(countOf(WEATHER_LAYERS), '屋内では降らない').toBe(0)

    await walkOutToTown()
    await expect
      .poll(() => countOf(SNOW_LAYERS), { message: '雪は 2 コマぶんの層が並ぶ' })
      .toBe(WEATHER_LAYER_COUNT)
    // 差し替えた応答は降水も 0 より大きい。降雪を先に見る判定が落ちればここが雨に化けるので、
    // 「雨が 0 枚」まで見て初めて雪として降ったと言える
    expect(countOf(RAIN_LAYERS), '雪の日に雨の層は出ない').toBe(0)
    expect(ariaHiddenOf(SNOW_LAYERS), '2 枚とも読み上げから外れる').toEqual(['true', 'true'])

    const [snowFirstLayer, snowSecondLayer] = Array.from(document.querySelectorAll(SNOW_LAYERS))
    const snowFirst = await weatherSheet(snowFirstLayer)
    const snowSecond = await weatherSheet(snowSecondLayer)
    expect(snowFirst.drawable, '雪の 1 コマ目が画像として読める').toBe(true)
    expect(snowSecond.drawable, '雪の 2 コマ目が画像として読める').toBe(true)
    // 2 枚が同じ絵だと、見せ消ししても粒が動かない(コマ送りになっていない)
    expect(snowSecond.image, '雪の 2 枚は別のコマである').not.toBe(snowFirst.image)

    // 同じ村を雨へ差し替えて開き直す(E2E から移す前は再読み込みしていた所)。属性の値が違うだけでなく、敷かれるシートそのものが
    // 雨と雪で別物だと確かめる。読み込み直すと自室から始まる(位置は捨てる)ので、降る場所までもう一度出てから数える
    stubWeather('rain')
    cleanup()
    clearVillageProgress(setId)
    await renderVillage()
    await walkOutToTown()
    await expect
      .poll(() => countOf(RAIN_LAYERS), { message: '差し替えた後は雨の層に入れ替わる' })
      .toBe(WEATHER_LAYER_COUNT)
    expect(countOf(SNOW_LAYERS), '雨に変えたら雪の層は残らない').toBe(0)
    const rainFirst = await weatherSheet(queryOne(RAIN_LAYERS))
    expect(rainFirst.drawable, '雨の 1 コマ目が画像として読める').toBe(true)
    expect(rainFirst.image, '雪のシートは雨のシートと別物').not.toBe(snowFirst.image)
  })

  test('天気の取得が失敗したら何も降らせず村は動く', async () => {
    const weather = stubWeather('error')
    startVillageClock(PHASE_CLOCKS.day, 'date')
    await renderVillage()

    // 問い合わせが済んでから数える。応答前に数えると「まだ出ていない」を通してしまう
    await expect.poll(weather.calls, { message: '天気を問い合わせた' }).toBeGreaterThan(0)
    // 取得に失敗しても村の描画と会話はそのまま動く
    await expect.element(frame()).toBeVisible()
    const dialog = page.getByRole('dialog')
    await userEvent.keyboard('e')
    await expect.element(dialog.getByRole('heading', { name: text.stops.home.title })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).not.toBeInTheDocument()

    // 降る場所(屋外)まで出てから数える。種類も問わない — 雨に絞ると、誤って雪として降った時に見逃す
    await walkOutToTown()
    await runFrames(SETTLE_FRAMES)
    expect(countOf(WEATHER_LAYERS), '失敗したら何も降らない').toBe(0)
  })
})

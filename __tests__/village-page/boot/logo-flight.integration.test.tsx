// 起動の覆い(Boot。中央のロゴを着地先のロゴへ飛ばしてから自分を外す状態のコンテナ)を直接描き、
// クライアント遷移で走る effect と、初回の読み込みで hydration より前に走るインラインの script の手順を、時刻・着地・二重に走らせないことで見る。
// 着地先は、村の見出しと同じ Logo(bootTarget)をテストが覆いの後ろに置く。覆いは手順の中で自分を文書から外すので、
// 村と同じく箱(main)の中に描く(描いた根の直下に置くと、外す時に React が外れた覆いを外し直して投げる)。
// 初回の読み込みは、書き出す HTML(サーバの描画)の中で script を走らせてからハイドレーションして作る。
// 村の画面の中で覆いの間だけ見出しのロゴを隠す見え方は、村を描く boot-landing が見る
import { cleanup, render } from '@testing-library/react'
import { useLayoutEffect, type ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { onTestFinished } from 'vitest'
import { page } from 'vitest/browser'
import Boot from '@/components/VillagePage/components/Boot/container'
import Logo from '@/components/ui/Logo'
import { SLACK_MS, emulateReducedMotion } from '../village-walk.test-helper'
import { prepareVillage, resetVillage, villageJa } from '../village.test-helper'
import '@/styles/tokens.css'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// rAF・performance.now・タイマー・Date を偽の時計に載せ、手順のタイマーをテストが 1 ms 単位で進める
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)。
  // 偽の時計を外すのも resetVillage
  cleanup()
  await resetVillage()
})

const { name } = villageJa

// 手順の時刻(描いてからの ms。Boot の runBoot と BOOT_SCRIPT が同じ値を持つ)。期待値としてテストが自分で持つ
// ロゴを着地先へ飛ばし始める
const FLY_AT_MS = 450
// 飛ばしたロゴが着地し、覆いを外す
const LANDED_MS = 1_000
// 飛ばさない時(動きを控える・着地先かロゴが無い)に覆いを外す
const SKIP_MS = 300
// どの道でも覆いを外す上限
const CAP_MS = 1_500

// 着地先のロゴの幅(px)。覆いのロゴ(幅は boot.css が画面の幅から決める)と違う大きさにして、縮めて重ねるのも見る
const TARGET_WIDTH = 160

// 覆いと、その後ろの着地先のロゴ。村では舞台(main)の先頭に覆いを置き、見出しのロゴが後ろに続く
const withTarget = (
  <main>
    <Boot name={name} />
    <div style={{ width: TARGET_WIDTH }}>
      <Logo name={name} bootTarget />
    </div>
  </main>
)

// 起動の覆いと、その中のロゴ。外れた後も確かめられるよう、描いた直後に控えて使う
const bootOverlay = () => {
  const boot = document.getElementById('boot')
  if (boot === null) throw new Error('起動の覆いが描かれていない')
  return boot
}
const bootLogo = (boot: HTMLElement) => {
  const logo = boot.querySelector('svg')
  if (logo === null) throw new Error('起動の覆いにロゴが描かれていない')
  return logo
}
// 覆いの中のロゴに書かれた transform。ロゴが無ければ空
const bootLogoTransform = (boot: HTMLElement) => boot.querySelector('svg')?.style.transform ?? ''
// 着地先のロゴ
const targetLogo = () => {
  const target = document.querySelector<SVGElement>('[data-boot-target]')
  if (target === null) throw new Error('着地先のロゴが描かれていない')
  return target
}

// 偽の時計を、描いた時刻 startedAt から数えて at ms の 1 ms 手前まで進める。手順は時刻をタイマーだけで決め、
// React の描き直しを待たないので、フレームではなく ms で進める。続けて passMs で 1 ms 進めると、その時刻のタイマーが走る
// (手順の時刻が 1 ms でもずれると、手前か後の確かめで落ちる)
const runToJustBefore = (startedAt: number, at: number) => {
  vi.advanceTimersByTime(at - 1 - (performance.now() - startedAt))
}
// 偽の時計を 1 ms 進める
const passMs = () => {
  vi.advanceTimersByTime(1)
}
// 偽の時計を、描いた時刻 startedAt から数えて at ms を過ぎた所まで進める
const runPast = (startedAt: number, at: number) => {
  vi.advanceTimersByTime(at + 1 - (performance.now() - startedAt))
}

// 覆いの DOM が置かれてから Boot の effect(passive)が走るまでの間に、layout effect で before を呼ぶ。
// effect より前に DOM が欠けた所を作る
function BeforeBootEffect({ before }: { before: () => void }) {
  useLayoutEffect(before, [before])
  return null
}

// クライアント遷移と同じく、描いて effect に手順を走らせる。描いた時刻を返す。
// render は effect まで流し終えてから戻るので、返した時刻に手順が始まっている
const openByEffect = async (ui: ReactElement = withTarget, before?: () => void) => {
  await page.viewport(1280, 720)
  const { unmount } = render(
    <>
      {ui}
      {before === undefined ? null : <BeforeBootEffect before={before} />}
    </>
  )
  return { startedAt: performance.now(), unmount }
}

// 書き出した HTML に入っている起動の script を、その場で走らせる。innerHTML で入れた script は走らないので、
// 同じ中身の script を作り直して文書へ入れる(作った script は入れた時に同期で走る)
const runInlineBootScript = () => {
  const inline = document.querySelector('#boot ~ script')
  if (inline === null) throw new Error('起動の script が描かれていない')
  const script = document.createElement('script')
  script.textContent = inline.textContent
  document.head.append(script)
  script.remove()
}

// 初回の読み込みと同じく、書き出す HTML(サーバの描画)を文書へ置き、beforeHydrate(既定は起動の script)を走らせてから
// その HTML へハイドレーションする。描いた時刻を返す
const openByScript = async (
  beforeHydrate: () => void = runInlineBootScript,
  ui: ReactElement = withTarget
) => {
  await page.viewport(1280, 720)
  const host = document.createElement('div')
  host.innerHTML = renderToString(ui)
  document.body.append(host)
  // ハイドレーションの前に落ちても、書き出した HTML を次のテストへ残さない(描いた後は cleanup も外す)
  onTestFinished(() => host.remove())
  beforeHydrate()
  const { unmount } = render(ui, { container: host, hydrate: true })
  return { startedAt: performance.now(), unmount }
}

describe('ロゴの着地', () => {
  // 手順を走らせる側。クライアント遷移では差し込まれた script が走らないので effect が、初回の読み込みでは script が走らせる
  const RUNNERS = [
    { name: 'クライアント遷移の effect', open: () => openByEffect() },
    { name: '初回の読み込みの script', open: () => openByScript() },
  ] as const

  for (const { name: runner, open } of RUNNERS) {
    test(`${runner}は、0.45 秒で覆いの中央のロゴを着地先のロゴの位置と大きさへ飛ばし始め、1 秒で覆いを外し、外した覆いへ後から手を出さない`, async () => {
      const { startedAt } = await open()
      const boot = bootOverlay()
      const logo = bootLogo(boot)
      const target = targetLogo()
      // 手順を始めた側が印を立てる(script と effect のうち、後から来た方はこの印を見て走らない)
      expect(boot.hasAttribute('data-run'), '手順を始めた印').toBe(true)
      // 飾りなので読み上げからは隠す
      expect(boot.getAttribute('aria-hidden')).toBe('true')
      expect(logo.getBoundingClientRect().width, '前提: 覆いのロゴは着地先と大きさが違う').not.toBe(
        TARGET_WIDTH
      )
      // 飛ばし始めるまでは中央のロゴのまま
      runToJustBefore(startedAt, FLY_AT_MS)
      expect(boot.hasAttribute('data-moving'), '飛ばし始める前の印').toBe(false)
      expect(logo.style.transform, '飛ばし始める前のロゴ').toBe('')
      passMs()
      expect(boot.hasAttribute('data-moving'), '飛ばし始めた印').toBe(true)
      // 動き(CSS の遷移)は実時間で進むので、着地は本物の時計で待つ。左上と幅・高さが着地先のロゴに重なる
      const to = target.getBoundingClientRect()
      const landed = () => {
        const box = logo.getBoundingClientRect()
        return [box.left - to.left, box.top - to.top, box.width - to.width, box.height - to.height]
      }
      await expect
        .poll(() => landed().every(gap => Math.abs(gap) < 1), {
          message: 'ロゴが着地先のロゴに重なる',
          timeout: SLACK_MS,
        })
        .toBe(true)
      // 着地するまでは覆いが残り、着地の時刻を越えたフレームで外れる
      runToJustBefore(startedAt, LANDED_MS)
      expect(document.getElementById('boot'), '着地の時刻より前の覆い').toBe(boot)
      passMs()
      expect(document.getElementById('boot'), '着地の時刻を越えた覆い').toBeNull()
      // 上限の時刻を過ぎても、外し終えた覆いへもう手を出さない(文書へ戻さず、ロゴも動かさない)
      const landedTransform = logo.style.transform
      runPast(startedAt, CAP_MS)
      expect(document.getElementById('boot')).toBeNull()
      expect(boot.isConnected, '外した覆いは文書の外のまま').toBe(false)
      expect(logo.style.transform, '外した後のロゴ').toBe(landedTransform)
    })
  }

  // 飛ばさずに少し待って外す場合。動きを控える設定と、どちらかのロゴが無い場合(どんな環境でも覆いは外す)
  const SKIPS = [
    {
      name: '動きを控える設定では',
      open: async () => {
        await emulateReducedMotion()
        return openByEffect()
      },
    },
    {
      name: '着地先のロゴを置かずに描くと',
      open: () =>
        openByEffect(
          <main>
            <Boot name={name} />
          </main>
        ),
    },
    {
      name: '覆いの中のロゴが effect より前に外れていると',
      open: () => openByEffect(withTarget, () => bootLogo(bootOverlay()).remove()),
    },
  ] as const

  for (const { name: skip, open } of SKIPS) {
    test(`${skip}、ロゴを飛ばさずに 0.3 秒で覆いを外し、上限の時刻を過ぎても外した覆いのロゴを飛ばさない`, async () => {
      const { startedAt } = await open()
      const boot = bootOverlay()
      expect(boot.hasAttribute('data-run'), '手順を始めた印').toBe(true)
      runToJustBefore(startedAt, SKIP_MS)
      expect(document.getElementById('boot'), '0.3 秒より前の覆い').toBe(boot)
      passMs()
      expect(document.getElementById('boot'), '0.3 秒を越えた覆い').toBeNull()
      // 飛ばし始める時刻を過ぎても、外した覆いのロゴを飛ばさない
      runPast(startedAt, CAP_MS)
      expect(boot.hasAttribute('data-moving'), '飛ばし始めた印').toBe(false)
      expect(bootLogoTransform(boot), '飛ばしたロゴ').toBe('')
      expect(boot.isConnected, '外した覆いは文書の外のまま').toBe(false)
    })
  }

  test('覆いが外れる前に Boot を外すと、予約した手順を止め、外した覆いのロゴを後から飛ばさない', async () => {
    const { startedAt, unmount } = await openByEffect()
    const boot = bootOverlay()
    const logo = bootLogo(boot)
    runToJustBefore(startedAt, FLY_AT_MS)
    unmount()
    // 予約したタイマーが残っていれば、飛ばし始める時刻に外した覆いのロゴへ transform を書く
    runPast(startedAt, CAP_MS)
    expect(boot.hasAttribute('data-moving'), '外した後に飛ばし始めた印').toBe(false)
    expect(logo.style.transform, '外した後に飛ばしたロゴ').toBe('')
  })
})

describe('script と effect の受け渡し', () => {
  test('書き出した HTML で script が先に印を立てていれば、ハイドレーションした effect は手順を走らせず、覆いを外すのを script に任せる', async () => {
    // script の手順は走らせず、印だけを立てる。effect が印を見ずに手順を走らせれば、上限までに覆いを外す
    const { startedAt } = await openByScript(() => bootOverlay().setAttribute('data-run', ''))
    const boot = bootOverlay()
    runPast(startedAt, CAP_MS)
    expect(document.getElementById('boot'), 'effect が外さなかった覆い').toBe(boot)
    expect(boot.hasAttribute('data-moving'), 'effect が飛ばし始めた印').toBe(false)
    expect(bootLogo(boot).style.transform, 'effect が飛ばしたロゴ').toBe('')
  })

  test('effect より前に覆いが外れていれば(script が外し終えた後など)、effect は何もせず、上限の時刻を過ぎても覆いを描き直さない', async () => {
    const { startedAt } = await openByEffect(withTarget, () => bootOverlay().remove())
    expect(document.getElementById('boot')).toBeNull()
    expect(targetLogo().isConnected, '着地先のロゴはそのまま').toBe(true)
    runPast(startedAt, CAP_MS)
    expect(document.getElementById('boot'), '覆いを描き直さない').toBeNull()
  })
})

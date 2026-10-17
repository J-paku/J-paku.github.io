// 起動の覆い(Boot)の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 中央のロゴを見出しのロゴへ飛ばして覆いを外す手順を、クライアント遷移で走る effect と、初回の読み込みで hydration より前に走る
// インラインの script の両方で見る。E2E は覆いが外れるのを待つだけで、手順の中身(時刻・着地・二重に走らせないこと)は見ない。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { page } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import {
  FRAME_MS,
  SLACK_MS,
  emulateReducedMotion,
  runFor,
  stepFrame,
  villageFrame,
} from './village-walk.test-helper'
import { PHASE_CLOCKS, startVillageClock } from './village-time.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// 手順の時刻(描いてからの ms。Boot の runBoot と BOOT_SCRIPT が同じ値を持つ)。期待値としてテストが自分で持つ
// ロゴを見出しへ飛ばし始める
const FLY_AT_MS = 450
// 飛ばしたロゴが着地し、覆いを外す
const LANDED_MS = 1_000
// 飛ばさない時(動きを控える・着地先かロゴが無い)に覆いを外す
const SKIP_MS = 300
// どの道でも覆いを外す上限
const CAP_MS = 1_500

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
// 見出しのロゴ(覆いのロゴの着地先)
const headingLogo = () => {
  const target = document.querySelector<SVGElement>('[data-boot-target]')
  if (target === null) throw new Error('見出しのロゴ(着地先)が描かれていない')
  return target
}

// 描いた時刻 startedAt から数えて at ms を越える直前のフレームまで進める。次の stepFrame で at を越える
// (偽の時計は 1 フレーム 16ms ずつ進み、ここで使う時刻はどれも 16 の倍数でない)
const runToJustBefore = async (startedAt: number, at: number) => {
  await runFor(at - FRAME_MS - (performance.now() - startedAt))
}

// 村の DOM が置かれてから Boot の effect(passive)が走るまでの間に、layout effect で before を呼ぶ。
// 初回の読み込みで hydration より前にインラインの script が DOM へ手を入れた所や、DOM が欠けた所を作る
function BeforeBootEffect({ before }: { before: () => void }) {
  useLayoutEffect(before, [before])
  return null
}

// 村を描き、描いた時刻を返す。render は effect まで流し終えてから戻るので、返した時刻に Boot の手順が始まっている
const openVillage = async (before?: () => void) => {
  await page.viewport(1280, 720)
  render(
    <>
      <VillagePageContainer {...villageJa} />
      {before === undefined ? null : <BeforeBootEffect before={before} />}
    </>
  )
  return performance.now()
}

// Boot が描いた起動の script(初回の読み込みで hydration より前に走る手順)を、その場で走らせる。
// React が差し込んだ script は走らない(差分挿入のインライン script をブラウザは実行しない)ので、
// 同じ中身の script を作り直して文書へ入れる(作った script は入れた時に同期で走る)
const runInlineBootScript = () => {
  const inline = document.querySelector('#boot ~ script')
  if (inline === null) throw new Error('起動の script が描かれていない')
  const script = document.createElement('script')
  script.textContent = inline.textContent
  document.head.append(script)
  script.remove()
}

// rAF・performance.now・タイマー・Date を偽の時計に載せ、手順のタイマーをテストが 1 フレーム(16ms)ずつ進める。
// 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
beforeEach(() => {
  startVillageClock(PHASE_CLOCKS.day, 'frames')
})

describe('ロゴの着地', () => {
  // 手順を走らせる側。クライアント遷移では差し込まれた script が走らないので effect が、初回の読み込みでは script が走らせる
  const RUNNERS = [
    { name: 'クライアント遷移の effect', before: undefined },
    { name: '初回の読み込みの script', before: runInlineBootScript },
  ] as const

  for (const { name, before } of RUNNERS) {
    test(`${name}は、中央のロゴを見出しのロゴの位置と大きさへ飛ばし、1 秒で覆いを外して見出しのロゴへ替える`, async () => {
      const startedAt = await openVillage(before)
      const boot = bootOverlay()
      const logo = bootLogo(boot)
      const target = headingLogo()
      // 手順を始めた側が印を立てる(script と effect のうち、後から来た方はこの印を見て走らない)
      expect(boot.hasAttribute('data-run'), '手順を始めた印').toBe(true)
      // 飾りなので読み上げからは隠す
      expect(boot.getAttribute('aria-hidden')).toBe('true')
      // 覆いがある間は見出しのロゴを隠す(着地した瞬間に入れ替わる)
      expect(getComputedStyle(target).visibility, '覆いの間の見出しのロゴ').toBe('hidden')
      // 飛ばし始めるまでは中央のロゴのまま
      await runToJustBefore(startedAt, FLY_AT_MS)
      expect(boot.hasAttribute('data-moving'), '飛ばし始める前の印').toBe(false)
      expect(logo.style.transform, '飛ばし始める前のロゴ').toBe('')
      await stepFrame()
      expect(boot.hasAttribute('data-moving'), '飛ばし始めた印').toBe(true)
      // 動き(CSS の遷移)は実時間で進むので、着地は本物の時計で待つ。左上と幅・高さが見出しのロゴに重なる
      const to = target.getBoundingClientRect()
      const landed = () => {
        const box = logo.getBoundingClientRect()
        return [box.left - to.left, box.top - to.top, box.width - to.width, box.height - to.height]
      }
      await expect
        .poll(() => landed().every(gap => Math.abs(gap) < 1), {
          message: 'ロゴが見出しのロゴに重なる',
          timeout: SLACK_MS,
        })
        .toBe(true)
      // 着地するまでは覆いが残り、着地の時刻を越えたフレームで外れる
      await runToJustBefore(startedAt, LANDED_MS)
      expect(document.getElementById('boot'), '着地の時刻より前の覆い').toBe(boot)
      await stepFrame()
      expect(document.getElementById('boot'), '着地の時刻を越えた覆い').toBeNull()
      expect(getComputedStyle(target).visibility, '覆いが外れた後の見出しのロゴ').toBe('visible')
      // 上限の時刻を過ぎても、外し終えた覆いへもう手を出さない
      await runToJustBefore(startedAt, CAP_MS + FRAME_MS)
      expect(document.getElementById('boot')).toBeNull()
    })
  }

  // 飛ばさずに少し待って外す場合。動きを控える設定と、どちらかのロゴが無い場合(どんな環境でも覆いは外す)
  const SKIPS = [
    { name: '動きを控える設定', reduceMotion: true, before: undefined },
    {
      name: '着地先の見出しのロゴが無い時',
      reduceMotion: false,
      before: () => headingLogo().removeAttribute('data-boot-target'),
    },
    {
      name: '覆いの中にロゴが無い時',
      reduceMotion: false,
      before: () => bootLogo(bootOverlay()).remove(),
    },
  ] as const

  for (const { name, reduceMotion, before } of SKIPS) {
    test(`${name}は、ロゴを飛ばさずに 0.3 秒で覆いを外す`, async () => {
      if (reduceMotion) await emulateReducedMotion()
      const startedAt = await openVillage(before)
      const boot = bootOverlay()
      expect(boot.hasAttribute('data-run'), '手順を始めた印').toBe(true)
      await runToJustBefore(startedAt, SKIP_MS)
      expect(document.getElementById('boot'), '0.3 秒より前の覆い').toBe(boot)
      await stepFrame()
      expect(document.getElementById('boot'), '0.3 秒を越えた覆い').toBeNull()
      // 飛ばし始める時刻を過ぎても、外した覆いのロゴを飛ばさない
      await runToJustBefore(startedAt, CAP_MS + FRAME_MS)
      expect(boot.hasAttribute('data-moving'), '飛ばし始めた印').toBe(false)
      expect(bootLogoTransform(boot), '飛ばしたロゴ').toBe('')
    })
  }

  test('覆いが外れる前に村を離れると、待っていた手順を止め、外れた覆いのロゴを後から飛ばさない', async () => {
    const startedAt = await openVillage()
    const boot = bootOverlay()
    const logo = bootLogo(boot)
    await runToJustBefore(startedAt, FLY_AT_MS)
    cleanup()
    // 待っていたタイマーが残っていれば、飛ばし始める時刻に外れた覆いのロゴへ transform を書く
    await runToJustBefore(startedAt, CAP_MS + FRAME_MS)
    expect(boot.hasAttribute('data-moving'), '離れた後に飛ばし始めた印').toBe(false)
    expect(logo.style.transform, '離れた後に飛ばしたロゴ').toBe('')
  })
})

describe('script と effect の受け渡し', () => {
  test('初回の読み込みの script が先に印を立てていれば、effect は手順を走らせず、覆いを外すのを script に任せる', async () => {
    // script の手順は走らせず、印だけを立てる。effect が印を見ずに手順を走らせれば、上限までに覆いを外す
    const startedAt = await openVillage(() => bootOverlay().setAttribute('data-run', ''))
    const boot = bootOverlay()
    await runToJustBefore(startedAt, CAP_MS + FRAME_MS)
    expect(document.getElementById('boot'), 'effect が外さなかった覆い').toBe(boot)
    expect(boot.hasAttribute('data-moving'), 'effect が飛ばし始めた印').toBe(false)
    expect(bootLogo(boot).style.transform, 'effect が飛ばしたロゴ').toBe('')
  })

  test('effect が走る前に覆いが外れていれば(script が外し終えた後など)、effect は何もせず村をそのまま描く', async () => {
    const startedAt = await openVillage(() => bootOverlay().remove())
    expect(document.getElementById('boot')).toBeNull()
    // 覆いが無いので見出しのロゴは初めから見え、村の枠も描かれている
    expect(getComputedStyle(headingLogo()).visibility).toBe('visible')
    expect(villageFrame()).not.toBeNull()
    await runToJustBefore(startedAt, CAP_MS + FRAME_MS)
    expect(document.getElementById('boot'), '覆いを描き直さない').toBeNull()
  })
})

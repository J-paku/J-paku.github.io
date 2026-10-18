// 夜の灯りの統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import {
  advanceUntil,
  focusVillage,
  isPainted,
  leaveRoom,
  villageFrame,
  villagePlayer,
  walk,
  worldLayer,
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

// E2E(tests/day-night.spec.ts)が見ていた夜の灯りの断定を、E2E からこの統合テストへ移したもの(ADR 0018 の「統合へ移す」)。
// E2E と同じく利用者に見える物(要素の有無・計算されたスタイル・位置)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。段階を決めるので Date だけを止める
// (startVillageClock の date。E2E の page.clock.setFixedTime)。差し替えるのは天気(ネットワーク)と時間だけで、
// 歩くのは village-walk.test-helper.ts の手順
describe('夜の灯り(tests/day-night.spec.ts)', () => {
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

  // 村は自室の開始マス (4,4) から始まる。下端の 1 マスのマット (4,7) へ下へ 3 マス歩いて乗ると、町の自宅前 (14,12) へ出る
  const walkOutToTown = async () => {
    villageFrame().focus()
    expect(await leaveRoom(setId), '部屋の下端のマットまで歩けた').toBe(3)
    // 天気・灯りを数える前に「今いるのは屋外」を確定させる。屋内のままだと天気は常に 0 枚で素通りする
    await expect.poll(worldId, { message: '町(屋外)へ出た' }).toBe('town')
  }

  const countOf = (selector: string) => document.querySelectorAll(selector).length

  // 夜の灯り。Lighting が world 層へ敷く光源で、data-village-light に光源の種類が載る
  const LIGHTS = '[data-village-light]'
  // 夜の町にともる灯りの内訳(実数。E2E からこの統合テストへ移した表)。「1 つ以上ある」だけを見ると
  // 主人公のランタン 1 つで通ってしまうので種類ごとの数を打つ。期待値を worldLights から作らない
  // (検査対象で検査対象を測っても何も証明できない)。
  // ★ 町の構成(content/world.ts の structures と家の窓の並び)を変えたら、この表も一緒に直す
  const TOWN_LIGHTS = {
    lamp: 3, // 街灯 lamp-west / lamp-east / lamp-plaza
    window: 4, // 家の窓。自宅1・名刺1・研究所2
    mailbox: 1, // ポスト前面の LED(粒は 5 つでも光源は 1 つ)
    campfire: 1, // たき火
    player: 1, // 主人公が提げるランタン
  } as const
  const TOWN_LIGHT_TOTAL = Object.values(TOWN_LIGHTS).reduce((sum, count) => sum + count, 0)
  // 人物と灯りの中心のずれの許容。両者は同じ transform を受けるので本来は 0 で、実測のまるめしか出ない
  const LIGHT_GAP_TOLERANCE_PX = 1

  const paintedLights = () => Array.from(document.querySelectorAll(LIGHTS)).filter(isPainted).length

  // 主人公と主人公の灯りの中心のずれを、同じ瞬間に両方の矩形を取って測る。
  // pose には rAF が人物へ書いた transform がそのまま入る(本当に歩いたかの裏取りに使う)
  const playerLightGap = () => {
    const player = villagePlayer()
    const light = queryOne('[data-village-light="player"]')
    const center = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    }
    const at = center(player)
    const lit = center(light)
    return { x: lit.x - at.x, y: lit.y - at.y, pose: player.style.transform }
  }

  test('夜の町は灯りがともり、主人公の灯りは歩いても離れない', async () => {
    startVillageClock(PHASE_CLOCKS.night, 'date')
    await renderVillage()
    expect(phase()).toBe('night')
    // 街灯もたき火も町にある。屋内のまま数えると主人公の灯りしか見ないテストになる
    await walkOutToTown()

    // 種類ごとに数を見る。合計だけだと、街灯が消えたぶん窓が増えたような入れ替わりを通してしまう
    for (const [kind, count] of Object.entries(TOWN_LIGHTS)) {
      expect(
        countOf(`[data-village-light="${kind}"]`),
        `夜の町に ${kind} の灯りが ${count} つ置かれている`
      ).toBe(count)
    }
    // 置かれているだけでなく本当に描かれている。表に無い種類が増えていればこの合計がずれて落ちる
    expect(paintedLights(), '夜の町では表どおりの灯りがすべて描かれている').toBe(TOWN_LIGHT_TOTAL)

    const before = playerLightGap()
    // 自宅前 (14,12) から右へ 1 マス
    expect(await walk(setId, 'ArrowRight', 1), '右へ 1 マス歩けた').toBe(1)
    const after = playerLightGap()
    // 先に「本当に歩いた」を確かめる。動いていなければ、ずれが同じでも何も証明していない
    expect(after.pose, '人物へ書かれる transform が変わっている(実際に歩いた)').not.toBe(
      before.pose
    )
    // カメラも一緒に動くので画面の絶対座標では判定できない。人物と灯りの中心のずれが
    // 歩く前後で変わらないことだけが「灯りが人物に固定されている」を意味する
    expect(Math.abs(after.x - before.x), '灯りが横に置いていかれていない').toBeLessThanOrEqual(
      LIGHT_GAP_TOLERANCE_PX
    )
    expect(Math.abs(after.y - before.y), '灯りが縦に置いていかれていない').toBeLessThanOrEqual(
      LIGHT_GAP_TOLERANCE_PX
    )
  })

  test('昼は灯りの要素が残ったまま一つも描かれない', async () => {
    startVillageClock(PHASE_CLOCKS.day, 'date')
    await renderVillage()
    expect(phase()).toBe('day')
    // 夜と同じ場所で数える。屋内で数えても町の光源は元から無いので、消えた証明にならない
    await walkOutToTown()

    // 段階が変わるたびに層を組み直さない作りなので、要素は昼も DOM に残っているのが正しい。
    // 枚数が 0 なのを合格にすると、そもそも描いていない場合と見分けが付かなくなる
    expect(countOf('[data-village-light="player"]'), '灯りの要素自体は昼でも DOM にある').toBe(1)
    expect(paintedLights(), '昼は灯りが一つも描かれない').toBe(0)
  })
})

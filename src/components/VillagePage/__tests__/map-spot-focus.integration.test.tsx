// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage'
import { mapEntries, type MapEntry } from '@/lib/village/map-entries'
import { spotToward } from '@/components/VillagePage/components/Village/components/WorldMap/utils/spot-navigation'
import {
  FRAME_MS,
  advanceUntil,
  focusVillage,
  leaveRoom,
  runFor,
  villageFrame,
  worldLayer,
  type WalkKey,
} from './village-walk.test-helper'
import { expectFrameFocused } from './village-dialog.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// ---- 拡大地図の方向キー ----
// tests/journey.spec.ts が見ている窓の中の操作のうち、地図の方向キーのフック(use-map-focus)の分岐を統合で通すもの。
// journey の行き先はこの段では決めていないので、journey はそのまま残す(ADR 0018)。
// E2E と同じく利用者に見える物(role・名前・焦点)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。差し替えるのは天気(ネットワーク)だけで、
// 歩く・押す・待つは village-walk.test-helper.ts の手順
describe('拡大地図の方向キー', () => {
  const { text } = villageJa
  const setId = villageJa.worldSet.id

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

  test('拡大地図は方向キーでその向きの地点へ焦点を移し、M で閉じる', async () => {
    await renderVillage()
    await walkOutToTown()
    await userEvent.keyboard('m')
    const map = page.getByRole('dialog')
    await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    const focusedSpot = () =>
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.spotId
        : undefined
    // 地図を開いた直後は番号 1(自室)の印に焦点がある
    const entries = mapEntries(villageJa.worldSet, villageJa.worldSet.worlds.town, new Set())
    const first = entries[0]
    await expect.poll(focusedSpot, { message: '開いた直後の焦点は番号 1 の地点' }).toBe(first.id)
    // 焦点が地点に無い(並びの先頭の閉じるボタンの)時は、Tab と同じく番号 1 の地点から入る
    await userEvent.tab({ shift: true })
    await expect
      .element(map.getByRole('button', { name: text.closeMap }), {
        message: '番号 1 の地点の前は閉じるボタン',
      })
      .toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect
      .poll(focusedSpot, { message: '閉じるボタンから方向キーで番号 1 の地点へ' })
      .toBe(first.id)
    // 右か下のうち、実際に地点がある向きを町のデータから選ぶ(tests/journey.spec.ts と同じ選び方)
    const moves: { key: WalkKey; spot: MapEntry | null }[] = [
      { key: 'ArrowRight', spot: spotToward(entries, first.id, 'right') },
      { key: 'ArrowDown', spot: spotToward(entries, first.id, 'down') },
    ]
    const move = moves.find(candidate => candidate.spot !== null)
    if (move === undefined || move.spot === null) {
      throw new Error('最初の地点の右にも下にも地点が無い')
    }
    const moved = move.spot
    expect(moved.id).not.toBe(first.id)
    await userEvent.keyboard(`{${move.key}}`)
    await expect.poll(focusedSpot, { message: 'その向きで最も近い地点へ焦点が移る' }).toBe(moved.id)
    // 押した向きに地点が無ければ、焦点は動かない
    const DIRECTIONS = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    } as const
    const dead = (Object.keys(DIRECTIONS) as WalkKey[]).find(
      key => spotToward(entries, moved.id, DIRECTIONS[key]) === null
    )
    if (dead === undefined) throw new Error(`${moved.id} からはどの向きにも地点がある`)
    await userEvent.keyboard(`{${dead}}`)
    await runFor(FRAME_MS * SETTLE_FRAMES)
    expect(focusedSpot(), 'その向きに地点が無ければ焦点は動かない').toBe(moved.id)
    // 焦点が移っただけで地図は閉じない。M は開閉の切り替えで、地図の中でも閉じる
    await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    await userEvent.keyboard('m')
    await expect.element(map).not.toBeInTheDocument()
    await expectFrameFocused('閉じると村の枠へ焦点が戻る')
  })
})

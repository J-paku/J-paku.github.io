// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import type { Cell, Direction } from '@content/types/world'
import VillagePageContainer from '@/components/VillagePage'
import { writePosition } from '@/lib/preferences'
import { isWalkable } from '@/lib/village/collision'
import {
  cellCenter,
  expectLoopIdle,
  focusVillage,
  isPainted,
  loopState,
  playerOnScreen,
  readCell,
  runFrames,
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

// ---- 主人公とそれに重ねる物の描き方 ----
// 歩行ループが rAF の中で DOM へ直接書く物のうち、ほかのファイルが通らない場合を、利用者に見える物(位置・見えるか・シートの絵)で確かめる。
// 街灯の笠の裏に立った時の街灯の重ね(LampVeil)、話せる相手がいない時の考え事の吹き出しが歩く主人公に付いて回ること、
// 最初のフレームより前に会話窓を開いた時の主人公の置き場。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境は、ファイル先頭の afterEach が戻す
describe('主人公とそれに重ねる物の描き方', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa
  const { room, town } = villageJa.worldSet.worlds
  const dialog = page.getByRole('dialog')

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

  // 保存した位置から村を描く。読み込み直後の最初の描画は保存を捨てるので、先に一度描いて外してから保存を置く
  // (このテストだけを走らせた時も同じ所から始めるため)。フレームはまだ 1 つも進めない
  const renderAt = async (saved: { worldId: string; cell: Cell; facing: Direction }) => {
    await page.viewport(1280, 720)
    render(<VillagePageContainer {...villageJa} />)
    cleanup()
    writePosition(setId, saved)
    render(<VillagePageContainer {...villageJa} />)
  }

  // 保存した位置から村を描き、起動の覆いが外れて歩行ループが眠るまで進める
  const openAt = async (saved: { worldId: string; cell: Cell; facing: Direction }) => {
    await renderAt(saved)
    await focusVillage()
    await expectLoopIdle()
  }

  // 箱の真ん中から、マスの真ん中までの距離(px)。箱もマスの位置もワールドの層から読む
  const gapTo = (element: Element, cell: Cell) => {
    const box = element.getBoundingClientRect()
    const center = cellCenter(cell)
    return Math.hypot(box.x + box.width / 2 - center.x, box.y + box.height / 2 - center.y)
  }

  test('街灯の笠の裏のマスに立つと、その街灯 1 本(上の灯と下の柱の 2 マス)を主人公の上へ薄く重ね、離れると消す', async () => {
    const lamp = town.structures.find(structure => structure.id === 'lamp-west')
    if (lamp === undefined || lamp.kind !== 'lamp') throw new Error('町に西の街灯が無い')
    // 街灯の絵は縦 2 マス。上のマス(cell)が笠と灯で、そこは歩いて通れる。下のマスは柱で通れない
    const shade = lamp.cell
    const pole = { x: shade.x, y: shade.y + 1 }
    const beside = { x: shade.x + 1, y: shade.y }
    expect(isWalkable(town, shade), '笠の裏のマスは歩ける').toBe(true)
    expect(isWalkable(town, pole), '柱のマスは通れない').toBe(false)
    expect(isWalkable(town, beside), '笠の裏の右隣は歩ける').toBe(true)
    await openAt({ worldId: town.id, cell: beside, facing: 'left' })
    const veil = worldLayer().querySelector('[data-village-veil]')
    if (veil === null) throw new Error('街灯の重ねの層が無い')
    const slots = Array.from(veil.children)
    expect(slots.length, '街灯 1 本ぶん(2 マス)の席').toBe(2)
    expect(slots.filter(isPainted), '前提: 笠の裏の隣では街灯を重ねない').toEqual([])

    expect(await walk(setId, 'ArrowLeft', 1), '笠の裏のマスへ 1 マス歩く').toBe(1)
    expect(readCell(setId)).toEqual({ worldId: town.id, cell: shade })
    const drawn = slots.map(slot => ({
      painted: isPainted(slot),
      // 席は 1 マスの絵で、マスの左上に置く。箱の真ん中がそのマスの真ん中に来る
      near: (cell: Cell) => gapTo(slot, cell) <= 1,
      sprite: slot instanceof HTMLElement ? slot.style.getPropertyValue('--i') : '',
    }))
    expect(
      drawn.map(slot => slot.painted),
      '笠の裏に立つと 2 マスとも重ねる'
    ).toEqual([true, true])
    expect(drawn[0].near(shade), '1 つ目の席は笠と灯のマス').toBe(true)
    expect(drawn[1].near(pole), '2 つ目の席は柱のマス').toBe(true)
    expect(
      drawn.map(slot => slot.sprite),
      '席の絵はシートの街灯の上と下'
    ).toEqual([
      String(villageJa.sprites.index['lamp-t']),
      String(villageJa.sprites.index['lamp-b']),
    ])
    // 重ねる絵は半透明。笠の向こうの主人公が透けて見える
    expect(Number(getComputedStyle(slots[0]).opacity), '重ねた街灯は半透明').toBeLessThan(1)

    expect(await walk(setId, 'ArrowRight', 1), '笠の裏から右隣へ戻る').toBe(1)
    expect(readCell(setId)).toEqual({ worldId: town.id, cell: beside })
    expect(slots.filter(isPainted), '離れると街灯の重ねを消す').toEqual([])
  })

  test('話せる相手がいない所で話しかけて出た考え事の吹き出しは、消えるまでの間に歩いても主人公の頭上に付いて回る', async () => {
    await openAt({ worldId: room.id, cell: { x: 4, y: 5 }, facing: 'down' })
    const right = { x: 5, y: 5 }
    expect(isWalkable(room, right), '前提: 開始の 1 マス下の右隣は床').toBe(true)
    const thought = () =>
      Array.from(document.querySelectorAll('[data-village-bubble-kind="thought"]')).find(bubble =>
        (bubble.textContent ?? '').includes(text.noTarget)
      ) ?? null
    await userEvent.keyboard('e')
    await expect.poll(thought, { message: '話せる相手がいない時の考え事' }).not.toBeNull()
    // 吹き出しと主人公の箱の左端どうしの差(px)。付いて回るなら、歩いても変わらない
    const offset = () => {
      const bubble = thought()
      if (bubble === null) throw new Error('考え事の吹き出しが消えた')
      return bubble.getBoundingClientRect().x - villagePlayer().getBoundingClientRect().x
    }
    const before = { offset: offset(), x: thought()?.getBoundingClientRect().x ?? 0 }
    expect(await walk(setId, 'ArrowRight', 1), '右へ 1 マス歩く').toBe(1)
    await expectLoopIdle()
    const bubble = thought()
    expect(bubble, '歩いた後も、消えるまでは考え事が出ている').not.toBeNull()
    const { cell } = playerOnScreen()
    expect(
      (bubble?.getBoundingClientRect().x ?? 0) - before.x,
      '吹き出しは主人公と一緒に 1 マス右へ動く(px)'
    ).toBeCloseTo(cell, 0)
    expect(offset(), '主人公の頭上からずれない(px)').toBeCloseTo(before.offset, 0)
  })

  test('起動して最初のフレームが来る前に会話窓を開いても、主人公は保存したマスに立ったまま描かれ、閉じた後に向きを描き直す', async () => {
    // 左向きの絵は右向きを反転して描く。最初のフレームより前に反転だけを書くと位置が抜け、ワールドの左上へ飛ぶ
    const home = room.spots.find(spot => spot.id === 'home')
    if (home === undefined) throw new Error('自室に自宅の地点が無い')
    await renderAt({ worldId: room.id, cell: home.cell, facing: 'left' })
    expect(loopState(), '前提: 歩行ループは最初のフレームを待っている').toBe('running')
    // キー操作は起動の覆いに関わらず、焦点のある枠へ届く
    villageFrame().focus()
    await userEvent.keyboard('e')
    await expect.element(dialog.getByRole('heading', { name: text.stops.home.title })).toBeVisible()
    await runFrames(3)
    expect(loopState(), '会話窓が開いている間の最初のフレームの後は眠る').toBe('idle')
    const opened = playerOnScreen()
    expect(
      { x: Math.round(opened.x), y: Math.round(opened.y) },
      '会話窓が開いている間も、主人公は保存したマスに立つ'
    ).toEqual(home.cell)
    await userEvent.keyboard('x')
    await expect.element(dialog).not.toBeInTheDocument()
    await expectLoopIdle()
    const closed = playerOnScreen()
    expect(
      { x: Math.round(closed.x), y: Math.round(closed.y) },
      '閉じた後も同じマスに立つ'
    ).toEqual(home.cell)
    expect(villagePlayer().style.transform, '閉じた後に保存した左向き(反転)で描き直す').toMatch(
      / scaleX\(-1\)$/
    )
  })

  test('開始の向きが左のワールドから始めると、最初のフレームより前から主人公を左向き(右向きの絵の反転)で開始マスに描く', async () => {
    // 実際のコンテンツの開始の向きは上(自室)と下(町)なので、自室の開始の向きだけを左へ替えた版を渡す
    const worldSet = {
      ...villageJa.worldSet,
      worlds: { ...villageJa.worldSet.worlds, room: { ...room, startFacing: 'left' as const } },
    }
    await page.viewport(1280, 720)
    render(<VillagePageContainer {...villageJa} worldSet={worldSet} />)
    expect(loopState(), '前提: 歩行ループは最初のフレームを待っている').toBe('running')
    expect(villagePlayer().dataset.sprite, '最初のフレームより前から右向きの絵').toBe(
      'player-right-0'
    )
    expect(villagePlayer().style.transform, '最初のフレームより前から反転して描く').toMatch(
      / scaleX\(-1\)$/
    )
    const before = playerOnScreen()
    expect({ x: Math.round(before.x), y: Math.round(before.y) }, '開始マスに描く').toEqual(
      room.start
    )
    await focusVillage()
    await expectLoopIdle()
    expect(villagePlayer().style.transform, '歩行ループが描いた後も左向き').toMatch(
      / scaleX\(-1\)$/
    )
    const after = playerOnScreen()
    expect({ x: Math.round(after.x), y: Math.round(after.y) }, '開始マスのまま').toEqual(room.start)
  })
})

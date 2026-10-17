// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { page } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import { userEvent } from 'vitest/browser'
import type { Cell, Direction, Spot, World, WorldSet } from '@content/types/world'
import { readVisited, writePosition, writeVisited } from '@/lib/preferences'
import { isWalkable } from '@/lib/village/collision'
import { objectSpotAt } from '@/lib/village/spot'
import { CLOCK_FOCUSABLE_SELECTOR, STOP_FOCUSABLE_SELECTOR } from '@/utils/focusables'
import {
  FRAME_MS,
  SETTLE_MS,
  advanceUntil,
  cellCenter,
  click,
  expectLoopIdle,
  focusIndex,
  focusVillage,
  leaveRoom,
  loopState,
  mouse,
  playerOnScreen,
  readCell,
  runFor,
  tapHeld,
  villageFrame,
  walk,
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

// ---- 歩く・待つ・釣り・傘・飛ぶ ----
// E2E が見ていた歩行ループの眠りと目覚め・池での釣り・雨の日の傘・自動移動の直線飛行を、E2E からこの統合テストへ移したもの
// (ADR 0016 の「統合へ移す」)と、
// それが通らないフックの分岐を確かめる検査(各 describe の末尾と「村の入力と道中の配線」)。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date。E2E の page.clock と同じく時間として替える)で止め、
// テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)、スティックと舞台を押すのは CDP の Input で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('歩く・待つ・釣り・傘・飛ぶ', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa

  // 描いて、起動の覆いが外れたら枠へ焦点を置く(E2E の openVillage)。既定は E2E と同じ PC の 1280×720
  const openVillage = async (width = 1280, height = 720) => {
    await page.viewport(width, height)
    render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
  }

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

  // E2E を移した上の検査が通らないフックの分岐を、利用者に見える振る舞いで確かめる
  // (保存の復元・地図の開け閉めと地形からの移動・押したまま動かす指・物を押して話しかける・
  // スティックでの本文送り・天気の問い合わせの中断・会話窓のキー・コースの完走)
  describe('村の入力と道中の配線', () => {
    const room = villageJa.worldSet.worlds.room
    const town = villageJa.worldSet.worlds.town
    const dialog = page.getByRole('dialog')
    const speech = () => page.getByRole('status').element().textContent ?? ''
    const sameCell = (goal: { worldId: string; cell: Cell }) => () =>
      JSON.stringify(readCell(setId)) === JSON.stringify(goal)

    test('描き直した村は保存した位置から始め、読めない保存(知らないワールド・歩けないマス)は捨てて開始地点から始める', async () => {
      await openVillage()
      expect(await walk(setId, 'ArrowDown', 1)).toBe(1)
      expect(readCell(setId)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
      // 村を離れて戻る(作品ページから戻った時と同じく、同じ読み込みの中で描き直す)
      cleanup()
      render(<VillagePageContainer {...villageJa} />)
      await focusVillage()
      await expectLoopIdle()
      // 部屋は枠に収まりカメラは動かないので、描かれた位置がそのままマス
      expect(playerOnScreen().x).toBeCloseTo(4, 1)
      expect(playerOnScreen().y, '保存した (4,5) から始める').toBeCloseTo(5, 1)
      const wall = { x: 0, y: 0 }
      expect(isWalkable(room, wall), '部屋の左上の角は歩けない').toBe(false)
      const unreadable = [
        { worldId: 'nowhere', cell: { x: 4, y: 5 }, facing: 'down' },
        { worldId: 'room', cell: wall, facing: 'down' },
      ] as const
      for (const saved of unreadable) {
        cleanup()
        writePosition(setId, saved)
        render(<VillagePageContainer {...villageJa} />)
        await focusVillage()
        await expectLoopIdle()
        const where = `${saved.worldId} (${saved.cell.x},${saved.cell.y})`
        expect(playerOnScreen().y, `${where} の保存は捨てて開始地点 (4,4) から`).toBeCloseTo(4, 1)
      }
    })

    test('地図は屋内では M を押しても開かず、町では地図の中で M をもう一度押すと閉じる', async () => {
      await openVillage()
      await userEvent.keyboard('m')
      await runFor(FRAME_MS * 2)
      expect(dialog.query(), '自室では地図を開かない').toBeNull()
      expect(await leaveRoom(setId)).toBe(3)
      await userEvent.keyboard('m')
      await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
      await userEvent.keyboard('m')
      await expect.element(dialog).not.toBeInTheDocument()
      // 閉じた後は錠が外れて歩ける
      expect(await walk(setId, 'ArrowRight', 1)).toBe(1)
    })

    test('地図で今立っている地点を選ぶとその場で着いたことにし、地形のマスを押すと地点でなくても向かう', async () => {
      const monument = town.spots.find(spot => spot.id === 'monument')
      if (monument === undefined) throw new Error('町に経歴碑の地点が無い')
      const place = text.stops.monument.place
      const spotButton = () =>
        dialog.getByRole('button', { name: text.fastTravel.replace('{place}', place) })
      const atMonument = { worldId: town.id, cell: monument.cell }
      await openVillage()
      expect(await leaveRoom(setId)).toBe(3)
      await userEvent.keyboard('m')
      await spotButton().click()
      await advanceUntil(sameCell(atMonument), '経歴碑へ着く', 10_000)
      await expectLoopIdle()
      // 今立っている地点をもう一度選ぶ。地図を閉じ、歩きも飛びもせずにその場に立つ
      await userEvent.keyboard('m')
      await spotButton().click()
      await expect.element(dialog).not.toBeInTheDocument()
      await runFor(FRAME_MS * 4)
      expect(loopState(), '動かない').toBe('idle')
      expect(readCell(setId)).toEqual(atMonument)
      // 地図の地形のうち、地点でも扉でもない歩けるマスを押す。経歴碑の前から 3 マス離れた所を選ぶ
      const target = [
        { x: 3, y: 0 },
        { x: -3, y: 0 },
        { x: 0, y: 3 },
        { x: 0, y: -3 },
      ]
        .map(d => ({ x: monument.cell.x + d.x, y: monument.cell.y + d.y }))
        .find(
          cell =>
            isWalkable(town, cell) &&
            !town.spots.some(s => s.cell.x === cell.x && s.cell.y === cell.y) &&
            !town.warps.some(w => w.cell.x === cell.x && w.cell.y === cell.y)
        )
      if (target === undefined) throw new Error('経歴碑の前から 3 マス先に歩ける地形が無い')
      const before = speech()
      await userEvent.keyboard('m')
      await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
      const canvas = [...dialog.element().querySelectorAll<HTMLElement>('div')].find(
        element => element.style.getPropertyValue('--map-w') !== ''
      )
      if (canvas === undefined) throw new Error('地図の地形が無い')
      const box = canvas.getBoundingClientRect()
      await page.elementLocator(canvas).click({
        position: {
          x: ((target.x + 0.5) / town.width) * box.width,
          y: ((target.y + 0.5) / town.height) * box.height,
        },
      })
      await expect.element(dialog).not.toBeInTheDocument()
      await advanceUntil(
        sameCell({ worldId: town.id, cell: target }),
        '押した地形のマスへ着く',
        10_000
      )
      // 地点でない所へは地点名を言えないので、行き先の案内は出さない
      expect(speech(), '案内文は押す前のまま').toBe(before)
    }, 30_000)

    test('舞台を押したまま指先を別のマスへ動かすと、行き先を指先のマスへ移してそこへ着く', async () => {
      await openVillage()
      expect(await leaveRoom(setId)).toBe(3)
      await expectLoopIdle()
      // 自宅前 (14,12) から右へは横道が続く
      const first = { x: 16, y: 12 }
      const second = { x: 17, y: 12 }
      expect(isWalkable(town, first) && isWalkable(town, second), '自宅前の右の道').toBe(true)
      const from = cellCenter(first)
      await mouse.move(from.x, from.y, false)
      await mouse.down(from.x, from.y)
      await runFor(FRAME_MS * 2)
      // 押している指先は同じマスの中でも少し揺れる。揺れてもそのまま押し続ける
      await mouse.move(from.x + 2, from.y + 2, true)
      await runFor(FRAME_MS * 2)
      const to = cellCenter(second)
      await mouse.move(to.x, to.y, true)
      await advanceUntil(sameCell({ worldId: town.id, cell: second }), '指先のマスへ着く')
      await mouse.up(to.x, to.y)
      await expectLoopIdle()
      expect(readCell(setId)).toEqual({ worldId: town.id, cell: second })
    })

    test('自室で机を押すと、もう話しかけられるマスに立っていれば歩かずに会話窓を開く', async () => {
      await openVillage()
      await expectLoopIdle()
      const home = room.spots.find(spot => spot.id === 'home')
      if (home === undefined) throw new Error('自室に自宅の地点が無い')
      // 対照: 歩いて届かず地点の物でもないマス(部屋の左上の角の壁)を押しても、歩きも話しもしない
      const wall = { x: 0, y: 0 }
      expect(isWalkable(room, wall) || objectSpotAt(room, wall) !== null).toBe(false)
      const corner = cellCenter(wall)
      await click(corner.x, corner.y)
      await runFor(SETTLE_MS)
      expect(dialog.query(), '壁を押しても窓は開かない').toBeNull()
      expect(readCell(setId), '壁を押しても歩かない').toBeNull()
      // 開始地点は自宅の地点の立ち位置で、上を向いた先の 1 マスが机
      const desk = { x: home.cell.x, y: home.cell.y - 1 }
      expect(objectSpotAt(room, desk)?.id, '上の 1 マスは自宅の地点の物').toBe('home')
      const point = cellCenter(desk)
      await click(point.x, point.y)
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }))
        .toBeVisible()
      expect(readCell(setId), '歩いていない').toBeNull()
    })

    test('話せる相手がいない所で話しかけた時の一言は、2.5 秒経つと消える', async () => {
      await openVillage()
      // 開始地点 (4,4) から 1 マス下は地点の立ち位置ではない
      expect(await walk(setId, 'ArrowDown', 1)).toBe(1)
      const hint = () =>
        [...document.querySelectorAll('[data-village-bubble-kind="thought"]')].find(bubble =>
          (bubble.textContent ?? '').includes(text.noTarget)
        ) ?? null
      await userEvent.keyboard('e')
      await expect.poll(hint, { message: '話せる相手がいない時の一言' }).not.toBeNull()
      await runFor(2_400)
      expect(hint(), '2.5 秒より前は出ている').not.toBeNull()
      await runFor(FRAME_MS * 8)
      expect(hint(), '2.5 秒経つと消える').toBeNull()
    })

    test('会話窓が開いている間は方向キー以外のキーでは閉じず、X で閉じる', async () => {
      await openVillage()
      await userEvent.keyboard('e')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }))
        .toBeVisible()
      await userEvent.keyboard('q')
      await runFor(FRAME_MS * 2)
      expect(dialog.query(), 'Q では閉じない').not.toBeNull()
      await userEvent.keyboard('x')
      await expect.element(dialog).not.toBeInTheDocument()
    })

    test('天気が届く前に村を離れると、天気の問い合わせを中断する', async () => {
      const signals: (AbortSignal | null | undefined)[] = []
      vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
        signals.push(init?.signal)
        return Response.json({ current: { precipitation: 2.4, snowfall: 0 } })
      })
      await page.viewport(1280, 720)
      render(<VillagePageContainer {...villageJa} />)
      expect(signals.length, '描いた時に天気を問い合わせる').toBe(1)
      cleanup()
      expect(signals[0]?.aborted, '離れた時に問い合わせを中断する').toBe(true)
      // 中断した後に届いた応答は使わない(描く先の無い村の状態を書き換えない)
      await runFor(FRAME_MS * 2)
    })

    test('コースの全地点で話して最後の会話窓を閉じると、案内が一覧への誘いに替わり、一覧への出口へ焦点が移る', async () => {
      // コースの地点(order を持つ地点)を巡る順に並べる
      const course = Object.values(villageJa.worldSet.worlds)
        .flatMap(world => world.spots)
        .filter(spot => spot.order !== undefined)
        .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
      const titleOf = (id: string) => text.stops[id]?.title ?? id
      const headingShown = (id: string) => () =>
        dialog.getByRole('heading', { name: titleOf(id) }).query() !== null
      await openVillage()
      // 同じ地点で 2 回話しても訪問は 1 回に数える(完走の判定がずれない)
      await userEvent.keyboard('e')
      await expect.element(dialog.getByRole('heading', { name: titleOf('home') })).toBeVisible()
      await dialog.getByRole('button', { name: text.close }).click()
      await expect.element(dialog).not.toBeInTheDocument()
      await userEvent.keyboard('e')
      await expect.element(dialog.getByRole('heading', { name: titleOf('home') })).toBeVisible()
      // 次へで残りの地点を順に巡る
      for (const [index, spot] of course.slice(0, -1).entries()) {
        const next = course[index + 1]
        await dialog.getByRole('button', { name: text.stops[spot.id]?.next ?? spot.id }).click()
        await advanceUntil(headingShown(next.id), `${next.id} の会話窓が開く`, 10_000)
      }
      const allSeen = text.allSeen.replaceAll('{list}', () => text.toList)
      expect(speech(), '最後の会話窓を閉じるまでは完走の案内を出さない').not.toBe(allSeen)
      await dialog.getByRole('button', { name: text.close }).click()
      await expect.element(dialog).not.toBeInTheDocument()
      await runFor(FRAME_MS * 2)
      expect(speech()).toBe(allSeen)
      const exit = document.querySelector<HTMLElement>('[data-village-exit]')
      expect(document.activeElement, '一覧への出口へ焦点が移る').toBe(exit)
      expect(exit?.hasAttribute('data-bounce'), '出口が跳ねる').toBe(true)
    }, 60_000)

    // ---- ここから下は、ほかの検査が通らない村のフックの分岐を、画面の操作で通す ----

    // 地点の並びを差し替えた版の村。実際のコンテンツでは作れない配置(次の地点が同じマス・歩いて届かない地点・地点の無い町)を作る
    const withSpots = (
      worldId: 'room' | 'town',
      edit: (spots: readonly Spot[]) => Spot[]
    ): WorldSet => {
      const { worlds } = villageJa.worldSet
      return {
        ...villageJa.worldSet,
        worlds: {
          ...worlds,
          [worldId]: { ...worlds[worldId], spots: edit(worlds[worldId].spots) },
        },
      }
    }
    const moveSpot = (spots: readonly Spot[], id: string, cell: Cell): Spot[] =>
      spots.map(spot => (spot.id === id ? { ...spot, cell } : spot))
    const spotOf = (world: World, id: string): Spot => {
      const spot = world.spots.find(candidate => candidate.id === id)
      if (spot === undefined) throw new Error(`${world.id} に ${id} の地点が無い`)
      return spot
    }
    // 保存した位置から村を描く。読み込み直後の最初の描画は保存を捨てるので、先に一度描いて外してから保存を置く
    // (このテストだけを走らせた時も同じ所から始めるため)
    const openAt = async (
      saved: { worldId: string; cell: Cell; facing: Direction },
      worldSet: WorldSet = villageJa.worldSet
    ) => {
      await page.viewport(1280, 720)
      render(<VillagePageContainer {...villageJa} />)
      cleanup()
      writePosition(setId, saved)
      render(<VillagePageContainer {...villageJa} worldSet={worldSet} />)
      await focusVillage()
      await expectLoopIdle()
    }

    test('会話窓で下を押したまま閉じて開き直すと、本文が窓に収まっていても押し直すまで焦点を操作へ渡さない', async () => {
      await openVillage()
      const title = dialog.getByRole('heading', { name: text.stops.home.title })
      await userEvent.keyboard('e')
      await expect.element(title).toHaveFocus()
      const panel = dialog.element().querySelector('[data-village-panel]')
      if (panel === null) throw new Error('会話窓の本文が無い')
      expect(panel.scrollHeight, '本文が窓に収まっている(送る余地が無い)').toBeLessThanOrEqual(
        panel.clientHeight
      )
      const firstAction = () => dialog.element().querySelector(STOP_FOCUSABLE_SELECTOR)
      // 収まっているので、下を押した瞬間に先頭の操作へ渡る
      await userEvent.keyboard('{ArrowDown>}')
      await advanceUntil(
        () => document.activeElement === firstAction(),
        '押した瞬間に先頭の操作へ渡る'
      )
      // 下を押したまま X で閉じ、E で開き直す
      await userEvent.keyboard('x')
      await expect.element(dialog).not.toBeInTheDocument()
      await userEvent.keyboard('e')
      await expect.element(title).toHaveFocus()
      await runFor(FRAME_MS * 10)
      expect(document.activeElement, '開く前から押していた下では見出しに留まる').toBe(
        title.element()
      )
      // 離したのを 1 フレームで読ませてから押し直すと渡る
      await userEvent.keyboard('{/ArrowDown}')
      await runFor(FRAME_MS * 2)
      await tapHeld('ArrowDown')
      await advanceUntil(
        () => document.activeElement === firstAction(),
        '押し直すと先頭の操作へ渡る'
      )
    })

    test('池で舞台を押したまま釣り始め、釣っている間に指先を別のマスへ動かしても、やめた後はその場に留まる', async () => {
      const pond = spotOf(town, 'pond')
      await openAt({ worldId: town.id, cell: pond.cell, facing: pond.facing })
      // 立っているマスを押したままにする(行き先が今のマスなので歩き出さない)
      const here = cellCenter(pond.cell)
      await mouse.move(here.x, here.y, false)
      await mouse.down(here.x, here.y)
      await runFor(FRAME_MS * 2)
      // 釣り始める。釣りの間は窓を出さないので、焦点は枠に残り、押している指も外れない
      await userEvent.keyboard('e')
      await advanceUntil(() => speech() === text.fishing.cast, '投げ始める')
      // 釣っている間に、押したままの指先を歩いて行けるマスへ動かす
      const elsewhere = { x: 8, y: 13 }
      expect(isWalkable(town, elsewhere), '動かした先は歩いて行ける').toBe(true)
      const there = cellCenter(elsewhere)
      await mouse.move(there.x, there.y, true)
      await runFor(FRAME_MS * 4)
      // やめる。釣っている間の指先の動きは読まないので、行き先は押した時のマス(今のマス)のまま
      await userEvent.keyboard('x')
      await runFor(SETTLE_MS * 2)
      expect(readCell(setId), '釣っている間に動かした指先のマスへは歩かない').toEqual({
        worldId: town.id,
        cell: pond.cell,
      })
      await mouse.up(there.x, there.y)
      await expectLoopIdle()
    })

    // タブの切り替えはヘッドレスの Chromium では起こせない(CDP にページの見え方を変える命令が無い)。
    // ブラウザの環境の設定として document の visibilityState を隠れた値に差し替え、ブラウザと同じく visibilitychange を送る
    test('方向キーを押したままタブが隠れると、離した知らせが届かなくても歩くのを止め、見えている間の知らせでは止めない', async () => {
      await openVillage()
      await expectLoopIdle()
      const column = () => readCell(setId)?.cell.x ?? 4
      // 開始地点 (4,4) の行は右の壁際 (9,4) まで床
      await userEvent.keyboard('{ArrowRight>}')
      await advanceUntil(() => column() === 5, '右へ歩き出す')
      // 見えている間の知らせ(タブが見えるようになった時と同じ)では止めない。知らせた時に歩きかけていた 1 マス(6)の
      // 先まで歩き続ける
      document.dispatchEvent(new Event('visibilitychange'))
      await advanceUntil(() => column() === 7, '見えている間は歩き続ける')
      // タブが隠れる。離した知らせ(keyup)は届かず、キーは押されたまま
      const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      hidden.mockRestore()
      // 歩きかけの 1 マスは最後まで進み、そこで止まって眠る
      await expectLoopIdle()
      const stopped = column()
      await runFor(SETTLE_MS * 2)
      expect(column(), '隠れた後は歩かない').toBe(stopped)
      expect(stopped, '右の壁際より手前で止まる').toBeLessThan(9)
      await userEvent.keyboard('{/ArrowRight}')
    })

    test('地点の無い町では地図を開いても焦点が枠に残り、枠で M をもう一度押すと閉じる', async () => {
      // 実際のコンテンツには地点の無い町が無いので、町の地点と自室のコースの地点を外した版を渡す(地図に印が 1 つも並ばない)
      const bare = withSpots('town', () => [])
      const worldSet = {
        ...bare,
        worlds: {
          ...bare.worlds,
          room: { ...room, spots: room.spots.filter(spot => spot.order === undefined) },
        },
      }
      await page.viewport(1280, 720)
      render(<VillagePageContainer {...villageJa} worldSet={worldSet} />)
      await focusVillage()
      expect(await leaveRoom(setId)).toBe(3)
      await userEvent.keyboard('m')
      await expect.element(dialog.getByRole('heading', { name: text.mapTitle })).toBeVisible()
      expect(
        dialog.element().querySelectorAll('[data-spot-id]').length,
        '地図に地点の印が無い'
      ).toBe(0)
      await runFor(FRAME_MS * 2)
      expect(document.activeElement, '焦点を置く地点が無いので枠に残る').toBe(villageFrame())
      await userEvent.keyboard('m')
      await expect.element(dialog).not.toBeInTheDocument()
    })

    test('次の地点にもう立っている時の「次へ」は、歩かずにその場で次の地点へ話しかけ、訪れたことにする', async () => {
      // 実際のコンテンツでは地点どうしの立ち位置が重ならないので、研究所の立ち位置を名刺工房と同じマスへ動かした版を渡す
      const meishi = spotOf(town, 'meishi')
      const worldSet = withSpots('town', spots => moveSpot(spots, 'lab', meishi.cell))
      await openAt({ worldId: town.id, cell: meishi.cell, facing: meishi.facing }, worldSet)
      await userEvent.keyboard('e')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.meishi.title }))
        .toBeVisible()
      expect(readVisited(setId), '前提: 研究所はまだ訪れていない').not.toContain('lab')
      await dialog.getByRole('button', { name: text.stops.meishi.next }).click()
      // 同じマスに立つ研究所へ話しかける。会話窓は閉じずに開いたまま、研究所を訪れたことに数える
      await expect
        .poll(() => readVisited(setId), { message: '研究所を訪れたことにする' })
        .toContain('lab')
      expect(document.querySelector('[role="dialog"]'), '会話窓は開いたまま').not.toBeNull()
      await runFor(SETTLE_MS)
      expect(readCell(setId), '歩いていない').toEqual({ worldId: town.id, cell: meishi.cell })
      expect(loopState(), '歩行ループは眠ったまま').toBe('idle')
    })

    test('コースの最後の会話窓を閉じた直後に村を離れても、一覧への出口へ焦点を移す処理は外れた後に何もしない', async () => {
      // 自室の地点のほかは話し終えた状態から始める(読み込み直後の最初の描画は保存を捨てるので、一度描いて外してから置く)
      const others = Object.values(villageJa.worldSet.worlds)
        .flatMap(world => world.spots)
        .filter(spot => spot.order !== undefined && spot.id !== 'home')
        .map(spot => spot.id)
      await page.viewport(1280, 720)
      render(<VillagePageContainer {...villageJa} />)
      cleanup()
      writeVisited(setId, others)
      await openVillage()
      await userEvent.keyboard('e')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }))
        .toBeVisible()
      await dialog.getByRole('button', { name: text.close }).click()
      await expect.element(dialog).not.toBeInTheDocument()
      // 閉じた時点で完走の案内に替わり、出口へ焦点を移すのは次のフレーム。その前に村を離れる
      expect(speech()).toBe(text.allSeen.replaceAll('{list}', () => text.toList))
      cleanup()
      await runFor(FRAME_MS * 2)
      expect(document.querySelector('[data-village-exit]'), '出口はもう無い').toBeNull()
      expect(document.activeElement, '焦点はどこへも移さない').toBe(document.body)
    })

    // 村を外した commit の中で、外した部品の後片付けの effect より前に時計を ms 進める。ページを移って村を外すと、
    // ref は commit の中で外れ、押しっぱなしのループを止める後片付けは commit の後に回るので、その間にフレームが来うる。
    // フレームの中で投げた物は errors へ集める(投げると、ページを移る時に外れた窓を触って落ちたことになる)
    function AdvanceAfterLeaving({ ms, errors }: { ms: number; errors: string[] }) {
      useLayoutEffect(() => {
        try {
          vi.advanceTimersByTime(ms)
        } catch (error) {
          errors.push(String(error))
        }
      }, [ms, errors])
      return null
    }

    test('会話窓で下を押したまま村を離れ、後片付けより先にフレームが来ても、本文送りは外れた窓を触らない', async () => {
      await page.viewport(1280, 720)
      const view = render(<VillagePageContainer {...villageJa} />)
      await focusVillage()
      await userEvent.keyboard('e')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }))
        .toHaveFocus()
      // 下を押したままにする。押している間は本文送りのループが毎フレーム回る
      await userEvent.keyboard('{ArrowDown>}')
      await runFor(FRAME_MS * 2)
      const errors: string[] = []
      view.rerender(<AdvanceAfterLeaving ms={FRAME_MS} errors={errors} />)
      expect(errors, '外れた後のフレームで投げない').toEqual([])
      expect(document.querySelector('[role="dialog"]'), '窓はもう無い').toBeNull()
      await userEvent.keyboard('{/ArrowDown}')
    })

    test('卓上時計の窓で下(S)を押したまま村を離れ、後片付けより先に繰り返しの時刻が来ても、外れた窓の焦点を動かさない', async () => {
      // 1 段目でスティック・WASD を倒し続けた時に、焦点を次のボタンへ移し直す間隔(ClockModal/utils/step-clock-time.ts の CHOOSE_REPEAT_MS)
      const CHOOSE_REPEAT_MS = 300
      await page.viewport(1280, 720)
      const view = render(<VillagePageContainer {...villageJa} />)
      await focusVillage()
      // 部屋の開始マス (4,4) から時計の前 (7,3) へ
      expect(await walk(setId, 'ArrowRight', 3), '時計と同じ列まで歩けた').toBe(3)
      expect(await walk(setId, 'ArrowUp', 1), '時計の前まで歩けた').toBe(1)
      await userEvent.keyboard('e')
      const clockWindow = page.getByRole('dialog', { name: text.clock.place })
      await expect.element(clockWindow).toHaveAttribute('data-step', 'choose')
      await expect.element(clockWindow.getByRole('button').first()).toHaveFocus()
      // S を押したままにする。窓は矢印だけを自分で受け、S は枠が押しっぱなしの向き(下)として読む
      await userEvent.keyboard('{s>}')
      await advanceUntil(
        () => focusIndex(clockWindow.element(), CLOCK_FOCUSABLE_SELECTOR) === 1,
        '押した瞬間に次のボタンへ移る'
      )
      const errors: string[] = []
      // 押し続けた時の次の 1 つの時刻を過ぎるまで進める
      view.rerender(<AdvanceAfterLeaving ms={CHOOSE_REPEAT_MS + FRAME_MS} errors={errors} />)
      expect(errors, '外れた後のフレームで投げない').toEqual([])
      expect(document.querySelector('[role="dialog"]'), '窓はもう無い').toBeNull()
      await userEvent.keyboard('{/s}')
    })

    test('描いた直後、枠の幅の最初の知らせが届く前に村を離れ、後片付けより先に最初のフレームが来ても、歩行ループは外れた枠を読まない', async () => {
      await page.viewport(1280, 720)
      // 描いてから離れるまで await を挟まず、同じタスクの中で済ませる。枠の幅を覚える ResizeObserver の知らせは
      // 本物の描画の段で届くので、その間には届かず、歩行ループの最初のフレームは枠そのものの幅を読みに行く
      const view = render(<VillagePageContainer {...villageJa} />)
      // 描いた時に頼んだ最初のフレームは、偽の時計を 1 度も進めていないのでまだ来ていない
      expect(loopState(), '前提: 最初のフレームを頼んで待っている').toBe('running')
      const errors: string[] = []
      // 偽の rAF は時計を入れた時の本物の時刻から 16ms 刻みで来る。日付を本物の今日より前(昼の瞬間)へ戻して止めているので、
      // 最初のフレームは 16ms 以上 32ms 未満の先になる。2 フレーム分進めて、最初のフレームを必ず来させる
      view.rerender(<AdvanceAfterLeaving ms={FRAME_MS * 2} errors={errors} />)
      expect(errors, '外れた後のフレームで投げない').toEqual([])
      expect(document.querySelector('[data-village]'), '村はもう無い').toBeNull()
    })
  })
})

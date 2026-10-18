// 村の統合テストのうち自動移動の直線飛行を見るもの(flight-*.integration.test.tsx)が共有する、村の配置と地図で移る手順。
// 描く道具(@testing-library/react)は import しない(npm run test:boundary)ので、村を描く手(openVillage)と
// それを使う手(goToTown など)は各ファイルの describe に置く
import { page, userEvent } from 'vitest/browser'
import type { Cell, World } from '@content/types/world'
import {
  advanceUntil,
  expectLoopIdle,
  readCell,
  villagePlayer,
  walk,
} from './village-walk.test-helper'
import {
  startRecording,
  stopRecording,
  type Recording,
  type Saved,
} from './village-walk-flight.test-helper'
import { villageJa } from './village.test-helper'

const setId = villageJa.worldSet.id
const { text } = villageJa

// 自動移動が着くまでの上限(偽の時計の ms)。町を横切って飛んでも、扉を通って別ワールドの地点へ移っても収まる
export const ARRIVE_MS = 10_000
// 影の位置が、出発と着地を結ぶ線分から外れてよい距離(マス)
export const LINE_TOLERANCE = 0.15

// ---- 村のデータ(content/world.ts の配置から引く) ----
const { worldSet } = villageJa
const worldOf = (id: string): World => {
  const world = worldSet.worlds[id]
  if (world === undefined) throw new Error(`worldSet に ${id} が無い`)
  return world
}
export const town = worldOf('town')
export const room = worldOf('room')
const spotCell = (world: World, id: string): Cell => {
  const spot = world.spots.find(s => s.id === id)
  if (spot === undefined) throw new Error(`${world.id} に地点 ${id} が無い`)
  return spot.cell
}
// 部屋の出口のマットと、そこから出た町の自宅前(飛ぶテストはここから飛び立つ)
const exitWarp = room.warps.find(w => w.target.worldId === town.id)
if (exitWarp === undefined) throw new Error('部屋に町へ出るマットが無い')
export const EXIT_MAT = exitWarp.cell
export const TOWN_ENTRY = exitWarp.target.cell
// 町の自宅の扉(壁の扉。通れないマス)と、ぶつかった時に戻る部屋の出口手前
const doorWarp = town.warps.find(w => w.target.worldId === room.id)
if (doorWarp === undefined) throw new Error('町に部屋へ戻る扉が無い')
export const HOME_DOOR = doorWarp.cell
export const ROOM_ENTRY = doorWarp.target.cell
// 地点の立ち位置。経歴碑は自宅前から真上寄りで、直線は自宅の屋根と壁の上を通る。
// 研究所は自宅前から右上で、横の差の方が大きい。名刺工房 → 研究所は次へで巡る順
export const MONUMENT = spotCell(town, 'monument')
export const LAB = spotCell(town, 'lab')
export const MEISHI = spotCell(town, 'meishi')
export const MAILBOX = spotCell(town, 'mailbox')
export const PC = spotCell(room, 'home')
// 町で最も上(y が最小)の地点。北の道の突き当たりにあり、カメラは町の上端で止まる
export const TOP_SPOT = town.spots.reduce((top, spot) => (spot.cell.y < top.cell.y ? spot : top))
export const placeOf = (id: string) => {
  const stop = text.stops[id]
  if (stop === undefined) throw new Error(`地点 ${id} の文言が無い`)
  return stop.place
}

// ---- 村の操作 ----

export const shadowEl = () => document.querySelector<HTMLElement>('[data-flight-shadow]')
export const flyingNow = () => shadowEl()?.dataset.flying
export const sprite = () => villagePlayer().dataset.sprite
export const sameSaved = (goal: Saved) => () =>
  JSON.stringify(readCell(setId)) === JSON.stringify(goal)
export const map = page.getByRole('dialog')

// 部屋の出口のマットまで歩いて町の自宅前へ出る。村を描いて枠へ焦点を置いた後に呼ぶ
export const walkOutToTown = async () => {
  expect(await walk(setId, 'ArrowDown', 3), '部屋の出口のマットまで歩いて町へ出る').toBe(3)
  expect(readCell(setId)).toEqual({ worldId: town.id, cell: TOWN_ENTRY })
}

export const openMap = async () => {
  await userEvent.keyboard('m')
  await expect.element(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
}

// 地図の地点の印。読み上げ名は text.fastTravel の {place} を地点名に置き換えたもの
export const spotButton = (place: string) =>
  map.getByRole('button', { name: text.fastTravel.replace('{place}', place) })

// 地図の地点の印を押し、着いて歩行ループが眠るまでを記録する
export const travelOnMap = async (place: string, goal: Saved): Promise<Recording> => {
  await openMap()
  const recording = startRecording(setId)
  await spotButton(place).click()
  await expect.element(map).not.toBeInTheDocument()
  await advanceUntil(sameSaved(goal), `${place} へ着く`, ARRIVE_MS)
  await expectLoopIdle()
  return stopRecording(recording)
}

// 飛び立つ(影が飛んでいる印を出す)まで時計を進める
export const waitForTakeOff = () => advanceUntil(() => flyingNow() === 'true', '飛び立つ')

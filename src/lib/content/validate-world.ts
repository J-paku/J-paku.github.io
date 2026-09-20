// 村ワールド(worldSet・地点文言)の整合性検査。純粋関数のみで、問題はread.tsがbuild時にthrowして落とす
import type { Locale } from '@content/types/content'
import type { World, WorldSet, Cell, Rect, VillageText } from '@content/types/world'
import { isWalkable, structureRect } from '@/lib/village/collision'

// 屋外の開始セル(自宅前)からどの会話地点までも、この歩数以内に収める。
// 町を 20×14 から 30×20 マスへ広げた分だけ上限も引き上げた。1マス256msなので16歩で約4秒
export const MAX_STEPS_TO_SPOT = 16
// 村の上限は「最初の町」相当(30×20マス・家4軒)。全部歩き回っても1分かからない大きさに留める
export const MAX_WORLD_WIDTH = 30
export const MAX_WORLD_HEIGHT = 20
export const MAX_HOUSES = 4

const key = (c: Cell): string => `${c.x},${c.y}`

const containsRect = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h

const rectInBounds = (world: World, r: Rect): boolean =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= world.width && r.y + r.h <= world.height

// 開始セルから 4 方向 BFS で各マスまでの最短歩数を返す
const stepsFromStart = (world: World): Map<string, number> => {
  const steps = new Map<string, number>([[key(world.start), 0]])
  const queue: Cell[] = [world.start]
  while (queue.length > 0) {
    const cur = queue.shift() as Cell
    const curSteps = steps.get(key(cur)) ?? 0
    for (const next of [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ]) {
      if (steps.has(key(next)) || !isWalkable(world, next)) continue
      steps.set(key(next), curSteps + 1)
      queue.push(next)
    }
  }
  return steps
}

// ワールド 1 つ分の検査。メッセージにはどのワールドかを必ず入れる
const validateWorld = (set: WorldSet, worldId: string, world: World): string[] => {
  const issues: string[] = []
  const at = (message: string): string => `ワールド "${worldId}": ${message}`

  if (world.width > MAX_WORLD_WIDTH || world.height > MAX_WORLD_HEIGHT)
    issues.push(
      at(
        `広さが上限 ${MAX_WORLD_WIDTH}x${MAX_WORLD_HEIGHT} を超えている(${world.width}x${world.height})`
      )
    )
  // 家の軒数は屋外だけの上限(屋内には家を置かない)
  if (world.kind === 'exterior') {
    const houses = world.structures.filter(s => s.kind === 'house')
    if (houses.length > MAX_HOUSES)
      issues.push(at(`家が上限 ${MAX_HOUSES} 軒を超えている(${houses.length})`))
  }
  if (world.tiles.length !== world.height) issues.push(at('tiles の行数が height と一致しない'))
  if (world.tiles.some(row => row.length !== world.width))
    issues.push(at('tiles の列数が width と一致しない'))

  // id は structures 内・spots 内でそれぞれ一意。地点が構造物と同じ id を名乗るのは許す
  // (spot.structureId で結ばれる同じ場所を指すため)
  for (const [label, list] of [
    ['構造物', world.structures],
    ['地点', world.spots],
  ] as const) {
    const ids = list.map(o => o.id)
    for (const id of ids) {
      const message = at(`${label}の id "${id}" が重複`)
      if (ids.filter(v => v === id).length > 1 && !issues.includes(message)) issues.push(message)
    }
  }

  // 家は solid(壁行)が area の中・扉が area の横幅の中にあること。他の構造物は占有マスがマップ内
  for (const structure of world.structures) {
    if (structure.kind === 'house') {
      if (!containsRect(structure.area, structure.solid))
        issues.push(at(`家 "${structure.id}" の solid が area の外にはみ出している`))
      const { area, doorX } = structure
      if (doorX < area.x || doorX + (structure.doorWidth ?? 1) > area.x + area.w)
        issues.push(at(`家 "${structure.id}" の扉 x=${doorX} が area の範囲外`))
      continue
    }
    if (!rectInBounds(world, structureRect(structure)))
      issues.push(at(`構造物 "${structure.id}" がマップ外にある`))
  }

  const structureIds = new Set(world.structures.map(s => s.id))
  for (const spot of world.spots) {
    if (!structureIds.has(spot.structureId))
      issues.push(at(`地点 "${spot.id}" の structureId "${spot.structureId}" が無い`))
    if (!isWalkable(world, spot.cell)) issues.push(at(`地点 "${spot.id}" の立ち位置が通行不可`))
  }
  if (!isWalkable(world, world.start)) issues.push(at('開始セルが通行不可'))

  // ワープは足元と移動先の両方が通行可でなければ、乗った瞬間に詰む
  for (const warp of world.warps) {
    // 足元が通行可(床)か、隣接マスから歩いて触れられる(壁の扉)ことを求める
    const reachable =
      isWalkable(world, warp.cell) ||
      [
        { x: warp.cell.x + 1, y: warp.cell.y },
        { x: warp.cell.x - 1, y: warp.cell.y },
        { x: warp.cell.x, y: warp.cell.y + 1 },
        { x: warp.cell.x, y: warp.cell.y - 1 },
      ].some(c => isWalkable(world, c))
    if (!reachable) issues.push(at(`ワープ "${warp.id}" に隣接する通路が無い`))
    const target = set.worlds[warp.target.worldId]
    if (target === undefined) {
      issues.push(at(`ワープ "${warp.id}" の移動先ワールド "${warp.target.worldId}" が無い`))
      continue
    }
    if (!isWalkable(target, warp.target.cell))
      issues.push(
        at(
          `ワープ "${warp.id}" の移動先 "${warp.target.worldId}" (${warp.target.cell.x},${warp.target.cell.y}) が通行不可`
        )
      )
  }

  // 訪問者を歩かせすぎないため、屋外ではどの会話地点も開始セルから MAX_STEPS_TO_SPOT 歩以内に置く
  if (world.kind !== 'exterior') return issues
  const steps = stepsFromStart(world)
  for (const spot of world.spots) {
    const spotSteps = steps.get(key(spot.cell))
    if (spotSteps === undefined) {
      issues.push(at(`地点 "${spot.id}" に開始セルから到達できない`))
    } else if (spotSteps > MAX_STEPS_TO_SPOT) {
      issues.push(at(`地点 "${spot.id}" が開始セルから ${spotSteps} 歩(上限 ${MAX_STEPS_TO_SPOT})`))
    }
  }
  return issues
}

export const validateWorldSet = (set: WorldSet): string[] => {
  const issues: string[] = []
  if (set.worlds[set.startWorldId] === undefined)
    issues.push(`開始ワールド "${set.startWorldId}" が worlds に無い`)
  for (const [worldId, world] of Object.entries(set.worlds)) {
    issues.push(...validateWorld(set, worldId, world))
  }
  // order は全ワールド通しの 1..n 連番で重複が無いこと(コース順の欠けは案内が途切れる)。
  // order の無い地点はコース外なので、この検査からは除く
  const spots = Object.values(set.worlds).flatMap(w => w.spots)
  const orderedSpots = spots.filter(s => s.order !== undefined)
  const orders = orderedSpots.map(s => s.order ?? 0).sort((a, b) => a - b)
  if (orders.some((v, i) => v !== i + 1))
    issues.push(`地点の order が全ワールド通しの 1..${orderedSpots.length} の連番になっていない`)
  return issues
}

// 文言の stops キーが全ワールドの spot id 集合と完全一致するか(片方だけの追加・削除を落とす)
export const validateVillageText = (set: WorldSet, text: VillageText, locale: Locale): string[] => {
  const issues: string[] = []
  const keys = new Set(Object.keys(text.stops))
  const spots = Object.values(set.worlds).flatMap(w => w.spots)
  for (const spot of spots) {
    if (!keys.has(spot.id)) issues.push(`${locale}: 地点 "${spot.id}" の文言が無い`)
  }
  const spotIds = new Set(spots.map(s => s.id))
  for (const k of keys) {
    if (!spotIds.has(k)) issues.push(`${locale}: 文言に未知の地点 "${k}" がある`)
  }
  return issues
}

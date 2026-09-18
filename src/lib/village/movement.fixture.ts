// step のテストが共有する3×3の最小ワールド。壁(water)と木を1マスずつ持つ
import type { World } from '@content/types/world'

export const world: World = {
  id: 't',
  kind: 'exterior',
  width: 3,
  height: 3,
  start: { x: 1, y: 1 },
  startFacing: 'up',
  tiles: [
    ['grass', 'grass', 'grass'],
    ['grass', 'grass', 'water'],
    ['grass', 'tree-tl', 'grass'],
  ],
  structures: [],
  spots: [],
  warps: [],
}
export const idle = { held: null, route: null, fast: false }

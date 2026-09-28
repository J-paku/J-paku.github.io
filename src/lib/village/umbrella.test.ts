// 扉の前後で傘を動かすかの planUmbrellaWarp・動きを伴わない傘の状態 restingUmbrella のテスト
import type { World } from '@content/types/world'
import { planUmbrellaWarp, restingUmbrella } from './umbrella'

const room: World = {
  id: 'room',
  kind: 'interior',
  width: 1,
  height: 1,
  start: { x: 0, y: 0 },
  startFacing: 'down',
  tiles: [['floor']],
  structures: [],
  spots: [],
  warps: [],
}
const town: World = { ...room, id: 'town', kind: 'exterior' }
// 屋外どうし・屋内どうしの移動を見るためのもう一つずつ
const field: World = { ...town, id: 'field' }
const attic: World = { ...room, id: 'attic' }

describe('planUmbrellaWarp', () => {
  it('雨の日に屋外から屋内へ入るときは、切り替える前に畳む', () => {
    expect(planUmbrellaWarp(town, room, true)).toBe('close-before')
  })
  it('雨の日に屋内から屋外へ出るときは、切り替えた後に広げる', () => {
    expect(planUmbrellaWarp(room, town, true)).toBe('open-after')
  })
  it('雨の日でも屋外どうし・屋内どうしの移動では傘を動かさない', () => {
    expect(planUmbrellaWarp(town, field, true)).toBe('none')
    expect(planUmbrellaWarp(room, attic, true)).toBe('none')
  })
  it('雨でなければどの組み合わせでも傘を動かさない', () => {
    for (const [from, to] of [
      [town, room],
      [room, town],
      [town, field],
      [room, attic],
    ] as const) {
      expect(planUmbrellaWarp(from, to, false), `${from.id} → ${to.id}`).toBe('none')
    }
  })
})

describe('restingUmbrella', () => {
  it('雨の屋外では時間表を持たない差したままの傘になる', () => {
    expect(restingUmbrella(town, true)).toEqual({ phase: 'open', since: 0 })
  })
  it('雨でない屋外・雨の屋内・雨でない屋内では傘を持たない', () => {
    expect(restingUmbrella(town, false)).toBeNull()
    expect(restingUmbrella(room, true)).toBeNull()
    expect(restingUmbrella(room, false)).toBeNull()
  })
})

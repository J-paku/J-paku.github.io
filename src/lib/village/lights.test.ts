// 夜の光源表 worldLights・PLAYER_LIGHT のテスト
import { vi } from 'vitest'
import type { Structure, World } from '@content/types/world'
import { facadeCells } from './facade'
import { NO_GLOW, PLAYER_LIGHT, worldLights, type LightKind, type LightSource } from './lights'
// 絵そのものを読むのはこのテストの中だけ。lights.ts はクライアントの束に入るので、
// あちらが sprites.ts を実行時に取り込むと node:crypto まで一緒に配られてしまう
import { LIGHT_KEYS } from '@/lib/pixel/palette-phase'
import { SPRITE_ARTS, SPRITE_NIGHT_ARTS } from '@/lib/pixel/sprites'

// server-only は Next.js のビルド境界専用ガードで、vitest(node 環境)では無条件に例外を投げる。
// テストでは中身を持たない mock に差し替え、読み込み専用の @/lib/content/read を素通しにする
vi.mock('server-only', () => ({}))

import { readWorldSet } from '@/lib/content/read'

// 実ワールドセットの町と自室を取得。無ければ即座に落とし、以降の型を World に保つ
const worlds = readWorldSet().worlds
const townOrUndefined = worlds.town
if (townOrUndefined === undefined) throw new Error('worldSet に town が無い')
const town: World = townOrUndefined
const roomOrUndefined = worlds.room
if (roomOrUndefined === undefined) throw new Error('worldSet に room が無い')
const room: World = roomOrUndefined

const byKind = (world: World, kind: LightKind): LightSource[] =>
  worldLights(world).filter(light => light.kind === kind)

// id で 1 つだけ取り出す。無ければその場で落として、以降の型を LightSource に保つ
const lightById = (world: World, id: string): LightSource => {
  const found = worldLights(world).find(light => light.id === id)
  if (found === undefined) throw new Error(`光源 "${id}" が無い`)
  return found
}

// 構造物だけを差し替える最小のワールド。地形は光源に関係しないので空でよい
const fakeWorld = (structures: Structure[]): World => ({
  id: 'fake',
  kind: 'exterior',
  width: 8,
  height: 8,
  start: { x: 0, y: 0 },
  startFacing: 'down',
  tiles: [],
  structures,
  spots: [],
  warps: [],
})

describe('worldLights (町)', () => {
  it('街灯 3 本ぶんの灯りが出る', () => {
    expect(byKind(town, 'lamp')).toHaveLength(3)
  })
  it('街灯の灯はマスの中央より少し下で、暖色の中くらいの灯りになる', () => {
    // 街灯は cell(= 上のマス)が灯、その真下が柱
    const lamp = lightById(town, 'lamp-west')
    expect(lamp).toMatchObject({ kind: 'lamp', radius: 2.6, intensity: 0.3, color: '#ffe8a8' })
    expect(lamp.x).toBeCloseTo(9.5)
    expect(lamp.y).toBeCloseTo(8.6)
    expect(lamp.flicker).toBeUndefined()
  })
  it('ポストの LED は 1 つで、マスの中央を弱く照らす', () => {
    expect(byKind(town, 'mailbox')).toHaveLength(1)
    const led = lightById(town, 'mailbox')
    expect(led).toMatchObject({ kind: 'mailbox', radius: 1.8, intensity: 0.22, color: '#f2e8ff' })
    expect(led.x).toBeCloseTo(24.5)
    expect(led.y).toBeCloseTo(14.55)
    expect(led.flicker).toBeUndefined()
  })
  it('ロボットは後光を出さない(隣の焚き火が同じ場所を照らす)', () => {
    expect(worldLights(town).filter(light => light.id === 'robot')).toEqual([])
  })
  it('焚き火の灯りは町に置かれた焚き火と同じ数だけ出る', () => {
    const placed = town.structures.filter(structure => structure.kind === 'campfire')
    // 町から焚き火が消えると 0 === 0 で素通りする検査になるので、まず置かれていることを押さえる
    expect(placed.length).toBeGreaterThan(0)
    expect(byKind(town, 'campfire')).toHaveLength(placed.length)
  })
  it('窓の灯りの数は facadeCells の窓マスと一致する', () => {
    const windowCells = town.structures
      .flatMap(structure => facadeCells(structure))
      .filter(({ key }) => key === 'window')
    // 町に窓が 1 枚も無ければこの検査は何も守らないので、まず窓の存在を押さえる
    expect(windowCells.length).toBeGreaterThan(0)
    expect(byKind(town, 'window')).toHaveLength(windowCells.length)
  })
  it('同じワールドを 2 回渡しても同じ並びになる', () => {
    expect(worldLights(town)).toEqual(worldLights(town))
  })
})

describe('worldLights (種類ごとの灯り)', () => {
  it('焚き火は大きな橙の灯りで、ゆらぎの印が付く', () => {
    const campfire: Structure = { id: 'fire', kind: 'campfire', cell: { x: 3, y: 4 } }
    const lights = worldLights(fakeWorld([campfire]))
    expect(lights).toHaveLength(1)
    const fire = lights[0]
    expect(fire).toMatchObject({
      id: 'fire',
      kind: 'campfire',
      radius: 3,
      intensity: 0.34,
      color: '#ffb464',
      flicker: true,
    })
    expect(fire.x).toBeCloseTo(3.5)
    expect(fire.y).toBeCloseTo(4.55)
  })
  it('家の窓は 1 マスごとに弱い灯りになり、id にマスが入る', () => {
    // 幅 4・壁 2 段の家は壁の最上段の (3,3) だけが窓(facade.test.ts と同じ形)
    const house: Structure = {
      id: 'h',
      kind: 'house',
      roof: 'red',
      area: { x: 2, y: 2, w: 4, h: 3 },
      solid: { x: 2, y: 3, w: 4, h: 2 },
      doorX: 3,
    }
    const lights = worldLights(fakeWorld([house]))
    expect(lights.map(light => light.id)).toEqual(['h:win:3,3'])
    expect(lights[0]).toMatchObject({
      kind: 'window',
      radius: 1.6,
      intensity: 0.18,
      color: '#ffeec8',
    })
    expect(lights[0].flicker).toBeUndefined()
  })
  it('灯りを持たない構造物は光源を出さない', () => {
    const robot: Structure = { id: 'r', kind: 'robot', cell: { x: 1, y: 1 } }
    const desk: Structure = { id: 'd', kind: 'desk', cell: { x: 3, y: 1 } }
    expect(worldLights(fakeWorld([robot, desk]))).toEqual([])
  })
  it('屋内(自室)は光源を持たない', () => {
    expect(worldLights(room)).toEqual([])
  })
})

// ---- 発光する絵と後光の突き合わせ ----
// 「絵が光る」(パレットの 4~9 を使う)と「周りを照らす後光が付く」は別々に決まる話で、
// 両者を繋ぐ検査がこれまで無かった。そのため経歴碑の星だけが光って足元は暗いまま、という
// 食い違いが誰にも気付かれずに残った。ここで「発光する絵を持つ種類は、後光を出すか
// NO_GLOW に名前があるかのどちらか」を固定し、次に発光素材を足す人へ必ず判断させる

// 種類ごとの見本。Record なので Structure へ種類を足すとここが型検査で落ち、
// 新しい種類が下の突き合わせからこぼれ落ちない
const SAMPLES: Record<Structure['kind'], Structure> = {
  // 幅 4・壁 2 段。壁の最上段の (3,3) だけが窓になる
  house: {
    id: 'house',
    kind: 'house',
    roof: 'red',
    area: { x: 2, y: 2, w: 4, h: 3 },
    solid: { x: 2, y: 3, w: 4, h: 2 },
    doorX: 3,
  },
  robot: { id: 'robot', kind: 'robot', cell: { x: 1, y: 1 } },
  mailbox: { id: 'mailbox', kind: 'mailbox', cell: { x: 1, y: 1 } },
  desk: { id: 'desk', kind: 'desk', cell: { x: 1, y: 1 } },
  bed: { id: 'bed', kind: 'bed', cell: { x: 1, y: 1 } },
  table: { id: 'table', kind: 'table', cell: { x: 1, y: 1 } },
  monument: { id: 'monument', kind: 'monument', cell: { x: 1, y: 1 } },
  stele: { id: 'stele', kind: 'stele', cell: { x: 1, y: 1 } },
  lamp: { id: 'lamp', kind: 'lamp', cell: { x: 1, y: 1 } },
  campfire: { id: 'campfire', kind: 'campfire', cell: { x: 1, y: 1 } },
}

// その種類の絵が灯り用の文字を 1 つでも使うか。種類 → スプライトの鍵の対応は facadeCells が
// 唯一の正本なので、ここで並べ直さない(窓が家の一部であることも facadeCells だけが知っている)
// 夜だけ差し替わる絵(ポストの LED など)も数える。昼の絵だけを見ると、夜に光る素材が
// この突き合わせからまるごと漏れてしまう
const hasLitSprite = (structure: Structure): boolean =>
  facadeCells(structure).some(({ key }) =>
    [SPRITE_ARTS[key], SPRITE_NIGHT_ARTS[key]].some(art =>
      LIGHT_KEYS.some(char => art.join('').includes(char))
    )
  )

// その種類が後光を出すか。表を覗かず worldLights の結果で見るので、窓のように
// 表ではなく facadeCells 経由で灯る作りもそのまま「出す」と数えられる
const emitsLight = (structure: Structure): boolean => worldLights(fakeWorld([structure])).length > 0

describe('発光する絵と後光', () => {
  it('発光する絵を持つ種類は、後光を出すか NO_GLOW に名前があるかのどちらかになる', () => {
    const lit = Object.values(SAMPLES).filter(structure => hasLitSprite(structure))
    // 発光素材が 1 つも無ければこの検査は何も守らないので、まず存在を押さえる
    expect(lit.length).toBeGreaterThan(0)

    const undecided = lit
      .filter(structure => !emitsLight(structure))
      .filter(structure => !NO_GLOW.some(kind => kind === structure.kind))
      .map(structure => structure.kind)

    expect(undecided).toEqual([])
  })
  it('NO_GLOW に載るのは「発光する絵を持つのに照らさない」種類だけ', () => {
    // 照らさない理由が無い種類(そもそも光らない絵)を並べて検査を黙らせることも、
    // 後光を出す種類をここへ書いて自己矛盾させることもできないようにする
    const actual = NO_GLOW.map(kind => ({
      kind,
      lit: hasLitSprite(SAMPLES[kind]),
      glows: emitsLight(SAMPLES[kind]),
    }))

    expect(actual).toEqual(NO_GLOW.map(kind => ({ kind, lit: true, glows: false })))
  })
})

describe('PLAYER_LIGHT', () => {
  it('主人公のランタンは街灯と同じ暖色で、少し狭く照らす', () => {
    expect(PLAYER_LIGHT).toEqual({ radius: 2.5, intensity: 0.3, color: '#ffe8a8' })
  })
})

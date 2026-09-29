// JS前と切り替え直後の見た目(initialView・cellShift)のテスト。
// rAFが回り出すまでの土台なので、開始マス・向き・カメラ・ミニマップ枠の寸法が実データのワールドから正しく組まれるかを見る
import { describe, expect, it, vi } from 'vitest'
import type { Direction, World } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import { cellShift, initialView } from './initial-view'
import { VIEW_COLS, VIEW_ROWS, cameraOffset } from './stage-scale'

// server-onlyはvitest(node環境)では無条件に例外を投げるので、中身を持たないmockに差し替える
vi.mock('server-only', () => ({}))

import { readWorldSet } from '@/lib/content/read'

const worlds = Object.values(readWorldSet().worlds)
const worldOf = (kind: World['kind']): World => {
  const world = worlds.find(w => w.kind === kind)
  if (world === undefined) throw new Error(`kindが${kind}のワールドが無い`)
  return world
}
const interior = worldOf('interior')
const exterior = worldOf('exterior')
// 向きだけを差し替える。開始の向きは実データの都合で変わるので、見たい向きはテストで決める
const facing = (world: World, startFacing: Direction): World => ({ ...world, startFacing })

// 村のシートと主人公のシート。同じ鍵に別の添字を持たせ、どちらのシートを引いたかを見分ける
const sprites: SheetLayout = {
  index: { locator: 9, 'player-down-0': 20 },
  count: 50,
  tile: 16,
  height: 16,
}
const playerSprites: SheetLayout = {
  index: { 'player-down-0': 2, 'player-up-0': 4, 'player-right-0': 6, locator: 1 },
  count: 30,
  tile: 16,
  height: 16,
}

describe('cellShift', () => {
  it('マスのx・yを--cell倍のtranslateへ書く', () => {
    expect(cellShift({ x: 3, y: 7 })).toBe(
      'translate(calc(var(--cell) * 3), calc(var(--cell) * 7))'
    )
  })

  it('原点のマスは0のまま書く', () => {
    expect(cellShift({ x: 0, y: 0 })).toBe(
      'translate(calc(var(--cell) * 0), calc(var(--cell) * 0))'
    )
  })
})

describe('initialView', () => {
  it('屋外のワールドはoutdoorsが真、屋内は偽', () => {
    expect(initialView(exterior, sprites, playerSprites, false).outdoors).toBe(true)
    expect(initialView(interior, sprites, playerSprites, false).outdoors).toBe(false)
  })

  it('rootStyleは表示枠のマス数と、2枚のシートそれぞれの枚数を持つ', () => {
    expect(initialView(exterior, sprites, playerSprites, false).rootStyle).toStrictEqual({
      '--cols': VIEW_COLS,
      '--rows': VIEW_ROWS,
      '--count': 50,
      '--player-count': 30,
    })
  })

  it('屋外のミニマップ枠は1マス4pxに内側余白と枠の8pxを足した寸法', () => {
    expect(initialView(exterior, sprites, playerSprites, false).frameStyle).toStrictEqual({
      '--minimap-w': `${exterior.width * 4 + 8}px`,
      '--minimap-h': `${exterior.height * 4 + 8}px`,
    })
  })

  it('屋内はミニマップを持たないので枠の寸法は0px', () => {
    expect(initialView(interior, sprites, playerSprites, false).frameStyle).toStrictEqual({
      '--minimap-w': '0px',
      '--minimap-h': '0px',
    })
  })

  it('startShiftは開始マスのtranslateで、目印(locatorStyle)も同じ文字列を受け取る', () => {
    const view = initialView(exterior, sprites, playerSprites, false)
    const { x, y } = exterior.start
    expect(view.startShift).toBe(`translate(calc(var(--cell) * ${x}), calc(var(--cell) * ${y}))`)
    expect(view.locatorStyle).toStrictEqual({ transform: view.startShift })
  })

  it('下向きで始まる主人公は反転せず、主人公のシートの下向きの立ちコマを使う', () => {
    const view = initialView(facing(exterior, 'down'), sprites, playerSprites, false)
    expect(view.startPose).toEqual({ key: 'player-down-0', flip: false, animating: false })
    expect(view.playerStyle).toStrictEqual({ transform: view.startShift, '--i': 2 })
  })

  it('上向きで始まる主人公は上向きの立ちコマを使う', () => {
    const view = initialView(facing(interior, 'up'), sprites, playerSprites, false)
    expect(view.startPose.key).toBe('player-up-0')
    expect(view.playerStyle).toStrictEqual({ transform: view.startShift, '--i': 4 })
  })

  it('左向きで始まる主人公は右向きのコマを左右反転して描く', () => {
    const view = initialView(facing(exterior, 'left'), sprites, playerSprites, false)
    expect(view.startPose).toEqual({ key: 'player-right-0', flip: true, animating: false })
    expect(view.playerStyle).toStrictEqual({
      transform: `${view.startShift} scaleX(-1)`,
      '--i': 6,
    })
  })

  it('右向きは同じ右向きのコマを反転せずに描く', () => {
    const view = initialView(facing(exterior, 'right'), sprites, playerSprites, false)
    expect(view.playerStyle).toStrictEqual({ transform: view.startShift, '--i': 6 })
  })

  it('動きを控える設定でも開始の姿勢は同じ(止まっているので歩行のコマを使わない)', () => {
    const moving = initialView(facing(exterior, 'left'), sprites, playerSprites, false)
    const reduced = initialView(facing(exterior, 'left'), sprites, playerSprites, true)
    expect(reduced.startPose).toEqual(moving.startPose)
    expect(reduced.playerStyle).toStrictEqual(moving.playerStyle)
  })

  it('worldStyleはワールド全体の寸法と、開始マスを追うカメラの原点を逆向きにずらすtransform', () => {
    const cam = cameraOffset(exterior, exterior.start)
    // カメラが原点(0,0)のままだと符号の取り違えを見逃すので、実データの開始マスで原点がずれていることを先に確かめる
    expect(cam.x > 0 || cam.y > 0).toBe(true)
    expect(initialView(exterior, sprites, playerSprites, false).worldStyle).toStrictEqual({
      width: `calc(var(--cell) * ${exterior.width})`,
      height: `calc(var(--cell) * ${exterior.height})`,
      transform: `translate(calc(var(--cell) * ${-cam.x}), calc(var(--cell) * ${-cam.y}))`,
    })
  })

  it('開始マスが右下の角ならカメラはワールドの端で止まる', () => {
    const corner: World = {
      ...exterior,
      start: { x: exterior.width - 1, y: exterior.height - 1 },
    }
    // 表示枠より広い屋外では、原点の上限は(幅-表示列数, 高さ-表示行数)
    const maxX = exterior.width - VIEW_COLS
    const maxY = exterior.height - VIEW_ROWS
    expect(maxX).toBeGreaterThan(0)
    expect(maxY).toBeGreaterThan(0)
    expect(initialView(corner, sprites, playerSprites, false).worldStyle.transform).toBe(
      `translate(calc(var(--cell) * -${maxX}), calc(var(--cell) * -${maxY}))`
    )
  })

  it('locatorSpriteStyleは主人公のシートではなく村のシートの目印の添字を使う', () => {
    expect(initialView(exterior, sprites, playerSprites, false).locatorSpriteStyle).toStrictEqual({
      '--i': 9,
    })
  })
})
